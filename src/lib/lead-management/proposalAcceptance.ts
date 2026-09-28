// "Yes, go ahead" — the client accepting their proposal.
//
// Before this, accepting meant replying to the proposal email and waiting for
// a human to notice and raise the invoice. The accept link short-circuits that:
// the client confirms on a public page, we stamp proposals.accepted_at, and the
// lead's owner is emailed that the invoice can go out.
//
// The read (loadProposalForAccept) and the write (acceptProposal) live together
// because they must agree on exactly one thing: which states are acceptable.
// The page renders from the read; the POST re-runs the same check before
// writing, so a page left open for a week cannot accept a proposal that was
// cancelled or invoiced in the meantime.

import { SupabaseClient } from "@supabase/supabase-js";
import { companyDetails } from "@/config/company";
import { computeInvoiceAmounts } from "@/lib/finance/invoiceAmounts";
import { lineItemsSubtotal, type InvoiceLineItem } from "@/lib/pdf/invoiceLineItems";
import {
  COURT_LABELS,
  awaitingCourtChoice,
  chosenCourt,
  courtChoiceSummary,
  isCourtId,
  normalizeCourtOptions,
  withChosenCourt,
  type CourtId,
} from "@/lib/lead-management/courtOptions";
import { sendUserEmail } from "@/lib/integrations/sendUserEmail";

/**
 * Why this proposal can or cannot be accepted right now.
 *
 * `invoiced` and `paid` are refusals rather than errors: the client has moved
 * past the proposal stage, so accepting would say nothing new — but they still
 * deserve an explanation rather than a dead button.
 *
 * `court_required` is only ever returned by acceptProposal, never by the read:
 * the proposal is acceptable, the request just did not say which of the offered
 * registration courts the client is choosing.
 */
export type ProposalAcceptState =
  | "acceptable"
  | "already_accepted"
  | "accepted"
  | "cancelled"
  | "invoiced"
  | "paid"
  | "court_required"
  | "not_found";

/**
 * One offered registration court with the figures the client would be charged
 * if they chose it. Every number comes from courtChoiceSummary, i.e. from
 * computeInvoiceAmounts over the exact line items choosing it would store.
 */
export type ProposalAcceptCourtOption = {
  court: CourtId;
  label: string;
  description: string;
  quantity: number;
  /** The court fee line total (already extended by quantity), before VAT. */
  amount: number;
  invoiceTotal: number;
  upfrontTotal: number;
  laterTotal: number;
  staged: boolean;
};

export type ProposalAcceptCourts = {
  /** Offered courts in display order. Empty when the picker was not used. */
  options: ProposalAcceptCourtOption[];
  /** Two or more offered and none chosen yet — accepting must name one. */
  awaitingChoice: boolean;
  /** Read off the line items: chosen by the client, or set by the team. */
  chosen: { court: CourtId; label: string } | null;
};

/**
 * Everything the public page may show. Deliberately narrow: the client already
 * has all of this in the proposal sitting in their inbox, and nothing else
 * about the lead belongs on an unauthenticated page.
 */
export type ProposalAcceptSummary = {
  state: ProposalAcceptState;
  proposalId: string;
  clientName: string;
  invoiceNumber: string;
  currency: string;
  invoiceTotal: number;
  /** True when the fees are split across payment stages. */
  staged: boolean;
  /** What starts the work — equal to invoiceTotal on an unstaged proposal. */
  upfrontTotal: number;
  laterTotal: number;
  acceptedAt: string | null;
  /**
   * While `courts.awaitingChoice` the figures above cover only the part that
   * never varies; the page shows each option's own totals instead.
   */
  courts: ProposalAcceptCourts;
};

type ProposalRow = {
  id: string;
  lead_id: string;
  amount: number | string | null;
  currency: string | null;
  invoice_number: string | null;
  status: string;
  invoiced_at: string | null;
  accepted_at: string | null;
  line_items: unknown;
  vat_rate: number | string | null;
  vat_amount: number | string | null;
  // Not in the generated Supabase types (migration 20260928000001).
  court_options?: unknown;
};

type LeadRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  assigned_to: string | null;
};

function classify(proposal: ProposalRow): ProposalAcceptState {
  if (proposal.status === "cancelled") return "cancelled";
  if (proposal.status === "paid") return "paid";
  // accepted_at wins over invoiced_at: a client who accepted and then had their
  // invoice raised should still see the friendly "already accepted" page, not
  // be told they are too late for something they themselves triggered.
  if (proposal.accepted_at) return "already_accepted";
  if (proposal.invoiced_at) return "invoiced";
  return "acceptable";
}

