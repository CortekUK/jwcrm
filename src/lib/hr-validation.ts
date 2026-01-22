import { z } from "zod";

// Employee form schema
export const employeeSchema = z.object({
  // Personal Info
  full_name: z.string().trim().min(2, "nameTooShort").nonempty("nameRequired"),
  email: z.string().trim().email("emailInvalid").optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  date_of_birth: z.string().optional().or(z.literal("")),

  // Job Info
  job_role_id: z.string().uuid("jobRoleRequired").optional().or(z.literal("")),
  department_id: z.string().uuid("departmentRequired").optional().or(z.literal("")),
  start_date: z.string().nonempty("startDateRequired"),
  salary: z.string().optional().or(z.literal("")),

  // Employment Status
  employment_status: z.enum(["active", "inactive", "on_leave", "terminated"]).default("active"),
});

// Employee edit schema (same as create but with id)
export const employeeEditSchema = employeeSchema.extend({
  id: z.string().uuid(),
});

// Deactivate employee schema
export const deactivateEmployeeSchema = z.object({
  termination_reason: z.enum(["resignation", "termination", "end_of_contract", "other"]),
  last_working_day: z.string().nonempty("lastWorkingDayRequired"),
  notes: z.string().optional(),
});

// Department schema
export const departmentSchema = z.object({
  name: z.string().trim().min(2, "departmentNameTooShort").nonempty("departmentNameRequired"),
});

// Document upload schema
export const documentUploadSchema = z.object({
  document_type: z.enum(["passport", "employment_visa", "emirates_id", "employment_contract"]),
  expiry_date: z.string().optional().or(z.literal("")),
});

// Types
export type EmployeeFormData = z.infer<typeof employeeSchema>;
export type EmployeeEditFormData = z.infer<typeof employeeEditSchema>;
export type DeactivateEmployeeFormData = z.infer<typeof deactivateEmployeeSchema>;
export type DepartmentFormData = z.infer<typeof departmentSchema>;
export type DocumentUploadFormData = z.infer<typeof documentUploadSchema>;

// Employee status options for dropdown
export const employmentStatusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "on_leave", label: "On Leave" },
  { value: "terminated", label: "Terminated" },
] as const;

// Termination reason options for dropdown
export const terminationReasonOptions = [
  { value: "resignation", label: "Resignation" },
  { value: "termination", label: "Termination" },
  { value: "end_of_contract", label: "End of Contract" },
  { value: "other", label: "Other" },
] as const;

// Document type options for dropdown
export const documentTypeOptions = [
  { value: "passport", label: "Passport" },
  { value: "employment_visa", label: "Employment Visa" },
  { value: "emirates_id", label: "Emirates ID" },
  { value: "employment_contract", label: "Employment Contract" },
] as const;
