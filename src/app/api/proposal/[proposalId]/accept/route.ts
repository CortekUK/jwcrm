// POST /api/proposal/[proposalId]/accept
//
// The client pressing "Yes, go ahead" on their proposal.
//
// POST ONLY, and deliberately so. The link that goes out in the proposal email
// and PDF points at the /proposal/[proposalId]/accept PAGE, never here: mail
// scanners (Outlook ATP and every antivirus gateway) fetch the links in a
// message on delivery, so a GET that accepted would mark proposals accepted
// before the client had even opened the email. Only a human pressing the button
// on that page reaches this route.
//
// Unauthenticated for the same reason /api/pay/[proposalId] is: the person
// accepting is not a CRM user. The proposal UUID is the secret, and the only
// thing this route can do with it is record an agreement the client is making
// about their own proposal — it returns nothing they were not already sent.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { acceptProposal } from "@/lib/lead-management/proposalAcceptance";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Refusals are explained, not just rejected — the client needs to know why. */
const REFUSAL_MESSAGES: Record<string, string> = {
  not_found: "We could not find this proposal. It may have been replaced by a newer one.",
  cancelled: "This proposal has been cancelled, so it can no longer be accepted.",
  invoiced: "Your invoice for this proposal has already been issued — there is nothing further to accept.",
  paid: "This proposal has already been paid in full. Thank you!",
  court_required: "Please choose your registration court before accepting.",
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ proposalId: string }> }
) {
  const { proposalId } = await context.params;

  // Optional JSON body `{ court }` — the registration court chosen on the page.
  // Tolerant of an empty or missing body: a page loaded before courts existed
  // posts nothing, and for a proposal with no choice to make it needs nothing.
  const body = (await request.json().catch(() => null)) as { court?: unknown } | null;
  const court = body && typeof body === "object" ? body.court : undefined;

  try {
    const result = await acceptProposal(supabaseAdmin, proposalId, {
      // Behind Vercel/any proxy the socket address is the proxy, so the
      // forwarded chain is the only place the client's own IP survives.
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
      court,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          accepted: false,
          state: result.state,
          error: REFUSAL_MESSAGES[result.state] ?? "This proposal cannot be accepted right now.",
        },
        {
          status:
            result.state === "not_found" ? 404 : result.state === "court_required" ? 400 : 409,
        }
      );
    }

    return NextResponse.json({
      accepted: true,
      state: result.state,
      // Lets the page say "thank you" the first time and "you've already
      // accepted this" on a refresh, without a second round trip.
      firstAccept: result.firstAccept === true,
      acceptedAt: result.summary?.acceptedAt ?? null,
      invoiceNumber: result.summary?.invoiceNumber ?? null,
      // The court as recorded, which is not necessarily the one the page sent:
      // if the team set it in the meantime, theirs stands and the page must
      // say so rather than echo the client's pick back.
      court: result.summary?.courts.chosen ?? null,
    });
  } catch (error) {
    console.error("Proposal acceptance failed:", error);
    return NextResponse.json(
      { accepted: false, error: "Something went wrong. Please contact us and we will confirm by hand." },
      { status: 500 }
    );
  }
}
