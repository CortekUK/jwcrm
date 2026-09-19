// Outbound email identity — single source of truth for every Resend send.
//
// The previous fallback was Resend's shared sandbox sender. It has no sender
// reputation and no alignment with justwills.ae, so anything sent from it
// lands in Junk. It must never be reachable again: if FROM_EMAIL is unset — or
// is accidentally pointed back at the sandbox domain — we fall back to the
// verified production sender below, never to the sandbox.

const VERIFIED_FROM = "Just Wills <noreply@justwills.ae>";
// The shared inbox the team actually monitors (the address printed on every
// invoice). info@justwills.ae does not exist as a mailbox — Microsoft returns
// RecipientNotFound — so replies pointed there bounced back to the client.
const MONITORED_REPLY_TO = "info@just-wills.net";

// The only remaining mention of the sandbox domain in src/ — it is a
// blocklist entry, never a value we can send from.
const SANDBOX_DOMAIN = "resend.dev";

function safeSender(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return VERIFIED_FROM;
  if (trimmed.toLowerCase().includes(SANDBOX_DOMAIN)) {
    console.warn(
      "FROM_EMAIL points at the Resend sandbox domain; using the verified sender instead."
    );
    return VERIFIED_FROM;
  }
  return trimmed;
}

/** From address on all Resend mail. Domain justwills.ae is verified in Resend. */
export const EMAIL_FROM = safeSender(process.env.FROM_EMAIL);

/** Reply-To on client- and staff-facing mail, so replies reach a monitored inbox. */
export const EMAIL_REPLY_TO =
  process.env.REPLY_TO_EMAIL?.trim() || MONITORED_REPLY_TO;

/**
 * The domain we are authenticated to send from. Resend holds verified DKIM for
 * justwills.ae, which is what keeps client mail out of Junk — mail sent from
 * any other domain fails authentication and gets filtered.
 */
export const SENDING_DOMAIN = "justwills.ae";

/**
 * Send a client-facing email AS the account manager, rather than from the
 * generic noreply address, so the client sees a person and replies reach them.
 *
 * No mailbox connection is needed: the domain is verified, so Resend can sign
 * for any address on it. The guard is the point — an address on any other
 * domain (a personal gmail, an old cortek.uk account) would fail SPF/DKIM
 * alignment and land in Junk, which is the exact bug this replaces. Anything
 * off-domain silently falls back to the verified sender.
 */
export function senderFor(
  name: string | null | undefined,
  email: string | null | undefined
): string {
  const address = email?.trim().toLowerCase();
  if (!address || !address.endsWith(`@${SENDING_DOMAIN}`)) return EMAIL_FROM;

  // Strip characters that would break the "Name <addr>" header.
  const display = (name || "").replace(/["<>\r\n]/g, "").trim();
  return display ? `${display} <${address}>` : `Just Wills <${address}>`;
}
