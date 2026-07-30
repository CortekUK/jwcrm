/**
 * Multi-step leave approval: rule matching, step tracking, delegation.
 *
 * Background
 * ----------
 * `leave_approval_rules` (migration 20260128000004) has always had
 * requires_manager_approval / requires_hr_approval / requires_director_approval
 * switches, and `leave_requests` has always had `approval_rule_id`,
 * `current_approval_step` and `total_approval_steps` columns — but nothing in the
 * repo ever wrote them. Approval was a single status update, so one click by
 * anyone in HR closed the request and the switches gated nothing.
 *
 * This module is the single place that:
 *   1. resolves which rule applies to a request and persists it on creation
 *      (`initializeApprovalWorkflow`),
 *   2. answers "which role is this request waiting on, and may *I* act?"
 *      (`fetchApprovalState`, `buildApprovalActorContext` + `authorizeStep`),
 *   3. records a decision, advances the chain, and reports whether that
 *      decision was the FINAL one (`recordApprovalDecision`).
 *
 * The balance deduction deliberately lives OUTSIDE this module: the caller runs
 * `applyLeaveBalanceChange` only when `recordApprovalDecision` reports
 * `isFinal`.
 *
 * Role mapping (important)
 * ------------------------
 * `app_role` has no 'manager' and no 'director' member. The three switches are
 * therefore mapped onto what actually exists:
 *
 *   manager  -> the employee's own manager (`employees.manager_id` -> that
 *               employee's linked `user_id`). If the employee has no manager, or
 *               the manager has no dashboard account, the step falls back to
 *               hr/admin/superadmin so requests cannot become unactionable.
 *   hr       -> app_role 'hr' (plus 'admin'/'superadmin', who administer everything)
 *   director -> app_role 'admin' or 'superadmin' — there is no 'director' role.
 *
 * Legacy requests
 * ---------------
 * Requests created before this existed have `approval_rule_id = NULL` and
 * `total_approval_steps` 1 or NULL. They are reported as `isLegacy` and behave
 * exactly as before: a single step, approvable by HR/admin, final immediately.
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * `leave_approval_rules`, `leave_approval_steps` and `leave_approval_delegations`
 * are not in `src/integrations/supabase/types.ts` (that file is generated from a
 * schema snapshot that predates them), and `leave_requests` in the generated
 * types is missing the workflow columns. All access to them goes through this
 * deliberately untyped handle; everything this module *exports* is fully typed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untypedDb = supabase as any;

export type ApproverRole = "manager" | "hr" | "director";

/** app_roles that satisfy each approver role. `manager` is resolved per-employee. */
const ROLE_APP_ROLES: Record<ApproverRole, string[]> = {
  manager: [],
  hr: ["hr", "admin", "superadmin"],
  director: ["admin", "superadmin"],
};

/** Used when an employee has no manager on file, so a step is never a dead end. */
const MANAGER_FALLBACK_APP_ROLES = ["hr", "admin", "superadmin"];

export const APPROVER_ROLE_LABELS: Record<ApproverRole, string> = {
  manager: "Manager",
  hr: "HR",
  director: "Director",
};

export interface LeaveApprovalRule {
  id: string;
  leave_type: string | null;
  min_days: number;
  max_days: number | null;
  requires_manager_approval: boolean;
  requires_hr_approval: boolean;
  requires_director_approval: boolean;
  escalation_days: number;
  priority: number;
  is_active: boolean;
}

export interface LeaveApprovalStepRecord {
  id: string;
  step_order: number;
  approver_type: string;
  status: string;
  response_at: string | null;
  response_by: string | null;
  approver_id: string | null;
  delegate_for?: string | null;
  comments: string | null;
}

export interface ApprovalError {
  message: string;
  code?: string;
}

// ---------------------------------------------------------------------------
// Rule matching
// ---------------------------------------------------------------------------

/**
 * Mirrors the SQL function `get_applicable_approval_rule` exactly: active rules
 * whose leave_type matches (or is NULL = all types) and whose min/max day window
 * contains the request, ordered so a leave-type-specific rule beats a generic
 * one, then by `priority` ascending.
 *
 * Kept in TS (rather than an `.rpc()` call) because every caller also needs the
 * rule's requires_* flags, which the SQL function does not return — one query
 * for all active rules serves both. The SQL function is still the authority on
 * the INSERT path via the `set_leave_approval_plan` trigger.
 */
