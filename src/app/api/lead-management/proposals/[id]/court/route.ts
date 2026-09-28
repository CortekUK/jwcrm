// POST /api/lead-management/proposals/[id]/court
//
// The team setting, changing or clearing the registration court on a proposal
// that offers several. The client's own choice is final on their side — if
// they want a different court they ask, and this is how the team makes the
// change. It is also how the team records a court the client gave by phone.
//
// Body: { court: "abu_dhabi" | "dubai" | "difc" | null }. The rules live in
// planCourtChange (lead-management/courtChange.ts) so they can be tested
// without a database. Never touches accepted_at: changing the court on the
// client's behalf is not the client accepting, and un-accepting them because
// the team corrected a fee would be wrong the other way.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCanManageLeadDeal } from "@/lib/lead-management/proposalInvoice";
import { planCourtChange } from "@/lib/lead-management/courtChange";
import { COURT_LABELS } from "@/lib/lead-management/courtOptions";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const { data: proposal, error: proposalError } = await supabaseAdmin
      .from("proposals")
      .select("id, status, invoiced_at, line_items, court_options, lead:leads(id, assigned_to)")
      .eq("id", proposalId)
      .maybeSingle();
    if (proposalError || !proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const rawLead = (proposal as unknown as {
      lead: { id: string; assigned_to: string | null } | { id: string; assigned_to: string | null }[] | null;
    }).lead;
    const lead = Array.isArray(rawLead) ? rawLead[0] : rawLead;

    const auth = await assertCanManageLeadDeal(supabaseAdmin, callerId, lead ?? {});
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const decision = planCourtChange(
      {
        status: proposal.status as string | null,
        invoiced_at: proposal.invoiced_at as string | null,
        line_items: proposal.line_items,
        court_options: (proposal as { court_options?: unknown }).court_options,
      },
      body && typeof body === "object" && "court" in body ? body.court : undefined
    );
    if (!decision.ok) {
      return NextResponse.json({ error: decision.error }, { status: decision.status });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("proposals")
      .update({
        line_items: decision.lineItems,
        amount: decision.amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", proposalId)
      // Re-assert the 409 rules in the write itself: an invoice raised between
      // the read above and this update must not have its proposal rewritten.
      .is("invoiced_at", null)
      .not("status", "in", "(paid,cancelled)")
      .select("id, line_items, amount");
    if (updateError) {
      console.error("Could not change the proposal court:", updateError);
      return NextResponse.json({ error: "Could not save the court" }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        {
          error:
            "The invoice has been raised for this proposal — change the court fee on the invoice instead.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      line_items: decision.lineItems,
      amount: decision.amount,
      court: decision.court
        ? { court: decision.court, label: COURT_LABELS[decision.court] }
        : null,
    });
  } catch (error) {
    console.error("Court change failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
