"use client";

// The confirm step.
//
// This owns the whole pre-acceptance block — heading, summary and button — not
// just the button. When it only owned the button, confirming left "Hi X, please
// confirm below and we will send your invoice" sitting above the thank-you,
// telling a client who had just accepted to accept.
//
// When the proposal offers several registration courts it also owns the court
// picker and the figures box, because the totals follow the court being picked
// and that can only happen in the browser. Picking and confirming is one step:
// the chosen court travels in the same POST that records the acceptance.

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { proposalAcceptApiPath } from "@/lib/finance/acceptLink";
import type { CourtId } from "@/lib/lead-management/courtOptions";
import type { ProposalAcceptCourtOption } from "@/lib/lead-management/proposalAcceptance";
import { AcceptSummary, formatCurrency } from "./AcceptSummary";

type Props = {
  proposalId: string;
  /** Rendered in the confirmation so the client sees what they just accepted. */
  invoiceNumber: string;
  /**
   * Everything shown before accepting. Passed in rather than rendered by the
   * parent so this component can replace it wholesale on success.
   */
  children: React.ReactNode;
  /** Already settled court (one offered, or set by the team), for the thank-you. */
  chosenCourtLabel?: string | null;
  /**
   * Set only while the client has a court to choose. The picker and the
   * figures box are then rendered here, after `children`.
   */
  courtChoice?: {
    options: ProposalAcceptCourtOption[];
    /** From ?court= on the email's per-court button, already validated. */
    initial: CourtId | null;
    clientName: string;
    currency: string;
  } | null;
};

export function AcceptProposalForm({
  proposalId,
  invoiceNumber,
  children,
  chosenCourtLabel = null,
  courtChoice = null,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CourtId | null>(courtChoice?.initial ?? null);
  // The court the server recorded. Normally the one picked here, but if the
  // team set a court in the meantime theirs stands — so name what was saved.
  const [recordedCourtLabel, setRecordedCourtLabel] = useState<string | null>(chosenCourtLabel);

  const selectedOption = courtChoice?.options.find((o) => o.court === selected) ?? null;
  const mustChoose = courtChoice !== null;

  const handleAccept = async () => {
    if (mustChoose && !selectedOption) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(proposalAcceptApiPath(proposalId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ court: mustChoose ? selected : null }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.accepted) {
        setError(payload?.error || "We could not record your acceptance. Please contact us.");
        return;
      }
      setRecordedCourtLabel(payload?.court?.label ?? selectedOption?.label ?? chosenCourtLabel);
      setAccepted(true);
    } catch (err) {
      console.error("Error accepting proposal:", err);
      setError("We could not reach our system just now. Please try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (accepted) {
    return (
      <div className="text-center">
        <CheckCircle2 className="h-14 w-14 mx-auto text-green-600 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Thank you — that&apos;s confirmed</h2>
        <p className="text-muted-foreground">
          We have recorded your acceptance of proposal{" "}
          <span className="font-medium text-foreground">{invoiceNumber}</span>
          {recordedCourtLabel && (
            <>
              {" "}
              with registration at{" "}
              <span className="font-medium text-foreground">{recordedCourtLabel}</span>
            </>
          )}
          . Your account manager has been notified and will send your invoice shortly.
        </p>
      </div>
    );
  }

  return (
    <div>
      {children}

      {courtChoice && (
        <>
          <fieldset className="mb-6">
            <legend className="text-sm font-medium text-foreground mb-3">
              Choose your registration court
            </legend>
            <div className="space-y-3">
              {courtChoice.options.map((option) => {
                const isSelected = option.court === selected;
                return (
                  <label
                    key={option.court}
                    className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? "border-[#0C5536] bg-[#0C5536]/5 ring-1 ring-[#0C5536]"
                        : "border-border hover:border-[#0C5536]/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="court"
                      value={option.court}
                      checked={isSelected}
                      onChange={() => setSelected(option.court)}
                      disabled={isSubmitting}
                      className="mt-1 h-4 w-4 accent-[#0C5536]"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="font-semibold text-foreground">{option.label}</span>
                        <span className="text-sm font-medium text-foreground whitespace-nowrap">
                          {formatCurrency(option.amount, courtChoice.currency)}
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            · X{option.quantity}
                          </span>
                        </span>
                      </span>
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 mt-1">
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Total {formatCurrency(option.invoiceTotal, courtChoice.currency)} incl. VAT
                        </span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <AcceptSummary
            invoiceNumber={invoiceNumber}
            clientName={courtChoice.clientName}
            currency={courtChoice.currency}
            courtLabel={selectedOption?.label ?? null}
            totals={selectedOption}
          />
        </>
      )}

      <Button
        onClick={handleAccept}
        disabled={isSubmitting || (mustChoose && !selectedOption)}
        className="w-full bg-[#0C5536] hover:bg-[#0a4429] text-white h-12 text-base"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Confirming...
          </>
        ) : mustChoose ? (
          selectedOption ? `Accept with ${selectedOption.label}` : "Choose a court to accept"
        ) : (
          "Accept this proposal"
        )}
      </Button>
      {mustChoose && (
        <p className="text-xs text-muted-foreground text-center mt-3">
          Your choice is final once confirmed. If you need to change it later, please contact your
          account manager.
        </p>
      )}
      <p className="text-xs text-muted-foreground text-center mt-3">
        Accepting confirms you are happy to proceed. We will then send your invoice — no payment is
        taken on this page.
      </p>
      {error && (
        <p className="text-sm text-red-600 text-center mt-4" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
