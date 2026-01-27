"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  CalendarDays,
  ArrowRight,
  User,
  Plane,
  Thermometer,
  AlertCircle,
  Wallet,
  GitBranch,
} from "lucide-react";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { usePathname, useRouter } from "next/navigation";

interface PendingRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  created_at: string;
  current_approval_step: number;
  total_approval_steps: number;
  escalation_count: number;
}

interface ApprovalRule {
  id: string;
  leave_type: string | null;
  min_days: number;
  max_days: number | null;
  escalation_days: number;
  requires_manager_approval: boolean;
  requires_hr_approval: boolean;
  requires_director_approval: boolean;
}

const leaveTypeConfig: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  annual: { icon: Plane, color: "text-purple-600", bgColor: "bg-purple-100", label: "Annual" },
  sick: { icon: Thermometer, color: "text-yellow-600", bgColor: "bg-yellow-100", label: "Sick" },
  emergency: { icon: AlertCircle, color: "text-orange-600", bgColor: "bg-orange-100", label: "Emergency" },
  unpaid: { icon: Wallet, color: "text-gray-600", bgColor: "bg-gray-100", label: "Unpaid" },
};

export function PendingApprovalsWidget() {
  const { t } = useTranslation(["hr", "common"]);
  const pathname = usePathname();
  const router = useRouter();
  const basePath = pathname?.startsWith("/admin") ? "/admin/hr" : "/hr";

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [rules, setRules] = useState<ApprovalRule[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch pending requests
      const { data: requestsData, error: requestsError } = await supabase
        .from("leave_requests")
        .select(`
          *,
          employees!inner(full_name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (requestsError) throw requestsError;

      const formattedRequests: PendingRequest[] = (requestsData || []).map((req: any) => ({
        id: req.id,
        employee_id: req.employee_id,
        employee_name: req.employees.full_name,
        leave_type: req.leave_type,
        start_date: req.start_date,
        end_date: req.end_date,
        total_days: req.total_days,
        reason: req.reason,
        created_at: req.created_at,
        current_approval_step: req.current_approval_step || 1,
        total_approval_steps: req.total_approval_steps || 1,
        escalation_count: req.escalation_count || 0,
      }));

      setRequests(formattedRequests);

      // Fetch approval rules
      const { data: rulesData } = await supabase
        .from("leave_approval_rules")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: true });

      setRules(rulesData || []);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
    } finally {
      setLoading(false);
    }
  };

  const getApplicableRule = (request: PendingRequest): ApprovalRule | undefined => {
    return rules.find((rule) => {
      const typeMatch = rule.leave_type === null || rule.leave_type === request.leave_type;
      const minMatch = request.total_days >= rule.min_days;
      const maxMatch = rule.max_days === null || request.total_days <= rule.max_days;
      return typeMatch && minMatch && maxMatch;
    });
  };

  const getUrgencyInfo = (request: PendingRequest) => {
    const now = new Date();
    const created = new Date(request.created_at);
    const daysPending = differenceInDays(now, created);
    const hoursPending = differenceInHours(now, created);

    const rule = getApplicableRule(request);
    const escalationDays = rule?.escalation_days || 3;

    // Calculate time until escalation
    const hoursUntilEscalation = (escalationDays * 24) - hoursPending;

    if (daysPending >= escalationDays) {
      return {
        level: "critical",
        label: t("hr:overdue", "Overdue"),
        color: "bg-red-100 text-red-700 border-red-200",
        icon: AlertTriangle,
        description: t("hr:daysOverdue", "{{days}} days overdue", { days: daysPending - escalationDays + 1 }),
      };
    } else if (hoursUntilEscalation <= 24) {
      return {
        level: "warning",
        label: t("hr:escalatingSoon", "Escalating Soon"),
        color: "bg-amber-100 text-amber-700 border-amber-200",
        icon: Clock,
        description: t("hr:hoursUntilEscalation", "{{hours}}h until escalation", { hours: Math.max(1, Math.round(hoursUntilEscalation)) }),
      };
    } else if (daysPending >= 1) {
      return {
        level: "pending",
        label: t("hr:pending", "Pending"),
        color: "bg-blue-100 text-blue-700 border-blue-200",
        icon: Clock,
        description: t("hr:daysPending", "{{days}} day(s) pending", { days: daysPending }),
      };
    } else {
      return {
        level: "new",
        label: t("hr:new", "New"),
        color: "bg-green-100 text-green-700 border-green-200",
        icon: CheckCircle,
        description: t("hr:submittedToday", "Submitted today"),
      };
    }
  };

  const getApprovalStepLabel = (step: number, rule?: ApprovalRule) => {
    if (!rule) return t("hr:hrApproval", "HR Approval");
    
    const steps: string[] = [];
    if (rule.requires_manager_approval) steps.push(t("hr:manager", "Manager"));
    if (rule.requires_hr_approval) steps.push(t("hr:hr", "HR"));
    if (rule.requires_director_approval) steps.push(t("hr:director", "Director"));
    
    return steps[step - 1] || t("hr:hrApproval", "HR Approval");
  };

  // Count by urgency
  const criticalCount = requests.filter(r => getUrgencyInfo(r).level === "critical").length;
  const warningCount = requests.filter(r => getUrgencyInfo(r).level === "warning").length;
  const pendingCount = requests.length;

  if (loading) {
    return (
      <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)] ${
      criticalCount > 0 ? "border-l-4 border-l-red-500" : warningCount > 0 ? "border-l-4 border-l-amber-500" : ""
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("hr:pendingApprovals", "Pending Approvals")}
            </CardTitle>
            {pendingCount > 0 && (
              <Badge className={`${criticalCount > 0 ? "bg-red-500" : warningCount > 0 ? "bg-amber-500" : "bg-blue-500"} text-white`}>
                {pendingCount}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`${basePath}/leave`)}
            className="border-[#E6E6E4] hover:border-[#C6A03B]"
          >
            {t("hr:viewAll", "View All")}
            <ArrowRight className="h-4 w-4 ltr:ml-1 rtl:mr-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <div className="text-center py-8 text-[#6B6B6B]">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-500" />
            <p className="font-medium text-[#222222]">{t("hr:noPendingApprovals", "No Pending Approvals")}</p>
            <p className="text-sm mt-1">{t("hr:allCaughtUp", "All caught up!")}</p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className={`p-3 rounded-lg text-center ${criticalCount > 0 ? "bg-red-50 border border-red-200" : "bg-[#FAFAF8] border border-[#E6E6E4]"}`}>
                <p className={`text-2xl font-bold ${criticalCount > 0 ? "text-red-600" : "text-[#222222]"}`}>{criticalCount}</p>
                <p className={`text-xs ${criticalCount > 0 ? "text-red-500" : "text-[#6B6B6B]"}`}>{t("hr:overdue", "Overdue")}</p>
              </div>
              <div className={`p-3 rounded-lg text-center ${warningCount > 0 ? "bg-amber-50 border border-amber-200" : "bg-[#FAFAF8] border border-[#E6E6E4]"}`}>
                <p className={`text-2xl font-bold ${warningCount > 0 ? "text-amber-600" : "text-[#222222]"}`}>{warningCount}</p>
                <p className={`text-xs ${warningCount > 0 ? "text-amber-500" : "text-[#6B6B6B]"}`}>{t("hr:escalatingSoon", "Escalating Soon")}</p>
              </div>
              <div className="p-3 rounded-lg text-center bg-[#FAFAF8] border border-[#E6E6E4]">
                <p className="text-2xl font-bold text-[#222222]">{pendingCount}</p>
                <p className="text-xs text-[#6B6B6B]">{t("hr:totalPending", "Total Pending")}</p>
              </div>
            </div>

            {/* Request List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {requests.slice(0, 5).map((request) => {
                const urgency = getUrgencyInfo(request);
                const UrgencyIcon = urgency.icon;
                const leaveConfig = leaveTypeConfig[request.leave_type] || leaveTypeConfig.annual;
                const LeaveIcon = leaveConfig.icon;
                const rule = getApplicableRule(request);
                const currentStepLabel = getApprovalStepLabel(request.current_approval_step, rule);

                return (
                  <div
                    key={request.id}
                    className={`p-3 rounded-lg border ${urgency.level === "critical" ? "border-red-200 bg-red-50" : urgency.level === "warning" ? "border-amber-200 bg-amber-50" : "border-[#E6E6E4] bg-white"} hover:shadow-sm transition-all cursor-pointer`}
                    onClick={() => router.push(`${basePath}/leave`)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Employee Info */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-[hsl(var(--jw-primary-green))]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-[hsl(var(--jw-primary-green))]">
                            {request.employee_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[#222222] text-sm truncate">{request.employee_name}</p>
                          <div className="flex items-center gap-1.5 text-xs text-[#6B6B6B]">
                            <Badge className={`${leaveConfig.bgColor} ${leaveConfig.color} border-0 text-[10px] px-1.5 py-0`}>
                              <LeaveIcon className="h-2.5 w-2.5 ltr:mr-0.5 rtl:ml-0.5" />
                              {leaveConfig.label}
                            </Badge>
                            <span>{request.total_days}d</span>
                            <span>•</span>
                            <span>{format(new Date(request.start_date), "MMM d")}</span>
                          </div>
                        </div>
                      </div>

                      {/* Approval Step */}
                      <div className="text-right flex-shrink-0">
                        <Badge variant="outline" className="border-[#C6A03B]/30 bg-[#FFF9E6] text-[#8B6914] text-[10px] mb-1">
                          {currentStepLabel}
                        </Badge>
                        {request.escalation_count > 0 && (
                          <p className="text-[10px] text-red-500">
                            {t("hr:escalatedXTimes", "Escalated {{count}}x", { count: request.escalation_count })}
                          </p>
                        )}
                      </div>

                      {/* Urgency Badge */}
                      <Badge className={`${urgency.color} border text-[10px] flex-shrink-0`}>
                        <UrgencyIcon className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                        {urgency.description}
                      </Badge>
                    </div>
                  </div>
                );
              })}

              {requests.length > 5 && (
                <Button
                  variant="ghost"
                  className="w-full text-sm text-[#6B6B6B] hover:text-[#0C5536]"
                  onClick={() => router.push(`${basePath}/leave`)}
                >
                  {t("hr:viewMoreRequests", "+ {{count}} more requests", { count: requests.length - 5 })}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
