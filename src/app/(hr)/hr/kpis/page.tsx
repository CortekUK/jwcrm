"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentMonth, getCurrentYear } from "@/lib/kpi-validation";
import { KPITable, KPIEvaluationTable, DepartmentKPISummary, DepartmentSummary, JobRoleSummary, EmployeeSummary, ExportDepartmentSummaryDialog } from "@/components/hr/kpis";
import { KPIAnalyticsCharts } from "@/components/hr/kpis/KPIAnalyticsCharts";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, ClipboardCheck, BarChart3, LineChart } from "lucide-react";
import { useHrBasePath } from "@/hooks/useHrBasePath";

type KPI = {
  id: string;
  name: string;
  description: string | null;
  target_value: number;
  unit: string;
  weighting: number;
  job_role_id: string;
  job_role?: {
    id: string;
    name: string;
  } | null;
  created_at: string | null;
  is_archived?: boolean;
};

type JobRole = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  full_name: string;
  job_role_id: string | null;
  job_role?: {
    id: string;
    name: string;
  } | null;
};

// Tab values that can be deep-linked via ?tab= (must match the TabsTrigger values below)
const TAB_VALUES = ["kpis", "evaluations", "summaries", "analytics"] as const;
const DEFAULT_TAB = "kpis";

type EvaluationSummary = {
  employee_id: string;
  employee_name: string;
  job_role_name: string | null;
  total_kpis: number;
  completed_kpis: number;
  overall_score: number | null;
};

