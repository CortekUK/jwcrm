import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import {
  LeaveExportFilters,
  LeaveExportRequest,
  EmployeeLeaveStats,
  LeaveExportData,
  LEAVE_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
} from "@/types/leave-export";

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
      reportType = "all",
      startDate,
      endDate,
      employeeId,
      departmentId,
      leaveTypes = "all",
      statuses = "all",
    }: LeaveExportFilters = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields: startDate, endDate" },
        { status: 400 }
      );
    }

    // Build query for leave requests with employee info
    let query = supabase
      .from("leave_requests")
      .select(
        `
        id,
        employee_id,
        leave_type,
        start_date,
        end_date,
        total_days,
        reason,
        status,
        created_at,
        approved_by,
        approved_at,
        denial_reason,
        employees!inner (
          id,
          full_name,
          job_title,
          department_id,
          departments (
            id,
            name
          )
        )
      `
      )
      .gte("start_date", startDate)
      .lte("start_date", endDate)
      .order("start_date", { ascending: false });

    // Apply filters
    if (reportType === "individual" && employeeId) {
      query = query.eq("employee_id", employeeId);
    }

    if (reportType === "department" && departmentId) {
      query = query.eq("employees.department_id", departmentId);
    }

    if (leaveTypes !== "all" && leaveTypes.length > 0) {
      query = query.in("leave_type", leaveTypes);
    }

    if (statuses !== "all" && statuses.length > 0) {
      query = query.in("status", statuses);
    }

    const { data: leaveRequests, error: leaveError } = await query;

    if (leaveError) {
      console.error("Error fetching leave requests:", leaveError);
      return NextResponse.json(
        { error: "Failed to fetch leave requests" },
        { status: 500 }
      );
    }

    // Fetch approver names
    const approverIds = [
      ...new Set(
        (leaveRequests || [])
          .filter((r: any) => r.approved_by)
          .map((r: any) => r.approved_by)
      ),
    ];

    let approverNames: Record<string, string> = {};
    if (approverIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", approverIds);

      if (profiles) {
        profiles.forEach((p) => {
          approverNames[p.id] = p.full_name || "Unknown";
        });
      }
    }

    // Fetch department name for department reports
    let departmentName: string | undefined;
    if (reportType === "department" && departmentId) {
      const { data: dept } = await supabase
        .from("departments")
        .select("name")
        .eq("id", departmentId)
        .single();
      departmentName = dept?.name;
    }

    // Transform data
    const requests: LeaveExportRequest[] = (leaveRequests || []).map(
      (req: any) => ({
        employee_id: req.employee_id,
        employee_name: req.employees?.full_name || "Unknown",
        department_name: req.employees?.departments?.name || null,
        job_title: req.employees?.job_title || null,
        leave_type: req.leave_type,
        start_date: req.start_date,
        end_date: req.end_date,
        total_days: req.total_days,
        reason: req.reason,
        status: req.status,
        created_at: req.created_at,
        approved_by_name: req.approved_by
          ? approverNames[req.approved_by] || null
          : null,
        approved_at: req.approved_at,
        denial_reason: req.denial_reason,
      })
    );

    // Calculate employee stats
    const employeeStatsMap: Record<string, EmployeeLeaveStats> = {};

    requests.forEach((req) => {
      if (!employeeStatsMap[req.employee_id]) {
        employeeStatsMap[req.employee_id] = {
          employee_id: req.employee_id,
          employee_name: req.employee_name,
          department_name: req.department_name,
          total_requests: 0,
          approved_requests: 0,
          denied_requests: 0,
          pending_requests: 0,
          total_days_approved: 0,
          by_type: {},
        };
      }

      const stats = employeeStatsMap[req.employee_id];
      stats.total_requests++;

      if (req.status === "approved") {
        stats.approved_requests++;
        stats.total_days_approved += req.total_days;
      } else if (req.status === "denied") {
        stats.denied_requests++;
      } else if (req.status === "pending") {
        stats.pending_requests++;
      }

      stats.by_type[req.leave_type] =
        (stats.by_type[req.leave_type] || 0) + req.total_days;
    });

    const employeeStats = Object.values(employeeStatsMap);

    // Calculate overall stats
    const overallStats = {
      totalRequests: requests.length,
      totalApproved: requests.filter((r) => r.status === "approved").length,
      totalDenied: requests.filter((r) => r.status === "denied").length,
      totalPending: requests.filter((r) => r.status === "pending").length,
      totalDaysApproved: requests
        .filter((r) => r.status === "approved")
        .reduce((sum, r) => sum + r.total_days, 0),
      byType: requests.reduce((acc, r) => {
        acc[r.leave_type] = (acc[r.leave_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    const exportData: LeaveExportData = {
      reportType,
      startDate,
      endDate,
      generatedAt: new Date().toISOString(),
      departmentName,
      requests,
      employeeStats,
      overallStats,
    };

    // Generate Excel workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryData = buildSummarySheet(exportData);
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    // Sheet 2: All Leave Requests
    const requestsData = buildRequestsSheet(requests);
    const requestsSheet = XLSX.utils.aoa_to_sheet(requestsData);
    requestsSheet["!cols"] = [
      { wch: 25 },
      { wch: 20 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
      { wch: 12 },
      { wch: 30 },
      { wch: 20 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, requestsSheet, "Leave Requests");

    // Sheet 3: By Employee Summary
    if (employeeStats.length > 0) {
      const employeeData = buildEmployeeSheet(employeeStats);
      const employeeSheet = XLSX.utils.aoa_to_sheet(employeeData);
      employeeSheet["!cols"] = [
        { wch: 25 },
        { wch: 20 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 15 },
      ];
      XLSX.utils.book_append_sheet(wb, employeeSheet, "By Employee");
    }

    // Generate buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Generate filename
    const filename = generateFilename(exportData);

    // Return the file
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
      { error: "Failed to export leave data" },
      { status: 500 }
    );
  }
}

function buildSummarySheet(data: LeaveExportData): any[][] {
  const rows: any[][] = [
    ["Leave Report"],
    [],
    ["Report Type", getReportTypeLabel(data.reportType)],
    ["Period", `${data.startDate} to ${data.endDate}`],
    ["Generated", new Date(data.generatedAt).toLocaleString()],
  ];

  if (data.departmentName) {
    rows.push(["Department", data.departmentName]);
  }

  rows.push([]);
  rows.push(["Overall Statistics"]);
  rows.push([]);
  rows.push(["Total Requests", data.overallStats.totalRequests.toString()]);
  rows.push(["Approved", data.overallStats.totalApproved.toString()]);
  rows.push(["Denied", data.overallStats.totalDenied.toString()]);
  rows.push(["Pending", data.overallStats.totalPending.toString()]);
  rows.push([
    "Total Days Approved",
    data.overallStats.totalDaysApproved.toString(),
  ]);

  rows.push([]);
  rows.push(["By Leave Type"]);
  Object.entries(data.overallStats.byType).forEach(([type, count]) => {
    rows.push([LEAVE_TYPE_LABELS[type] || type, count.toString()]);
  });

  return rows;
}

function buildRequestsSheet(requests: LeaveExportRequest[]): any[][] {
  const headers = [
    "Employee Name",
    "Department",
    "Leave Type",
    "Start Date",
    "End Date",
    "Days",
    "Status",
    "Reason",
    "Approved By",
    "Denial Reason",
  ];

  const rows: any[][] = [headers];

  requests.forEach((req) => {
    rows.push([
      req.employee_name,
      req.department_name || "N/A",
      LEAVE_TYPE_LABELS[req.leave_type] || req.leave_type,
      req.start_date,
      req.end_date,
      req.total_days,
      LEAVE_STATUS_LABELS[req.status] || req.status,
      req.reason || "-",
      req.approved_by_name || "-",
      req.denial_reason || "-",
    ]);
  });

  return rows;
}

function buildEmployeeSheet(stats: EmployeeLeaveStats[]): any[][] {
  const headers = [
    "Employee Name",
    "Department",
    "Total Requests",
    "Approved",
    "Denied",
    "Pending",
    "Days Approved",
  ];

  const rows: any[][] = [headers];

  stats.forEach((emp) => {
    rows.push([
      emp.employee_name,
      emp.department_name || "N/A",
      emp.total_requests,
      emp.approved_requests,
      emp.denied_requests,
      emp.pending_requests,
      emp.total_days_approved,
    ]);
  });

  return rows;
}

function getReportTypeLabel(type: string): string {
  switch (type) {
    case "individual":
      return "Individual Employee";
    case "all":
      return "All Employees";
    case "department":
      return "By Department";
    default:
      return type;
  }
}

function generateFilename(data: LeaveExportData): string {
  const dateStr = `${data.startDate}_to_${data.endDate}`;

  switch (data.reportType) {
    case "department":
      const deptName = data.departmentName?.replace(/\s+/g, "_") || "Department";
      return `Leave_Report_${deptName}_${dateStr}.xlsx`;
    case "all":
    default:
      return `Leave_Report_All_Employees_${dateStr}.xlsx`;
  }
}
