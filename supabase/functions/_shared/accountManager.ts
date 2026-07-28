// Resolving the staff recipient for a client-raised message.
//
// A will can have an account manager assigned (wills.account_manager_id).
// Anything the client raises against that will — a support message, an edit
// request — should reach that person rather than a shared inbox, so that a
// client with two different managers never has their case handled by the
// wrong one.
//
// When the will is unassigned, or the message isn't about a specific will,
// this falls back to the general admin address.
//
// NOTE ON THE TEST-MODE SWAP: the Resend account in use is a trial that can
// only deliver to one verified address. So the *real* recipient is resolved
// and reported here, but `applyTestModeSwap` redirects the actual send until
// PRODUCTION_EMAIL_MODE is set. The intended address is preserved in the
// subject line so routing can be verified before go-live. This mirrors
// src/lib/integrations/sendUserEmail.ts.

// deno-lint-ignore-file no-explicit-any

export interface StaffRecipient {
  email: string;
  name: string;
  /** True when this is a specific account manager rather than the fallback. */
  isAccountManager: boolean;
}

export function getAdminFallbackEmail(): string {
  return Deno.env.get('ADMIN_EMAIL') || 'aw736024@gmail.com';
}

/**
 * Resolve who should receive a client message about `willId`.
 * Never throws — any lookup failure degrades to the admin fallback so a
 * message is never silently lost.
 */
export async function resolveStaffRecipient(
  supabase: any,
  willId: string | null | undefined
): Promise<StaffRecipient> {
  const fallback: StaffRecipient = {
    email: getAdminFallbackEmail(),
    name: 'Just Wills Admin',
    isAccountManager: false,
  };

  if (!willId) return fallback;

  try {
    const { data: will, error: willError } = await supabase
      .from('wills')
      .select('account_manager_id')
      .eq('id', willId)
      .maybeSingle();

    if (willError || !will?.account_manager_id) return fallback;

    const managerId = will.account_manager_id;

    // The email lives on auth.users; the display name lives on profiles.
    const { data: authUser, error: authError } =
      await supabase.auth.admin.getUserById(managerId);
    const managerEmail = authUser?.user?.email;
    if (authError || !managerEmail) return fallback;

    const { data: managerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', managerId)
      .maybeSingle();

    return {
      email: managerEmail,
      name: managerProfile?.full_name || 'Your account manager',
      isAccountManager: true,
    };
  } catch (err) {
    console.error('resolveStaffRecipient failed, falling back to admin:', err);
    return fallback;
  }
}

/**
 * Redirect the send to the Resend-verified inbox until production mode is on,
 * preserving the address the message was actually addressed to.
 */
export function applyTestModeSwap(
  intendedEmail: string,
  subject: string
): { to: string; subject: string; isTestMode: boolean } {
  const isTestMode = !Deno.env.get('PRODUCTION_EMAIL_MODE');
  if (!isTestMode) {
    return { to: intendedEmail, subject, isTestMode: false };
  }
  return {
    to: getAdminFallbackEmail(),
    subject: `[Original: ${intendedEmail}] ${subject}`,
    isTestMode: true,
  };
}