export function matchApprovalRule(
  rules: LeaveApprovalRule[],
  leaveType: string,
  totalDays: number,
): LeaveApprovalRule | null {
  const candidates = rules.filter((rule) => {
    if (rule.is_active === false) return false;
    const typeMatch = rule.leave_type === null || rule.leave_type === leaveType;
    const minMatch = totalDays >= (rule.min_days ?? 1);
    const maxMatch = rule.max_days === null || rule.max_days === undefined || totalDays <= rule.max_days;
    return typeMatch && minMatch && maxMatch;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aSpecific = a.leave_type !== null ? 0 : 1;
    const bSpecific = b.leave_type !== null ? 0 : 1;
    if (aSpecific !== bSpecific) return aSpecific - bSpecific;
    return (a.priority ?? 100) - (b.priority ?? 100);
  });

  return candidates[0];
}

/** The ordered chain of approver roles a rule requires. */
export function chainForRule(rule: LeaveApprovalRule | null): ApproverRole[] {
  if (!rule) return [];
  const chain: ApproverRole[] = [];
  if (rule.requires_manager_approval) chain.push("manager");
  if (rule.requires_hr_approval) chain.push("hr");
  if (rule.requires_director_approval) chain.push("director");
  return chain;
}

export async function fetchActiveApprovalRules(): Promise<LeaveApprovalRule[]> {
  const { data, error } = await untypedDb
    .from("leave_approval_rules")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (error) {
    console.error("Failed to load leave approval rules:", error);
    return [];
  }
  return (data || []) as LeaveApprovalRule[];
}

export interface ApprovalPlan {
  ruleId: string | null;
  chain: ApproverRole[];
  totalSteps: number;
}

/** Resolve the plan for a brand-new request. */
export async function resolveApprovalPlan(
  leaveType: string,
  totalDays: number,
  preloadedRules?: LeaveApprovalRule[],
): Promise<ApprovalPlan> {
  const rules = preloadedRules ?? (await fetchActiveApprovalRules());
  const rule = matchApprovalRule(rules, leaveType, totalDays);
  const chain = chainForRule(rule);

  // A matched rule with every switch off still needs someone to sign off;
  // treat it as a single HR step rather than auto-approving.
  if (rule && chain.length === 0) {
    return { ruleId: rule.id, chain: ["hr"], totalSteps: 1 };
  }
  if (!rule) {
    return { ruleId: null, chain: [], totalSteps: 1 };
  }
  return { ruleId: rule.id, chain, totalSteps: chain.length };
}

/**
 * Persist `approval_rule_id` / `total_approval_steps` / `current_approval_step`
 * on a freshly created request. Safe to call more than once: it does nothing if
 * a plan is already recorded (e.g. by the `set_leave_approval_plan` trigger).
 */
export async function initializeApprovalWorkflow(
  requestId: string,
  leaveType: string,
  totalDays: number,
  preloadedRules?: LeaveApprovalRule[],
): Promise<{ error: ApprovalError | null }> {
  try {
    const { data: existing } = await untypedDb
      .from("leave_requests")
      .select("approval_rule_id, total_approval_steps")
      .eq("id", requestId)
      .maybeSingle();

    if (existing?.approval_rule_id) {
      return { error: null };
    }

    const plan = await resolveApprovalPlan(leaveType, totalDays, preloadedRules);
    if (!plan.ruleId) {
      // No rule matches this request; leave it as a single-step request so it
      // behaves exactly like everything created before this feature existed.
      return { error: null };
    }

    const { error } = await untypedDb
      .from("leave_requests")
      .update({
        approval_rule_id: plan.ruleId,
        total_approval_steps: plan.totalSteps,
        current_approval_step: 1,
      })
      .eq("id", requestId);

    if (error) return { error: { message: error.message, code: error.code } };
    return { error: null };
  } catch (err) {
    return {
      error: { message: err instanceof Error ? err.message : "Unknown error" },
    };
  }
}

// ---------------------------------------------------------------------------
// Per-request approval state
// ---------------------------------------------------------------------------

export interface LeaveRequestApprovalInput {
  id: string;
  employee_id: string;
  leave_type: string;
  total_days: number;
  approval_rule_id?: string | null;
  current_approval_step?: number | null;
  total_approval_steps?: number | null;
}

