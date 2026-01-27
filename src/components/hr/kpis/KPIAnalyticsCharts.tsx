"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  PieChart as PieChartIcon, 
  BarChart3, 
  TrendingUp, 
  Target,
  Building2,
  Users,
  RefreshCw,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { subMonths, format, getMonth, getYear } from "date-fns";

interface EmployeeScore {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
  jobRoleId: string;
  jobRoleName: string;
  score: number | null;
  month: number;
  year: number;
}

interface KPIData {
  id: string;
  name: string;
  jobRoleName: string;
  averageScore: number;
  evaluationCount: number;
}

interface MonthlyTrend {
  month: string;
  monthNum: number;
  year: number;
  averageScore: number;
  completionRate: number;
}

interface DepartmentScore {
  departmentId: string;
  departmentName: string;
  averageScore: number;
  employeeCount: number;
}

const COLORS = {
  excellent: "#10b981", // green
  good: "#f59e0b", // amber
  needsImprovement: "#ef4444", // red
  notEvaluated: "#9ca3af", // gray
  primary: "#0C5536",
  gold: "#C6A03B",
  trend: "#3b82f6",
  completion: "#8b5cf6",
};

const pieChartConfig = {
  value: {
    label: "Employees",
  },
} satisfies ChartConfig;

const barChartConfig = {
  averageScore: {
    label: "Average Score",
    color: COLORS.primary,
  },
} satisfies ChartConfig;

const lineChartConfig = {
  averageScore: {
    label: "Average Score",
    color: COLORS.trend,
  },
  completionRate: {
    label: "Completion Rate",
    color: COLORS.completion,
  },
} satisfies ChartConfig;

