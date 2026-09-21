"use client";

// Where the payment link lands when there is nothing left to pay — the client
// already settled the balance (often by bank transfer) since the email was
// sent — or when the invoice is no longer active (e.g. replaced by a revised
// proposal). Showing this instead of a Stripe checkout is the whole point of
// resolving the link at click time.
//
// Styled with theme tokens only, matching the public accept page. Mixing fixed
// light colours (bg-white, text-gray-900) with the app's dark theme rendered
// dark text on a dark card.

import { CheckCircle2, AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { companyDetails } from "@/config/company";

function SettledContent() {
  const params = useSearchParams();
  const unavailable = params?.get("reason") === "unavailable";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12">
      <div className="max-w-lg w-full mx-auto px-6">
        <div className="text-center mb-8">
          <span className="text-sm font-medium tracking-widest text-[#0C5536]/60">JUST WILLS</span>
        </div>
        <div className="bg-card rounded-2xl shadow-xl shadow-black/5 p-8 sm:p-10 text-center">
          {unavailable ? (
            <AlertCircle className="h-14 w-14 mx-auto text-amber-500 mb-4" />
          ) : (
            <CheckCircle2 className="h-14 w-14 mx-auto text-green-600 mb-4" />
          )}
          <h1 className="text-2xl font-bold text-foreground mb-3">
            {unavailable ? "Payment link unavailable" : "Nothing left to pay"}
          </h1>
          <p className="text-muted-foreground mb-8">
            {unavailable
              ? "This payment link is no longer active — the invoice may have been replaced. Please contact us and we will send you the right one."
              : "This invoice has been settled in full — no payment is outstanding, so we have not charged you anything. If you believe this is a mistake, please get in touch."}
          </p>
          <a
            href={`mailto:${companyDetails.email}`}
            className="inline-flex w-full items-center justify-center rounded-lg bg-[#0C5536] px-4 py-3 text-sm font-medium text-white hover:bg-[#0C5536]/90 transition-colors"
          >
            Contact us
          </a>
        </div>
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

export default function PaymentSettledPage() {
  return (
    <Suspense fallback={null}>
      <SettledContent />
    </Suspense>
  );
}
