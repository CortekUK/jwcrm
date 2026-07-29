/**
 * Server-side reader/writer for the lead-management settings rows.
 *
 * SERVER ONLY — never import this from a client component; it is compiled
 * against the service-role key.
 *
 * Every getter merges the stored jsonb over the defaults, so a row that was
 * written before a field existed still yields a complete object instead of
 * `undefined` silently disabling a feature.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_LEAD_AUTOMATION,
  DEFAULT_LEAD_CADENCE,
  DEFAULT_LEAD_NOTIFICATIONS,
  DEFAULT_LEAD_TEAM,
  DEFAULT_LEAD_TEMPLATES,
  LEAD_SETTING_KEYS,
  LEAD_SETTINGS_WRITE_ROLES,
  TEAM_TIMEZONE,
  type LeadAutomationSettings,
  type LeadCadenceSettings,
  type LeadEmailTemplate,
  type LeadNotificationSettings,
  type LeadTeamSettings,
} from "./settingsTypes";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export { supabaseAdmin as leadSettingsAdmin };

async function readRaw(key: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", key)
    .maybeSingle();
  if (error) {
    console.error(`Failed to read system_settings/${key}:`, error.message);
    return null;
  }
  const value = data?.setting_value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function readSettingRow(
  key: string
): Promise<{ setting_value: unknown; updated_at: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select("setting_value, updated_at")
    .eq("setting_key", key)
    .maybeSingle();
  if (error || !data) return null;
  return data as { setting_value: unknown; updated_at: string | null };
}

export async function writeSettingRow(
  key: string,
  value: unknown,
  description: string
): Promise<{ setting_value: unknown; updated_at: string | null }> {
  const { data: existing } = await supabaseAdmin
    .from("system_settings")
    .select("id")
    .eq("setting_key", key)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .update({ setting_value: value })
      .eq("setting_key", key)
      .select("setting_value, updated_at")
      .single();
    if (error) throw error;
    return data as { setting_value: unknown; updated_at: string | null };
  }

  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .insert({ setting_key: key, setting_value: value, description })
    .select("setting_value, updated_at")
    .single();
  if (error) throw error;
  return data as { setting_value: unknown; updated_at: string | null };
}

/* ------------------------------------------------------------------ */
/* Typed getters                                                       */
/* ------------------------------------------------------------------ */

export async function getLeadNotificationSettings(): Promise<LeadNotificationSettings> {
  const raw = await readRaw(LEAD_SETTING_KEYS.notifications);
  return { ...DEFAULT_LEAD_NOTIFICATIONS, ...(raw || {}) } as LeadNotificationSettings;
}

export async function getLeadEmailTemplates(): Promise<LeadEmailTemplate[]> {
  const raw = await readRaw(LEAD_SETTING_KEYS.templates);
  const stored = raw?.templates;
  if (!Array.isArray(stored)) return DEFAULT_LEAD_TEMPLATES;
  // Defaults supply any template the stored row never learned about, so a
  // newly added template id can never resolve to `undefined`.
  return DEFAULT_LEAD_TEMPLATES.map((fallback) => {
    const match = (stored as LeadEmailTemplate[]).find((t) => t?.id === fallback.id);
    return match ? ({ ...fallback, ...match } as LeadEmailTemplate) : fallback;
  });
}

export async function getLeadAutomationSettings(): Promise<LeadAutomationSettings> {
  const raw = await readRaw(LEAD_SETTING_KEYS.automation);
  if (!raw) return DEFAULT_LEAD_AUTOMATION;
  const rules = Array.isArray(raw.rules)
    ? DEFAULT_LEAD_AUTOMATION.rules.map((fallback) => {
        const match = (raw.rules as LeadAutomationRuleLike[]).find(
          (r) => r?.id === fallback.id
        );
        return match ? { ...fallback, isActive: !!match.isActive } : fallback;
      })
    : DEFAULT_LEAD_AUTOMATION.rules;
  const staleLeadDays =
    typeof raw.staleLeadDays === "number" && raw.staleLeadDays > 0
      ? Math.floor(raw.staleLeadDays)
      : DEFAULT_LEAD_AUTOMATION.staleLeadDays;
  return { rules, staleLeadDays };
}

type LeadAutomationRuleLike = { id?: string; isActive?: boolean };

export async function getLeadTeamSettings(): Promise<LeadTeamSettings> {
  const raw = await readRaw(LEAD_SETTING_KEYS.team);
  return { ...DEFAULT_LEAD_TEAM, ...(raw || {}) } as LeadTeamSettings;
}

export async function getLeadCadenceSettings(): Promise<LeadCadenceSettings> {
  const raw = await readRaw(LEAD_SETTING_KEYS.cadence);
  if (!raw) return DEFAULT_LEAD_CADENCE;
  return {
    ...DEFAULT_LEAD_CADENCE,
    ...raw,
    failedOutcomes: Array.isArray(raw.failedOutcomes)
      ? (raw.failedOutcomes as string[])
      : DEFAULT_LEAD_CADENCE.failedOutcomes,
  } as LeadCadenceSettings;
}

/* ------------------------------------------------------------------ */
/* Caller resolution + write permission                                */
/* ------------------------------------------------------------------ */

export async function resolveCallerId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!accessToken) return null;
  const { data } = await supabaseAdmin.auth.getUser(accessToken);
  return data?.user?.id ?? null;
}

export type SettingsAuthResult =
  | { ok: true; callerId: string }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Mirrors `assertCanManageLeadDeal` in proposalInvoice.ts: resolve the caller
 * from the Bearer JWT, then check `user_roles`. Client-side disabling of the
 * controls is cosmetic — this is the actual gate.
 */
export async function assertCanWriteLeadSettings(
  request: Request
): Promise<SettingsAuthResult> {
  const callerId = await resolveCallerId(request);
  if (!callerId) return { ok: false, status: 401, error: "Unauthorized" };

  const { data: roleRows, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId);
  if (error) return { ok: false, status: 403, error: "Role lookup failed" };

  const roles = new Set((roleRows || []).map((r: { role: string }) => r.role));
  const allowed = (LEAD_SETTINGS_WRITE_ROLES as readonly string[]).some((r) =>
    roles.has(r)
  );
  if (!allowed) return { ok: false, status: 403, error: "Forbidden" };

  return { ok: true, callerId };
}

/* ------------------------------------------------------------------ */
/* Working hours                                                       */
/* ------------------------------------------------------------------ */

function minutesOf(hhmm: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || "").trim());
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return fallback;
  return h * 60 + min;
}

/**
 * Is `when` inside the team's configured working window?
 *
 * Working DAYS are deliberately not modelled — the brief asked for a time
 * window only, so every day is a working day. A start >= end (an overnight
 * window) is treated as "always open" rather than silently blocking all mail.
 */
export function isWithinWorkingHours(
  team: LeadTeamSettings,
  when: Date = new Date()
): boolean {
  const start = minutesOf(team.workingHoursStart, 0);
  const end = minutesOf(team.workingHoursEnd, 24 * 60);
  if (start >= end) return true;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TEAM_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(when);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const nowMinutes = hour * 60 + minute;

  return nowMinutes >= start && nowMinutes < end;
}

export type { SupabaseClient };
