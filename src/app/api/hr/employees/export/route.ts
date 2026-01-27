import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import {
  EmployeeExportFilters,
  ExportableEmployee,
  EmployeeExportData,
  EMPLOYMENT_STATUS_LABELS,
} from "@/types/employee-export";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    const {
      departmentIds = "all",
      statuses = "all",
      includeSalary = false,
      format = "xlsx",
    }: EmployeeExportFilters = body;

    // Build query for employees
    let query = supabase
      .from("employees")
      .select(
        `
        id,
        full_name,
        email,
        phone,
        date_of_birth,
        job_title,
        department_id,
        manager_id,
        start_date,
        employment_status,
        salary,
        job_role_id,
        departments (
          id,
          name
        ),
        job_roles (
          id,
          name
        )
      `
      )
      .order("full_name");

    // Apply department filter
    if (departmentIds !== "all" && departmentIds.length > 0) {
      query = query.in("department_id", departmentIds);
    }

    // Apply status filter
    if (statuses !== "all" && statuses.length > 0) {
      query = query.in("employment_status", statuses);
    }

    const { data: employees, error: empError } = await query;

    if (empError) {
      console.error("Error fetching employees:", empError);
      return NextResponse.json(
        { error: "Failed to fetch employees" },
        { status: 500 }
      );
    }

    if (!employees || employees.length === 0) {
      return NextResponse.json(
        { error: "No employees found matching the criteria" },
        { status: 404 }
      );
    }

    // Fetch manager names
    const managerIds = [
      ...new Set(
        employees.filter((e: any) => e.manager_id).map((e: any) => e.manager_id)
      ),
    ];

    let managerNames: Record<string, string> = {};
    if (managerIds.length > 0) {
      const { data: managers } = await supabase
        .from("employees")
        .select("id, full_name")
        .in("id", managerIds);

      if (managers) {
        managers.forEach((m) => {
          managerNames[m.id] = m.full_name;
        });
      }
    }

    // Transform data
    const exportableEmployees: ExportableEmployee[] = employees.map(
      (emp: any) => ({
        id: emp.id,
        full_name: emp.full_name,
        email: emp.email,
        phone: emp.phone,
        date_of_birth: emp.date_of_birth,
        job_title: emp.job_title,
        job_role_name: emp.job_roles?.name || null,
        department_name: emp.departments?.name || null,
        manager_name: emp.manager_id ? managerNames[emp.manager_id] || null : null,
        start_date: emp.start_date,
        employment_status: emp.employment_status,
        salary: includeSalary ? emp.salary : null,
      })
    );

    // Calculate stats
    const stats = {
      totalEmployees: exportableEmployees.length,
      byStatus: exportableEmployees.reduce((acc, emp) => {
        acc[emp.employment_status] = (acc[emp.employment_status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byDepartment: exportableEmployees.reduce((acc, emp) => {
        const dept = emp.department_name || "No Department";
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    // Determine filter labels
    let departmentLabel = "All Departments";
    if (departmentIds !== "all" && departmentIds.length > 0) {
      const deptNames = [
        ...new Set(
          exportableEmployees
            .map((e) => e.department_name)
            .filter((n) => n !== null)
        ),
      ];
      departmentLabel =
        deptNames.length > 0 ? deptNames.join(", ") : "Selected Departments";
    }

    let statusLabel = "All Statuses";
    if (statuses !== "all" && statuses.length > 0) {
      statusLabel = (statuses as string[])
        .map((s) => EMPLOYMENT_STATUS_LABELS[s] || s)
        .join(", ");
    }

    const exportData: EmployeeExportData = {
      generatedAt: new Date().toISOString(),
      filters: {
        departments: departmentLabel,
        statuses: statusLabel,
      },
      employees: exportableEmployees,
      stats,
    };

    // Generate output based on format
    if (format === "csv") {
      const csv = generateCSV(exportableEmployees, includeSalary);
      const filename = `Employee_Roster_${new Date().toISOString().split("T")[0]}.csv`;

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Excel format
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryData = buildSummarySheet(exportData);
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet["!cols"] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    // Sheet 2: Employee List
    const employeeData = buildEmployeeSheet(exportableEmployees, includeSalary);
    const employeeSheet = XLSX.utils.aoa_to_sheet(employeeData);
    const colWidths = [
      { wch: 25 }, // Name
      { wch: 25 }, // Email
      { wch: 15 }, // Phone
      { wch: 20 }, // Job Role
      { wch: 20 }, // Department
      { wch: 20 }, // Manager
      { wch: 12 }, // Start Date
      { wch: 12 }, // Status
    ];
    if (includeSalary) {
      colWidths.push({ wch: 15 }); // Salary
    }
    employeeSheet["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, employeeSheet, "Employees");

    // Generate buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = `Employee_Roster_${new Date().toISOString().split("T")[0]}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export employee data" },
      { status: 500 }
    );
  }
}

function buildSummarySheet(data: EmployeeExportData): any[][] {
  const rows: any[][] = [
    ["Employee Roster Export"],
    [],
    ["Generated", new Date(data.generatedAt).toLocaleString()],
    ["Departments", data.filters.departments],
    ["Statuses", data.filters.statuses],
    [],
    ["Statistics"],
    [],
    ["Total Employees", data.stats.totalEmployees.toString()],
    [],
    ["By Status"],
  ];

  Object.entries(data.stats.byStatus).forEach(([status, count]) => {
    rows.push([EMPLOYMENT_STATUS_LABELS[status] || status, count.toString()]);
  });

  rows.push([]);
  rows.push(["By Department"]);

  Object.entries(data.stats.byDepartment).forEach(([dept, count]) => {
    rows.push([dept, count.toString()]);
  });

  return rows;
}

function buildEmployeeSheet(
  employees: ExportableEmployee[],
  includeSalary: boolean
): any[][] {
  const headers = [
    "Full Name",
    "Email",
    "Phone",
    "Job Role",
    "Department",
    "Manager",
    "Start Date",
    "Status",
  ];

  if (includeSalary) {
    headers.push("Salary");
  }

  const rows: any[][] = [headers];

  employees.forEach((emp) => {
    const row = [
      emp.full_name,
      emp.email || "-",
      emp.phone || "-",
      emp.job_role_name || emp.job_title || "-",
      emp.department_name || "-",
      emp.manager_name || "-",
      emp.start_date,
      EMPLOYMENT_STATUS_LABELS[emp.employment_status] || emp.employment_status,
    ];

    if (includeSalary) {
      row.push(emp.salary !== null ? emp.salary.toLocaleString() : "-");
    }

    rows.push(row);
  });

  return rows;
}

function generateCSV(
  employees: ExportableEmployee[],
  includeSalary: boolean
): string {
  const headers = [
    "Full Name",
    "Email",
    "Phone",
    "Job Role",
    "Department",
    "Manager",
    "Start Date",
    "Status",
  ];

  if (includeSalary) {
    headers.push("Salary");
  }

  const rows = [headers.join(",")];

  employees.forEach((emp) => {
    const row = [
      escapeCSV(emp.full_name),
      escapeCSV(emp.email || ""),
      escapeCSV(emp.phone || ""),
      escapeCSV(emp.job_role_name || emp.job_title || ""),
      escapeCSV(emp.department_name || ""),
      escapeCSV(emp.manager_name || ""),
      emp.start_date,
      EMPLOYMENT_STATUS_LABELS[emp.employment_status] || emp.employment_status,
    ];

    if (includeSalary) {
      row.push(emp.salary !== null ? emp.salary.toString() : "");
    }

    rows.push(row.join(","));
  });

  return rows.join("\n");
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
