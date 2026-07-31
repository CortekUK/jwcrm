// Where a "Pay now" link should point.
//
// A Stripe Checkout Session is created for a FIXED amount and never changes, so
// a stored checkout URL still charges the original invoice total long after the
// client has part-paid it. Every payment link therefore points at our own
// resolver route instead: it looks up the CURRENT outstanding balance at click
// time and mints a fresh Stripe session for exactly that amount.
//
// Safe to import from client components — no server-only dependencies.

export function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

/** Absolute URL — use for emails and PDFs, which are read outside the app. */
export function paymentResolverUrl(proposalId: string): string {
  return `${appBaseUrl()}/api/pay/${proposalId}`;
}

/** Relative URL — fine for in-app links and buttons. */
export function paymentResolverPath(proposalId: string): string {
  return `/api/pay/${proposalId}`;
}
