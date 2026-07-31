// Create a Stripe Checkout Session for what a client still owes RIGHT NOW.
//
// Checkout Sessions are immutable: the amount is baked in when the session is
// created. A link created at invoice time therefore keeps charging the original
// total even after the client has bank-transferred part of it — which is how an
// AED 1,050 invoice collected AED 1,139. So the amount has to be resolved at
// click time, which is what this does.
//
// Server-only: pulls in the Stripe SDK and the service-role Supabase client.

import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/integrations/stripe/server";
import { invoiceTotalFor } from "@/lib/finance/outstandingBalance";
import { appBaseUrl } from "@/lib/finance/paymentLink";

/** Sub-cent remainders are rounding noise, not a debt. */
export const BALANCE_EPSILON = 0.01;

export type BalanceCheckout =
  | { ok: false; status: number; error: string }
  | { ok: true; settled: true; balanceDue: number; currency: string; invoiceTotal: number; totalPaid: number }
  | {
      ok: true;
      settled: false;
      url: string;
      sessionId: string;
      balanceDue: number;
      currency: string;
      invoiceTotal: number;
      totalPaid: number;
    };

/**
 * Outstanding balance for a single proposal: the VAT-inclusive invoice total
 * (single source of truth in outstandingBalance.ts) minus everything recorded
 * against it in proposal_payments, whatever the method.
 */
export async function outstandingBalanceForProposal(
  supabaseAdmin: SupabaseClient,
  proposalId: string
): Promise<
  | { ok: false; status: number; error: string }
  | { ok: true; proposal: Record<string, unknown>; invoiceTotal: number; totalPaid: number; balanceDue: number }
> {
  const { data: proposal, error: proposalError } = await supabaseAdmin
    .from("proposals")
    .select("id, amount, currency, line_items, status, invoice_number, lead_id")
    .eq("id", proposalId)
    .single();

  if (proposalError || !proposal) {
    return { ok: false, status: 404, error: "Invoice not found" };
  }

  if (proposal.status === "cancelled") {
    return { ok: false, status: 409, error: "This invoice has been cancelled" };
  }

  const { data: payments, error: paymentsError } = await supabaseAdmin
    .from("proposal_payments")
    .select("amount")
    .eq("proposal_id", proposalId);

  if (paymentsError) {
    // Never guess the balance — guessing high double-charges the client and
    // guessing low leaves money uncollected.
    return { ok: false, status: 500, error: "Could not read payment history" };
  }

  const invoiceTotal = invoiceTotalFor({
    id: proposal.id,
    amount: proposal.amount,
    currency: proposal.currency,
    line_items: proposal.line_items,
    status: proposal.status,
  });

  const totalPaid = (payments || []).reduce(
    (sum: number, p: { amount: number | string | null }) => sum + (Number(p.amount) || 0),
    0
  );

  return {
    ok: true,
    proposal,
    invoiceTotal,
    totalPaid,
    balanceDue: invoiceTotal - totalPaid,
  };
}

/**
 * Resolve the balance and, if anything is still owed, mint a fresh Checkout
 * Session for exactly that amount.
 *
 * The metadata (proposalId / leadEmail / leadName) is what the Stripe webhook
 * reads to record the payment — without proposalId the webhook rejects the
 * event outright, so it must always be present.
 */
export async function createBalanceCheckoutSession(
  supabaseAdmin: SupabaseClient,
  proposalId: string
): Promise<BalanceCheckout> {
  const balance = await outstandingBalanceForProposal(supabaseAdmin, proposalId);
  if (!balance.ok) return balance;

  const proposal = balance.proposal as {
    id: string;
    currency: string | null;
    invoice_number: string | null;
    lead_id: string | null;
  };
  const currency = proposal.currency || "AED";

  if (balance.balanceDue <= BALANCE_EPSILON) {
    return {
      ok: true,
      settled: true,
      balanceDue: 0,
      currency,
      invoiceTotal: balance.invoiceTotal,
      totalPaid: balance.totalPaid,
    };
  }

  // Smallest currency unit. Round once, here, so the figure Stripe charges and
  // the figure we later compare against the invoice total agree to the cent.
  const unitAmount = Math.round(balance.balanceDue * 100);
  if (unitAmount <= 0) {
    return {
      ok: true,
      settled: true,
      balanceDue: 0,
      currency,
      invoiceTotal: balance.invoiceTotal,
      totalPaid: balance.totalPaid,
    };
  }

  const { data: lead } = proposal.lead_id
    ? await supabaseAdmin
        .from("leads")
        .select("full_name, email")
        .eq("id", proposal.lead_id)
        .single()
    : { data: null };

  const leadEmail: string | undefined = lead?.email || undefined;
  const leadName: string = lead?.full_name || "";

  const partial = balance.totalPaid > 0;
  const baseUrl = appBaseUrl();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    ...(leadEmail ? { customer_email: leadEmail } : {}),
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: "Just Wills - Legal Services",
            description: partial
              ? `Invoice ${proposal.invoice_number ?? ""} — remaining balance`.trim()
              : `Invoice ${proposal.invoice_number ?? ""} for ${leadName || "client"}`.trim(),
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    // The webhook cannot function without proposalId.
    metadata: {
      proposalId: proposal.id,
      leadEmail: leadEmail ?? "",
      leadName,
    },
    success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/payment/cancelled`,
  });

  if (!session.url) {
    return { ok: false, status: 502, error: "Stripe did not return a checkout URL" };
  }

  return {
    ok: true,
    settled: false,
    url: session.url,
    sessionId: session.id,
    balanceDue: unitAmount / 100,
    currency,
    invoiceTotal: balance.invoiceTotal,
    totalPaid: balance.totalPaid,
  };
}
