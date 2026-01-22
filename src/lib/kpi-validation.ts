import { z } from "zod";

// Job Role schema
export const jobRoleSchema = z.object({
  name: z.string().trim().min(2, "nameTooShort").nonempty("nameRequired"),
  department_id: z.string().uuid("departmentRequired").optional().or(z.literal("")),
});

// Job Role edit schema
export const jobRoleEditSchema = jobRoleSchema.extend({
  id: z.string().uuid(),
});

// KPI schema
export const kpiSchema = z.object({
  job_role_id: z.string().uuid("jobRoleRequired"),
  name: z.string().trim().min(2, "nameTooShort").nonempty("nameRequired"),
  description: z.string().trim().optional().or(z.literal("")),
  target_value: z.string().min(1, "targetValueRequired"),
  unit: z.string().trim().min(1, "unitRequired"),
  weighting: z.string().min(1, "weightingRequired"),
});

// KPI edit schema
export const kpiEditSchema = kpiSchema.extend({
  id: z.string().uuid(),
});

// KPI Evaluation schema (for marking scores)
export const kpiEvaluationSchema = z.object({
  employee_id: z.string().uuid(),
  kpi_id: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  achieved_value: z.string().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

// Bulk evaluation schema (for evaluating multiple KPIs at once)
export const bulkKpiEvaluationSchema = z.object({
  employee_id: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  evaluations: z.array(z.object({
    kpi_id: z.string().uuid(),
    achieved_value: z.string().optional().or(z.literal("")),
    notes: z.string().trim().optional().or(z.literal("")),
  })),
});

// Types
export type JobRoleFormData = z.infer<typeof jobRoleSchema>;
export type JobRoleEditFormData = z.infer<typeof jobRoleEditSchema>;
export type KPIFormData = z.infer<typeof kpiSchema>;
export type KPIEditFormData = z.infer<typeof kpiEditSchema>;
export type KPIEvaluationFormData = z.infer<typeof kpiEvaluationSchema>;
export type BulkKPIEvaluationFormData = z.infer<typeof bulkKpiEvaluationSchema>;

// Unit suggestions for KPI input
export const kpiUnitSuggestions = [
  { value: "marks", label: "Marks" },
  { value: "%", label: "Percentage (%)" },
  { value: "count", label: "Count" },
  { value: "£", label: "GBP (£)" },
  { value: "$", label: "USD ($)" },
  { value: "AED", label: "AED" },
  { value: "/5", label: "Rating (/5)" },
  { value: "/10", label: "Rating (/10)" },
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
] as const;

// Month options
export const monthOptions = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
] as const;

// Evaluation status options
export const evaluationStatusOptions = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
] as const;

// Helper to calculate score
export function calculateScore(achievedValue: number, targetValue: number): number {
  if (targetValue <= 0) return 0;
  return Math.round((achievedValue / targetValue) * 100 * 100) / 100; // Round to 2 decimal places
}

// Helper to get current year options (current year + 2 previous years)
export function getYearOptions(): { value: number; label: string }[] {
  const currentYear = new Date().getFullYear();
  return [
    { value: currentYear, label: String(currentYear) },
    { value: currentYear - 1, label: String(currentYear - 1) },
    { value: currentYear - 2, label: String(currentYear - 2) },
  ];
}

// Helper to get current month (1-12)
export function getCurrentMonth(): number {
  return new Date().getMonth() + 1;
}

// Helper to get current year
export function getCurrentYear(): number {
  return new Date().getFullYear();
}
