"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle, Loader2, Mail } from "lucide-react";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(true);
  const [showContent, setShowContent] = useState(false);
  // null while unknown; true only once Stripe says the session is paid.
  const [isPaid, setIsPaid] = useState<boolean | null>(null);

  const sessionId = searchParams?.get("session_id") ?? null;

  useEffect(() => {
    let cancelled = false;

    const reveal = (paid: boolean) => {
      if (cancelled) return;
      setIsPaid(paid);
      setIsVerifying(false);
      setTimeout(() => {
        if (!cancelled) setShowContent(true);
      }, 100);
    };

    // No session id means we have nothing to verify against — never claim
    // success on the strength of the URL alone.
    if (!sessionId) {
      reveal(false);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const response = await fetch(
          `/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`
        );
        const payload = await response.json().catch(() => ({}));
        reveal(response.ok && payload?.paid === true);
      } catch (error) {
        console.error("Error confirming payment:", error);
        reveal(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (isVerifying) {
    return (
      <div className="text-center py-12">
        <div className="relative">
          <div className="w-16 h-16 mx-auto rounded-full border-4 border-[#0C5536]/20 border-t-[#0C5536] animate-spin" />
        </div>
        <p className="text-gray-500 mt-6 animate-pulse">Confirming payment...</p>
      </div>
    );
  }

  if (!isPaid) {
    return (
      <div className={`text-center transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="relative mb-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-200">
            <AlertCircle className="h-10 w-10 text-white" strokeWidth={2.5} />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          We couldn&apos;t confirm this payment
        </h1>

        <p className="text-gray-500 text-lg mb-10">
          {sessionId
            ? "Stripe has not confirmed this checkout session as paid. If you were charged, it may still be processing."
            : "This page was opened without a checkout reference, so there is nothing to confirm."}
        </p>

        <div className="inline-flex items-center gap-3 bg-amber-500/5 rounded-full px-6 py-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Mail className="h-5 w-5 text-amber-700" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">Need a hand?</p>
            <p className="text-xs text-gray-500">Contact support before paying again</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`text-center transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      {/* Success Icon with Animation */}
      <div className="relative mb-8">
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-200 animate-[bounce_1s_ease-in-out]">
          <CheckCircle className="h-10 w-10 text-white" strokeWidth={2.5} />
        </div>
        {/* Decorative rings */}
        <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full border-4 border-green-200 animate-ping opacity-20" />
      </div>

      {/* Main Message */}
      <h1 className="text-3xl font-bold text-gray-900 mb-3">
        You're all set!
      </h1>

      <p className="text-gray-500 text-lg mb-10">
        Payment received successfully
      </p>

      {/* Email Notice */}
      <div className="inline-flex items-center gap-3 bg-[#0C5536]/5 rounded-full px-6 py-3">
        <div className="w-10 h-10 rounded-full bg-[#0C5536]/10 flex items-center justify-center">
          <Mail className="h-5 w-5 text-[#0C5536]" />
        </div>
        <div className="text-left">
          <p className="text-sm font-medium text-gray-900">Check your inbox</p>
          <p className="text-xs text-gray-500">Login details on the way</p>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="text-center py-12">
      <Loader2 className="h-12 w-12 mx-auto text-[#0C5536] animate-spin" />
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-md w-full mx-auto px-6">
        {/* Logo */}
        <div className="text-center mb-12">
          <span className="text-sm font-medium tracking-widest text-[#0C5536]/60">JUST WILLS</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-10">
          <Suspense fallback={<LoadingFallback />}>
            <PaymentSuccessContent />
          </Suspense>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-400 mt-8">
          Need help?{" "}
          <a href="mailto:support@justwills.ae" className="text-[#0C5536] hover:underline">
            support@justwills.ae
          </a>
        </p>
      </div>
    </div>
  );
}
