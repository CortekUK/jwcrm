import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface DepartmentSummary {
  department_id: string;
  department_name: string;
  total_employees: number;
  employees_with_kpis: number;
  total_kpis: number;
  completed_evaluations: number;
  pending_evaluations: number;
  average_score: number | null;
  completion_rate: number;
  job_roles: JobRoleSummary[];
}

interface JobRoleSummary {
  job_role_id: string;
  job_role_name: string;
  employee_count: number;
  kpi_count: number;
  completed_evaluations: number;
  pending_evaluations: number;
  average_score: number | null;
  completion_rate: number;
  employees: EmployeeSummary[];
}

interface EmployeeSummary {
  employee_id: string;
  employee_name: string;
  completed_kpis: number;
  total_kpis: number;
  overall_score: number | null;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];

    // Create supabase client with service role for data access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { year, month, departmentId } = body;

    if (!year || !month) {
      return NextResponse.json({ error: "Year and month are required" }, { status: 400 });
    }

    // Fetch all necessary data
    const departmentSummaries = await fetchDepartmentSummaries(supabase, year, month, departmentId);

    if (departmentSummaries.length === 0) {
      return NextResponse.json({ error: "No data found for the selected period" }, { status: 404 });
    }

    // Generate Excel workbook
    const wb = XLSX.utils.book_new();

    // Get month name
    const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" });
    const periodLabel = `${monthName} ${year}`;

    // Sheet 1: Summary Overview
    const summaryData = buildSummarySheet(departmentSummaries, periodLabel);
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    // Sheet 2: Department Details
    const deptData = buildDepartmentSheet(departmentSummaries);
    const deptSheet = XLSX.utils.aoa_to_sheet(deptData);
    deptSheet["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, deptSheet, "Departments");

    // Sheet 3: Job Role Details
    const roleData = buildJobRoleSheet(departmentSummaries);
    const roleSheet = XLSX.utils.aoa_to_sheet(roleData);
    roleSheet["!cols"] = [{ wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, roleSheet, "Job Roles");

    // Sheet 4: Employee Details
    const empData = buildEmployeeSheet(departmentSummaries);
    const empSheet = XLSX.utils.aoa_to_sheet(empData);
    empSheet["!cols"] = [{ wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, empSheet, "Employees");

    // Generate buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = departmentId
      ? `${departmentSummaries[0]?.department_name.replace(/\s+/g, "_")}_KPI_Summary_${periodLabel.replace(/\s+/g, "_")}.xlsx`
      : `Department_KPI_Summary_${periodLabel.replace(/\s+/g, "_")}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export department summary data" },
      { status: 500 }
    );
  }
}

async function fetchDepartmentSummaries(
  supabase: ReturnType<typeof createClient>,
  year: number,
  month: number,
  departmentId?: string | null
): Promise<DepartmentSummary[]> {
  // Fetch departments
  let deptQuery = supabase.from("departments").select("id, name").order("name");
  if (departmentId) {
    deptQuery = deptQuery.eq("id", departmentId);
  }
  const { data: departments, error: deptError } = await deptQuery;
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
    .eq("year", year)
    .eq("month", month);
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
    }).filter((r) => r.employee_count > 0);

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
  }).filter((d) => d.employees_with_kpis > 0);

  return summaries;
}

function buildSummarySheet(summaries: DepartmentSummary[], periodLabel: string): any[][] {
  const totalEmployees = summaries.reduce((sum, d) => sum + d.employees_with_kpis, 0);
  const totalCompleted = summaries.reduce((sum, d) => sum + d.completed_evaluations, 0);
  const totalPending = summaries.reduce((sum, d) => sum + d.pending_evaluations, 0);
  const overallCompletionRate = totalEmployees > 0
    ? Math.round((totalCompleted / (totalCompleted + totalPending)) * 100) || 0
    : 0;
  const avgScores = summaries.filter(d => d.average_score !== null).map(d => d.average_score!);
  const overallAvgScore = avgScores.length > 0
    ? Math.round(avgScores.reduce((a, b) => a + b, 0) / avgScores.length * 10) / 10
    : null;

  const rows: any[][] = [
    ["Department KPI Summary Report"],
    [],
    ["Period", periodLabel],
    ["Generated At", new Date().toLocaleString()],
    [],
    ["OVERALL STATISTICS"],
    [],
    ["Total Departments", summaries.length],
    ["Total Employees with KPIs", totalEmployees],
    ["Total Completed Evaluations", totalCompleted],
    ["Total Pending Evaluations", totalPending],
    ["Overall Completion Rate", `${overallCompletionRate}%`],
    ["Overall Average Score", overallAvgScore !== null ? `${overallAvgScore}%` : "N/A"],
    [],
    ["DEPARTMENT BREAKDOWN"],
    [],
    ["Department", "Employees", "Completed", "Pending", "Avg Score"],
  ];

  summaries.forEach((dept) => {
    rows.push([
      dept.department_name,
      dept.employees_with_kpis,
      dept.completed_evaluations,
      dept.pending_evaluations,
      dept.average_score !== null ? `${dept.average_score}%` : "N/A",
    ]);
  });

  return rows;
}

function buildDepartmentSheet(summaries: DepartmentSummary[]): any[][] {
  const rows: any[][] = [
    ["Department", "Total Employees", "Employees with KPIs", "Completion Rate", "Average Score", "Job Roles"],
  ];

  summaries.forEach((dept) => {
    rows.push([
      dept.department_name,
      dept.total_employees,
      dept.employees_with_kpis,
      `${dept.completion_rate}%`,
      dept.average_score !== null ? `${dept.average_score}%` : "N/A",
      dept.job_roles.length,
    ]);
  });

  return rows;
}

function buildJobRoleSheet(summaries: DepartmentSummary[]): any[][] {
  const rows: any[][] = [
    ["Department", "Job Role", "Employees", "Completed", "Pending", "Avg Score"],
  ];

  summaries.forEach((dept) => {
    dept.job_roles.forEach((role) => {
      rows.push([
        dept.department_name,
        role.job_role_name,
        role.employee_count,
        role.completed_evaluations,
        role.pending_evaluations,
        role.average_score !== null ? `${role.average_score}%` : "N/A",
      ]);
    });
  });

  return rows;
}

function buildEmployeeSheet(summaries: DepartmentSummary[]): any[][] {
  const rows: any[][] = [
    ["Department", "Job Role", "Employee Name", "Completed KPIs", "Total KPIs", "Overall Score"],
  ];

  summaries.forEach((dept) => {
    dept.job_roles.forEach((role) => {
      role.employees.forEach((emp) => {
        rows.push([
          dept.department_name,
          role.job_role_name,
          emp.employee_name,
          emp.completed_kpis,
          emp.total_kpis,
          emp.overall_score !== null ? `${emp.overall_score}%` : "N/A",
        ]);
      });
    });
  });

  return rows;
}
