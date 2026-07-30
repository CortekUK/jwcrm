/**
 * Shared read/write path for employee leave balances.
 *
 * Background
 * ----------
 * `leave_balances` has one hard-coded column pair per leave type
 * (annual_entitled/annual_used/annual_pending, sick_entitled/sick_used). HR can
 * create arbitrary leave types with `tracks_balance = true`, and the approval
 * code used to build a column name from `balance_field_prefix`
 * (e.g. `maternity_used`) and write it — a column that does not exist. Postgres
 * rejected the statement and nobody destructured `{ error }`, so the deduction
 * vanished silently, taking the `annual_pending` correction batched into the
 * same statement with it.
 *
 * Fix
 * ---
 * `employee_leave_balances` (migration 20260731000003) stores one row per
 * (employee, year, leave_type_slug), so ANY leave type can track a balance.
 *
 * Two safety properties this module guarantees:
 *
 *  1. **Dual-write.** Changes to `annual` and `sick` are ALSO written to the
 *     legacy `leave_balances` columns, in a separate statement, so those columns
 *     stay accurate and any consumer still reading them keeps working.
 *  2. **Degrades without the migration.** If `employee_leave_balances` does not
 *     exist yet, reads fall back to the legacy columns and writes to
 *     annual/sick still succeed via the dual-write. Only custom leave types
 *     report an error — loudly, instead of silently.
 *
 * Every write returns `{ error }`. Callers MUST surface it.
 */

import { supabase } from "@/integrations/supabase/client";

/** Table added by migration 20260731000003. */
export const EMPLOYEE_LEAVE_BALANCES_TABLE = "employee_leave_balances";

/**
 * The new table is not in `src/integrations/supabase/types.ts` — that file is
 * generated from the live schema and the migration has not been applied yet.
 * All access to it goes through this deliberately untyped handle; everything
 * this module *exports* is fully typed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untypedDb = supabase as any;

/** Leave type slugs that still have dedicated columns on `leave_balances`. */
export const LEGACY_BALANCE_SLUGS = ["annual", "sick"] as const;
export type LegacyBalanceSlug = (typeof LEGACY_BALANCE_SLUGS)[number];

/** Defaults used when an employee has no balance row yet (UAE statutory minimums). */
export const DEFAULT_ENTITLEMENT: Record<string, number> = {
  annual: 30,
  sick: 90,
};

export function defaultEntitlementFor(slug: string): number {
  return DEFAULT_ENTITLEMENT[slug] ?? 0;
}

export function isLegacyBalanceSlug(slug: string): slug is LegacyBalanceSlug {
  return (LEGACY_BALANCE_SLUGS as readonly string[]).includes(slug);
}

export interface LeaveBalanceError {
  message: string;
  code?: string;
}

export interface LeaveBalance {
  leave_type_slug: string;
  entitled: number;
  used: number;
  pending: number;
}

/** leave type slug -> balance */
export type LeaveBalanceMap = Record<string, LeaveBalance>;

/** The legacy `leave_balances` row, kept available for consumers that need its id. */
export interface LegacyLeaveBalanceRow {
  id: string;
  employee_id: string;
  year: number;
  annual_entitled: number | null;
  annual_used: number | null;
  annual_pending: number | null;
  sick_entitled: number | null;
  sick_used: number | null;
}

export interface FetchLeaveBalancesResult {
  /** employee_id -> (slug -> balance) */
  byEmployee: Record<string, LeaveBalanceMap>;
  /** employee_id -> legacy row (null-safe lookup; absent when no legacy row exists) */
  legacyByEmployee: Record<string, LegacyLeaveBalanceRow>;
  /** True when `employee_leave_balances` is missing and legacy columns were used. */
  degraded: boolean;
  error: LeaveBalanceError | null;
}

// ── Internals ────────────────────────────────────────────────────────────────

/**
 * Display coercion. Deliberately reproduces the `value || fallback` semantics the
 * balances and history pages already used, so a stored 0 keeps rendering as the
 * default entitlement exactly as it does today.
 */
function displayNum(value: unknown, fallback: number): number {
  return Number(value) || fallback;
}

