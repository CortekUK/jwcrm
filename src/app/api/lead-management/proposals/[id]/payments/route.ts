import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCanManageLeadDeal } from "@/lib/lead-management/proposalInvoice";
import { applyPaymentSideEffects } from "@/lib/finance/applyPaymentSideEffects";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Records a payment against a proposal/invoice (client request: track partial
// payments — e.g. drafting fee now, court fees + VAT later — and keep the
// invoice "open" with a visible balance until it's fully paid).
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proposalId } = await context.params;

    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: userInfo, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userInfo?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const callerId = userInfo.user.id;

    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amount);
    const method = (body.method || "").toString().trim();
    const notes = body.notes ? body.notes.toString() : null;
    const paidAt = body.paid_at ? new Date(body.paid_at).toISOString() : new Date().toISOString();

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
    }
    if (!method) {
      return NextResponse.json({ error: "Payment method is required" }, { status: 400 });
    }

    const { data: proposal, error: proposalError } = await supabaseAdmin
      .from("proposals")
      .select("*, lead:leads(id, assigned_to)")
      .eq("id", proposalId)
      .single();
    if (proposalError || !proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const lead = (proposal as any).lead;
    const auth = await assertCanManageLeadDeal(supabaseAdmin, callerId, lead ?? {});
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data: payment, error: insertError } = await supabaseAdmin
      .from("proposal_payments")
      .insert({
        proposal_id: proposalId,
        amount,
        method,
        notes,
        paid_at: paidAt,
        recorded_by: callerId,
      })
      .select()
      .single();
    if (insertError || !payment) {
      console.error("Error recording payment:", insertError);
      return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
    }

    // Settling the invoice, moving the lead and opening the client portal are
    // shared with the Stripe webhook, so a bank transfer recorded here produces
    // exactly the same outcome as a card payment — including creating the
    // portal account once the drafting fee is covered.
    const result = await applyPaymentSideEffects(supabaseAdmin, proposalId, {
      trigger: "manual",
    });

    if (!result.ok) {
      // The payment row is already saved; only the follow-on work failed.
      console.error("Post-payment processing failed:", result.error);
      return NextResponse.json(
        { error: result.error, payment, paymentRecorded: true },
        { status: result.status }
      );
    }

    const { stageState, provisioned } = result;

    return NextResponse.json({
      success: true,
      payment,
      invoiceTotal: stageState.amounts.invoiceTotal,
      totalPaid: stageState.totalPaid,
      balanceDue: Math.max(0, stageState.balanceDue),
      status: result.proposalStatus,
      leadStatus: result.leadStatus,
      stage: stageState.stage,
      upfrontTotal: stageState.amounts.upfrontTotal,
      amountDue: stageState.amountDue,
      // Surfaced so the dialog can tell the user the portal was opened — and so
      // a provisioning failure is visible rather than silently logged.
      portal: provisioned.status,
      portalError: provisioned.status === "failed" ? provisioned.error : undefined,
    });
  } catch (error) {
    console.error("Error in record payment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
