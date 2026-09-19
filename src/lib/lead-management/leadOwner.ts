// Who a lead's client-facing email should come FROM.
//
// Client mail used to go out either from a generic noreply address or, when a
// staff member had connected Outlook, from whatever mailbox that happened to be
// — in practice an address on an unrelated domain, which failed authentication
// and landed invoices in Junk.
//
// Now it goes out as the person who owns the lead, on the verified sending
// domain. No mailbox connection is required: the domain is verified with the
// email provider, so it can sign for any address on it. `senderFor` refuses
// anything off-domain, so an owner whose login is a personal address falls back
// to the generic sender rather than quietly breaking deliverability.

import type { SupabaseClient } from "@supabase/supabase-js";
import { companyDetails } from "@/config/company";
import { senderFor } from "@/config/email";

export type LeadOwner = {
  name: string;
  email: string;
  /** Ready for the `from` field — already domain-guarded. */
  sender: string;
};

/**
 * Resolve the owner of a lead. Falls back to the company contact when the lead
 * is unassigned, so a client-facing email never has a blank sender.
 */
export async function resolveLeadOwner(
  supabaseAdmin: SupabaseClient,
  assignedTo: string | null | undefined
): Promise<LeadOwner> {
  let name = companyDetails.defaultContactName;
  let email = companyDetails.invoiceEmail;

  if (assignedTo) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", assignedTo)
      .maybeSingle();
    if (profile?.full_name) name = profile.full_name;

    // The login address is the owner's real mailbox; profiles has no email.
    const { data: auth } = await supabaseAdmin.auth.admin.getUserById(assignedTo);
    if (auth?.user?.email) email = auth.user.email;
  }

  return { name, email, sender: senderFor(name, email) };
}
