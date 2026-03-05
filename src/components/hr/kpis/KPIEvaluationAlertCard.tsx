"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Target,
  Clock,
  ChevronRight,
  Calendar,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  endOfMonth,
  endOfQuarter,
  differenceInDays,
  format,
  startOfMonth,
  getMonth,
  getQuarter
} from "date-fns";

interface PendingEvaluation {
  employee_id: string;
  employee_name: string;
  job_role_name: string;
  kpi_count: number;
  evaluated_count: number;
  month?: number;
  year?: number;
  isCustom?: boolean;
  customKpiCount?: number;
  customEvaluatedCount?: number;
}

interface MissedMonth {
  month: number;
  year: number;
  pendingCount: number;
}

type AlertType = "month" | "quarter" | "overdue" | null;

export function KPIEvaluationAlertCard() {
  const { t, i18n } = useTranslation(["hr"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pendingEvaluations, setPendingEvaluations] = useState<PendingEvaluation[]>([]);
  const [overdueEvaluations, setOverdueEvaluations] = useState<PendingEvaluation[]>([]);
  const [missedMonths, setMissedMonths] = useState<MissedMonth[]>([]);
  const [alertType, setAlertType] = useState<AlertType>(null);
  const [daysRemaining, setDaysRemaining] = useState(0);

  useEffect(() => {
    checkAlertConditions();
  }, []);

  const checkAlertConditions = async () => {
    const today = new Date();
    const monthEnd = endOfMonth(today);
    const quarterEnd = endOfQuarter(today);

    const daysToMonthEnd = differenceInDays(monthEnd, today);
    const daysToQuarterEnd = differenceInDays(quarterEnd, today);

    // First check for overdue evaluations from past months
    const hasOverdue = await fetchOverdueEvaluations();

    if (hasOverdue) {
      setAlertType("overdue");
      setLoading(false);
      return;
    }

    // Determine alert type based on proximity
    let currentAlertType: AlertType = null;
    let days = 0;

    // Check quarter end first (higher priority if both are within 7 days)
    if (daysToQuarterEnd <= 7 && daysToQuarterEnd >= 0) {
      currentAlertType = "quarter";
      days = daysToQuarterEnd;
    } else if (daysToMonthEnd <= 7 && daysToMonthEnd >= 0) {
      currentAlertType = "month";
      days = daysToMonthEnd;
    }

    if (!currentAlertType) {
      setLoading(false);
      return;
    }

    setAlertType(currentAlertType);
    setDaysRemaining(days);

    // Fetch pending evaluations for current month
    await fetchPendingEvaluations();
  };

  const fetchOverdueEvaluations = async (): Promise<boolean> => {
    try {
      const today = new Date();
      const currentMonth = getMonth(today) + 1;
      const currentYear = today.getFullYear();

      // Get employees with job roles
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select(`
          id,
          full_name,
          job_role_id,
          start_date,
          job_roles!inner(id, name)
        `)
        .eq("employment_status", "active")
        .not("job_role_id", "is", null);

      if (empError) throw empError;
      if (!employees || employees.length === 0) return false;

      // Get KPIs for each job role (exclude archived)
      const { data: kpis, error: kpiError } = await supabase
        .from("kpis")
        .select("id, job_role_id")
        .eq("is_archived", false);

      if (kpiError) throw kpiError;
      if (!kpis || kpis.length === 0) return false;

      // Build KPI count per role
      const kpisByRole: Record<string, string[]> = {};
      kpis.forEach((kpi) => {
        if (!kpisByRole[kpi.job_role_id]) {
          kpisByRole[kpi.job_role_id] = [];
        }
        kpisByRole[kpi.job_role_id].push(kpi.id);
      });

      // Check past 3 months (excluding current month)
      const monthsToCheck: { month: number; year: number }[] = [];
      for (let i = 1; i <= 3; i++) {
        let checkMonth = currentMonth - i;
        let checkYear = currentYear;
        if (checkMonth <= 0) {
          checkMonth += 12;
          checkYear -= 1;
        }
        monthsToCheck.push({ month: checkMonth, year: checkYear });
      }

      // Get all evaluations for the past 3 months
      const { data: evaluations, error: evalError } = await supabase
        .from("kpi_evaluations")
        .select("employee_id, kpi_id, month, year")
        .in("month", monthsToCheck.map(m => m.month))
        .in("year", [...new Set(monthsToCheck.map(m => m.year))]);

      if (evalError) throw evalError;

      // Build evaluation map: employee_id -> month/year -> Set of kpi_ids
      const evaluationMap: Record<string, Record<string, Set<string>>> = {};
      (evaluations || []).forEach((eval_) => {
        const key = `${eval_.month}-${eval_.year}`;
        if (!evaluationMap[eval_.employee_id]) {
          evaluationMap[eval_.employee_id] = {};
        }
        if (!evaluationMap[eval_.employee_id][key]) {
          evaluationMap[eval_.employee_id][key] = new Set();
        }
        evaluationMap[eval_.employee_id][key].add(eval_.kpi_id);
      });

      // Also check custom KPIs
      const { data: customKpis } = await supabase
        .from("employee_custom_kpis")
        .select("id, employee_id")
        .eq("is_archived", false);

      const customKpisByEmployee: Record<string, string[]> = {};
      (customKpis || []).forEach((ck: any) => {
        if (!customKpisByEmployee[ck.employee_id]) {
          customKpisByEmployee[ck.employee_id] = [];
        }
        customKpisByEmployee[ck.employee_id].push(ck.id);
      });

      // Get custom KPI evaluations for past 3 months
      const { data: customEvals } = await supabase
        .from("custom_kpi_evaluations")
        .select("employee_id, custom_kpi_id, month, year")
        .in("month", monthsToCheck.map(m => m.month))
        .in("year", [...new Set(monthsToCheck.map(m => m.year))]);

      const customEvalMap: Record<string, Record<string, Set<string>>> = {};
      (customEvals || []).forEach((eval_: any) => {
        const key = `${eval_.month}-${eval_.year}`;
        if (!customEvalMap[eval_.employee_id]) {
          customEvalMap[eval_.employee_id] = {};
        }
        if (!customEvalMap[eval_.employee_id][key]) {
          customEvalMap[eval_.employee_id][key] = new Set();
        }
        customEvalMap[eval_.employee_id][key].add(eval_.custom_kpi_id);
      });

      // Get all active employees for custom KPI check (including those without job roles)
      const { data: allActiveEmployees } = await supabase
        .from("employees")
        .select("id, full_name, start_date, job_role_id")
        .eq("employment_status", "active");

      // Find overdue evaluations
      const overdue: PendingEvaluation[] = [];
      const missed: MissedMonth[] = [];
      const processedEmployeeMonths = new Set<string>();

      for (const { month, year } of monthsToCheck) {
        let pendingForMonth = 0;
        const monthKey = `${month}-${year}`;
        const monthDate = new Date(year, month - 1, 1);

        for (const emp of employees as any[]) {
          const roleKpis = kpisByRole[emp.job_role_id] || [];
          if (roleKpis.length === 0) continue;

          // Skip if employee hadn't started yet in that month
          const empStartDate = new Date(emp.start_date);
          if (empStartDate > monthDate) continue;

          const employeeEvals = evaluationMap[emp.id]?.[monthKey] || new Set();
          const evaluatedCount = roleKpis.filter(kpiId => employeeEvals.has(kpiId)).length;

          // Also check custom KPIs for this employee
          const empCustomKpis = customKpisByEmployee[emp.id] || [];
          const empCustomEvals = customEvalMap[emp.id]?.[monthKey] || new Set();
          const customEvalCount = empCustomKpis.filter(id => empCustomEvals.has(id)).length;

          const hasRolePending = evaluatedCount < roleKpis.length;
          const hasCustomPending = empCustomKpis.length > 0 && customEvalCount < empCustomKpis.length;

          if (hasRolePending || hasCustomPending) {
            pendingForMonth++;
            processedEmployeeMonths.add(`${emp.id}-${monthKey}`);
            overdue.push({
              employee_id: emp.id,
              employee_name: emp.full_name,
              job_role_name: emp.job_roles.name,
              kpi_count: roleKpis.length,
              evaluated_count: evaluatedCount,
              month,
              year,
              customKpiCount: empCustomKpis.length > 0 ? empCustomKpis.length : undefined,
              customEvaluatedCount: empCustomKpis.length > 0 ? customEvalCount : undefined,
            });
          }
        }

        // Check employees who only have custom KPIs (no job role)
        for (const emp of (allActiveEmployees || []) as any[]) {
          if (emp.job_role_id) continue; // Already handled above
          const empKey = `${emp.id}-${monthKey}`;
          if (processedEmployeeMonths.has(empKey)) continue;

          const empCustomKpis = customKpisByEmployee[emp.id] || [];
          if (empCustomKpis.length === 0) continue;

          const empStartDate = new Date(emp.start_date);
          if (empStartDate > monthDate) continue;

          const empCustomEvals = customEvalMap[emp.id]?.[monthKey] || new Set();
          const customEvalCount = empCustomKpis.filter(id => empCustomEvals.has(id)).length;

          if (customEvalCount < empCustomKpis.length) {
            pendingForMonth++;
            overdue.push({
              employee_id: emp.id,
              employee_name: emp.full_name,
              job_role_name: "",
              kpi_count: 0,
              evaluated_count: 0,
              month,
              year,
              isCustom: true,
              customKpiCount: empCustomKpis.length,
              customEvaluatedCount: customEvalCount,
            });
          }
        }

        if (pendingForMonth > 0) {
          missed.push({ month, year, pendingCount: pendingForMonth });
        }
      }

      setOverdueEvaluations(overdue);
      setMissedMonths(missed);

      return overdue.length > 0;
    } catch (error) {
      console.error("Error fetching overdue evaluations:", error);
      return false;
    }
  };

  const fetchPendingEvaluations = async () => {
    try {
      const today = new Date();
      const currentMonth = getMonth(today) + 1; // 1-12
      const currentYear = today.getFullYear();
      const monthStart = format(startOfMonth(today), "yyyy-MM-dd");

      // Get employees with job roles (who should have KPIs)
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select(`
          id,
          full_name,
          job_role_id,
          job_roles!inner(id, name)
        `)
        .eq("employment_status", "active")
        .not("job_role_id", "is", null);

      if (empError) throw empError;

      // Get KPIs for each job role (exclude archived)
      const { data: kpis, error: kpiError } = await supabase
        .from("kpis")
        .select("id, job_role_id")
        .eq("is_archived", false);

      if (kpiError) throw kpiError;

      // Get evaluations for current month
      const { data: evaluations, error: evalError } = await supabase
        .from("kpi_evaluations")
        .select("employee_id, kpi_id")
        .eq("month", currentMonth)
        .eq("year", currentYear);

      if (evalError) throw evalError;

      // Build a map of KPI counts per job role
      const kpisByRole: Record<string, string[]> = {};
      (kpis || []).forEach((kpi) => {
        if (!kpisByRole[kpi.job_role_id]) {
          kpisByRole[kpi.job_role_id] = [];
        }
        kpisByRole[kpi.job_role_id].push(kpi.id);
      });

      // Build a map of evaluations per employee
      const evaluationsByEmployee: Record<string, Set<string>> = {};
      (evaluations || []).forEach((eval_) => {
        if (!evaluationsByEmployee[eval_.employee_id]) {
          evaluationsByEmployee[eval_.employee_id] = new Set();
        }
        evaluationsByEmployee[eval_.employee_id].add(eval_.kpi_id);
      });

      // Also check custom KPIs for pending evaluations
      const { data: customKpis } = await supabase
        .from("employee_custom_kpis")
        .select("id, employee_id")
        .eq("is_archived", false);

      const customKpisByEmployee: Record<string, string[]> = {};
      (customKpis || []).forEach((ck: any) => {
        if (!customKpisByEmployee[ck.employee_id]) {
          customKpisByEmployee[ck.employee_id] = [];
        }
        customKpisByEmployee[ck.employee_id].push(ck.id);
      });

      const { data: customEvals } = await supabase
        .from("custom_kpi_evaluations")
        .select("employee_id, custom_kpi_id")
        .eq("month", currentMonth)
        .eq("year", currentYear);

      const customEvalsByEmployee: Record<string, Set<string>> = {};
      (customEvals || []).forEach((eval_: any) => {
        if (!customEvalsByEmployee[eval_.employee_id]) {
          customEvalsByEmployee[eval_.employee_id] = new Set();
        }
        customEvalsByEmployee[eval_.employee_id].add(eval_.custom_kpi_id);
      });

      // Find employees with pending evaluations
      const pending: PendingEvaluation[] = [];
      const processedIds = new Set<string>();

      (employees || []).forEach((emp: any) => {
        const roleKpis = kpisByRole[emp.job_role_id] || [];
        if (roleKpis.length === 0) return;

        const employeeEvals = evaluationsByEmployee[emp.id] || new Set();
        const evaluatedCount = roleKpis.filter(kpiId => employeeEvals.has(kpiId)).length;

        const empCustomKpis = customKpisByEmployee[emp.id] || [];
        const empCustomEvals = customEvalsByEmployee[emp.id] || new Set();
        const customEvalCount = empCustomKpis.filter(id => empCustomEvals.has(id)).length;

        const hasRolePending = evaluatedCount < roleKpis.length;
        const hasCustomPending = empCustomKpis.length > 0 && customEvalCount < empCustomKpis.length;

        if (hasRolePending || hasCustomPending) {
          processedIds.add(emp.id);
          pending.push({
            employee_id: emp.id,
            employee_name: emp.full_name,
            job_role_name: emp.job_roles.name,
            kpi_count: roleKpis.length,
            evaluated_count: evaluatedCount,
            customKpiCount: empCustomKpis.length > 0 ? empCustomKpis.length : undefined,
            customEvaluatedCount: empCustomKpis.length > 0 ? customEvalCount : undefined,
          });
        }
      });

      // Check employees with only custom KPIs (no job role)
      const { data: allActiveEmps } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("employment_status", "active")
        .is("job_role_id", null);

      (allActiveEmps || []).forEach((emp: any) => {
        if (processedIds.has(emp.id)) return;
        const empCustomKpis = customKpisByEmployee[emp.id] || [];
        if (empCustomKpis.length === 0) return;

        const empCustomEvals = customEvalsByEmployee[emp.id] || new Set();
        const customEvalCount = empCustomKpis.filter(id => empCustomEvals.has(id)).length;

        if (customEvalCount < empCustomKpis.length) {
          pending.push({
            employee_id: emp.id,
            employee_name: emp.full_name,
            job_role_name: "",
            kpi_count: 0,
            evaluated_count: 0,
            isCustom: true,
            customKpiCount: empCustomKpis.length,
            customEvaluatedCount: customEvalCount,
          });
        }
      });

      setPendingEvaluations(pending);
    } catch (error) {
      console.error("Error fetching pending evaluations:", error);
    } finally {
      setLoading(false);
    }
  };

  // Don't render if no alert or no pending evaluations
  if (loading) {
    return (
      <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
            <span className="text-orange-600">{t("common:loading")}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if we have anything to show
  const hasOverdue = alertType === "overdue" && overdueEvaluations.length > 0;
  const hasPending = (alertType === "month" || alertType === "quarter") && pendingEvaluations.length > 0;
  const hasAlerts = hasOverdue || hasPending;

  const getAlertColor = () => {
    if (alertType === "overdue") return "bg-white dark:bg-card border-l-4 border-l-amber-500 border-[#E6E6E4] dark:border-border";
    if (daysRemaining <= 2) return "bg-white dark:bg-card border-l-4 border-l-red-400 border-[#E6E6E4] dark:border-border";
    if (daysRemaining <= 5) return "bg-white dark:bg-card border-l-4 border-l-orange-400 border-[#E6E6E4] dark:border-border";
    return "bg-white dark:bg-card border-l-4 border-l-yellow-400 border-[#E6E6E4] dark:border-border";
  };

  const getTextColor = () => {
    if (alertType === "overdue") return "text-amber-700";
    if (daysRemaining <= 2) return "text-red-600";
    if (daysRemaining <= 5) return "text-orange-600";
    return "text-yellow-600";
  };

  const getIconColor = () => {
    if (alertType === "overdue") return "text-amber-500";
    if (daysRemaining <= 2) return "text-red-500";
    if (daysRemaining <= 5) return "text-orange-500";
    return "text-yellow-500";
  };

  const getMonthName = (month: number) => {
    const monthKeys = ["january", "february", "march", "april", "may", "june",
                       "july", "august", "september", "october", "november", "december"];
    return t(`hr:month.${monthKeys[month - 1]}`);
  };

  // For overdue, show list grouped by month
  const displayItems = alertType === "overdue" ? overdueEvaluations : pendingEvaluations;

  // Success state - no alerts
  if (!hasAlerts) {
    return (
      <Card className="border-[#E6E6E4] dark:border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-semibold text-[#0C5536] dark:text-[#C6A03B] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <div className="h-8 w-8 rounded-lg bg-[hsl(var(--jw-primary-green))]/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
            </div>
            {t("hr:kpiEvaluationAlert.cardTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
            <div>
              <p className="font-medium text-green-700">
                {t("hr:kpiEvaluationAlert.allComplete")}
              </p>
              <p className="text-sm text-green-600">
                {t("hr:kpiEvaluationAlert.noOverdueEvaluations")}
              </p>
            </div>
          </div>

          {/* Action Button */}
          <Button
            onClick={() => router.push("/admin/hr/kpis")}
            variant="outline"
            className="w-full border-[hsl(var(--jw-primary-green))] text-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))]/10"
          >
            <Calendar className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
            {t("hr:kpiEvaluationAlert.goToEvaluations")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Alert state - has pending or overdue evaluations
  return (
    <Card className={`${getAlertColor()} shadow-sm`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold flex items-center gap-2 text-[#0C5536] dark:text-[#C6A03B]" style={{ fontFamily: 'Playfair Display, serif' }}>
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${alertType === "overdue" ? "bg-amber-100" : "bg-[hsl(var(--jw-gold-accent))]/10"}`}>
            <AlertTriangle className={`h-4 w-4 ${getIconColor()}`} />
          </div>
          {alertType === "overdue"
            ? t("hr:kpiEvaluationAlert.overdueTitle")
            : t("hr:kpiEvaluationAlert.title")
          }
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alert Message */}
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${alertType === "overdue" ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" : daysRemaining <= 2 ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" : daysRemaining <= 5 ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800" : "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800"}`}>
          <Clock className={`h-5 w-5 ${getIconColor()} shrink-0`} />
          <div>
            {alertType === "overdue" ? (
              <>
                <p className={`font-medium ${getTextColor()}`}>
                  {t("hr:kpiEvaluationAlert.overdueMessage")}
                </p>
                <p className="text-sm text-[#6B6B6B] dark:text-muted-foreground">
                  {missedMonths.map((m, i) => (
                    <span key={`${m.month}-${m.year}`}>
                      {i > 0 && ", "}
                      {getMonthName(m.month)} {m.year} ({m.pendingCount})
                    </span>
                  ))}
                </p>
              </>
            ) : (
              <>
                <p className={`font-medium ${getTextColor()}`}>
                  {alertType === "quarter"
                    ? t("hr:kpiEvaluationAlert.quarterEndApproaching", { days: daysRemaining })
                    : t("hr:kpiEvaluationAlert.monthEndApproaching", { days: daysRemaining })
                  }
                </p>
                <p className="text-sm text-[#6B6B6B] dark:text-muted-foreground">
                  {t("hr:kpiEvaluationAlert.pendingCount", { count: pendingEvaluations.length })}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Pending/Overdue Evaluations List */}
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {displayItems.slice(0, 5).map((item, index) => (
            <div
              key={`${item.employee_id}-${item.month || "current"}-${index}`}
              className="flex items-center justify-between p-3 bg-[#FAFAF8] dark:bg-card rounded-lg border border-[#E6E6E4] dark:border-border hover:border-[#C6A03B] dark:hover:border-[#C6A03B] cursor-pointer transition-colors"
              onClick={() => router.push(`/admin/hr/kpis/evaluations/${item.employee_id}${item.month ? `?month=${item.month}&year=${item.year}` : ""}`)}
            >
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${alertType === "overdue" ? "bg-amber-100" : "bg-[hsl(var(--jw-gold-accent))]/10"}`}>
                  <Target className={`h-4 w-4 ${alertType === "overdue" ? "text-amber-600" : "text-[#0C5536] dark:text-[#C6A03B]"}`} />
                </div>
                <div>
                  <p className="font-medium text-[#222222] dark:text-foreground">{item.employee_name}</p>
                  <p className="text-xs text-[#6B6B6B] dark:text-muted-foreground">
                    {item.job_role_name || (item.isCustom ? t("hr:customKpisOnly") : "")}
                    {item.month && (
                      <span className="text-amber-600 ltr:ml-1 rtl:mr-1">
                        • {getMonthName(item.month)} {item.year}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.kpi_count > 0 && (
                  <Badge
                    variant="outline"
                    className={`${item.evaluated_count === 0 ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 border-amber-200 dark:border-amber-800" : "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-600 border-yellow-200 dark:border-yellow-800"}`}
                  >
                    {item.evaluated_count}/{item.kpi_count} {t("hr:kpiEvaluationAlert.evaluated")}
                  </Badge>
                )}
                {item.customKpiCount && item.customKpiCount > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-purple-50 dark:bg-purple-950/30 text-purple-600 border-purple-200 dark:border-purple-800"
                  >
                    {item.customEvaluatedCount}/{item.customKpiCount} {t("hr:custom")}
                  </Badge>
                )}
                <ChevronRight className={`h-4 w-4 text-[#C6A03B] ${isRtl ? "rotate-180" : ""}`} />
              </div>
            </div>
          ))}
        </div>

        {/* Show more if there are more than 5 */}
        {displayItems.length > 5 && (
          <p className="text-sm text-[#6B6B6B] dark:text-muted-foreground text-center">
            {t("hr:kpiEvaluationAlert.andMore", { count: displayItems.length - 5 })}
          </p>
        )}

        {/* Action Button */}
        <Button
          onClick={() => router.push("/admin/hr/kpis")}
          className="w-full bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
        >
          <Calendar className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
          {t("hr:kpiEvaluationAlert.goToEvaluations")}
        </Button>
      </CardContent>
    </Card>
  );
}
