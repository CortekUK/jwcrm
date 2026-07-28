import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { companyDetails } from "@/config/company";
import { normalizeLineItems, lineItemsSubtotal } from "@/lib/pdf/invoiceLineItems";
import { assertCanManageLeadDeal } from "@/lib/lead-management/proposalInvoice";

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

    // Recompute balance: invoice total INCLUDING VAT (matches how the
    // invoice PDF/email already compute the client's real amount due) minus
    // everything paid so far.
    const items = normalizeLineItems(
      (proposal as any).line_items,
      (proposal as any).amount
    );
    const subtotal = lineItemsSubtotal(items);
    const vatAmount = subtotal * (companyDetails.vatRate / 100);
    const invoiceTotal = subtotal + vatAmount;

    const { data: allPayments, error: sumError } = await supabaseAdmin
      .from("proposal_payments")
      .select("amount")
      .eq("proposal_id", proposalId);
    if (sumError) {
      console.error("Error summing payments:", sumError);
    }
    const totalPaid = (allPayments || []).reduce(
      (sum: number, p: { amount: number }) => sum + Number(p.amount),
      0
    );
    const balanceDue = Math.max(0, invoiceTotal - totalPaid);

    // Fully covered (small epsilon for floating-point rounding) -> mark paid.
    let newStatus = (proposal as any).status;
    if (balanceDue < 0.01) {
      newStatus = "paid";
      await supabaseAdmin
        .from("proposals")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", proposalId);
    }

    return NextResponse.json({
      success: true,
      payment,
      invoiceTotal,
      totalPaid,
      balanceDue,
      status: newStatus,
    });
  } catch (error) {
    console.error("Error in record payment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