function summariseCourts(proposal: ProposalRow): ProposalAcceptCourts {
  const items = (proposal.line_items as InvoiceLineItem[] | null) ?? null;
  const offered = normalizeCourtOptions(proposal.court_options);
  const chosen = chosenCourt(items);
  const choice = courtChoiceSummary(
    items,
    offered,
    { vat_rate: proposal.vat_rate, vat_amount: proposal.vat_amount },
    companyDetails.vatRate
  );
  return {
    options: choice.options.map(({ option, amounts }) => ({
      court: option.court,
      label: COURT_LABELS[option.court],
      description: option.description,
      quantity: option.quantity,
      amount: option.amount,
      invoiceTotal: amounts.invoiceTotal,
      upfrontTotal: amounts.upfrontTotal,
      laterTotal: amounts.laterTotal,
      staged: amounts.staged,
    })),
    awaitingChoice: awaitingCourtChoice(items, offered),
    chosen: chosen ? { court: chosen, label: COURT_LABELS[chosen] } : null,
  };
}

function summarise(proposal: ProposalRow, lead: LeadRow | null): ProposalAcceptSummary {
  // Amounts always come from the shared helper, never recomputed here, so the
  // figure on this page is the same one the PDF and the payment link use.
  const amounts = computeInvoiceAmounts(
    {
      amount: proposal.amount,
      line_items: (proposal.line_items as InvoiceLineItem[] | null) ?? null,
      vat_rate: proposal.vat_rate,
      vat_amount: proposal.vat_amount,
    },
    companyDetails.vatRate
  );

  return {
    state: classify(proposal),
    proposalId: proposal.id,
    clientName: lead?.full_name || "there",
    invoiceNumber: proposal.invoice_number || "",
    currency: proposal.currency || "AED",
    invoiceTotal: amounts.invoiceTotal,
    staged: amounts.staged,
    upfrontTotal: amounts.upfrontTotal,
    laterTotal: amounts.laterTotal,
    acceptedAt: proposal.accepted_at,
    courts: summariseCourts(proposal),
  };
}

const PROPOSAL_COLUMNS =
  "id, lead_id, amount, currency, invoice_number, status, invoiced_at, accepted_at, line_items, vat_rate, vat_amount, court_options";

