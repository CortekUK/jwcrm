import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Public (unauthenticated) lead intake endpoint. Backs the QR-code intake form
// so prospects can submit their details straight into the CRM. Uses the service
// role key server-side; never exposes it to the client.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const INTAKE_SOURCE_NAME = "QR Form";

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const full_name = (body.full_name || "").toString().trim();
    const email = (body.email || "").toString().trim();
    const phone = (body.phone || "").toString().trim();
    const company_name = (body.company_name || "").toString().trim();
    const notes = (body.notes || "").toString().trim();
    const lead_type = body.lead_type === "corporate" ? "corporate" : "individual";

    // Validation
    if (full_name.length < 2) {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    }
    if (!isEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
    }

    // Resolve the QR Form source (created via migration/seed)
    const { data: source } = await supabaseAdmin
      .from("lead_sources")
      .select("id")
      .eq("name", INTAKE_SOURCE_NAME)
      .maybeSingle();
    const sourceId = source?.id ?? null;

    // Auto-assign by round-robin (least-loaded). Prefer salespeople linked to
    // this lead's source; if the source has none, fall back to ALL salespeople
    // so a public/QR lead is never left unassigned.
    let candidateIds: string[] = [];
    if (sourceId) {
      const { data: assignments } = await supabaseAdmin
        .from("source_salesperson_assignments")
        .select("salesperson_id")
        .eq("source_id", sourceId);
      candidateIds = (assignments || []).map((a) => a.salesperson_id);
    }
    if (candidateIds.length === 0) {
      // Fallback: every user with the salesperson role.
      const { data: roleRows } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "salesperson");
      candidateIds = (roleRows || []).map((r) => r.user_id);
    }

    let assignedTo: string | null = null;
    if (candidateIds.length === 1) {
      assignedTo = candidateIds[0];
    } else if (candidateIds.length > 1) {
      const { data: counts } = await supabaseAdmin
        .from("leads")
        .select("assigned_to")
        .in("assigned_to", candidateIds);
      const map: Record<string, number> = Object.fromEntries(
        candidateIds.map((i) => [i, 0])
      );
      (counts || []).forEach((l) => {
        if (l.assigned_to && map[l.assigned_to] !== undefined) map[l.assigned_to]++;
      });
      assignedTo = candidateIds.reduce(
        (best, i) => (map[i] < map[best] ? i : best),
        candidateIds[0]
      );
    }
    const assignedAt = assignedTo ? new Date().toISOString() : null;

    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .insert({
        full_name,
        email,
        phone: phone || null,
        company_name: company_name || null,
        lead_type,
        source_id: sourceId,
        source: INTAKE_SOURCE_NAME,
        notes: notes || null,
        status: "not_started",
        assigned_to: assignedTo,
        assigned_at: assignedAt,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Public intake insert error:", error);
      return NextResponse.json({ error: "Could not submit. Please try again." }, { status: 500 });
    }

    // Mirror the assignment into the multi-assignee table
    if (assignedTo) {
      await supabaseAdmin.from("lead_assignments").upsert(
        { lead_id: lead.id, salesperson_id: assignedTo, is_primary: true, assigned_at: assignedAt },
        { onConflict: "lead_id,salesperson_id" }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Public intake error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