export interface LeaveApprovalState {
  requestId: string;
  rule: LeaveApprovalRule | null;
  chain: ApproverRole[];
  currentStep: number;
  totalSteps: number;
  /** Role the request is currently waiting on. */
  currentRole: ApproverRole | null;
  /** True for requests created before multi-step approval existed. */
  isLegacy: boolean;
  history: LeaveApprovalStepRecord[];
}

/**
 * Build the approval state for a request. Prefers the rule persisted on the
 * request; falls back to matching live rules for requests created before the
 * plan was written (those are still treated as single-step — see `isLegacy`).
 */
export async function fetchApprovalState(
  request: LeaveRequestApprovalInput,
  preloadedRules?: LeaveApprovalRule[],
): Promise<LeaveApprovalState> {
  const rules = preloadedRules ?? (await fetchActiveApprovalRules());
  const rule = request.approval_rule_id
    ? rules.find((r) => r.id === request.approval_rule_id) ?? null
    : null;

  const isLegacy = !request.approval_rule_id;
  const chain = isLegacy ? [] : chainForRule(rule);
  const effectiveChain: ApproverRole[] = chain.length > 0 ? chain : ["hr"];

  const totalSteps = isLegacy
    ? 1
    : Math.max(1, request.total_approval_steps || effectiveChain.length);
  const currentStep = Math.min(
    Math.max(1, request.current_approval_step || 1),
    totalSteps,
  );

  let history: LeaveApprovalStepRecord[] = [];
  const { data: steps } = await untypedDb
    .from("leave_approval_steps")
    .select("*")
    .eq("leave_request_id", request.id)
    .order("step_order", { ascending: true });
  history = (steps || []) as LeaveApprovalStepRecord[];

  return {
    requestId: request.id,
    rule,
    chain: effectiveChain,
    currentStep,
    totalSteps,
    currentRole: effectiveChain[currentStep - 1] ?? "hr",
    isLegacy,
    history,
  };
}

// ---------------------------------------------------------------------------
// Who may act
// ---------------------------------------------------------------------------

export interface StepAuthorization {
  allowed: boolean;
  /**
   * When the caller is acting under a delegation, the user id of the approver
   * they are standing in for. Recorded on the step for the audit trail.
   */
  delegateFor: string | null;
  /** Human-readable explanation when `allowed` is false. */
  reason?: string;
}

interface DelegationRow {
  delegator_id: string;
  leave_types: string[] | null;
  max_days: number | null;
}

/**
 * Everything needed to decide "may this user act at step X of request Y",
 * loaded once. Three small queries total, so a list of 200 pending requests
 * costs the same as one.
 */
export interface ApprovalActorContext {
  userId: string | null;
  /** user id -> their app_roles */
  rolesByUser: Map<string, string[]>;
  /** employee id -> { manager_id, user_id } */
  employees: Map<string, { manager_id: string | null; user_id: string | null }>;
  /** Delegations currently in force where the signed-in user is the delegate. */
  delegations: DelegationRow[];
}

export const EMPTY_ACTOR_CONTEXT: ApprovalActorContext = {
  userId: null,
  rolesByUser: new Map(),
  employees: new Map(),
  delegations: [],
};

/**
 * Loads the signed-in user's identity, the whole (small) user_roles and
 * employees role/manager graph, and the delegations naming them as delegate.
 *
 * Delegations are read straight from `leave_approval_delegations`, applying the
 * same predicates as the existing SQL function `get_active_delegate`
 * (is_active, CURRENT_DATE within start/end, leave-type scope, max_days cap).
 * That function answers "who is X's delegate?" and returns only ONE row; we
 * need the inverse — "whose authority may X exercise?" — which it cannot
 * express, hence the direct query.
 */
