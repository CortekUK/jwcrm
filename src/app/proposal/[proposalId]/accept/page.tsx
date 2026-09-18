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

// Acceptance state changes under us — never serve a cached "not yet accepted".
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

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
}: {
  params: Promise<{ proposalId: string }>;
}) {
  const { proposalId } = await params;

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

  return (
    <Shell>
      {/* The heading and summary are passed INTO the form so that confirming
          replaces them — otherwise the client is still told to "confirm below"
          after they already have. */}
      <AcceptProposalForm
        proposalId={summary.proposalId}
        invoiceNumber={summary.invoiceNumber}
      >
      <div className="text-center mb-8">
        <div className="w-14 h-14 mx-auto rounded-full bg-[#0C5536]/10 flex items-center justify-center mb-4">
          <FileText className="h-7 w-7 text-[#0C5536]" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Accept your proposal</h1>
        <p className="text-muted-foreground">
          Hi {summary.clientName}, please confirm below and we will send your invoice so drafting can
          begin.
        </p>
      </div>

      {/* Exactly the figures from the proposal they were emailed — resolved
          through the shared amounts helper, never recomputed here. */}
      <div className="rounded-xl border border-border bg-muted/40 divide-y divide-border mb-8">
        <div className="flex items-center justify-between px-5 py-3.5">
          <span className="text-sm text-muted-foreground">Reference</span>
          <span className="text-sm font-medium text-foreground">{summary.invoiceNumber}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-3.5">
          <span className="text-sm text-muted-foreground">Prepared for</span>
          <span className="text-sm font-medium text-foreground">{summary.clientName}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-3.5">
          <span className="text-sm text-muted-foreground">Total (incl. VAT)</span>
          <span className="text-sm font-semibold text-foreground">
            {formatCurrency(summary.invoiceTotal, summary.currency)}
          </span>
        </div>
        {/* Only meaningful on a staged proposal: on a flat one the "payable
            now" figure is just the total again. */}
        {summary.staged && summary.laterTotal > 0 && (
          <div className="px-5 py-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Payable now to begin drafting</span>
              <span className="text-sm font-semibold text-[#0C5536]">
                {formatCurrency(summary.upfrontTotal, summary.currency)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              The remaining {formatCurrency(summary.laterTotal, summary.currency)} is payable at the
              court appointment stage.
            </p>
          </div>
        )}
      </div>

      </AcceptProposalForm>
    </Shell>
  );
}
