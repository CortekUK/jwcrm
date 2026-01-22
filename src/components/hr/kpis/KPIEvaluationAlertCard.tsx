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

      // Find overdue evaluations
      const overdue: PendingEvaluation[] = [];
      const missed: MissedMonth[] = [];

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

          if (evaluatedCount < roleKpis.length) {
            pendingForMonth++;
            overdue.push({
              employee_id: emp.id,
              employee_name: emp.full_name,
              job_role_name: emp.job_roles.name,
              kpi_count: roleKpis.length,
              evaluated_count: evaluatedCount,
              month,
              year,
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

      // Find employees with pending evaluations
      const pending: PendingEvaluation[] = [];

      (employees || []).forEach((emp: any) => {
        const roleKpis = kpisByRole[emp.job_role_id] || [];
        if (roleKpis.length === 0) return; // No KPIs for this role

        const employeeEvals = evaluationsByEmployee[emp.id] || new Set();
        const evaluatedCount = roleKpis.filter(kpiId => employeeEvals.has(kpiId)).length;

        if (evaluatedCount < roleKpis.length) {
          pending.push({
            employee_id: emp.id,
            employee_name: emp.full_name,
            job_role_name: emp.job_roles.name,
            kpi_count: roleKpis.length,
            evaluated_count: evaluatedCount,
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
      <Card className="border-orange-200 bg-orange-50">
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
    if (alertType === "overdue") return "bg-red-50 border-red-300";
    if (daysRemaining <= 2) return "bg-red-50 border-red-300";
    if (daysRemaining <= 5) return "bg-orange-50 border-orange-300";
    return "bg-yellow-50 border-yellow-300";
  };

  const getTextColor = () => {
    if (alertType === "overdue") return "text-red-600";
    if (daysRemaining <= 2) return "text-red-600";
    if (daysRemaining <= 5) return "text-orange-600";
    return "text-yellow-600";
  };

  const getIconColor = () => {
    if (alertType === "overdue") return "text-red-500";
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
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[#222222]">
            <Target className="h-5 w-5 text-[hsl(var(--jw-primary-green))]" />
            {t("hr:kpiEvaluationAlert.cardTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
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
    <Card className={`border-2 ${getAlertColor()}`}>
      <CardHeader className="pb-2">
        <CardTitle className={`flex items-center gap-2 ${getTextColor()}`}>
          <AlertTriangle className={`h-5 w-5 ${getIconColor()}`} />
          {alertType === "overdue"
            ? t("hr:kpiEvaluationAlert.overdueTitle")
            : t("hr:kpiEvaluationAlert.title")
          }
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alert Message */}
        <div className={`flex items-center gap-3 p-3 rounded-lg ${alertType === "overdue" ? "bg-red-100" : daysRemaining <= 2 ? "bg-red-100" : daysRemaining <= 5 ? "bg-orange-100" : "bg-yellow-100"}`}>
          <Clock className={`h-5 w-5 ${getIconColor()} shrink-0`} />
          <div>
            {alertType === "overdue" ? (
              <>
                <p className={`font-medium ${getTextColor()}`}>
                  {t("hr:kpiEvaluationAlert.overdueMessage")}
                </p>
                <p className="text-sm text-gray-600">
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
                <p className="text-sm text-gray-600">
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
              className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors"
              onClick={() => router.push(`/admin/hr/kpis/evaluations/${item.employee_id}${item.month ? `?month=${item.month}&year=${item.year}` : ""}`)}
            >
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${alertType === "overdue" ? "bg-red-100" : "bg-gray-100"}`}>
                  <Target className={`h-4 w-4 ${alertType === "overdue" ? "text-red-500" : "text-gray-500"}`} />
                </div>
                <div>
                  <p className="font-medium text-[#222222]">{item.employee_name}</p>
                  <p className="text-xs text-gray-500">
                    {item.job_role_name}
                    {item.month && (
                      <span className="text-red-500 ml-1">
                        • {getMonthName(item.month)} {item.year}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`${item.evaluated_count === 0 ? "bg-red-50 text-red-600 border-red-200" : "bg-yellow-50 text-yellow-600 border-yellow-200"}`}
                >
                  {item.evaluated_count}/{item.kpi_count} {t("hr:kpiEvaluationAlert.evaluated")}
                </Badge>
                <ChevronRight className={`h-4 w-4 text-gray-400 ${isRtl ? "rotate-180" : ""}`} />
              </div>
            </div>
          ))}
        </div>

        {/* Show more if there are more than 5 */}
        {displayItems.length > 5 && (
          <p className="text-sm text-gray-500 text-center">
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
