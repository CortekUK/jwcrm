"use client";

// The confirm step.
//
// This owns the whole pre-acceptance block — heading, summary and button — not
// just the button. When it only owned the button, confirming left "Hi X, please
// confirm below and we will send your invoice" sitting above the thank-you,
// telling a client who had just accepted to accept.

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { proposalAcceptApiPath } from "@/lib/finance/acceptLink";

type Props = {
  proposalId: string;
  /** Rendered in the confirmation so the client sees what they just accepted. */
  invoiceNumber: string;
  /**
   * Everything shown before accepting. Passed in rather than rendered by the
   * parent so this component can replace it wholesale on success.
   */
  children: React.ReactNode;
};

export function AcceptProposalForm({ proposalId, invoiceNumber, children }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(proposalAcceptApiPath(proposalId), { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.accepted) {
        setError(payload?.error || "We could not record your acceptance. Please contact us.");
        return;
      }
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
          <span className="font-medium text-foreground">{invoiceNumber}</span>. Your account manager
          has been notified and will send your invoice shortly.
        </p>
      </div>
    );
  }

  return (
    <div>
      {children}
      <Button
        onClick={handleAccept}
        disabled={isSubmitting}
        className="w-full bg-[#0C5536] hover:bg-[#0a4429] text-white h-12 text-base"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Confirming...
          </>
        ) : (
          "Accept this proposal"
        )}
      </Button>
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