export default function KPIsPage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  // The admin portal re-exports this page, so hardcoding /admin/hr threw an
  // HR-portal user out of their own portal mid-flow.
  const basePath = useHrBasePath();
  const searchParams = useSearchParams();
  
  // Get initial role filter from URL
  const initialRoleFilter = searchParams.get("role") || undefined;

  // Get initial tab from URL (e.g. the "Mark Evaluations" shortcut on the HR dashboard).
  // Unknown or absent values fall back to the default tab.
  const tabParam = searchParams?.get("tab");
  const initialTab = TAB_VALUES.includes(tabParam as (typeof TAB_VALUES)[number])
    ? (tabParam as string)
    : DEFAULT_TAB;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);

  // KPIs tab state
  const [kpis, setKPIs] = useState<KPI[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // Evaluations tab state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [evaluationSummaries, setEvaluationSummaries] = useState<EvaluationSummary[]>([]);
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  // Department summary tab state
  const [departmentSummaries, setDepartmentSummaries] = useState<DepartmentSummary[]>([]);
  const [summaryYear, setSummaryYear] = useState(getCurrentYear());
  const [summaryMonth, setSummaryMonth] = useState(getCurrentMonth());

  // Fetch KPIs and job roles
  const fetchKPIsData = useCallback(async () => {
    try {
      let kpisQuery = supabase
        .from("kpis")
        .select("id, name, description, target_value, unit, weighting, job_role_id, job_role:job_roles(id, name), created_at, is_archived")
        .order("name");

      // Only filter out archived if not showing archived
      if (!showArchived) {
        kpisQuery = kpisQuery.eq("is_archived", false);
      }

      const [kpisResult, rolesResult] = await Promise.all([
        kpisQuery,
        supabase
          .from("job_roles")
          .select("id, name")
          .order("name"),
      ]);

      if (kpisResult.error) throw kpisResult.error;
      if (rolesResult.error) throw rolesResult.error;

      setKPIs(kpisResult.data || []);
      setJobRoles(rolesResult.data || []);
    } catch (error) {
      console.error("Error fetching KPIs data:", error);
    }
  }, [showArchived]);

  // Fetch evaluations data
  const fetchEvaluationsData = useCallback(async () => {
    try {
      // Fetch active employees with job roles
      const { data: employeesData, error: empError } = await supabase
        .from("employees")
        .select("id, full_name, job_role_id, job_role:job_roles(id, name)")
        .eq("employment_status", "active")
        .order("full_name");

      if (empError) throw empError;
      setEmployees(employeesData || []);

      // Fetch evaluations for selected year/month
      const { data: evaluationsData, error: evalError } = await supabase
        .from("kpi_evaluations")
        .select("employee_id, kpi_id, score, status")
        .eq("year", selectedYear)
        .eq("month", selectedMonth);

      if (evalError) throw evalError;

      // Fetch KPIs for calculating totals (exclude archived)
      const { data: kpisData, error: kpiError } = await supabase
        .from("kpis")
        .select("id, job_role_id, weighting")
        .eq("is_archived", false);

      if (kpiError) throw kpiError;

      // Calculate summaries for each employee
      const summaries: EvaluationSummary[] = (employeesData || []).map((emp) => {
        const empKPIs = (kpisData || []).filter((k) => k.job_role_id === emp.job_role_id);
        const empEvals = (evaluationsData || []).filter((e) => e.employee_id === emp.id);
        const completedEvals = empEvals.filter((e) => e.status === "completed");

        // Calculate weighted score
        let weightedScore = 0;
        let totalWeight = 0;
        completedEvals.forEach((evaluation) => {
          const kpi = empKPIs.find((k) => k.id === evaluation.kpi_id);
          if (kpi && evaluation.score !== null) {
            weightedScore += (evaluation.score * kpi.weighting) / 100;
            totalWeight += kpi.weighting;
          }
        });

        const overallScore = totalWeight > 0 ? Math.round(weightedScore * 100) / 100 : null;

        return {
          employee_id: emp.id,
          employee_name: emp.full_name,
          job_role_name: emp.job_role?.name || null,
          total_kpis: empKPIs.length,
          completed_kpis: completedEvals.length,
          overall_score: overallScore,
        };
      });

      setEvaluationSummaries(summaries);
    } catch (error) {
      console.error("Error fetching evaluations data:", error);
    }
  }, [selectedYear, selectedMonth]);

  // Fetch department summaries
  const fetchDepartmentSummaries = useCallback(async () => {
    try {
      // Fetch departments
      const { data: departments, error: deptError } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");

      if (deptError) throw deptError;

      // Fetch job roles with department info
      const { data: jobRolesData, error: rolesError } = await supabase
        .from("job_roles")
        .select("id, name, department_id")
        .order("name");

      if (rolesError) throw rolesError;

      // Fetch employees with job roles
      const { data: employeesData, error: empError } = await supabase
        .from("employees")
        .select("id, full_name, job_role_id, job_role:job_roles(id, name, department_id)")
        .eq("employment_status", "active")
        .not("job_role_id", "is", null);

      if (empError) throw empError;

      // Fetch KPIs (exclude archived)
      const { data: kpisData, error: kpiError } = await supabase
        .from("kpis")
        .select("id, job_role_id, weighting")
        .eq("is_archived", false);

      if (kpiError) throw kpiError;

      // Fetch evaluations for selected month/year
      const { data: evaluationsData, error: evalError } = await supabase
        .from("kpi_evaluations")
        .select("employee_id, kpi_id, score, status")
        .eq("year", summaryYear)
        .eq("month", summaryMonth);

      if (evalError) throw evalError;

      // Build KPIs by job role
      const kpisByRole: Record<string, { id: string; weighting: number }[]> = {};
      (kpisData || []).forEach((kpi) => {
        if (!kpisByRole[kpi.job_role_id]) {
          kpisByRole[kpi.job_role_id] = [];
        }
        kpisByRole[kpi.job_role_id].push({ id: kpi.id, weighting: kpi.weighting });
      });

      // Build evaluations by employee
      const evalsByEmployee: Record<string, { kpi_id: string; score: number | null; status: string }[]> = {};
      (evaluationsData || []).forEach((eval_) => {
        if (!evalsByEmployee[eval_.employee_id]) {
          evalsByEmployee[eval_.employee_id] = [];
        }
        evalsByEmployee[eval_.employee_id].push({
          kpi_id: eval_.kpi_id,
          score: eval_.score,
          status: eval_.status,
        });
      });

      // Build department summaries
      const summaries: DepartmentSummary[] = (departments || []).map((dept) => {
        const deptJobRoles = (jobRolesData || []).filter((r) => r.department_id === dept.id);
        const deptEmployees = (employeesData || []).filter(
          (e: any) => e.job_role?.department_id === dept.id
        );

        let deptCompleted = 0;
        let deptPending = 0;
        let deptScores: number[] = [];

        const jobRoleSummaries: JobRoleSummary[] = deptJobRoles.map((role) => {
          const roleEmployees = deptEmployees.filter((e) => e.job_role_id === role.id);
          const roleKpis = kpisByRole[role.id] || [];

          let roleCompleted = 0;
          let rolePending = 0;
          let roleScores: number[] = [];

          const empSummaries: EmployeeSummary[] = roleEmployees.map((emp: any) => {
            const empEvals = evalsByEmployee[emp.id] || [];
            const completedEvals = empEvals.filter((e) => e.status === "completed");
            const pendingCount = roleKpis.length - completedEvals.length;

            roleCompleted += completedEvals.length;
            rolePending += pendingCount > 0 ? pendingCount : 0;

            // Calculate employee score
            let weightedScore = 0;
            let totalWeight = 0;
            completedEvals.forEach((evaluation) => {
              const kpi = roleKpis.find((k) => k.id === evaluation.kpi_id);
              if (kpi && evaluation.score !== null) {
                weightedScore += (evaluation.score * kpi.weighting) / 100;
                totalWeight += kpi.weighting;
              }
            });
            const empScore = totalWeight > 0 ? Math.round(weightedScore * 10) / 10 : null;
            if (empScore !== null) roleScores.push(empScore);

            return {
              employee_id: emp.id,
              employee_name: emp.full_name,
              completed_kpis: completedEvals.length,
              total_kpis: roleKpis.length,
              overall_score: empScore,
            };
          });

          deptCompleted += roleCompleted;
          deptPending += rolePending;
          deptScores = [...deptScores, ...roleScores];

          const roleAvgScore = roleScores.length > 0
            ? Math.round(roleScores.reduce((a, b) => a + b, 0) / roleScores.length * 10) / 10
            : null;

          return {
            job_role_id: role.id,
            job_role_name: role.name,
            employee_count: roleEmployees.length,
            kpi_count: roleKpis.length,
            completed_evaluations: roleCompleted,
            pending_evaluations: rolePending,
            average_score: roleAvgScore,
            completion_rate: (roleCompleted + rolePending) > 0
              ? Math.round((roleCompleted / (roleCompleted + rolePending)) * 100)
              : 0,
            employees: empSummaries,
          };
        }).filter((r) => r.employee_count > 0); // Only include roles with employees

        const deptAvgScore = deptScores.length > 0
          ? Math.round(deptScores.reduce((a, b) => a + b, 0) / deptScores.length * 10) / 10
          : null;

        return {
          department_id: dept.id,
          department_name: dept.name,
          total_employees: deptEmployees.length,
          employees_with_kpis: deptEmployees.filter((e) => {
            const roleKpis = kpisByRole[e.job_role_id || ""] || [];
            return roleKpis.length > 0;
          }).length,
          total_kpis: deptJobRoles.reduce((sum, r) => sum + (kpisByRole[r.id]?.length || 0), 0),
          completed_evaluations: deptCompleted,
          pending_evaluations: deptPending,
          average_score: deptAvgScore,
          completion_rate: (deptCompleted + deptPending) > 0
            ? Math.round((deptCompleted / (deptCompleted + deptPending)) * 100)
            : 0,
          job_roles: jobRoleSummaries,
        };
      }).filter((d) => d.employees_with_kpis > 0); // Only include departments with employees with KPIs

      setDepartmentSummaries(summaries);
    } catch (error) {
      console.error("Error fetching department summaries:", error);
    }
  }, [summaryYear, summaryMonth]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchKPIsData(), fetchEvaluationsData(), fetchDepartmentSummaries()]);
      setLoading(false);
    };
    loadData();
  }, [fetchKPIsData, fetchEvaluationsData, fetchDepartmentSummaries]);

  // Reload evaluations when year/month changes
  useEffect(() => {
    if (!loading) {
      fetchEvaluationsData();
    }
  }, [selectedYear, selectedMonth, fetchEvaluationsData, loading]);

  // Reload department summaries when year/month changes
  useEffect(() => {
    if (!loading) {
      fetchDepartmentSummaries();
    }
  }, [summaryYear, summaryMonth, fetchDepartmentSummaries, loading]);

  const handleAddKPI = () => {
    router.push(`${basePath}/kpis/new`);
  };

  const handleEditKPI = (id: string) => {
    router.push(`${basePath}/kpis/${id}/edit`);
  };

  const handleEvaluate = (employeeId: string) => {
    router.push(`${basePath}/kpis/evaluations/${employeeId}?year=${selectedYear}&month=${selectedMonth}`);
  };

  const handleSummaryEmployeeClick = (employeeId: string) => {
    router.push(`${basePath}/kpis/evaluations/${employeeId}?year=${summaryYear}&month=${summaryMonth}`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Target className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("hr:kpis")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {t("hr:kpisDescription")}
            </p>
          </div>
          {!loading && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[hsl(var(--jw-primary-green))]/30 bg-white">
              <Target className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
              <span className="text-sm font-medium text-[hsl(var(--jw-primary-green))]">
                {kpis.filter(k => !k.is_archived).length} {t("hr:kpisCount")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border border-[#E6E6E4] p-1.5 rounded-xl w-full grid grid-cols-4 h-auto">
          <TabsTrigger 
            value="kpis" 
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[#555555] font-medium transition-all"
          >
            <Target className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("hr:kpis")}
          </TabsTrigger>
          <TabsTrigger 
            value="evaluations" 
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[#555555] font-medium transition-all"
          >
            <ClipboardCheck className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("hr:evaluations")}
          </TabsTrigger>
          <TabsTrigger 
            value="summaries" 
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[#555555] font-medium transition-all"
          >
            <BarChart3 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("hr:departmentSummary.title")}
          </TabsTrigger>
          <TabsTrigger 
            value="analytics" 
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[#555555] font-medium transition-all"
          >
            <LineChart className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("hr:kpiAnalytics.tabTitle")}
          </TabsTrigger>
        </TabsList>

        {/* KPIs Tab */}
        <TabsContent value="kpis">
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-6">
              {loading ? (
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : (
                <KPITable
                  kpis={kpis}
                  jobRoles={jobRoles}
                  onAddNew={handleAddKPI}
                  onEdit={handleEditKPI}
                  onRefresh={fetchKPIsData}
                  showArchived={showArchived}
                  onShowArchivedChange={setShowArchived}
                  initialRoleFilter={initialRoleFilter}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evaluations Tab */}
        <TabsContent value="evaluations">
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-6">
              {loading ? (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : (
                <KPIEvaluationTable
                  employees={employees}
                  evaluationSummaries={evaluationSummaries}
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  onYearChange={setSelectedYear}
                  onMonthChange={setSelectedMonth}
                  onEvaluate={handleEvaluate}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Department Summaries Tab */}
        <TabsContent value="summaries">
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-6">
              {loading ? (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Export Button */}
                  <div className="flex justify-end">
                    <ExportDepartmentSummaryDialog
                      departmentSummaries={departmentSummaries}
                      selectedYear={summaryYear}
                      selectedMonth={summaryMonth}
                    />
                  </div>
                  <DepartmentKPISummary
                    departmentSummaries={departmentSummaries}
                    selectedYear={summaryYear}
                    selectedMonth={summaryMonth}
                    onYearChange={setSummaryYear}
                    onMonthChange={setSummaryMonth}
                    onEmployeeClick={handleSummaryEmployeeClick}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-6">
              <KPIAnalyticsCharts />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("hr:legalNotice")}
        </p>
      </div>
    </div>
  );
}
