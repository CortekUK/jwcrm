// Single source of truth for the outbound email identity used by every edge
// function. Previously each function did:
//
//   Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'
//
// `resend.dev` is Resend's shared sandbox domain: no sending reputation and no
// SPF/DKIM/DMARC alignment with justwills.ae, which is why mail landed in Junk.
// The fallback is now the verified production sender, and any env override that
// points back at the sandbox is rejected so it can never silently regress.

const SANDBOX_DOMAIN = 'resend.dev';

/** Verified sender in Resend for the justwills.ae domain. */
const DEFAULT_FROM = 'Just Wills <noreply@justwills.ae>';

/** Monitored inbox so replies to automated mail reach a human. */
const DEFAULT_REPLY_TO = 'info@justwills.ae';

function safeEnv(name: string, fallback: string): string {
  const value = (Deno.env.get(name) || '').trim();
  if (!value) return fallback;
  if (value.toLowerCase().includes(SANDBOX_DOMAIN)) {
    console.warn(
      `${name} is set to a ${SANDBOX_DOMAIN} sandbox address; ignoring it and using ${fallback}`
    );
    return fallback;
  }
  return value;
}

/** `from` for every outbound email. */
export const EMAIL_FROM: string = safeEnv('FROM_EMAIL', DEFAULT_FROM);

/** `replyTo` for client- and staff-facing mail that has no more specific reply address. */
export const EMAIL_REPLY_TO: string = safeEnv('REPLY_TO_EMAIL', DEFAULT_REPLY_TO);
