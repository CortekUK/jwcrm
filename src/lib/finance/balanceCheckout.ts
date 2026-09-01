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
import { invoiceAmountsFor } from "@/lib/finance/outstandingBalance";
import {
  resolvePaymentStage,
  sumPayments,
  BALANCE_EPSILON,
  type PaymentStage,
  type StageState,
} from "@/lib/finance/invoiceAmounts";
import { appBaseUrl } from "@/lib/finance/paymentLink";

export { BALANCE_EPSILON };

type StageFigures = {
  stage: PaymentStage;
  /** What this checkout charges — the stage cost, not the whole balance. */
  amountDue: number;
  upfrontTotal: number;
  laterTotal: number;
};

export type BalanceCheckout =
  | { ok: false; status: number; error: string }
  | ({
      ok: true;
      settled: true;
      balanceDue: number;
      currency: string;
      invoiceTotal: number;
      totalPaid: number;
    } & StageFigures)
  | ({
      ok: true;
      settled: false;
      url: string;
      sessionId: string;
      balanceDue: number;
      currency: string;
      invoiceTotal: number;
      totalPaid: number;
    } & StageFigures);

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
  | {
      ok: true;
      proposal: Record<string, unknown>;
      invoiceTotal: number;
      totalPaid: number;
      balanceDue: number;
      stageState: StageState;
    }
> {
  const { data: proposal, error: proposalError } = await supabaseAdmin
    .from("proposals")
    // vat_rate/vat_amount are required: without them this would price the
    // invoice at the default 5% and charge something different from the PDF.
    .select(
      "id, amount, currency, line_items, status, invoice_number, lead_id, vat_rate, vat_amount"
    )
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

  const amounts = invoiceAmountsFor({
    id: proposal.id,
    amount: proposal.amount,
    currency: proposal.currency,
    line_items: proposal.line_items,
    status: proposal.status,
    vat_rate: proposal.vat_rate,
    vat_amount: proposal.vat_amount,
  });

  const totalPaid = sumPayments(payments);
  const stageState = resolvePaymentStage(amounts, totalPaid);

  return {
    ok: true,
    proposal,
    invoiceTotal: amounts.invoiceTotal,
    totalPaid,
    balanceDue: stageState.balanceDue,
    stageState,
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
  const { stageState } = balance;
  const { amounts } = stageState;

  const stageFigures: StageFigures = {
    stage: stageState.stage,
    amountDue: stageState.amountDue,
    upfrontTotal: amounts.upfrontTotal,
    laterTotal: amounts.laterTotal,
  };

  const settledResult = {
    ok: true as const,
    settled: true as const,
    balanceDue: 0,
    currency,
    invoiceTotal: balance.invoiceTotal,
    totalPaid: balance.totalPaid,
    ...stageFigures,
    amountDue: 0,
  };

  if (stageState.fullySettled) return settledResult;

  // Charge the CURRENT STAGE, not the whole outstanding balance: on a staged
  // invoice the client pays the drafting fee now and the court fees later.
  // On an unstaged invoice amountDue is the full balance, exactly as before.
  //
  // Smallest currency unit. Round once, here, so the figure Stripe charges and
  // the figure we later compare against the invoice total agree to the cent.
  const unitAmount = Math.round(stageState.amountDue * 100);
  if (unitAmount <= 0) return settledResult;

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

  // Say which stage this payment covers, so the client can see on the Stripe
  // page that they are being asked for the drafting fee rather than the lot.
  const invoiceRef = proposal.invoice_number ?? "";
  const description =
    stageState.stage === "upfront"
      ? `Invoice ${invoiceRef} — will drafting fee (payable now)`.trim()
      : partial
        ? `Invoice ${invoiceRef} — remaining balance`.trim()
        : `Invoice ${invoiceRef} for ${leadName || "client"}`.trim();

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
            description,
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
    balanceDue: stageState.balanceDue,
    currency,
    invoiceTotal: balance.invoiceTotal,
    totalPaid: balance.totalPaid,
    ...stageFigures,
    // Report exactly what Stripe was told to charge, post-rounding.
    amountDue: unitAmount / 100,
  };
}
