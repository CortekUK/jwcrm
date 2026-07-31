// GET/POST /api/pay/[proposalId]
//
// The one payment link. Every "Pay now" button — in the invoice email, the
// invoice PDF, the CRM and the finance table — points here rather than at a
// stored Stripe URL, because a stored Stripe URL charges whatever the invoice
// totalled the day it was created and cannot know about a later bank transfer.
//
// GET  → 302 to a freshly-minted Stripe Checkout for the CURRENT balance.
//        This is the form used by emails and PDFs, where the link is static and
//        sitting in the client's inbox for weeks.
// POST → the same decision as JSON, for in-app callers that want to show the
//        "already settled" message themselves.
//
// Deliberately unauthenticated: the client paying the invoice is not a CRM
// user. The proposal id is an unguessable UUID, and the only thing this route
// will ever do is offer to take money for an invoice that is genuinely
// outstanding — it exposes no client data in the GET path.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createBalanceCheckoutSession } from "@/lib/finance/balanceCheckout";
import { appBaseUrl } from "@/lib/finance/paymentLink";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ proposalId: string }> }
) {
  const { proposalId } = await context.params;
  const baseUrl = appBaseUrl();

  try {
    const result = await createBalanceCheckoutSession(supabaseAdmin, proposalId);

    if (!result.ok) {
      return NextResponse.redirect(
        `${baseUrl}/payment/settled?reason=unavailable`,
        { status: 302 }
      );
    }

    if (result.settled) {
      return NextResponse.redirect(`${baseUrl}/payment/settled`, { status: 302 });
    }

    return NextResponse.redirect(result.url, { status: 302 });
  } catch (error) {
    console.error("pay link resolution failed:", error);
    return NextResponse.redirect(
      `${baseUrl}/payment/settled?reason=unavailable`,
      { status: 302 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ proposalId: string }> }
) {
  const { proposalId } = await context.params;

  try {
    const result = await createBalanceCheckoutSession(supabaseAdmin, proposalId);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (result.settled) {
      return NextResponse.json({
        settled: true,
        balanceDue: 0,
        currency: result.currency,
        invoiceTotal: result.invoiceTotal,
        totalPaid: result.totalPaid,
      });
    }

    return NextResponse.json({
      settled: false,
      url: result.url,
      sessionId: result.sessionId,
      balanceDue: result.balanceDue,
      currency: result.currency,
      invoiceTotal: result.invoiceTotal,
      totalPaid: result.totalPaid,
    });
  } catch (error) {
    console.error("pay link resolution failed:", error);
    return NextResponse.json({ error: "Could not start payment" }, { status: 500 });
  }
}
