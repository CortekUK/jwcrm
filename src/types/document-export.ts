export interface DocumentExportFilters {
  includeExpired: boolean; // false = active only, true = all (including archived)
  departmentIds: string[] | "all";
  employeeIds: string[] | "all";
}

export interface DocumentExportProgress {
  status:
    | "preparing"
    | "fetching"
    | "downloading"
    | "zipping"
    | "complete"
    | "error";
  currentStep: string;
  processedCount: number;
  totalCount: number;
  errorMessage?: string;
}

export interface ExportableDocument {
  id: string;
  employee_id: string;
  employee_name: string;
  department_name: string | null;
  document_type: string;
  document_path: string;
  document_name: string;
  document_mime: string | null;
  expiry_date: string | null;
  is_active: boolean;
  archived_at: string | null;
  uploaded_at: string | null;
}

export interface DocumentExportRequest {
  filters: DocumentExportFilters;
}

export interface DocumentExportManifestRow {
  employee_name: string;
  department: string;
  document_type: string;
  document_name: string;
  expiry_date: string;
  status: string;
  uploaded_at: string;
  file_path_in_zip: string;
}
