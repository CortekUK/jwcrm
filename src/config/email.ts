// Outbound email identity — single source of truth for every Resend send.
//
// The previous fallback was Resend's shared sandbox sender. It has no sender
// reputation and no alignment with justwills.ae, so anything sent from it
// lands in Junk. It must never be reachable again: if FROM_EMAIL is unset — or
// is accidentally pointed back at the sandbox domain — we fall back to the
// verified production sender below, never to the sandbox.

const VERIFIED_FROM = "Just Wills <noreply@justwills.ae>";
const MONITORED_REPLY_TO = "info@justwills.ae";

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