export async function buildApprovalActorContext(): Promise<ApprovalActorContext> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  const [rolesRes, employeesRes, delegationsRes] = await Promise.all([
    untypedDb.from("user_roles").select("user_id, role"),
    untypedDb.from("employees").select("id, manager_id, user_id"),
    userId
      ? untypedDb
          .from("leave_approval_delegations")
          .select("delegator_id, leave_types, max_days")
          .eq("delegate_id", userId)
          .eq("is_active", true)
          .lte("start_date", today)
          .gte("end_date", today)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const rolesByUser = new Map<string, string[]>();
  for (const row of (rolesRes.data || []) as { user_id: string; role: string }[]) {
    const list = rolesByUser.get(row.user_id) || [];
    list.push(row.role);
    rolesByUser.set(row.user_id, list);
  }

  const employees = new Map<string, { manager_id: string | null; user_id: string | null }>();
  for (const row of (employeesRes.data || []) as {
    id: string;
    manager_id: string | null;
    user_id: string | null;
  }[]) {
    employees.set(row.id, { manager_id: row.manager_id, user_id: row.user_id });
  }

  if (delegationsRes.error) {
    console.error("Failed to load approval delegations:", delegationsRes.error);
  }

  return {
    userId,
    rolesByUser,
    employees,
    delegations: (delegationsRes.data || []) as DelegationRow[],
  };
}

function usersWithAppRoles(ctx: ApprovalActorContext, roles: string[]): Set<string> {
  const out = new Set<string>();
  if (roles.length === 0) return out;
  ctx.rolesByUser.forEach((userRoles, userId) => {
    if (userRoles.some((r) => roles.includes(r))) out.add(userId);
  });
  return out;
}

/** user ids that natively satisfy `role` for this employee's request. */
function qualifyingApproverIds(
  ctx: ApprovalActorContext,
  role: ApproverRole,
  employeeId: string,
): Set<string> {
  if (role === "manager") {
    const employee = ctx.employees.get(employeeId);
    const manager = employee?.manager_id ? ctx.employees.get(employee.manager_id) : null;
    if (manager?.user_id) return new Set([manager.user_id]);

    // No manager on file (or no dashboard account for them): fall back so the
    // request does not become permanently unactionable.
    return usersWithAppRoles(ctx, MANAGER_FALLBACK_APP_ROLES);
  }

  return usersWithAppRoles(ctx, ROLE_APP_ROLES[role]);
}

/**
 * May the signed-in user act at `role` for this request — either directly, or
 * as an active delegate of somebody who can?
 */
export function authorizeStep(
  ctx: ApprovalActorContext,
  params: {
    role: ApproverRole;
    employeeId: string;
    leaveType: string;
    totalDays: number;
  },
): StepAuthorization {
  if (!ctx.userId) {
    return { allowed: false, delegateFor: null, reason: "Not signed in." };
  }

  const qualifying = qualifyingApproverIds(ctx, params.role, params.employeeId);

  if (qualifying.has(ctx.userId)) {
    return { allowed: true, delegateFor: null };
  }

  const delegated = ctx.delegations.find((d) => {
    if (!qualifying.has(d.delegator_id)) return false;
    const typeOk =
      !d.leave_types || d.leave_types.length === 0 || d.leave_types.includes(params.leaveType);
    const daysOk = d.max_days === null || d.max_days === undefined || params.totalDays <= d.max_days;
    return typeOk && daysOk;
  });

  if (delegated) {
    return { allowed: true, delegateFor: delegated.delegator_id };
  }

  return {
    allowed: false,
    delegateFor: null,
    reason: `This request is waiting on ${APPROVER_ROLE_LABELS[params.role]} approval.`,
  };
}

// ---------------------------------------------------------------------------
// Recording a decision
// ---------------------------------------------------------------------------

export interface DecisionResult {
  error: ApprovalError | null;
  /** True when this decision closed the request (final approval, or any denial). */
  isFinal: boolean;
  /** Step the request moved to (unchanged on a final decision). */
  nextStep: number;
  state: LeaveApprovalState | null;
  authorization: StepAuthorization | null;
}

/**
 * Record an approve/deny at the request's CURRENT step.
 *
 * - verifies the caller may act at that step (directly or by delegation)
 * - appends a row to `leave_approval_steps`
 * - on approve: advances `current_approval_step`, and only sets
 *   status='approved' when the final step is reached
 * - on deny: sets status='denied' immediately, whatever step it is
 *
 * The caller is responsible for the leave-balance movement, and must only apply
 * the `used` deduction when `isFinal` is true for an approval.
 */
export async function recordApprovalDecision(params: {
  request: LeaveRequestApprovalInput;
  action: "approved" | "denied";
  comment?: string | null;
  preloadedRules?: LeaveApprovalRule[];
}): Promise<DecisionResult> {
  const { request, action } = params;

  try {
    // Always re-read the actor context: a delegation may have started or ended
    // since the list was rendered.
    const ctx = await buildApprovalActorContext();
    const userId = ctx.userId;
    if (!userId) {
      return {
        error: { message: "Not signed in." },
        isFinal: false,
        nextStep: 1,
        state: null,
        authorization: null,
      };
    }

    // Re-read the request so two approvers clicking at once cannot both act on
    // a stale step.
    const { data: fresh } = await untypedDb
      .from("leave_requests")
      .select(
        "id, employee_id, leave_type, total_days, status, approval_rule_id, current_approval_step, total_approval_steps",
      )
      .eq("id", request.id)
      .maybeSingle();

    const current: LeaveRequestApprovalInput & { status?: string } = fresh ?? request;

    if (current.status && current.status !== "pending") {
      return {
        error: { message: "This request has already been decided." },
        isFinal: false,
        nextStep: 1,
        state: null,
        authorization: null,
      };
    }

    const state = await fetchApprovalState(current, params.preloadedRules);
    const role: ApproverRole = state.currentRole ?? "hr";

    const authorization = authorizeStep(ctx, {
      role,
      employeeId: current.employee_id,
      leaveType: current.leave_type,
      totalDays: current.total_days,
    });

    if (!authorization.allowed) {
      return {
        error: { message: authorization.reason || "You cannot act on this step." },
        isFinal: false,
        nextStep: state.currentStep,
        state,
        authorization,
      };
    }

    const now = new Date().toISOString();
    const isFinal = action === "denied" || state.currentStep >= state.totalSteps;
    const nextStep = isFinal
      ? state.currentStep
      : Math.min(state.currentStep + 1, state.totalSteps);

    const stepError = await insertApprovalStep({
      leaveRequestId: current.id,
      stepOrder: state.currentStep,
      approverType: role,
      approverId: userId,
      delegateFor: authorization.delegateFor,
      status: action,
      respondedAt: now,
      comment: params.comment ?? null,
    });

    // A failure to write the audit row must not silently drop the decision, but
    // it also must not block HR — surface it and carry on.
    if (stepError) {
      console.error("Failed to record leave approval step:", stepError);
    }

    const updates: Record<string, unknown> = {
      current_approval_step: nextStep,
    };

    if (action === "denied") {
      updates.status = "denied";
      updates.denial_reason = params.comment || null;
      updates.approved_by = userId;
      updates.approved_at = now;
    } else if (isFinal) {
      updates.status = "approved";
      updates.approved_by = userId;
      updates.approved_at = now;
    } else {
      // Intermediate approval: the request stays pending, and the escalation
      // clock restarts for the next approver.
      updates.last_escalated_at = null;
    }

    const { error: updateError } = await untypedDb
      .from("leave_requests")
      .update(updates)
      .eq("id", current.id)
      .eq("status", "pending");

    if (updateError) {
      return {
        error: { message: updateError.message, code: updateError.code },
        isFinal: false,
        nextStep: state.currentStep,
        state,
        authorization,
      };
    }

    return { error: null, isFinal, nextStep, state, authorization };
  } catch (err) {
    return {
      error: { message: err instanceof Error ? err.message : "Unknown error" },
      isFinal: false,
      nextStep: 1,
      state: null,
      authorization: null,
    };
  }
}

/**
 * `delegate_for` is added by migration 20260731000005. Until that migration is
 * applied the column does not exist, so the insert is retried without it rather
 * than losing the whole audit row.
 */
async function insertApprovalStep(step: {
  leaveRequestId: string;
  stepOrder: number;
  approverType: ApproverRole;
  approverId: string;
  delegateFor: string | null;
  status: "approved" | "denied";
  respondedAt: string;
  comment: string | null;
}): Promise<ApprovalError | null> {
  const base = {
    leave_request_id: step.leaveRequestId,
    step_order: step.stepOrder,
    approver_type: step.approverType,
    approver_id: step.approverId,
    status: step.status,
    response_at: step.respondedAt,
    response_by: step.approverId,
    comments: step.comment,
  };

  const { error } = await untypedDb
    .from("leave_approval_steps")
    .insert({ ...base, delegate_for: step.delegateFor });

  if (!error) return null;

  const missingColumn =
    error.code === "42703" || /delegate_for/i.test(error.message || "");

  if (missingColumn) {
    const { error: retryError } = await untypedDb
      .from("leave_approval_steps")
      .insert(base);
    if (!retryError) return null;
    return { message: retryError.message, code: retryError.code };
  }

  return { message: error.message, code: error.code };
}
