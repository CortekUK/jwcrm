import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/integrations/stripe/server";

/**
 * Confirms a Checkout Session with Stripe.
 *
 * The success page used to show "Payment received" after a hardcoded 2 second
 * timer, so opening /payment/success directly — with no session_id at all —
 * rendered a successful payment. This is the only authority for that claim.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");

  if (!sessionId || !sessionId.startsWith("cs_")) {
    return NextResponse.json(
      { paid: false, error: "missing_session_id" },
      { status: 400 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return NextResponse.json({
      paid: session.payment_status === "paid",
      payment_status: session.payment_status,
      status: session.status,
      customer_email:
        session.customer_details?.email ?? session.customer_email ?? null,
    });
  } catch (error) {
    console.error("Error verifying Stripe checkout session:", error);
    return NextResponse.json(
      { paid: false, error: "verification_failed" },
      { status: 502 }
    );
  }
}