/** Write coercion. Preserves a stored 0 verbatim — never substitutes a default. */
function toNum(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** True when the error means "employee_leave_balances does not exist yet". */
function isMissingTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  // 42P01 = undefined_table (Postgres). PGRST205/PGRST106 = PostgREST schema cache miss.
  if (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST106") return true;
  return typeof e.message === "string" &&
    /does not exist|could not find the table|schema cache/i.test(e.message);
}

function toBalanceError(error: unknown): LeaveBalanceError | null {
  if (!error) return null;
  const e = error as { code?: string; message?: string };
  return { message: e.message || "Unknown database error", code: e.code };
}

// ── Reads ────────────────────────────────────────────────────────────────────

/**
 * Read balances for a year, optionally restricted to a set of employees.
 *
 * Legacy `leave_balances` is read first and seeds the annual/sick entries; rows
 * from `employee_leave_balances` are then overlaid on top and win where present.
 * That ordering is what makes the page render identically before and after the
 * migration is applied.
 */
export async function fetchLeaveBalances(
  year: number,
  employeeIds?: string[],
): Promise<FetchLeaveBalancesResult> {
  const byEmployee: Record<string, LeaveBalanceMap> = {};
  const legacyByEmployee: Record<string, LegacyLeaveBalanceRow> = {};
  let degraded = false;
  let error: LeaveBalanceError | null = null;

  // 1. Legacy columns — the fallback, and still dual-written.
  let legacyQuery = supabase.from("leave_balances").select("*").eq("year", year);
  if (employeeIds && employeeIds.length > 0) {
    legacyQuery = legacyQuery.in("employee_id", employeeIds);
  }
  const { data: legacyRows, error: legacyError } = await legacyQuery;
  if (legacyError) error = toBalanceError(legacyError);

  for (const row of (legacyRows || []) as unknown as LegacyLeaveBalanceRow[]) {
    legacyByEmployee[row.employee_id] = row;
    byEmployee[row.employee_id] = {
      annual: {
        leave_type_slug: "annual",
        entitled: displayNum(row.annual_entitled, 30),
        used: displayNum(row.annual_used, 0),
        pending: displayNum(row.annual_pending, 0),
      },
      sick: {
        leave_type_slug: "sick",
        entitled: displayNum(row.sick_entitled, 90),
        used: displayNum(row.sick_used, 0),
        // No sick_pending column exists on the legacy table.
        pending: 0,
      },
    };
  }

  // 2. Per-leave-type table overlays the legacy figures where it has a row.
  let query = untypedDb
    .from(EMPLOYEE_LEAVE_BALANCES_TABLE)
    .select("employee_id, leave_type_slug, entitled, used, pending")
    .eq("year", year);
  if (employeeIds && employeeIds.length > 0) {
    query = query.in("employee_id", employeeIds);
  }
  const { data: rows, error: newError } = await query;

  if (newError) {
    if (isMissingTable(newError)) {
      degraded = true;
    } else if (!error) {
      error = toBalanceError(newError);
    }
  } else {
    for (const row of (rows || []) as Array<Record<string, unknown>>) {
      const employeeId = String(row.employee_id);
      const slug = String(row.leave_type_slug);
      const map = byEmployee[employeeId] || (byEmployee[employeeId] = {});
      map[slug] = {
        leave_type_slug: slug,
        entitled: displayNum(row.entitled, defaultEntitlementFor(slug)),
        used: displayNum(row.used, 0),
        pending: displayNum(row.pending, 0),
      };
    }
  }

  return { byEmployee, legacyByEmployee, degraded, error };
}

export interface FetchEmployeeLeaveBalancesResult {
  balances: LeaveBalanceMap;
  legacy: LegacyLeaveBalanceRow | null;
  degraded: boolean;
  error: LeaveBalanceError | null;
}

/** Convenience wrapper around {@link fetchLeaveBalances} for a single employee. */
export async function fetchEmployeeLeaveBalances(
  employeeId: string,
  year: number,
): Promise<FetchEmployeeLeaveBalancesResult> {
  const result = await fetchLeaveBalances(year, [employeeId]);
  return {
    balances: result.byEmployee[employeeId] || {},
    legacy: result.legacyByEmployee[employeeId] || null,
    degraded: result.degraded,
    error: result.error,
  };
}

/** Read a single slug out of a balance map, filling in defaults when absent. */
export function balanceFor(
  map: LeaveBalanceMap | undefined,
  slug: string,
): LeaveBalance {
  return (
    map?.[slug] || {
      leave_type_slug: slug,
      entitled: defaultEntitlementFor(slug),
      used: 0,
      pending: 0,
    }
  );
}

// ── Writes ───────────────────────────────────────────────────────────────────

export interface LeaveBalanceChange {
  employeeId: string;
  year: number;
  /** leave_types.slug / leave_requests.leave_type */
  slug: string;
  /** Days to add to `used`. Negative gives days back. */
  usedDelta?: number;
  /** Days to add to `pending`. Negative releases a reservation. */
  pendingDelta?: number;
  /** Absolute entitlement to store. Omit to leave the current value alone. */
  entitled?: number;
}

export interface LeaveBalanceWriteResult {
  error: LeaveBalanceError | null;
  /** True when `employee_leave_balances` is missing; annual/sick still persisted. */
  degraded: boolean;
}

interface LegacyPatch {
  annual_entitled?: number;
  annual_used?: number;
  annual_pending?: number;
  sick_entitled?: number;
  sick_used?: number;
}

/**
 * Dual-write for annual/sick. Runs as its OWN statement so it can never be
 * taken down by an unrelated failure on the per-type table (that batching was
 * the original bug). No-op for every other slug.
 */
async function writeLegacyBalance(
  change: LeaveBalanceChange,
  usedDelta: number,
  pendingDelta: number,
): Promise<LeaveBalanceError | null> {
  const { employeeId, year, slug, entitled } = change;
  if (!isLegacyBalanceSlug(slug)) return null;

  const { data: row, error: readError } = await supabase
    .from("leave_balances")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .maybeSingle();

  if (readError) return toBalanceError(readError);

  const patch: LegacyPatch = {};
  if (slug === "annual") {
    if (usedDelta !== 0) patch.annual_used = Math.max(0, toNum(row?.annual_used) + usedDelta);
    if (pendingDelta !== 0) {
      patch.annual_pending = Math.max(0, toNum(row?.annual_pending) + pendingDelta);
    }
    if (entitled !== undefined) patch.annual_entitled = entitled;
  } else {
    if (usedDelta !== 0) patch.sick_used = Math.max(0, toNum(row?.sick_used) + usedDelta);
    if (entitled !== undefined) patch.sick_entitled = entitled;
    // `leave_balances` has no sick_pending column — sick pending lives only in
    // the new table, which is why nothing is dropped here.
  }

  if (Object.keys(patch).length === 0) return null;

  if (row) {
    const { error } = await supabase
      .from("leave_balances")
      .update(patch)
      .eq("id", row.id);
    return toBalanceError(error);
  }

  const { error } = await supabase
    .from("leave_balances")
    .insert({ employee_id: employeeId, year, ...patch });
  return toBalanceError(error);
}

/**
 * Apply a balance change for one (employee, year, leave type).
 *
 * Writes the per-leave-type table, then dual-writes the legacy annual/sick
 * columns as a separate statement. Always returns `{ error }` — surface it.
 */
export async function applyLeaveBalanceChange(
  change: LeaveBalanceChange,
): Promise<LeaveBalanceWriteResult> {
  const { employeeId, year, slug } = change;
  const usedDelta = change.usedDelta ?? 0;
  const pendingDelta = change.pendingDelta ?? 0;

  let degraded = false;
  let error: LeaveBalanceError | null = null;

  // 1. Per-leave-type table.
  const { data: existing, error: readError } = await untypedDb
    .from(EMPLOYEE_LEAVE_BALANCES_TABLE)
    .select("id, entitled, used, pending")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .eq("leave_type_slug", slug)
    .maybeSingle();

  if (readError && isMissingTable(readError)) {
    degraded = true;
  } else if (readError) {
    error = toBalanceError(readError);
  } else {
    const current = existing as Record<string, unknown> | null;
    const nextUsed = Math.max(0, toNum(current?.used) + usedDelta);
    const nextPending = Math.max(0, toNum(current?.pending) + pendingDelta);
    const nextEntitled =
      change.entitled !== undefined
        ? change.entitled
        : current
          ? toNum(current.entitled)
          : defaultEntitlementFor(slug);

    if (current) {
      const { error: updateError } = await untypedDb
        .from(EMPLOYEE_LEAVE_BALANCES_TABLE)
        .update({
          entitled: nextEntitled,
          used: nextUsed,
          pending: nextPending,
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id);
      if (updateError) error = toBalanceError(updateError);
    } else {
      const { error: insertError } = await untypedDb
        .from(EMPLOYEE_LEAVE_BALANCES_TABLE)
        .insert({
          employee_id: employeeId,
          year,
          leave_type_slug: slug,
          entitled: nextEntitled,
          used: nextUsed,
          pending: nextPending,
        });
      if (insertError) error = toBalanceError(insertError);
    }
  }

  // 2. Legacy dual-write (separate statement, independent failure).
  const legacyError = await writeLegacyBalance(change, usedDelta, pendingDelta);
  if (legacyError && !error) error = legacyError;

  // 3. Without the new table a custom leave type has nowhere to go. Say so
  //    instead of failing silently, which is the bug this replaces.
  if (degraded && !isLegacyBalanceSlug(slug) && !error) {
    error = {
      code: "MISSING_BALANCE_TABLE",
      message:
        `Balance tracking for "${slug}" requires the employee_leave_balances table. ` +
        `Apply migration 20260731000003_create_employee_leave_balances.sql.`,
    };
  }

  return { error, degraded };
}

/** Set an absolute entitlement for one leave type. */
export async function setLeaveEntitlement(
  employeeId: string,
  year: number,
  slug: string,
  entitled: number,
): Promise<LeaveBalanceWriteResult> {
  return applyLeaveBalanceChange({ employeeId, year, slug, entitled });
}
