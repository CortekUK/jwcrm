// Employee Export Types

export interface EmployeeExportFilters {
  departmentIds: string[] | "all";
  statuses: string[] | "all";
  includeSalary: boolean;
  format: "xlsx" | "csv";
}

export interface ExportableEmployee {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  job_title: string | null;
  job_role_name: string | null;
  department_name: string | null;
  manager_name: string | null;
  start_date: string;
  employment_status: string;
  salary: number | null;
}

export interface EmployeeExportData {
  generatedAt: string;
  filters: {
    departments: string;
    statuses: string;
  };
  employees: ExportableEmployee[];
  stats: {
    totalEmployees: number;
    byStatus: Record<string, number>;
    byDepartment: Record<string, number>;
  };
}

export const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  on_leave: "On Leave",
  terminated: "Terminated",
};