async function loadRows(
  sb: SupabaseClient,
  proposalId: string
): Promise<{ proposal: ProposalRow; lead: LeadRow | null } | null> {
  const { data: proposal, error } = await sb
    .from("proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("id", proposalId)
    .maybeSingle();
  if (error || !proposal) return null;

  // Separate query rather than a PostgREST embed: the lead is optional context
  // here, and a join that fails to resolve would take the whole page down.
  const { data: lead } = await sb
    .from("leads")
    .select("id, full_name, email, assigned_to")
    .eq("id", (proposal as ProposalRow).lead_id)
    .maybeSingle();

  return { proposal: proposal as ProposalRow, lead: (lead as LeadRow) || null };
}

/** Read-only: what the public accept page renders. Never mutates anything. */
export async function loadProposalForAccept(
  sb: SupabaseClient,
  proposalId: string
): Promise<ProposalAcceptSummary | null> {
  const rows = await loadRows(sb, proposalId);
  if (!rows) return null;
  return summarise(rows.proposal, rows.lead);
}

export type AcceptResult = {
  ok: boolean;
  /** The state AFTER the attempt — "already_accepted" on a repeat click. */
  state: ProposalAcceptState;
  summary: ProposalAcceptSummary | null;
  /**
   * True only on the request that actually flipped accepted_at — the one that
   * sent the notification. Everything else is a repeat click.
   */
  firstAccept?: boolean;
};

/**
 * Accept the proposal. Safe to call any number of times: the update is
 * conditional on accepted_at still being null, so a double-click, a retried
 * request and a second tab all collapse into one acceptance and one
 * notification email.
 */
export async function acceptProposal(
  sb: SupabaseClient,
  proposalId: string,
  context: {
    ip?: string | null;
    userAgent?: string | null;
    /**
     * The registration court the client picked, straight from the request body
     * — untrusted. Only read while a choice is awaited; otherwise the court is
     * already settled (one offered, or the team set it) and the client cannot
     * override it.
     */
    court?: unknown;
  }
): Promise<AcceptResult> {
  const rows = await loadRows(sb, proposalId);
  if (!rows) {
    return { ok: false, state: "not_found", summary: null };
  }

  const state = classify(rows.proposal);
  if (state === "already_accepted") {
    // Idempotent, not an error: the client did accept, they just did it twice.
    return { ok: true, state, summary: summarise(rows.proposal, rows.lead), firstAccept: false };
  }
  if (state !== "acceptable") {
    return { ok: false, state, summary: summarise(rows.proposal, rows.lead) };
  }

  // Choosing the court IS accepting — one step, one write. Validated against
  // what was offered as stored now, not what the page showed, so a page left
  // open across a re-send cannot pick a court that is no longer on offer.
  const currentItems = (rows.proposal.line_items as InvoiceLineItem[] | null) ?? null;
  const offered = normalizeCourtOptions(rows.proposal.court_options);
  let courtFields: { line_items: InvoiceLineItem[]; amount: number } | null = null;
  let chosenByClient: CourtId | null = null;
  if (awaitingCourtChoice(currentItems, offered)) {
    const court = context.court;
    if (!isCourtId(court) || !offered.some((o) => o.court === court)) {
      return { ok: false, state: "court_required", summary: summarise(rows.proposal, rows.lead) };
    }
    const lineItems = withChosenCourt(currentItems, offered, court);
    // amount follows line_items exactly as every other writer keeps it.
    courtFields = { line_items: lineItems, amount: lineItemsSubtotal(lineItems) };
    chosenByClient = court;
  }

  const acceptedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await sb
    .from("proposals")
    .update({
      accepted_at: acceptedAt,
      accepted_ip: context.ip ?? null,
      accepted_user_agent: context.userAgent ?? null,
      updated_at: acceptedAt,
      // In the same conditional update as accepted_at, so the court and the
      // acceptance land together or not at all: a losing racer writes neither,
      // and a repeat accept never reaches here to change the court.
      ...(courtFields ?? {}),
    })
    .eq("id", proposalId)
    // The race guard. Two concurrent accepts both pass the check above; only
    // the one that finds accepted_at still null gets a row back, and only that
    // one sends the notification.
    .is("accepted_at", null)
    .select(PROPOSAL_COLUMNS);

  if (updateError) {
    console.error("Could not record proposal acceptance:", updateError);
    return { ok: false, state: "acceptable", summary: summarise(rows.proposal, rows.lead) };
  }

  const acceptedRow = (updated?.[0] as ProposalRow | undefined) ?? null;
  const wonTheRace = acceptedRow !== null;
  const finalRow: ProposalRow =
    acceptedRow ?? { ...rows.proposal, accepted_at: rows.proposal.accepted_at ?? acceptedAt };
  const summary = summarise(finalRow, rows.lead);

  if (!wonTheRace) {
    // The winner may have chosen a different court (a second tab), and it is
    // theirs that stands — so report the row as stored, not what this request
    // tried to write. Falls back to the local view if the re-read fails.
    const fresh = await loadRows(sb, proposalId).catch(() => null);
    return {
      ok: true,
      state: "already_accepted",
      summary: fresh ? summarise(fresh.proposal, fresh.lead) : summary,
      firstAccept: false,
    };
  }

  await notifyTeamOfAcceptance(sb, {
    proposal: finalRow,
    lead: rows.lead,
    summary,
    chosenByClient: chosenByClient !== null,
  });

  // "accepted", not "already_accepted": this request is the one that did it.
  // Returning the latter would be a lie that any caller branching on `state`
  // (rather than on `firstAccept`) would turn into "you have already accepted
  // this" shown to someone accepting for the very first time.
  return { ok: true, state: "accepted", summary, firstAccept: true };
}

/**
 * Tell the human who owns this lead that the client said yes, so they can raise
 * the invoice. Best-effort throughout — a failed email must never undo an
 * acceptance the client has already been shown as successful.
 */
async function notifyTeamOfAcceptance(
  sb: SupabaseClient,
  input: {
    proposal: ProposalRow;
    lead: LeadRow | null;
    summary: ProposalAcceptSummary;
    /** True when this acceptance is what chose the court. */
    chosenByClient: boolean;
  }
): Promise<void> {
  const { proposal, lead, summary, chosenByClient } = input;

  // Unassigned leads still have to reach somebody; the shared invoice mailbox
  // is the same fallback the proposal email itself uses for the account manager.
  let recipient = companyDetails.invoiceEmail;
  let ownerName = companyDetails.defaultContactName;
  try {
    if (lead?.assigned_to) {
      const { data: profile } = await sb
        .from("profiles")
        .select("full_name")
        .eq("user_id", lead.assigned_to)
        .maybeSingle();
      if (profile?.full_name) ownerName = profile.full_name as string;

      const { data: owner } = await sb.auth.admin.getUserById(lead.assigned_to);
      if (owner?.user?.email) recipient = owner.user.email;
    }
  } catch (err) {
    console.error("Could not resolve the lead owner for an acceptance notice:", err);
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: summary.currency }).format(n);

  const escHtml = (v: string) =>
    v
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const clientLabel = escHtml(lead?.full_name || "The client");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #0C5536; padding: 18px; text-align: center;">
        <h1 style="color: #C6A03B; margin: 0; font-size: 20px;">Proposal Accepted</h1>
      </div>
      <div style="padding: 26px; background-color: #FAFAF8;">
        <p style="color: #222222; line-height: 1.6; margin-top: 0;">
          Hi ${escHtml(ownerName)},
        </p>
        <p style="color: #222222; line-height: 1.6;">
          <strong>${clientLabel}</strong> has accepted proposal
          <strong>${escHtml(summary.invoiceNumber)}</strong> online. The invoice can now be sent.
        </p>
        <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px;">
          <tr>
            <td style="padding: 10px 14px; color: #666666;">Client</td>
            <td style="padding: 10px 14px; text-align: right; color: #222222;">${clientLabel}${
              lead?.email ? `<br/><span style="font-size:12px;color:#6B6B6B;">${escHtml(lead.email)}</span>` : ""
            }</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; color: #666666;">Reference</td>
            <td style="padding: 10px 14px; text-align: right; color: #222222;">${escHtml(summary.invoiceNumber)}</td>
          </tr>
          ${
            // Worth its own row: with several courts offered, which one the
            // client picked decides the court fee on the invoice to be raised.
            summary.courts.chosen
              ? `<tr>
                   <td style="padding: 10px 14px; color: #666666;">Registration court</td>
                   <td style="padding: 10px 14px; text-align: right; color: #222222;">${escHtml(
                     summary.courts.chosen.label
                   )}${
                     chosenByClient
                       ? `<br/><span style="font-size:12px;color:#6B6B6B;">Chosen by the client when accepting</span>`
                       : ""
                   }</td>
                 </tr>`
              : ""
          }
          <tr>
            <td style="padding: 10px 14px; color: #666666;">Total</td>
            <td style="padding: 10px 14px; text-align: right; color: #222222;">${fmt(summary.invoiceTotal)}</td>
          </tr>
          ${
            // Only worth saying when the fees are actually split — on a flat
            // proposal the "payable now" figure is just the total again.
            summary.staged && summary.laterTotal > 0
              ? `<tr>
                   <td style="padding: 10px 14px; color: #666666;">Payable now</td>
                   <td style="padding: 10px 14px; text-align: right; color: #0C5536; font-weight: bold;">${fmt(summary.upfrontTotal)}</td>
                 </tr>`
              : ""
          }
          <tr>
            <td style="padding: 10px 14px; color: #666666;">Accepted</td>
            <td style="padding: 10px 14px; text-align: right; color: #222222;">${new Date(
              summary.acceptedAt || new Date().toISOString()
            ).toUTCString()}</td>
          </tr>
        </table>
        <p style="color: #6B6B6B; font-size: 13px; margin-bottom: 0;">
          Open the lead in the CRM and use Send Invoice to raise it.
        </p>
      </div>
    </div>`;

  // actorUserId is null on purpose: this is an internal notice ABOUT the owner's
  // lead, sent TO the owner. Routing it through their own Outlook would put a
  // copy in their Sent items and make it look like they wrote it themselves.
  const result = await sendUserEmail(null, {
    to: recipient,
    subject: `Proposal accepted — ${summary.invoiceNumber} (${lead?.full_name || "client"})`,
    refId: proposal.id,
    log: { kind: "proposal_accepted", leadId: proposal.lead_id, proposalId: proposal.id },
    html,
  });

  if (!result.ok) {
    console.error("Proposal acceptance notification failed:", result.error);
  }
}
