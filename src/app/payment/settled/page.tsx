"use client";

// Where the payment link lands when there is nothing left to pay — the client
// already settled the balance (often by bank transfer) since the email was
// sent. Showing this instead of a Stripe checkout is the whole point of
// resolving the link at click time.

import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SettledContent() {
  const params = useSearchParams();
  const unavailable = params?.get("reason") === "unavailable";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-auto p-8">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            {unavailable ? (
              <AlertCircle className="h-16 w-16 mx-auto text-amber-500" />
            ) : (
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {unavailable ? "Payment Link Unavailable" : "Nothing Left to Pay"}
          </h1>
          <p className="text-gray-600 mb-6">
            {unavailable
              ? "We could not open this payment link. It may relate to an invoice that is no longer active. Please contact us and we will help."
              : "This invoice has been settled in full — no payment is outstanding, so we have not charged you anything. If you believe this is a mistake, please get in touch."}
          </p>
          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/">Return to Home</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <a href="mailto:support@justwills.ae">Contact Support</a>
            </Button>
          </div>
        </div>
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
