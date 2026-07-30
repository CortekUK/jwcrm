"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { useLeaveTypes } from "@/hooks/useLeaveTypes";
import { getLeaveTypeIcon } from "@/lib/leave-type-icons";
import { useToast } from "@/hooks/use-toast";
import {
  APPROVER_ROLE_LABELS,
  ApprovalActorContext,
  ApproverRole,
  EMPTY_ACTOR_CONTEXT,
  LeaveApprovalRule,
  authorizeStep,
  buildApprovalActorContext,
  chainForRule,
  fetchActiveApprovalRules,
  recordApprovalDecision,
} from "@/lib/hr/leaveApproval";
import { applyLeaveBalanceChange } from "@/lib/hr/leaveBalances";

interface PendingRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  created_at: string;
  approval_rule_id: string | null;
  current_approval_step: number;
  total_approval_steps: number;
}

interface LeaveSummaryWidgetProps {
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
}

export function LeaveSummaryWidget({ onApprove, onDeny }: LeaveSummaryWidgetProps) {
  const { t } = useTranslation(["hr"]);
  const router = useRouter();
  const { getBySlug } = useLeaveTypes();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalRules, setApprovalRules] = useState<LeaveApprovalRule[]>([]);
  const [actorContext, setActorContext] = useState<ApprovalActorContext>(EMPTY_ACTOR_CONTEXT);

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      const { data } = await supabase
        .from("leave_requests")
        .select(`
          id,
          employee_id,
          leave_type,
          start_date,
          end_date,
          total_days,
          created_at,
          approval_rule_id,
          current_approval_step,
          total_approval_steps,
          employees!inner(full_name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);

      const formatted: PendingRequest[] = (data || []).map((req: any) => ({
        id: req.id,
        employee_id: req.employee_id,
        employee_name: req.employees.full_name,
        leave_type: req.leave_type,
        start_date: req.start_date,
        end_date: req.end_date,
        total_days: req.total_days,
        created_at: req.created_at,
        approval_rule_id: req.approval_rule_id ?? null,
        current_approval_step: req.current_approval_step || 1,
        total_approval_steps: req.total_approval_steps || 1,
      }));

      setRequests(formatted);

      const [rules, ctx] = await Promise.all([
        fetchActiveApprovalRules(),
        buildApprovalActorContext(),
      ]);
      setApprovalRules(rules);
      setActorContext(ctx);
    } catch (error) {
      console.error("Error fetching leave requests:", error);
    } finally {
      setLoading(false);
    }
  };

  // Which approver the request is waiting on, and whether this user may act.
  // Requests with no persisted rule predate multi-step approval and stay
  // single-step.
  const getApprovalInfo = (request: PendingRequest) => {
    const rule = request.approval_rule_id
      ? approvalRules.find((r) => r.id === request.approval_rule_id) ?? null
      : null;
    const chain = request.approval_rule_id ? chainForRule(rule) : [];
    const effectiveChain: ApproverRole[] = chain.length > 0 ? chain : ["hr"];
    const totalSteps = request.approval_rule_id
      ? Math.max(1, request.total_approval_steps || effectiveChain.length)
      : 1;
    const currentStep = Math.min(Math.max(1, request.current_approval_step), totalSteps);
    const currentRole: ApproverRole = effectiveChain[currentStep - 1] ?? "hr";

    const auth = authorizeStep(actorContext, {
      role: currentRole,
      employeeId: request.employee_id,
      leaveType: request.leave_type,
      totalDays: request.total_days,
    });

    const roleLabel = t(`leaveWidget.approver_${currentRole}`, APPROVER_ROLE_LABELS[currentRole]);
    const label =
      totalSteps > 1
        ? t("leaveWidget.awaitingStep", "Awaiting {{role}} — step {{step}} of {{total}}", {
            role: roleLabel,
            step: currentStep,
            total: totalSteps,
          })
        : t("leaveWidget.awaitingRole", "Awaiting {{role}}", { role: roleLabel });

    return { currentRole, currentStep, totalSteps, auth, label };
  };

  // One click here signs off the CURRENT step only. The request stays pending
  // until the last required approver acts; the leave page owns the balance
  // deduction and notification that run on final approval.
  const handleApprove = async (request: PendingRequest) => {
    setApprovingId(request.id);
    try {
      const decision = await recordApprovalDecision({
        request,
        action: "approved",
        preloadedRules: approvalRules,
      });

      if (decision.error) {
        toast({
          title: t("common.error", "Error"),
          description: decision.error.message,
          variant: "destructive",
        });
        return;
      }

      if (decision.isFinal) {
        // Final approval: move the balance. This widget has never marked
        // attendance or sent the approval email (the leave page owns those) —
        // but it must not leave the balance stale now that a click here can
        // genuinely close a request.
        const ltConfig = getBySlug(request.leave_type);
        if (ltConfig?.tracks_balance) {
          const { error: balanceError } = await applyLeaveBalanceChange({
            employeeId: request.employee_id,
            year: new Date().getFullYear(),
            slug: request.leave_type,
            usedDelta: request.total_days,
            pendingDelta: -request.total_days,
          });
          if (balanceError) {
            console.error("Error updating leave balance:", balanceError);
            toast({
              title: t("common.error", "Error"),
              description: balanceError.message,
              variant: "destructive",
            });
          }
        }

        setRequests((prev) => prev.filter((r) => r.id !== request.id));
        onApprove?.(request.id);
      } else {
        // Still pending on the next approver — reflect the new step in place.
        setRequests((prev) =>
          prev.map((r) =>
            r.id === request.id ? { ...r, current_approval_step: decision.nextStep } : r,
          ),
        );
      }
    } catch (error) {
      console.error("Error approving request:", error);
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) {
    return (
      <Card className="border-[#E6E6E4] dark:border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-3 rounded-lg border border-[#E6E6E4] dark:border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-3 rounded" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Skeleton className="h-7 w-7 rounded" />
                  <Skeleton className="h-7 w-7 rounded" />
                </div>
              </div>
            </div>
          ))}
          <Skeleton className="h-10 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E6E6E4] dark:border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold text-[#0C5536] dark:text-[#C6A03B] flex items-center justify-between" style={{ fontFamily: 'Playfair Display, serif' }}>
          <span className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[hsl(var(--jw-gold-accent))]/10 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
            </div>
            {t("leaveWidget.leaveRequests")}
          </span>
          {requests.length > 0 && (
            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/30 text-amber-600 border-amber-200 dark:border-amber-800">
              {requests.length} {t("leaveWidget.pending")}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.length === 0 ? (
          <div className="text-center py-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-50 dark:bg-green-950/30 flex items-center justify-center mb-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-[#222222] dark:text-foreground font-medium mb-1">{t("leaveWidget.noPendingRequests")}</p>
            <p className="text-sm text-[#6B6B6B] dark:text-muted-foreground">{t("leaveWidget.allCaughtUp")}</p>
          </div>
        ) : (
          <>
            {requests.slice(0, 3).map((request) => {
              const lt = getBySlug(request.leave_type);
              const Icon = getLeaveTypeIcon(lt?.icon_name || "Calendar");
              const config = {
                color: lt?.color_class || "text-gray-600",
                label: lt?.name || request.leave_type,
              };
              const isToday =
                request.start_date === format(new Date(), "yyyy-MM-dd") ||
                differenceInDays(new Date(request.start_date), new Date()) <= 1;
              const approval = getApprovalInfo(request);

              return (
                <div
                  key={request.id}
                  className={`p-3 rounded-lg border ${isToday ? "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30" : "border-[#E6E6E4] dark:border-border bg-white dark:bg-card"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-[#6B6B6B] dark:text-muted-foreground" />
                        <span className="font-medium text-[#222222] dark:text-foreground truncate">{request.employee_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#6B6B6B] dark:text-muted-foreground">
                        <Icon className={`h-3 w-3 ${config.color}`} />
                        <span>{config.label}</span>
                        <span>|</span>
                        <span>
                          {format(new Date(request.start_date), "MMM d")} -{" "}
                          {format(new Date(request.end_date), "MMM d")}
                        </span>
                        <span className="font-medium">({request.total_days}d)</span>
                      </div>
                      {/* Which approver this request is waiting on */}
                      <div className="mt-1 text-xs text-[#6B6B6B] dark:text-muted-foreground">
                        {approval.label}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={() => router.push("/admin/hr/leave")}
                            disabled={approvingId === request.id}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("leaveWidget.deny")}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                            onClick={() => handleApprove(request)}
                            disabled={approvingId !== null || !approval.auth.allowed}
                          >
                            {approvingId === request.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {approval.auth.allowed
                            ? t("leaveWidget.approve")
                            : approval.auth.reason}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              );
            })}

            {requests.length > 3 && (
              <p className="text-xs text-center text-[#6B6B6B] dark:text-muted-foreground">+{requests.length - 3} {t("leaveWidget.moreRequests")}</p>
            )}
          </>
        )}

        <Button
          variant="outline"
          className="w-full border-[#E6E6E4] dark:border-border hover:bg-[#FAFAF8] dark:hover:bg-accent"
          onClick={() => router.push("/admin/hr/leave")}
        >
          <CalendarDays className="h-4 w-4 mr-2 text-[hsl(var(--jw-primary-green))]" />
          {requests.length > 0 ? t("leaveWidget.viewAllRequests") : t("leaveWidget.manageLeave")}
        </Button>
      </CardContent>
    </Card>
  );
}
