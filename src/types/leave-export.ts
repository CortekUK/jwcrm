// Leave Export Types

export type LeaveExportReportType = "all" | "department" | "individual";

export interface LeaveExportFilters {
  reportType: LeaveExportReportType;
  startDate: string;
  endDate: string;
  employeeId?: string;
  departmentId?: string;
  leaveTypes: string[] | "all";
  statuses: string[] | "all";
}

export interface LeaveExportRequest {
  employee_id: string;
  employee_name: string;
  department_name: string | null;
  job_title: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: string;
  created_at: string;
  approved_by_name: string | null;
  approved_at: string | null;
  denial_reason: string | null;
}

export interface EmployeeLeaveStats {
  employee_id: string;
  employee_name: string;
  department_name: string | null;
  total_requests: number;
  approved_requests: number;
  denied_requests: number;
  pending_requests: number;
  total_days_approved: number;
  by_type: Record<string, number>;
}

export interface LeaveExportData {
  reportType: LeaveExportReportType;
  startDate: string;
  endDate: string;
  generatedAt: string;
  departmentName?: string;
  requests: LeaveExportRequest[];
  employeeStats: EmployeeLeaveStats[];
  overallStats: {
    totalRequests: number;
    totalApproved: number;
    totalDenied: number;
    totalPending: number;
    totalDaysApproved: number;
    byType: Record<string, number>;
  };
}

export const LEAVE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
};