export function KPIAnalyticsCharts() {
  const { t, i18n } = useTranslation(["hr"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const basePath = pathname?.startsWith("/admin") ? "/admin/hr" : "/hr";
  
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [employeeScores, setEmployeeScores] = useState<EmployeeScore[]>([]);
  const [kpiScores, setKpiScores] = useState<KPIData[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [departmentScores, setDepartmentScores] = useState<DepartmentScore[]>([]);
  
  // Employee trend state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [employeeList, setEmployeeList] = useState<{ id: string; name: string; jobRoleName: string }[]>([]);
  const [employeeTrendData, setEmployeeTrendData] = useState<{ month: string; score: number | null }[]>([]);

  const currentMonth = new Date().getMonth() + 1;
  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    fetchAnalyticsData();
  }, [selectedYear]);

  // Fetch employee-specific trend when employee is selected
  useEffect(() => {
    if (selectedEmployeeId) {
      fetchEmployeeTrend(selectedEmployeeId);
    } else {
      setEmployeeTrendData([]);
    }
  }, [selectedEmployeeId, selectedYear]);

  const fetchEmployeeTrend = async (employeeId: string) => {
    try {
      // Get employee's job role
      const { data: employee } = await supabase
        .from("employees")
        .select("job_role_id")
        .eq("id", employeeId)
        .single();

      if (!employee?.job_role_id) {
        setEmployeeTrendData([]);
        return;
      }

      // Get KPIs for the role
      const { data: kpis } = await supabase
        .from("kpis")
        .select("id, weighting")
        .eq("job_role_id", employee.job_role_id)
        .eq("is_archived", false);

      if (!kpis || kpis.length === 0) {
        setEmployeeTrendData([]);
        return;
      }

      // Get evaluations for the year
      const { data: evaluations } = await supabase
        .from("kpi_evaluations")
        .select("month, kpi_id, achieved_value, score, status")
        .eq("employee_id", employeeId)
        .eq("year", selectedYear);

      // Calculate monthly scores
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const trendData: { month: string; score: number | null }[] = [];
      const monthsToShow = selectedYear === new Date().getFullYear() ? currentMonth : 12;

      for (let month = 1; month <= monthsToShow; month++) {
        const monthEvals = (evaluations || []).filter((e: any) => e.month === month);
        const completedEvals = monthEvals.filter((e: any) => e.achieved_value !== null && e.status === "completed");

        if (completedEvals.length === 0) {
          trendData.push({ month: monthNames[month - 1], score: null });
          continue;
        }

        // Calculate weighted score
        let weightedSum = 0;
        let totalWeight = 0;
        completedEvals.forEach((evaluation: any) => {
          const kpi = kpis.find((k) => k.id === evaluation.kpi_id);
          if (kpi && evaluation.score !== null) {
            weightedSum += evaluation.score * (kpi.weighting || 1);
            totalWeight += kpi.weighting || 1;
          }
        });

        const avgScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
        trendData.push({ month: monthNames[month - 1], score: avgScore });
      }

      setEmployeeTrendData(trendData);
    } catch (error) {
      console.error("Error fetching employee trend:", error);
      setEmployeeTrendData([]);
    }
  };

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // Get employees with departments and job roles
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select(`
          id,
          full_name,
          department_id,
          job_role_id,
          start_date,
          departments(id, name),
          job_roles(id, name)
        `)
        .eq("employment_status", "active")
        .not("job_role_id", "is", null);

      if (empError) throw empError;

      // Get KPIs (exclude archived)
      const { data: kpis, error: kpiError } = await supabase
        .from("kpis")
        .select(`
          id,
          name,
          job_role_id,
          weighting,
          target_value,
          job_roles(name)
        `)
        .eq("is_archived", false);

      if (kpiError) throw kpiError;

      // Get evaluations for selected year
      const { data: evaluations, error: evalError } = await supabase
        .from("kpi_evaluations")
        .select("employee_id, kpi_id, achieved_value, month, year, status")
        .eq("year", selectedYear);

      if (evalError) throw evalError;

      // Build KPI lookup
      const kpiMap: Record<string, any> = {};
      (kpis || []).forEach((kpi: any) => {
        kpiMap[kpi.id] = kpi;
      });

      // Build KPIs by role
      const kpisByRole: Record<string, any[]> = {};
      (kpis || []).forEach((kpi: any) => {
        if (!kpisByRole[kpi.job_role_id]) kpisByRole[kpi.job_role_id] = [];
        kpisByRole[kpi.job_role_id].push(kpi);
      });

      // Process employee scores for current month
      const empScores: EmployeeScore[] = [];
      const monthsToAnalyze = selectedYear === new Date().getFullYear() ? currentMonth : 12;

      // Calculate scores for each employee for the current/latest month
      (employees || []).forEach((emp: any) => {
        const roleKpis = kpisByRole[emp.job_role_id] || [];
        if (roleKpis.length === 0) return;

        const empEvals = (evaluations || []).filter(
          (e: any) => e.employee_id === emp.id && e.month === monthsToAnalyze
        );

        let weightedSum = 0;
        let totalWeight = 0;

        roleKpis.forEach((kpi: any) => {
          const eval_ = empEvals.find((e: any) => e.kpi_id === kpi.id);
          if (eval_?.achieved_value !== null && eval_?.achieved_value !== undefined) {
            const weight = kpi.weighting / 100;
            weightedSum += eval_.achieved_value * weight;
            totalWeight += weight;
          }
        });

        const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;

        empScores.push({
          id: emp.id,
          name: emp.full_name,
          departmentId: emp.department_id || "none",
          departmentName: emp.departments?.name || t("hr:kpiAnalytics.noDepartment"),
          jobRoleId: emp.job_role_id,
          jobRoleName: emp.job_roles?.name || "",
          score,
          month: monthsToAnalyze,
          year: selectedYear,
        });
      });

      setEmployeeScores(empScores);

      // Build employee list for dropdown
      const empList = (employees || []).map((emp: any) => ({
        id: emp.id,
        name: emp.full_name,
        jobRoleName: emp.job_roles?.name || "",
      }));
      setEmployeeList(empList);

      // Calculate KPI average scores
      const kpiScoreMap: Record<string, { total: number; count: number; name: string; jobRoleName: string }> = {};
      
      (evaluations || []).forEach((eval_: any) => {
        if (eval_.achieved_value === null || eval_.achieved_value === undefined) return;
        const kpi = kpiMap[eval_.kpi_id];
        if (!kpi) return;

        if (!kpiScoreMap[eval_.kpi_id]) {
          kpiScoreMap[eval_.kpi_id] = {
            total: 0,
            count: 0,
            name: kpi.name,
            jobRoleName: kpi.job_roles?.name || "",
          };
        }
        kpiScoreMap[eval_.kpi_id].total += eval_.achieved_value;
        kpiScoreMap[eval_.kpi_id].count++;
      });

      const kpiData: KPIData[] = Object.entries(kpiScoreMap)
        .map(([id, data]) => ({
          id,
          name: data.name,
          jobRoleName: data.jobRoleName,
          averageScore: Math.round(data.total / data.count),
          evaluationCount: data.count,
        }))
        .sort((a, b) => b.averageScore - a.averageScore);

      setKpiScores(kpiData);

      // Calculate monthly trends
      const trends: MonthlyTrend[] = [];
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      for (let month = 1; month <= monthsToAnalyze; month++) {
        const monthEvals = (evaluations || []).filter((e: any) => e.month === month);
        
        if (monthEvals.length === 0) continue;

        const scoredEvals = monthEvals.filter((e: any) => e.achieved_value !== null);
        const avgScore = scoredEvals.length > 0
          ? Math.round(scoredEvals.reduce((sum: number, e: any) => sum + e.achieved_value, 0) / scoredEvals.length)
          : 0;

        // Calculate completion rate for this month
        let totalRequired = 0;
        let totalCompleted = 0;

        (employees || []).forEach((emp: any) => {
          const roleKpis = kpisByRole[emp.job_role_id] || [];
          totalRequired += roleKpis.length;

          const empEvals = monthEvals.filter((e: any) => e.employee_id === emp.id);
          totalCompleted += empEvals.filter((e: any) => e.achieved_value !== null).length;
        });

        const completionRate = totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 0;

        trends.push({
          month: monthNames[month - 1],
          monthNum: month,
          year: selectedYear,
          averageScore: avgScore,
          completionRate,
        });
      }

      setMonthlyTrends(trends);

      // Calculate department scores
      const deptMap: Record<string, { total: number; count: number; name: string }> = {};

      empScores.forEach((emp) => {
        if (emp.score === null) return;
        
        if (!deptMap[emp.departmentId]) {
          deptMap[emp.departmentId] = { total: 0, count: 0, name: emp.departmentName };
        }
        deptMap[emp.departmentId].total += emp.score;
        deptMap[emp.departmentId].count++;
      });

      const deptScores: DepartmentScore[] = Object.entries(deptMap)
        .map(([id, data]) => ({
          departmentId: id,
          departmentName: data.name,
          averageScore: Math.round(data.total / data.count),
          employeeCount: data.count,
        }))
        .sort((a, b) => b.averageScore - a.averageScore);

      setDepartmentScores(deptScores);

    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Score distribution pie chart data
  const scoreDistribution = useMemo(() => {
    const excellent = employeeScores.filter(e => e.score !== null && e.score >= 80).length;
    const good = employeeScores.filter(e => e.score !== null && e.score >= 60 && e.score < 80).length;
    const needsImprovement = employeeScores.filter(e => e.score !== null && e.score < 60).length;
    const notEvaluated = employeeScores.filter(e => e.score === null).length;

    return [
      { name: t("hr:kpiAnalytics.excellent"), value: excellent, color: COLORS.excellent },
      { name: t("hr:kpiAnalytics.good"), value: good, color: COLORS.good },
      { name: t("hr:kpiAnalytics.needsImprovement"), value: needsImprovement, color: COLORS.needsImprovement },
      { name: t("hr:kpiAnalytics.notEvaluated"), value: notEvaluated, color: COLORS.notEvaluated },
    ].filter(d => d.value > 0);
  }, [employeeScores, t]);

  // Department chart data
  const departmentChartData = useMemo(() => {
    return departmentScores.slice(0, 8).map(dept => ({
      name: dept.departmentName.length > 15 
        ? dept.departmentName.substring(0, 15) + "..." 
        : dept.departmentName,
      fullName: dept.departmentName,
      score: dept.averageScore,
      employees: dept.employeeCount,
    }));
  }, [departmentScores]);

  // Top/Bottom KPIs
  const topKpis = useMemo(() => kpiScores.slice(0, 5), [kpiScores]);
  const bottomKpis = useMemo(() => [...kpiScores].sort((a, b) => a.averageScore - b.averageScore).slice(0, 5), [kpiScores]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-[#E6E6E4]">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (employeeScores.length === 0) {
    return (
      <Card className="border-[#E6E6E4]">
        <CardContent className="py-12 text-center">
          <Target className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-[#6B6B6B] mb-4">{t("hr:kpiAnalytics.noData")}</p>
          <Button
            variant="outline"
            onClick={() => router.push(`${basePath}/kpis`)}
          >
            {t("hr:kpiAnalytics.configureKPIs")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className={cn("flex flex-wrap items-center justify-between gap-4", isRtl && "flex-row-reverse")}>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
          <h3 className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
            {t("hr:kpiAnalytics.title")}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedYear.toString()}
            onValueChange={(val) => setSelectedYear(parseInt(val))}
          >
            <SelectTrigger className="w-[120px] border-[#E6E6E4]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchAnalyticsData}
            className="border-[#E6E6E4]"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Score Distribution Pie */}
        <Card className="border-[#E6E6E4]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#222222] flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
              {t("hr:kpiAnalytics.scoreDistribution")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={pieChartConfig} className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scoreDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {scoreDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry: any) => (
                      <span className="text-sm text-[#6B6B6B]">
                        {value} ({entry.payload.value})
                      </span>
                    )}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value, name) => [`${value} ${t("hr:kpiAnalytics.employees")}`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Chart 2: Department Performance Bar */}
        <Card className="border-[#E6E6E4]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#222222] flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
              {t("hr:kpiAnalytics.departmentPerformance")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {departmentChartData.length > 0 ? (
              <ChartContainer config={barChartConfig} className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={departmentChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value, name, props) => [
                        `${value}% (${props.payload.employees} ${t("hr:kpiAnalytics.employees")})`,
                        props.payload.fullName
                      ]}
                    />
                    <Bar 
                      dataKey="score" 
                      fill={COLORS.primary}
                      radius={[0, 4, 4, 0]}
                      barSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-[#6B6B6B]">
                {t("hr:kpiAnalytics.noData")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 3: Monthly Trend Line */}
        <Card className="border-[#E6E6E4]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#222222] flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
              {t("hr:kpiAnalytics.monthlyTrend")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyTrends.length > 0 ? (
              <ChartContainer config={lineChartConfig} className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={monthlyTrends}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value, name) => [`${value}%`, name === "averageScore" ? t("hr:kpiAnalytics.avgScore") : t("hr:kpiAnalytics.completion")]}
                    />
                    <Legend 
                      formatter={(value) => value === "averageScore" ? t("hr:kpiAnalytics.avgScore") : t("hr:kpiAnalytics.completion")}
                    />
                    <Line
                      type="monotone"
                      dataKey="averageScore"
                      stroke={COLORS.trend}
                      strokeWidth={2}
                      dot={{ fill: COLORS.trend }}
                      name="averageScore"
                    />
                    <Line
                      type="monotone"
                      dataKey="completionRate"
                      stroke={COLORS.completion}
                      strokeWidth={2}
                      dot={{ fill: COLORS.completion }}
                      name="completionRate"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-[#6B6B6B]">
                {t("hr:kpiAnalytics.noData")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 4: Top/Bottom KPIs */}
        <Card className="border-[#E6E6E4]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#222222] flex items-center gap-2">
              <Target className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
              {t("hr:kpiAnalytics.kpiPerformance")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpiScores.length > 0 ? (
              <div className="space-y-4">
                {/* Top KPIs */}
                <div>
                  <p className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {t("hr:kpiAnalytics.topPerforming")}
                  </p>
                  <div className="space-y-1.5">
                    {topKpis.slice(0, 3).map((kpi, i) => (
                      <div key={kpi.id} className="flex items-center justify-between p-2 rounded bg-green-50 border border-green-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-green-700 bg-green-200 rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#222222] truncate">{kpi.name}</p>
                            <p className="text-xs text-[#6B6B6B] truncate">{kpi.jobRoleName}</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-green-600 flex-shrink-0 ml-2">{kpi.averageScore}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom KPIs */}
                {bottomKpis.length > 0 && bottomKpis[0].averageScore < 70 && (
                  <div>
                    <p className="text-xs font-medium text-red-600 mb-2 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 rotate-180" />
                      {t("hr:kpiAnalytics.needsImprovement")}
                    </p>
                    <div className="space-y-1.5">
                      {bottomKpis.filter(k => k.averageScore < 70).slice(0, 3).map((kpi) => (
                        <div key={kpi.id} className="flex items-center justify-between p-2 rounded bg-red-50 border border-red-200">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#222222] truncate">{kpi.name}</p>
                            <p className="text-xs text-[#6B6B6B] truncate">{kpi.jobRoleName}</p>
                          </div>
                          <span className="text-sm font-bold text-red-600 flex-shrink-0 ml-2">{kpi.averageScore}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-[#6B6B6B]">
                {t("hr:kpiAnalytics.noData")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Employee Individual Trend Chart */}
      <Card className="border-[#E6E6E4] mt-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-base font-semibold text-[#222222] flex items-center gap-2">
              <Users className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
              {t("hr:kpiAnalytics.employeeTrend", "Individual Employee Trend")}
            </CardTitle>
            <Select
              value={selectedEmployeeId || ""}
              onValueChange={(value) => setSelectedEmployeeId(value || null)}
            >
              <SelectTrigger className="w-[280px] border-[#E6E6E4]">
                <SelectValue placeholder={t("hr:kpiAnalytics.selectEmployee", "Select an employee")} />
              </SelectTrigger>
              <SelectContent>
                {employeeList.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} {emp.jobRoleName && <span className="text-[#6B6B6B]">- {emp.jobRoleName}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedEmployeeId ? (
            <div className="h-[280px] flex items-center justify-center text-[#6B6B6B] bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]">
              <div className="text-center">
                <Users className="h-10 w-10 mx-auto mb-2 text-[#C6A03B]" />
                <p>{t("hr:kpiAnalytics.selectEmployeePrompt", "Select an employee to view their performance trend")}</p>
              </div>
            </div>
          ) : employeeTrendData.filter(d => d.score !== null).length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-[#6B6B6B]">
              {t("hr:kpiAnalytics.noEmployeeData", "No evaluation data for this employee in selected year")}
            </div>
          ) : (
            <ChartContainer config={lineChartConfig} className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={employeeTrendData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value) => [`${value}%`, t("hr:score", "Score")]}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    dot={{ fill: COLORS.primary, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: COLORS.gold }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
