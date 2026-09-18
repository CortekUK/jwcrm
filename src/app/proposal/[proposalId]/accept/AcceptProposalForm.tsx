"use client";

// The confirm step. Everything the client is agreeing to is already rendered
// by the server component above this; all this owns is the button, the POST,
// and what the client sees afterwards.

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { proposalAcceptApiPath } from "@/lib/finance/acceptLink";

type Props = {
  proposalId: string;
  /** Rendered in the confirmation so the client sees what they just accepted. */
  invoiceNumber: string;
};

export function AcceptProposalForm({ proposalId, invoiceNumber }: Props) {
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
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Thank you — that&apos;s confirmed</h2>
        <p className="text-gray-600">
          We have recorded your acceptance of proposal{" "}
          <span className="font-medium text-gray-900">{invoiceNumber}</span>. Your account manager
          has been notified and will send your invoice shortly.
        </p>
      </div>
    );
  }

  return (
    <div>
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
      <p className="text-xs text-gray-500 text-center mt-3">
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
