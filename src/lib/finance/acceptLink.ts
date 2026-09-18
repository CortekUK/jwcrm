// Where an "Accept this proposal" link should point.
//
// Two rules are baked into these paths, and both matter:
//
//  1. The link in an email or a PDF points at a PAGE, never at the API route.
//     Corporate mail scanners (Outlook ATP, most antivirus gateways) fetch
//     every link in a message before the recipient ever sees it. A link that
//     accepted on GET would mark proposals accepted by machines, in bulk, the
//     moment the email was delivered. The page shows what is being accepted
//     and only its button POSTs.
//
//  2. The proposal UUID is the whole secret, exactly as it already is for
//     /api/pay/[proposalId] — the client accepting is not a CRM user and has
//     nothing to log in with.
//
// Safe to import from client components — no server-only dependencies.

import { appBaseUrl } from "./paymentLink";

/** Absolute URL — use for emails and PDFs, which are read outside the app. */
export function proposalAcceptUrl(proposalId: string): string {
  return `${appBaseUrl()}/proposal/${proposalId}/accept`;
}

/** Relative URL — fine for in-app links and buttons. */
export function proposalAcceptPath(proposalId: string): string {
  return `/proposal/${proposalId}/accept`;
}

/** The POST-only endpoint the confirm button calls. Never linked from email. */
export function proposalAcceptApiPath(proposalId: string): string {
  return `/api/proposal/${proposalId}/accept`;
}
