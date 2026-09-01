// Creates the client's portal account.
//
// This used to live inline in the Stripe webhook and fired only when an invoice
// was settled in full. Two things were wrong with that:
//
//  1. Clients pay the will-drafting fee first precisely so work can begin — and
//     the work needs the portal. Waiting for the court fees meant the portal
//     appeared long after it was needed.
//  2. A client who paid that fee by bank transfer got nothing at all, because
//     the manual "record payment" path never provisioned anything.
//
// So the gate is now "the upfront line items are covered", and both payment
// paths call this one function. On an unstaged invoice "upfront covered" means
// the same as "settled in full", so legacy invoices behave exactly as before.

import type { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { Resend } from "resend";
import { EMAIL_FROM, EMAIL_REPLY_TO } from "@/config/email";
import { paymentResolverUrl } from "@/lib/finance/paymentLink";
import {
  buildPortalWelcomeEmailHTML,
  buildPortalWelcomeSubject,
} from "@/lib/email/clientPortalWelcomeEmail";
import type { StageState } from "@/lib/finance/invoiceAmounts";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Every app_role except "client" (verified against the live enum).
 *
 * If a lead's email happens to match a staff account, linking it would hand
 * that account a client portal role rather than create a client — so we refuse
 * and surface it instead.
 */
const PRIVILEGED_ROLES = new Set([
  "admin",
  "superadmin",
  "finance",
  "lead_management",
  "salesperson",
  "account_manager",
  "hr",
]);

export type ProvisionOutcome =
  | { status: "created"; userId: string; emailSent: boolean }
  | { status: "linked_existing"; userId: string; emailSent: boolean }
  | { status: "already_provisioned"; userId: string }
  | {
      status: "skipped";
      reason: "upfront_not_covered" | "no_email" | "no_lead" | "privileged_account";
    }
  | { status: "failed"; error: string };

export type ProvisionInput = {
  leadId: string | null | undefined;
  proposalId: string;
  email: string | null | undefined;
  fullName: string | null | undefined;
  stageState: StageState;
  currency: string;
};

function generatePassword(): string {
  return crypto.randomBytes(12).toString("base64url");
}

function portalUrl(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/client`;
}

async function hasPrivilegedRole(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return (data || []).some((r: { role: string }) => PRIVILEGED_ROLES.has(r.role));
}

/**
 * `handle_new_user` (trigger on auth.users) already creates the profile row and
 * inserts the role from user_metadata, so we do NOT write those here — the
 * webhook used to, which risked a unique violation on (user_id, role).
 *
 * We do verify the role landed: if that trigger ever changes, a client would
 * otherwise end up with an account that cannot see anything.
 */
async function ensureClientRole(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<void> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "client")
    .maybeSingle();

  if (!data) {
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "client" });
    // 23505 = the trigger got there first. Not an error.
    if (error && error.code !== "23505") {
      console.error("Could not assign client role:", error);
    }
  }
}

async function sendWelcome(
  input: ProvisionInput,
  opts: { password?: string; recoveryUrl?: string }
): Promise<boolean> {
  const { stageState, currency, email, fullName, proposalId } = input;
  const data = {
    leadName: fullName || "",
    leadEmail: email as string,
    portalUrl: portalUrl(),
    password: opts.password,
    recoveryUrl: opts.recoveryUrl,
    fullySettled: stageState.fullySettled,
    amountReceived: stageState.totalPaid,
    balanceDue: Math.max(0, stageState.balanceDue),
    currency,
    payBalanceUrl: stageState.fullySettled
      ? undefined
      : paymentResolverUrl(proposalId),
  };

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email as string,
      replyTo: EMAIL_REPLY_TO,
      subject: buildPortalWelcomeSubject(data),
      html: buildPortalWelcomeEmailHTML(data),
    });
    return true;
  } catch (emailError) {
    // The account exists and is linked; a failed email must not undo that or
    // cause a retry to create a second account.
    console.error("Error sending portal welcome email:", emailError);
    return false;
  }
}

export async function provisionClientPortalAccount(
  supabaseAdmin: SupabaseClient,
  input: ProvisionInput
): Promise<ProvisionOutcome> {
  const { leadId, email, fullName, stageState } = input;

  // The single gate. Everything downstream depends on this being the only
  // place the decision is made.
  if (!stageState.upfrontCovered) {
    return { status: "skipped", reason: "upfront_not_covered" };
  }
  if (!leadId) return { status: "skipped", reason: "no_lead" };
  if (!email) return { status: "skipped", reason: "no_email" };

  // Idempotency: survives Stripe webhook retries, and a manual payment recorded
  // after a card payment on the same invoice.
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("portal_user_id")
    .eq("id", leadId)
    .maybeSingle();

  if (lead?.portal_user_id) {
    return { status: "already_provisioned", userId: lead.portal_user_id };
  }

  const password = generatePassword();
  const { data: created, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || "",
        // handle_new_user reads this; without it the trigger falls back to
        // 'client' anyway, but being explicit keeps the two in agreement.
        role: "client",
        locale: "en",
        source: "lead_conversion",
        lead_id: leadId,
      },
    });

  let userId: string;
  let linkedExisting = false;
  let recoveryUrl: string | undefined;

  if (createError) {
    if (!createError.message?.includes("already been registered")) {
      console.error("Error creating portal auth user:", createError);
      return { status: "failed", error: createError.message || "createUser failed" };
    }

    // The address already has an account. The old code logged this and moved
    // on, silently leaving that client without the client role — and it could
    // not do better, because auth.users is not reachable over PostgREST.
    const { data: existingId, error: lookupError } = await supabaseAdmin.rpc(
      "find_auth_user_id_by_email",
      { p_email: email }
    );
    if (lookupError || !existingId) {
      console.error("Could not resolve existing auth user:", lookupError);
      return {
        status: "failed",
        error: "Account already exists but could not be linked",
      };
    }

    // Never quietly attach a client portal to a staff account.
    if (await hasPrivilegedRole(supabaseAdmin, existingId as string)) {
      console.warn(
        `Refusing to link lead ${leadId} to privileged account ${existingId}`
      );
      return { status: "skipped", reason: "privileged_account" };
    }

    userId = existingId as string;
    linkedExisting = true;

    // Send a set-password link rather than inventing a new password for an
    // account the person may already be using.
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    recoveryUrl = linkData?.properties?.action_link;
  } else {
    userId = created!.user.id;
  }

  await ensureClientRole(supabaseAdmin, userId);

  // Mark the lead BEFORE emailing: if the email throws, the account still
  // exists, and a retry must not create a second one.
  const { error: linkError } = await supabaseAdmin
    .from("leads")
    .update({
      portal_user_id: userId,
      portal_created_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (linkError) {
    console.error("Could not link portal account to lead:", linkError);
  }

  const emailSent = await sendWelcome(
    input,
    linkedExisting ? { recoveryUrl } : { password }
  );

  return linkedExisting
    ? { status: "linked_existing", userId, emailSent }
    : { status: "created", userId, emailSent };
}
