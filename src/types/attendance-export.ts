// Attendance Export Types

export type ExportReportType = "individual" | "all" | "department";

export interface ExportIncludeOptions {
  summaryStats: boolean;
  dailyBreakdown: boolean;
  lateArrivals: boolean;
  leaveDays: boolean;
  warnings: boolean;
}

export interface ExportRequest {
  reportType: ExportReportType;
  employeeId?: string;
  departmentId?: string;
  startDate: string;
  endDate: string;
  includeOptions: ExportIncludeOptions;
}

export interface EmployeeBasicInfo {
  id: string;
  full_name: string;
  job_title: string | null;
  department_name: string | null;
  email: string | null;
}

export interface AttendanceRecord {
  date: string;
  status: string;
  check_in_time: string | null;
  reason: string | null;
}

export interface WarningRecord {
  id: string;
  employee_id: string;
  issue_summary: string;
  message: string;
  sent_at: string | null;
}

export interface LeaveRecord {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string | null;
}

export interface EmployeeAttendanceData {
  employee: EmployeeBasicInfo;
  records: AttendanceRecord[];
  warnings?: WarningRecord[];
  leaveRequests?: LeaveRecord[];
  stats: {
    totalDays: number;
    attendanceRate: number;
    statusCounts: Record<string, number>;
  };
}

export interface AttendanceExportData {
  reportType: ExportReportType;
  startDate: string;
  endDate: string;
  generatedAt: string;
  departmentName?: string;
  employees: EmployeeAttendanceData[];
  overallStats?: {
    totalEmployees: number;
    avgAttendanceRate: number;
    totalDaysRecorded: number;
  };
}

export const STATUS_LABELS: Record<string, string> = {
  present: "Present",
  late: "Late",
  wfh: "Work From Home",
  on_leave: "On Leave",
  sick_leave: "Sick Leave",
  absent: "Absent",
};

export const DEFAULT_INCLUDE_OPTIONS: ExportIncludeOptions = {
  summaryStats: true,
  dailyBreakdown: true,
  lateArrivals: true,
  leaveDays: true,
  warnings: false,
};
