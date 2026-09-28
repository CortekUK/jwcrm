// The public "accept your proposal" page.
//
// This is what the button in the proposal email and PDF links to. It exists
// because accepting must never happen on a GET: mail scanners follow every
// link in a delivered message, and a GET-to-accept would mark proposals
// accepted before the client ever opened their inbox. So the link lands here,
// the client sees exactly what they are agreeing to, and only the button
// POSTs to /api/proposal/[proposalId]/accept.
//
// Unauthenticated by design, like /payment/settled — the client is not a CRM
// user. It shows only what is already in the proposal they were emailed.

import { createClient } from "@supabase/supabase-js";
import { AlertCircle, CheckCircle2, FileText } from "lucide-react";
import {
  loadProposalForAccept,
  type ProposalAcceptSummary,
} from "@/lib/lead-management/proposalAcceptance";
import { companyDetails } from "@/config/company";
import { AcceptProposalForm } from "./AcceptProposalForm";
import { AcceptSummary } from "./AcceptSummary";

// Acceptance state changes under us — never serve a cached "not yet accepted".
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12">
      <div className="max-w-lg w-full mx-auto px-6">
        <div className="text-center mb-8">
          <span className="text-sm font-medium tracking-widest text-[#0C5536]/60">JUST WILLS</span>
        </div>
        <div className="bg-card rounded-2xl shadow-xl shadow-black/5 p-8 sm:p-10">{children}</div>
        <p className="text-center text-sm text-muted-foreground mt-8">
          Questions?{" "}
          <a href={`mailto:${companyDetails.email}`} className="text-[#0C5536] hover:underline">
            {companyDetails.email}
          </a>
        </p>
      </div>
    </div>
  );
}

/** Every outcome that is not "please confirm" — refusals and repeat visits. */
function Notice({
  tone,
  title,
  body,
}: {
  tone: "good" | "warn";
  title: string;
  body: string;
}) {
  return (
    <Shell>
      <div className="text-center">
        {tone === "good" ? (
          <CheckCircle2 className="h-14 w-14 mx-auto text-green-600 mb-4" />
        ) : (
          <AlertCircle className="h-14 w-14 mx-auto text-amber-500 mb-4" />
        )}
        <h1 className="text-2xl font-bold text-foreground mb-3">{title}</h1>
        <p className="text-muted-foreground">{body}</p>
      </div>
    </Shell>
  );
}

export default async function AcceptProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ proposalId: string }>;
  // ?court= comes from the per-court buttons in the proposal email.
  searchParams: Promise<{ court?: string | string[] }>;
}) {
  const { proposalId } = await params;
  const { court: requestedCourt } = await searchParams;

  let summary: ProposalAcceptSummary | null = null;
  try {
    summary = await loadProposalForAccept(supabaseAdmin, proposalId);
  } catch (error) {
    console.error("Could not load proposal for acceptance:", error);
  }

  if (!summary || summary.state === "not_found") {
    return (
      <Notice
        tone="warn"
        title="Proposal not found"
        body="We could not find this proposal. It may have been replaced by a newer one — please get in touch and we will send you the current version."
      />
    );
  }

  if (summary.state === "already_accepted") {
    return (
      <Notice
        tone="good"
        title="You've already accepted this"
        body={`We recorded your acceptance of ${summary.invoiceNumber}${
          summary.acceptedAt ? ` on ${formatDate(summary.acceptedAt)}` : ""
        }${
          summary.courts.chosen ? `, with registration at ${summary.courts.chosen.label}` : ""
        }. Your account manager has been notified and will send your invoice — there is nothing more for you to do here.`}
      />
    );
  }

  if (summary.state === "cancelled") {
    return (
      <Notice
        tone="warn"
        title="This proposal has been cancelled"
        body="It can no longer be accepted. If this is unexpected, please contact us and we will put it right."
      />
    );
  }

  if (summary.state === "invoiced" || summary.state === "paid") {
    return (
      <Notice
        tone="good"
        title={summary.state === "paid" ? "This is already paid" : "Your invoice is already with you"}
        body={
          summary.state === "paid"
            ? `Proposal ${summary.invoiceNumber} has been paid in full — thank you. There is nothing left to accept.`
            : `We have already issued the invoice for ${summary.invoiceNumber}, so there is nothing further to accept here. Please use the payment link in that invoice email.`
        }
      />
    );
  }

  // Preselect only a court that is actually on offer: the query string is
  // whatever the link (or someone editing it) says, and it only ever preselects
  // — the client still has to press confirm, and the POST re-validates.
  const awaiting = summary.courts.awaitingChoice;
  const initialCourt =
    awaiting && typeof requestedCourt === "string"
      ? summary.courts.options.find((o) => o.court === requestedCourt)?.court ?? null
      : null;

  return (
    <Shell>
      {/* The heading and summary are passed INTO the form so that confirming
          replaces them — otherwise the client is still told to "confirm below"
          after they already have. While a court is to be chosen the figures
          box moves into the form too, because its totals follow the pick. */}
      <AcceptProposalForm
        proposalId={summary.proposalId}
        invoiceNumber={summary.invoiceNumber}
        chosenCourtLabel={summary.courts.chosen?.label ?? null}
        courtChoice={
          awaiting
            ? {
                options: summary.courts.options,
                initial: initialCourt,
                clientName: summary.clientName,
                currency: summary.currency,
              }
            : null
        }
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#0C5536]/10 flex items-center justify-center mb-4">
            <FileText className="h-7 w-7 text-[#0C5536]" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Accept your proposal</h1>
          {awaiting ? (
            <p className="text-muted-foreground">
              Hi {summary.clientName}, please choose the court where your will is to be registered
              and confirm below. Our fee is the same whichever you choose — only the government
              court fee differs.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Hi {summary.clientName}, please confirm below and we will send your invoice so drafting
              can begin.
            </p>
          )}
        </div>

        {/* Exactly the figures from the proposal they were emailed — resolved
            through the shared amounts helper, never recomputed here. */}
        {!awaiting && (
          <AcceptSummary
            invoiceNumber={summary.invoiceNumber}
            clientName={summary.clientName}
            currency={summary.currency}
            courtLabel={summary.courts.chosen?.label ?? null}
            totals={summary}
          />
        )}
      </AcceptProposalForm>
    </Shell>
  );
}
