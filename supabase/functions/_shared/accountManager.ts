// Resolving the staff recipient for a client-raised message.
//
// A will can have an account manager assigned (wills.account_manager_id).
// Anything the client raises against that will — a support message, an edit
// request — should reach that person rather than a shared inbox, so that a
// client with two different managers never has their case handled by the
// wrong one.
//
// When the will is unassigned, or the message isn't about a specific will,
// this falls back to the general monitored inbox (ADMIN_EMAIL, defaulting to
// info@justwills.ae). Mail is always delivered to the resolved recipient —
// there is no test-mode redirect.

// deno-lint-ignore-file no-explicit-any

import { EMAIL_REPLY_TO } from './email.ts';

export interface StaffRecipient {
  email: string;
  name: string;
  /** True when this is a specific account manager rather than the fallback. */
  isAccountManager: boolean;
}

export function getAdminFallbackEmail(): string {
  return (Deno.env.get('ADMIN_EMAIL') || '').trim() || EMAIL_REPLY_TO;
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
