"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import {
  Target,
  Users,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Award,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHrBasePath } from "@/hooks/useHrBasePath";
import { cn } from "@/lib/utils";

interface PerformanceBand {
  label: string;
  count: number;
  percentage: number;
  color: string;
  bgColor: string;
}

interface TopPerformer {
  id: string;
  name: string;
  score: number;
  jobRole: string;
}

interface LowPerformer {
  id: string;
  name: string;
  score: number;
  jobRole: string;
}

interface OverviewStats {
  totalEmployeesWithKPIs: number;
  completionRate: number;
  averageScore: number | null;
  overdueCount: number;
  pendingCount: number;
  performanceBands: PerformanceBand[];
  topPerformers: TopPerformer[];
  lowPerformers: LowPerformer[];
}

export function KPIOverviewCard() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const basePath = useHrBasePath();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<OverviewStats>({
    totalEmployeesWithKPIs: 0,
    completionRate: 0,
    averageScore: null,
    overdueCount: 0,
    pendingCount: 0,
    performanceBands: [],
    topPerformers: [],
    lowPerformers: [],
  });

  useEffect(() => {
    fetchKPIOverview();
  }, []);

  const fetchKPIOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
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
      if (!employees || employees.length === 0) {
        setLoading(false);
        return;
      }

      // Get KPIs for each job role (exclude archived)
      const { data: kpis, error: kpiError } = await supabase
        .from("kpis")
        .select("id, job_role_id, weighting")
        .eq("is_archived", false);

      if (kpiError) throw kpiError;

      // Build KPI info per role
      const kpisByRole: Record<string, { id: string; weighting: number }[]> = {};
      (kpis || []).forEach((kpi) => {
        if (!kpisByRole[kpi.job_role_id]) {
          kpisByRole[kpi.job_role_id] = [];
        }
        kpisByRole[kpi.job_role_id].push({ id: kpi.id, weighting: kpi.weighting || 0 });
      });

      // Also check for employees with custom KPIs
      const { data: customKpiEmployees } = await supabase
        .from("employee_custom_kpis")
        .select("employee_id")
        .eq("is_archived", false);

      const employeesWithCustomKpis = new Set(
        (customKpiEmployees || []).map((c: any) => c.employee_id)
      );

      // Count employees with KPIs (role-based OR custom)
      const employeesWithKPIs = employees.filter(
        (emp: any) => kpisByRole[emp.job_role_id]?.length > 0 || employeesWithCustomKpis.has(emp.id)
      );
      const totalEmployeesWithKPIs = employeesWithKPIs.length;

      // Get evaluations for current month with scores
      const { data: evaluations, error: evalError } = await supabase
        .from("kpi_evaluations")
        .select("employee_id, kpi_id, score, status")
        .eq("month", currentMonth)
        .eq("year", currentYear);

      if (evalError) throw evalError;

      // Build evaluation map: employee_id -> kpi_id -> score.
      // `score` is the percentage of target (see calculateScore in lib/kpi-validation);
      // `achieved_value` is the raw amount in the KPI's own unit and must not be
      // rendered as a percentage.
      const evaluationMap: Record<string, Record<string, number | null>> = {};
      (evaluations || []).forEach((eval_: any) => {
        if (!evaluationMap[eval_.employee_id]) {
          evaluationMap[eval_.employee_id] = {};
        }
        evaluationMap[eval_.employee_id][eval_.kpi_id] =
          eval_.score !== null && eval_.score !== undefined ? Number(eval_.score) : null;
      });

      // Calculate stats for each employee
      let totalCompleted = 0;
      let totalRequired = 0;
      const employeeScores: { id: string; name: string; score: number | null; jobRole: string }[] = [];

      employeesWithKPIs.forEach((emp: any) => {
        const roleKpis = kpisByRole[emp.job_role_id] || [];
        if (roleKpis.length === 0) return;

        totalRequired += roleKpis.length;
        const empEvals = evaluationMap[emp.id] || {};
        
        let weightedSum = 0;
        let totalWeight = 0;
        let completedCount = 0;

        roleKpis.forEach((kpi) => {
          const value = empEvals[kpi.id];
          if (value !== undefined && value !== null) {
            completedCount++;
            weightedSum += value * (kpi.weighting / 100);
            totalWeight += kpi.weighting / 100;
          }
        });

        totalCompleted += completedCount;
        const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;

        employeeScores.push({
          id: emp.id,
          name: emp.full_name,
          score,
          jobRole: emp.job_roles.name,
        });
      });

      // Calculate completion rate
      const completionRate = totalRequired > 0 
        ? Math.round((totalCompleted / totalRequired) * 100) 
        : 0;

      // Calculate overall average score
      const scoredEmployees = employeeScores.filter(e => e.score !== null);
      const averageScore = scoredEmployees.length > 0
        ? Math.round(scoredEmployees.reduce((sum, e) => sum + (e.score || 0), 0) / scoredEmployees.length)
        : null;

      // Calculate performance bands
      const excellent = scoredEmployees.filter(e => e.score! >= 80).length;
      const good = scoredEmployees.filter(e => e.score! >= 60 && e.score! < 80).length;
      const needsImprovement = scoredEmployees.filter(e => e.score! < 60).length;
      const notEvaluated = employeeScores.filter(e => e.score === null).length;
      const totalForBands = employeeScores.length;

      const performanceBands: PerformanceBand[] = [
        {
          label: t("hr:kpiOverview.excellent"),
          count: excellent,
          percentage: totalForBands > 0 ? Math.round((excellent / totalForBands) * 100) : 0,
          color: "text-green-600",
          bgColor: "bg-green-500",
        },
        {
          label: t("hr:kpiOverview.good"),
          count: good,
          percentage: totalForBands > 0 ? Math.round((good / totalForBands) * 100) : 0,
          color: "text-amber-600",
          bgColor: "bg-amber-500",
        },
        {
          label: t("hr:kpiOverview.needsImprovement"),
          count: needsImprovement,
          percentage: totalForBands > 0 ? Math.round((needsImprovement / totalForBands) * 100) : 0,
          color: "text-red-600",
          bgColor: "bg-red-500",
        },
        {
          label: t("hr:kpiOverview.notEvaluated"),
          count: notEvaluated,
          percentage: totalForBands > 0 ? Math.round((notEvaluated / totalForBands) * 100) : 0,
          color: "text-gray-500",
          bgColor: "bg-gray-400",
        },
      ];

      // Get top performers (highest scores, limit 3)
      const topPerformers = scoredEmployees
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 3)
        .map(e => ({
          id: e.id,
          name: e.name,
          score: e.score || 0,
          jobRole: e.jobRole,
        }));

      // Get low performers (scores < 60, limit 3)
      const lowPerformers = scoredEmployees
        .filter(e => (e.score || 0) < 60)
        .sort((a, b) => (a.score || 0) - (b.score || 0))
        .slice(0, 3)
        .map(e => ({
          id: e.id,
          name: e.name,
          score: e.score || 0,
          jobRole: e.jobRole,
        }));

      // Count pending (not completed) evaluations
      const pendingCount = totalRequired - totalCompleted;

      // Check for overdue evaluations from past months
      const overdueCount = await countOverdueEvaluations(employees, kpisByRole, currentMonth, currentYear);

      setStats({
        totalEmployeesWithKPIs,
        completionRate,
        averageScore,
        overdueCount,
        pendingCount,
        performanceBands,
        topPerformers,
        lowPerformers,
      });
    } catch (error) {
      console.error("Error fetching KPI overview:", error);
      // Without this the card falls back to zeros, which is indistinguishable
      // from "no KPIs configured".
      setError(t("hr:kpiOverview.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const countOverdueEvaluations = async (
    employees: any[],
    kpisByRole: Record<string, { id: string; weighting: number }[]>,
    currentMonth: number,
    currentYear: number
  ): Promise<number> => {
    try {
      // Check past 3 months
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

      const { data: evaluations } = await supabase
        .from("kpi_evaluations")
        .select("employee_id, kpi_id, month, year")
        .in("month", monthsToCheck.map(m => m.month))
        .in("year", [...new Set(monthsToCheck.map(m => m.year))]);

      // Build evaluation map
      const evalMap: Record<string, Record<string, Set<string>>> = {};
      (evaluations || []).forEach((eval_: any) => {
        const key = `${eval_.month}-${eval_.year}`;
        if (!evalMap[eval_.employee_id]) evalMap[eval_.employee_id] = {};
        if (!evalMap[eval_.employee_id][key]) evalMap[eval_.employee_id][key] = new Set();
        evalMap[eval_.employee_id][key].add(eval_.kpi_id);
      });

      let overdueCount = 0;
      for (const { month, year } of monthsToCheck) {
        const key = `${month}-${year}`;
        const monthDate = new Date(year, month - 1, 1);

        for (const emp of employees) {
          const roleKpis = kpisByRole[emp.job_role_id] || [];
          if (roleKpis.length === 0) continue;

          const empStartDate = new Date(emp.start_date);
          if (empStartDate > monthDate) continue;

          const evalSet = evalMap[emp.id]?.[key] || new Set();
          const missing = roleKpis.filter(kpi => !evalSet.has(kpi.id)).length;
          if (missing > 0) overdueCount++;
        }
      }

      return overdueCount;
    } catch (error) {
      console.error("Error counting overdue:", error);
      return 0;
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-gray-500";
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  if (loading) {
    return (
      <Card className="border-[#E6E6E4] dark:border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-6 w-40" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-32 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-[#E6E6E4] dark:border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-semibold text-[#0C5536] dark:text-[#C6A03B] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <div className="h-8 w-8 rounded-lg bg-[hsl(var(--jw-gold-accent))]/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
            </div>
            {t("hr:kpiOverview.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto text-red-400 mb-3" />
            <p className="text-red-600">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchKPIOverview}>
              <RefreshCw className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
              {t("common:retry", "Retry")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stats.totalEmployeesWithKPIs === 0) {
    return (
      <Card className="border-[#E6E6E4] dark:border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-semibold text-[#0C5536] dark:text-[#C6A03B] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <div className="h-8 w-8 rounded-lg bg-[hsl(var(--jw-gold-accent))]/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
            </div>
            {t("hr:kpiOverview.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Target className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-[#6B6B6B] dark:text-muted-foreground">{t("hr:kpiOverview.noKPIsConfigured")}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push(`${basePath}/kpis`)}
            >
              {t("hr:kpiOverview.configureKPIs")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E6E6E4] dark:border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold text-[#0C5536] dark:text-[#C6A03B] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <div className="h-8 w-8 rounded-lg bg-[hsl(var(--jw-gold-accent))]/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
            </div>
            {t("hr:kpiOverview.title")}
          </CardTitle>
          {stats.overdueCount > 0 && (
            <Badge variant="outline" className="bg-red-50 dark:bg-red-950/30 text-red-600 border-red-200 dark:border-red-800">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {stats.overdueCount} {t("hr:kpiOverview.overdue")}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-[#FAFAF8] dark:bg-card border border-[#E6E6E4] dark:border-border">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-[#6B6B6B] dark:text-muted-foreground" />
              <span className="text-xs text-[#6B6B6B] dark:text-muted-foreground">{t("hr:kpiOverview.employeesWithKPIs")}</span>
            </div>
            <p className="text-xl font-bold text-[#222222] dark:text-foreground">{stats.totalEmployeesWithKPIs}</p>
          </div>

          <div className="p-3 rounded-lg bg-[#FAFAF8] dark:bg-card border border-[#E6E6E4] dark:border-border">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-[#6B6B6B] dark:text-muted-foreground" />
              <span className="text-xs text-[#6B6B6B] dark:text-muted-foreground">{t("hr:kpiOverview.completionRate")}</span>
            </div>
            <p className={cn("text-xl font-bold", stats.completionRate >= 80 ? "text-green-600" : stats.completionRate >= 50 ? "text-amber-600" : "text-red-600")}>
              {stats.completionRate}%
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#FAFAF8] dark:bg-card border border-[#E6E6E4] dark:border-border">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-[#6B6B6B] dark:text-muted-foreground" />
              <span className="text-xs text-[#6B6B6B] dark:text-muted-foreground">{t("hr:kpiOverview.averageScore")}</span>
            </div>
            <p className={cn("text-xl font-bold", getScoreColor(stats.averageScore))}>
              {stats.averageScore !== null ? `${stats.averageScore}%` : "-"}
            </p>
          </div>

          <div className={cn(
            "p-3 rounded-lg border",
            stats.pendingCount > 0 ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
          )}>
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className={cn("h-4 w-4", stats.pendingCount > 0 ? "text-amber-600" : "text-green-600")} />
              <span className={cn("text-xs", stats.pendingCount > 0 ? "text-amber-600" : "text-green-600")}>
                {t("hr:kpiOverview.pendingEvals")}
              </span>
            </div>
            <p className={cn("text-xl font-bold", stats.pendingCount > 0 ? "text-amber-600" : "text-green-600")}>
              {stats.pendingCount}
            </p>
          </div>
        </div>

        {/* Performance Distribution Bar */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-[#222222] dark:text-foreground">{t("hr:kpiOverview.performanceDistribution")}</p>
          <div className="h-4 rounded-full overflow-hidden flex bg-gray-100 dark:bg-gray-800">
            {stats.performanceBands.map((band, i) => (
              band.percentage > 0 && (
                <div
                  key={i}
                  className={cn("h-full transition-all", band.bgColor)}
                  style={{ width: `${band.percentage}%` }}
                  title={`${band.label}: ${band.count} (${band.percentage}%)`}
                />
              )
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            {stats.performanceBands.map((band, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className={cn("h-2.5 w-2.5 rounded-full", band.bgColor)} />
                <span className="text-[#6B6B6B] dark:text-muted-foreground">{band.label}: {band.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top & Low Performers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Performers */}
          {stats.topPerformers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-[#222222] dark:text-foreground">{t("hr:kpiOverview.topPerformers")}</span>
              </div>
              <div className="space-y-1.5">
                {stats.topPerformers.map((performer, i) => (
                  <div
                    key={performer.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 cursor-pointer hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors"
                    onClick={() => router.push(`${basePath}/kpis/evaluations/${performer.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-green-700 bg-green-200 rounded-full h-5 w-5 flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[#222222] dark:text-foreground">{performer.name}</p>
                        <p className="text-xs text-[#6B6B6B] dark:text-muted-foreground">{performer.jobRole}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-green-600">{performer.score}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low Performers */}
          {stats.lowPerformers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-[#222222] dark:text-foreground">{t("hr:kpiOverview.needsAttention")}</span>
              </div>
              <div className="space-y-1.5">
                {stats.lowPerformers.map((performer) => (
                  <div
                    key={performer.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
                    onClick={() => router.push(`${basePath}/kpis/evaluations/${performer.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <div>
                        <p className="text-sm font-medium text-[#222222] dark:text-foreground">{performer.name}</p>
                        <p className="text-xs text-[#6B6B6B] dark:text-muted-foreground">{performer.jobRole}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-red-600">{performer.score}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className={cn("flex gap-2 pt-2", isRtl && "flex-row-reverse")}>
          <Button
            variant="outline"
            className="flex-1 border-[#E6E6E4] dark:border-border hover:border-[#C6A03B] dark:hover:border-[#C6A03B] hover:bg-[#FAFAF8] dark:hover:bg-accent dark:bg-card"
            onClick={() => router.push(`${basePath}/kpis`)}
          >
            <Target className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
            {t("hr:kpiOverview.viewAllEvaluations")}
            <ChevronRight className={cn("h-4 w-4", isRtl ? "mr-auto rotate-180" : "ml-auto")} />
          </Button>
          {stats.pendingCount > 0 && (
            <Button
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
              onClick={() => router.push(`${basePath}/kpis?tab=evaluations`)}
            >
              <ClipboardList className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
              {t("hr:kpiOverview.markEvaluations")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
