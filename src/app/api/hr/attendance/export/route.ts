import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import {
  ExportRequest,
  ExportIncludeOptions,
  EmployeeAttendanceData,
  AttendanceExportData,
  STATUS_LABELS,
  DEFAULT_INCLUDE_OPTIONS,
} from "@/types/attendance-export";

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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const {
      reportType = "individual",
      employeeId,
      departmentId,
      startDate,
      endDate,
      includeOptions = DEFAULT_INCLUDE_OPTIONS,
    }: ExportRequest = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields: startDate, endDate" },
        { status: 400 }
      );
    }

    if (reportType === "individual" && !employeeId) {
      return NextResponse.json(
        { error: "Missing required field: employeeId for individual export" },
        { status: 400 }
      );
    }

    if (reportType === "department" && !departmentId) {
      return NextResponse.json(
        { error: "Missing required field: departmentId for department export" },
        { status: 400 }
      );
    }

    // Fetch employees based on report type
    let employeesQuery = supabase
      .from("employees")
      .select("id, full_name, email, job_title, department_id, departments(name)")
      .eq("employment_status", "active");

    if (reportType === "individual") {
      employeesQuery = employeesQuery.eq("id", employeeId);
    } else if (reportType === "department") {
      employeesQuery = employeesQuery.eq("department_id", departmentId);
    }

    const { data: employees, error: empError } = await employeesQuery.order("full_name");

    if (empError) {
      return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 });
    }

    if (!employees || employees.length === 0) {
      return NextResponse.json({ error: "No employees found" }, { status: 404 });
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

    // Build employee IDs array
    const employeeIds = employees.map((e) => e.id);

    // Fetch attendance records for all employees in date range
    const { data: attendanceRecords, error: attError } = await supabase
      .from("attendance")
      .select("employee_id, date, status, check_in_time, reason")
      .in("employee_id", employeeIds)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    if (attError) {
      return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
    }

    // Fetch warnings if included
    let warningsMap: Record<string, any[]> = {};
    if (includeOptions.warnings) {
      const { data: warnings } = await supabase
        .from("attendance_warnings")
        .select("id, employee_id, issue_summary, message, sent_at")
        .in("employee_id", employeeIds)
        .gte("sent_at", startDate)
        .lte("sent_at", endDate + "T23:59:59");

      if (warnings) {
        warnings.forEach((w) => {
          if (!warningsMap[w.employee_id]) {
            warningsMap[w.employee_id] = [];
          }
          warningsMap[w.employee_id].push(w);
        });
      }
    }

    // Fetch leave requests if included
    let leavesMap: Record<string, any[]> = {};
    if (includeOptions.leaveDays) {
      const { data: leaves } = await supabase
        .from("leave_requests")
        .select("id, employee_id, leave_type, start_date, end_date, total_days, status")
        .in("employee_id", employeeIds)
        .eq("status", "approved")
        .or(`start_date.lte.${endDate},end_date.gte.${startDate}`);

      if (leaves) {
        leaves.forEach((l) => {
          if (!leavesMap[l.employee_id]) {
            leavesMap[l.employee_id] = [];
          }
          leavesMap[l.employee_id].push(l);
        });
      }
    }

    // Group attendance by employee
    const attendanceByEmployee: Record<string, any[]> = {};
    (attendanceRecords || []).forEach((record) => {
      if (!attendanceByEmployee[record.employee_id]) {
        attendanceByEmployee[record.employee_id] = [];
      }
      attendanceByEmployee[record.employee_id].push(record);
    });

    // Build employee attendance data
    const employeeDataList: EmployeeAttendanceData[] = employees.map((emp) => {
      const records = attendanceByEmployee[emp.id] || [];
      const statusCounts: Record<string, number> = {
        present: 0,
        late: 0,
        wfh: 0,
        on_leave: 0,
        sick_leave: 0,
        absent: 0,
      };

      records.forEach((r) => {
        if (statusCounts[r.status] !== undefined) {
          statusCounts[r.status]++;
        }
      });

      const totalDays = records.length;
      const attendedDays = statusCounts.present + statusCounts.late + statusCounts.wfh;
      const attendanceRate = totalDays > 0 ? Math.round((attendedDays / totalDays) * 100) : 0;

      return {
        employee: {
          id: emp.id,
          full_name: emp.full_name,
          job_title: emp.job_title,
          department_name: (emp.departments as any)?.name || null,
          email: emp.email,
        },
        records: records.map((r) => ({
          date: r.date,
          status: r.status,
          check_in_time: r.check_in_time,
          reason: r.reason,
        })),
        warnings: warningsMap[emp.id] || [],
        leaveRequests: leavesMap[emp.id] || [],
        stats: {
          totalDays,
          attendanceRate,
          statusCounts,
        },
      };
    });

    // Calculate overall stats
    const totalEmployees = employeeDataList.length;
    const totalDaysRecorded = employeeDataList.reduce((sum, e) => sum + e.stats.totalDays, 0);
    const avgAttendanceRate =
      totalEmployees > 0
        ? Math.round(
            employeeDataList.reduce((sum, e) => sum + e.stats.attendanceRate, 0) / totalEmployees
          )
        : 0;

    const exportData: AttendanceExportData = {
      reportType,
      startDate,
      endDate,
      generatedAt: new Date().toISOString(),
      departmentName,
      employees: employeeDataList,
      overallStats: {
        totalEmployees,
        avgAttendanceRate,
        totalDaysRecorded,
      },
    };

    // Generate Excel workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    if (includeOptions.summaryStats) {
      const summaryData = buildSummarySheet(exportData, includeOptions);
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
    }

    // Sheet 2: Employee Summary (for bulk exports)
    if (reportType !== "individual" && includeOptions.summaryStats) {
      const employeeSummaryData = buildEmployeeSummarySheet(exportData);
      const employeeSummarySheet = XLSX.utils.aoa_to_sheet(employeeSummaryData);
      employeeSummarySheet["!cols"] = [
        { wch: 25 },
        { wch: 20 },
        { wch: 15 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 15 },
      ];
      XLSX.utils.book_append_sheet(wb, employeeSummarySheet, "By Employee");
    }

    // Sheet 3: Daily Breakdown
    if (includeOptions.dailyBreakdown) {
      const detailData = buildDailyBreakdownSheet(exportData);
      const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
      detailSheet["!cols"] = [
        { wch: 25 },
        { wch: 12 },
        { wch: 12 },
        { wch: 15 },
        { wch: 12 },
        { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(wb, detailSheet, "Attendance Records");
    }

    // Sheet 4: Late Arrivals
    if (includeOptions.lateArrivals) {
      const lateData = buildLateArrivalsSheet(exportData);
      if (lateData.length > 1) {
        const lateSheet = XLSX.utils.aoa_to_sheet(lateData);
        lateSheet["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, lateSheet, "Late Arrivals");
      }
    }

    // Sheet 5: Leave Days
    if (includeOptions.leaveDays) {
      const leaveData = buildLeaveDaysSheet(exportData);
      if (leaveData.length > 1) {
        const leaveSheet = XLSX.utils.aoa_to_sheet(leaveData);
        leaveSheet["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, leaveSheet, "Leave Days");
      }
    }

    // Sheet 6: Warnings
    if (includeOptions.warnings) {
      const warningsData = buildWarningsSheet(exportData);
      if (warningsData.length > 1) {
        const warningsSheet = XLSX.utils.aoa_to_sheet(warningsData);
        warningsSheet["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, warningsSheet, "Warnings Issued");
      }
    }

    // Generate buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Generate filename
    const filename = generateFilename(exportData, employees);

    // Return the file
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export attendance data" },
      { status: 500 }
    );
  }
}

// Helper functions to build sheets

function buildSummarySheet(data: AttendanceExportData, includeOptions: ExportIncludeOptions): any[][] {
  const rows: any[][] = [
    ["Attendance Report"],
    [],
    ["Report Type", getReportTypeLabel(data.reportType)],
    ["Period", `${data.startDate} to ${data.endDate}`],
    ["Generated", data.generatedAt.split("T")[0]],
  ];

  if (data.departmentName) {
    rows.push(["Department", data.departmentName]);
  }

  rows.push([]);

  if (data.overallStats) {
    rows.push(["Overall Statistics"]);
    rows.push([]);
    rows.push(["Total Employees", data.overallStats.totalEmployees.toString()]);
    rows.push(["Total Days Recorded", data.overallStats.totalDaysRecorded.toString()]);
    rows.push(["Average Attendance Rate", `${data.overallStats.avgAttendanceRate}%`]);
  }

  // For individual reports, show detailed stats
  if (data.reportType === "individual" && data.employees.length > 0) {
    const emp = data.employees[0];
    rows.push([]);
    rows.push(["Employee Details"]);
    rows.push([]);
    rows.push(["Name", emp.employee.full_name]);
    rows.push(["Job Title", emp.employee.job_title || "N/A"]);
    rows.push(["Department", emp.employee.department_name || "N/A"]);
    rows.push([]);
    rows.push(["Total Days Recorded", emp.stats.totalDays.toString()]);
    rows.push(["Attendance Rate", `${emp.stats.attendanceRate}%`]);
    rows.push([]);
    rows.push(["Status Breakdown"]);
    Object.entries(emp.stats.statusCounts).forEach(([status, count]) => {
      const percentage = emp.stats.totalDays > 0
        ? Math.round((count / emp.stats.totalDays) * 100)
        : 0;
      rows.push([STATUS_LABELS[status] || status, `${count} (${percentage}%)`]);
    });
  }

  rows.push([]);
  rows.push(["Included Sections"]);
  rows.push(["Summary Statistics", includeOptions.summaryStats ? "Yes" : "No"]);
  rows.push(["Daily Breakdown", includeOptions.dailyBreakdown ? "Yes" : "No"]);
  rows.push(["Late Arrivals", includeOptions.lateArrivals ? "Yes" : "No"]);
  rows.push(["Leave Days", includeOptions.leaveDays ? "Yes" : "No"]);
  rows.push(["Warnings", includeOptions.warnings ? "Yes" : "No"]);

  return rows;
}

function buildEmployeeSummarySheet(data: AttendanceExportData): any[][] {
  const headers = [
    "Employee Name",
    "Department",
    "Job Title",
    "Total Days",
    "Present",
    "Late",
    "WFH",
    "On Leave",
    "Absent",
    "Attendance %",
  ];

  const rows: any[][] = [headers];

  data.employees.forEach((emp) => {
    rows.push([
      emp.employee.full_name,
      emp.employee.department_name || "N/A",
      emp.employee.job_title || "N/A",
      emp.stats.totalDays,
      emp.stats.statusCounts.present || 0,
      emp.stats.statusCounts.late || 0,
      emp.stats.statusCounts.wfh || 0,
      (emp.stats.statusCounts.on_leave || 0) + (emp.stats.statusCounts.sick_leave || 0),
      emp.stats.statusCounts.absent || 0,
      `${emp.stats.attendanceRate}%`,
    ]);
  });

  return rows;
}

function buildDailyBreakdownSheet(data: AttendanceExportData): any[][] {
  const headers = ["Employee Name", "Date", "Day", "Status", "Check-in Time", "Reason"];
  const rows: any[][] = [headers];

  data.employees.forEach((emp) => {
    emp.records.forEach((record) => {
      const date = new Date(record.date);
      const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
      rows.push([
        emp.employee.full_name,
        record.date,
        dayName,
        STATUS_LABELS[record.status] || record.status,
        record.check_in_time ? record.check_in_time.substring(0, 5) : "-",
        record.reason || "-",
      ]);
    });
  });

  return rows;
}

function buildLateArrivalsSheet(data: AttendanceExportData): any[][] {
  const headers = ["Employee Name", "Date", "Day", "Check-in Time"];
  const rows: any[][] = [headers];

  data.employees.forEach((emp) => {
    emp.records
      .filter((r) => r.status === "late")
      .forEach((record) => {
        const date = new Date(record.date);
        const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
        rows.push([
          emp.employee.full_name,
          record.date,
          dayName,
          record.check_in_time ? record.check_in_time.substring(0, 5) : "-",
        ]);
      });
  });

  return rows;
}

function buildLeaveDaysSheet(data: AttendanceExportData): any[][] {
  const headers = ["Employee Name", "Leave Type", "Start Date", "End Date", "Total Days"];
  const rows: any[][] = [headers];

  data.employees.forEach((emp) => {
    (emp.leaveRequests || []).forEach((leave) => {
      rows.push([
        emp.employee.full_name,
        leave.leave_type.charAt(0).toUpperCase() + leave.leave_type.slice(1),
        leave.start_date,
        leave.end_date,
        leave.total_days,
      ]);
    });
  });

  return rows;
}

function buildWarningsSheet(data: AttendanceExportData): any[][] {
  const headers = ["Employee Name", "Sent Date", "Issue Summary", "Message"];
  const rows: any[][] = [headers];

  data.employees.forEach((emp) => {
    (emp.warnings || []).forEach((warning) => {
      rows.push([
        emp.employee.full_name,
        warning.sent_at ? warning.sent_at.split("T")[0] : "-",
        warning.issue_summary,
        warning.message.substring(0, 100) + (warning.message.length > 100 ? "..." : ""),
      ]);
    });
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

function generateFilename(data: AttendanceExportData, employees: any[]): string {
  const dateStr = `${data.startDate}_to_${data.endDate}`;

  switch (data.reportType) {
    case "individual":
      const empName = employees[0]?.full_name?.replace(/\s+/g, "_") || "Employee";
      return `Attendance_${empName}_${dateStr}.xlsx`;
    case "department":
      const deptName = data.departmentName?.replace(/\s+/g, "_") || "Department";
      return `Attendance_${deptName}_${dateStr}.xlsx`;
    case "all":
    default:
      return `Attendance_All_Employees_${dateStr}.xlsx`;
  }
}
