# Changelog - January 24-27, 2026

This document summarizes all changes made to the JWCRM project between January 24-27, 2026.

---

## Commits on January 27, 2026

### 1. feat: add HR email logs, KPI department export, and lead management enhancements
**Commit:** `05ec807`
**Author:** Neema
**Date:** Tue Jan 27 18:08:21 2026

#### Description
- Add email logs page and table component for HR settings
- Add KPI department summary PDF export with dialog
- Enhance lead management page with salesperson stats
- Update salesperson dashboard with improved layout
- Add locale translations for salesperson features

#### Files Changed
| Status | File |
|--------|------|
| Modified | `src/app/(admin)/admin/salesperson/page.tsx` |
| Modified | `src/app/(hr)/hr/kpis/page.tsx` |
| Added | `src/app/(hr)/hr/settings/email-logs/page.tsx` |
| Modified | `src/app/(lead-management)/lead-management/page.tsx` |
| Added | `src/app/api/hr/kpis/department-summary/export/route.ts` |
| Modified | `src/components/RoleSwitcher.tsx` |
| Added | `src/components/hr/kpis/DepartmentSummaryPDFTemplate.tsx` |
| Added | `src/components/hr/kpis/ExportDepartmentSummaryDialog.tsx` |
| Modified | `src/components/hr/kpis/index.ts` |
| Added | `src/components/hr/settings/EmailLogsTable.tsx` |
| Modified | `src/components/hr/settings/NotificationSettings.tsx` |
| Modified | `src/components/lead-management/SalespersonStatsCard.tsx` |
| Modified | `src/config/dashboards.ts` |
| Modified | `src/locales/ar/salesperson.json` |
| Modified | `src/locales/en/salesperson.json` |

---

### 2. refactor: replace dollar signs and £ symbols with AED currency
**Commit:** `80e61b5`
**Author:** Neema
**Date:** Tue Jan 27 15:41:45 2026

#### Description
- Replace DollarSign icon with Coins icon across lead management pages
- Replace all £ currency symbols with AED prefix
- Affects reports, analytics, lead details, pipeline board, and will forms
- Ensures consistent AED currency representation throughout the system

#### Files Changed
| Status | File |
|--------|------|
| Modified | `src/app/(admin)/admin/lead-management/leads/[leadId]/page.tsx` |
| Modified | `src/app/(admin)/admin/lead-management/reports/page.tsx` |
| Modified | `src/app/(admin)/admin/salesperson/leads/[leadId]/page.tsx` |
| Modified | `src/app/(admin)/admin/salesperson/reports/page.tsx` |
| Modified | `src/app/(admin)/admin/salesperson/settings/page.tsx` |
| Modified | `src/app/(admin)/admin/wills/[id]/page.tsx` |
| Modified | `src/app/(lead-management)/lead-management/analytics/page.tsx` |
| Modified | `src/components/admin/WillDocumentPreview.tsx` |
| Modified | `src/components/lead-management/LeadActivityFeed.tsx` |
| Modified | `src/components/lead-management/LeadPipelineBoard.tsx` |
| Modified | `src/components/lead-management/NotificationCenter.tsx` |
| Modified | `src/components/lead-management/SalespersonStatsCard.tsx` |
| Modified | `src/components/will-form/StepReview.tsx` |

---

### 3. fix: resolve runtime error in reports pages
**Commit:** `421ba3f`
**Author:** Neema
**Date:** Tue Jan 27 15:21:05 2026

#### Description
Replace ChartTooltip/ChartTooltipContent (which requires ChartContainer context) with standard recharts Tooltip component to fix "useChart must be used within a <ChartContainer />" error.

#### Files Changed
| Status | File |
|--------|------|
| Modified | `src/app/(admin)/admin/lead-management/reports/page.tsx` |
| Modified | `src/app/(admin)/admin/salesperson/reports/page.tsx` |

---

### 4. fix: center leads by status pie chart in reports pages
**Commit:** `512cf2d`
**Author:** Neema
**Date:** Tue Jan 27 15:17:31 2026

#### Description
- Wrap PieChart with ResponsiveContainer for proper centering
- Add flex container with items-center and justify-center
- Apply fix to both lead-management and salesperson reports pages

#### Files Changed
| Status | File |
|--------|------|
| Modified | `src/app/(admin)/admin/lead-management/reports/page.tsx` |
| Modified | `src/app/(admin)/admin/salesperson/reports/page.tsx` |

---

### 5. feat: add new features and fix build error
**Commit:** `ad7592e`
**Author:** Neema
**Date:** Tue Jan 27 15:08:24 2026
**Files Changed:** 198 (87 Added, 105 Modified, 6 Deleted)

#### Description
- Fix build error: replace non-existent Funnel icon with Filter from lucide-react
- Add sales analytics charts, lead management features, and HR reviews
- Add finance and lead management reports
- Add export functionality for employees, transactions, invoices, and leads
- Add KPI analytics and evaluation components
- Add leave approval workflow and escalation features
- Add document threshold alerts
- Update localization files for Arabic and English
- Add multiple new API routes and Supabase migrations

#### Files Changed (All 198 Files)

##### Deleted Files (6 files)
| Status | File |
|--------|------|
| Deleted | `app/globals.css` |
| Deleted | `app/layout.tsx` |
| Deleted | `app/page.tsx` |
| Deleted | `components/theme-provider.tsx` |
| Deleted | `lib/utils.ts` |
| Deleted | `styles/globals.css` |

##### Root Files (4 files)
| Status | File |
|--------|------|
| Added | `insert-demo-kpi-evaluations.sql` |
| Added | `insert-demo-monthly-reviews.sql` |
| Added | `insert-demo-quarterly-reviews.sql` |
| Added | `package-lock.json` |

##### Admin Pages - Added (13 files)
| Status | File |
|--------|------|
| Added | `src/app/(admin)/admin/finance/reports/page.tsx` |
| Added | `src/app/(admin)/admin/hr/reports/page.tsx` |
| Added | `src/app/(admin)/admin/hr/reviews/[id]/edit/page.tsx` |
| Added | `src/app/(admin)/admin/hr/reviews/[id]/page.tsx` |
| Added | `src/app/(admin)/admin/hr/reviews/compliance/page.tsx` |
| Added | `src/app/(admin)/admin/hr/reviews/monthly/[id]/edit/page.tsx` |
| Added | `src/app/(admin)/admin/hr/reviews/monthly/[id]/page.tsx` |
| Added | `src/app/(admin)/admin/hr/reviews/monthly/new/page.tsx` |
| Added | `src/app/(admin)/admin/hr/reviews/monthly/page.tsx` |
| Added | `src/app/(admin)/admin/hr/reviews/new/page.tsx` |
| Added | `src/app/(admin)/admin/hr/reviews/page.tsx` |
| Added | `src/app/(admin)/admin/lead-management/reports/page.tsx` |
| Added | `src/app/(admin)/admin/salesperson/reports/page.tsx` |

##### Admin Pages - Modified (10 files)
| Status | File |
|--------|------|
| Modified | `src/app/(admin)/admin/hr/employees/new/page.tsx` |
| Modified | `src/app/(admin)/admin/hr/employees/page.tsx` |
| Modified | `src/app/(admin)/admin/lead-management/leads/[leadId]/page.tsx` |
| Modified | `src/app/(admin)/admin/lead-management/salesperson/[salespersonId]/page.tsx` |
| Modified | `src/app/(admin)/admin/lead-management/sources/page.tsx` |
| Modified | `src/app/(admin)/admin/salesperson/calendar/page.tsx` |
| Modified | `src/app/(admin)/admin/salesperson/leads/[leadId]/page.tsx` |
| Modified | `src/app/(admin)/admin/salesperson/leads/page.tsx` |
| Modified | `src/app/(admin)/admin/salesperson/page.tsx` |
| Modified | `src/app/(admin)/admin/salesperson/settings/page.tsx` |

##### Finance Pages (3 files)
| Status | File |
|--------|------|
| Added | `src/app/(finance)/finance/reports/page.tsx` |
| Modified | `src/app/(finance)/finance/page.tsx` |
| Modified | `src/app/(finance)/finance/settings/page.tsx` |

##### HR Pages - Added (10 files)
| Status | File |
|--------|------|
| Added | `src/app/(hr)/hr/reports/page.tsx` |
| Added | `src/app/(hr)/hr/reviews/[id]/edit/page.tsx` |
| Added | `src/app/(hr)/hr/reviews/[id]/page.tsx` |
| Added | `src/app/(hr)/hr/reviews/compliance/page.tsx` |
| Added | `src/app/(hr)/hr/reviews/monthly/[id]/edit/page.tsx` |
| Added | `src/app/(hr)/hr/reviews/monthly/[id]/page.tsx` |
| Added | `src/app/(hr)/hr/reviews/monthly/new/page.tsx` |
| Added | `src/app/(hr)/hr/reviews/monthly/page.tsx` |
| Added | `src/app/(hr)/hr/reviews/new/page.tsx` |
| Added | `src/app/(hr)/hr/reviews/page.tsx` |

##### HR Pages - Modified (21 files)
| Status | File |
|--------|------|
| Modified | `src/app/(hr)/hr/attendance/employee/[id]/page.tsx` |
| Modified | `src/app/(hr)/hr/attendance/page.tsx` |
| Modified | `src/app/(hr)/hr/departments/page.tsx` |
| Modified | `src/app/(hr)/hr/documents/page.tsx` |
| Modified | `src/app/(hr)/hr/employees/[id]/edit/page.tsx` |
| Modified | `src/app/(hr)/hr/employees/[id]/page.tsx` |
| Modified | `src/app/(hr)/hr/employees/new/page.tsx` |
| Modified | `src/app/(hr)/hr/employees/page.tsx` |
| Modified | `src/app/(hr)/hr/job-roles/[id]/edit/page.tsx` |
| Modified | `src/app/(hr)/hr/job-roles/new/page.tsx` |
| Modified | `src/app/(hr)/hr/job-roles/page.tsx` |
| Modified | `src/app/(hr)/hr/kpis/[id]/edit/page.tsx` |
| Modified | `src/app/(hr)/hr/kpis/evaluations/[employeeId]/page.tsx` |
| Modified | `src/app/(hr)/hr/kpis/new/page.tsx` |
| Modified | `src/app/(hr)/hr/kpis/page.tsx` |
| Modified | `src/app/(hr)/hr/leave/balances/page.tsx` |
| Modified | `src/app/(hr)/hr/leave/calendar/page.tsx` |
| Modified | `src/app/(hr)/hr/leave/history/[employeeId]/page.tsx` |
| Modified | `src/app/(hr)/hr/leave/page.tsx` |
| Modified | `src/app/(hr)/hr/page.tsx` |
| Modified | `src/app/(hr)/hr/settings/page.tsx` |

##### Lead Management Pages (3 files)
| Status | File |
|--------|------|
| Added | `src/app/(lead-management)/lead-management/analytics/page.tsx` |
| Modified | `src/app/(lead-management)/lead-management/leads/page.tsx` |
| Modified | `src/app/(lead-management)/lead-management/settings/page.tsx` |

##### API Routes - Added (6 files)
| Status | File |
|--------|------|
| Added | `src/app/api/hr/employees/export/route.ts` |
| Added | `src/app/api/hr/leave/export/route.ts` |
| Added | `src/app/api/hr/trigger-kpi-reminder/route.ts` |
| Added | `src/app/api/hr/trigger-leave-escalation/route.ts` |
| Added | `src/app/api/hr/trigger-threshold-alert/route.ts` |
| Added | `src/app/api/lead-management/leads/[id]/route.ts` |

##### API Routes - Modified (6 files)
| Status | File |
|--------|------|
| Modified | `src/app/api/finance/transactions/route.ts` |
| Modified | `src/app/api/hr/documents/export/route.ts` |
| Modified | `src/app/api/lead-management/leads/[id]/communications/route.ts` |
| Modified | `src/app/api/lead-management/salesperson/[id]/leads/route.ts` |
| Modified | `src/app/api/lead-management/send-proposal/route.ts` |
| Modified | `src/app/api/stripe/create-checkout-session/route.ts` |

##### Core App Files (3 files)
| Status | File |
|--------|------|
| Modified | `src/app/layout.tsx` |
| Modified | `src/app/login/page.tsx` |
| Modified | `src/app/providers.tsx` |

##### Shared Components (4 files)
| Status | File |
|--------|------|
| Modified | `src/components/LanguageSwitcher.tsx` |
| Modified | `src/components/RoleSwitcher.tsx` |
| Modified | `src/components/auth/ChangePasswordForm.tsx` |
| Modified | `src/components/dashboard/DashboardHome.tsx` |

##### Finance Components (7 files)
| Status | File |
|--------|------|
| Added | `src/components/finance/InvoiceExportButton.tsx` |
| Added | `src/components/finance/TransactionExportButton.tsx` |
| Modified | `src/components/finance/AddTransactionDialog.tsx` |
| Modified | `src/components/finance/FinanceCharts.tsx` |
| Modified | `src/components/finance/FinanceStatsCards.tsx` |
| Modified | `src/components/finance/InvoiceTable.tsx` |
| Modified | `src/components/finance/TransactionTable.tsx` |

##### HR Components - Added (18 files)
| Status | File |
|--------|------|
| Added | `src/components/hr/ExportEmployeesButton.tsx` |
| Added | `src/components/hr/attendance/AttendanceAlertsCard.tsx` |
| Added | `src/components/hr/kpis/EmployeeKPIHistory.tsx` |
| Added | `src/components/hr/kpis/KPIAnalyticsCharts.tsx` |
| Added | `src/components/hr/kpis/KPIExportButton.tsx` |
| Added | `src/components/hr/kpis/KPIOverviewCard.tsx` |
| Added | `src/components/hr/leave/ExportLeaveModal.tsx` |
| Added | `src/components/hr/leave/PendingApprovalsWidget.tsx` |
| Added | `src/components/hr/reviews/ComplianceDashboard.tsx` |
| Added | `src/components/hr/reviews/MonthlyReviewForm.tsx` |
| Added | `src/components/hr/reviews/MonthlyReviewList.tsx` |
| Added | `src/components/hr/reviews/QuarterlyReviewForm.tsx` |
| Added | `src/components/hr/reviews/QuarterlyReviewList.tsx` |
| Added | `src/components/hr/reviews/QuarterlyReviewPDFTemplate.tsx` |
| Added | `src/components/hr/reviews/ReviewAlertCard.tsx` |
| Added | `src/components/hr/reviews/ReviewTemplateManager.tsx` |
| Added | `src/components/hr/reviews/index.ts` |
| Added | `src/components/hr/settings/LeaveApprovalSettings.tsx` |

##### HR Components - Modified (15 files)
| Status | File |
|--------|------|
| Modified | `src/components/hr/AddEmployeeForm.tsx` |
| Modified | `src/components/hr/EmployeeProfile.tsx` |
| Modified | `src/components/hr/EmployeeTable.tsx` |
| Modified | `src/components/hr/ExpiryAlertCard.tsx` |
| Modified | `src/components/hr/attendance/AttendanceCalendar.tsx` |
| Modified | `src/components/hr/index.ts` |
| Modified | `src/components/hr/kpis/AddKPIForm.tsx` |
| Modified | `src/components/hr/kpis/DepartmentKPISummary.tsx` |
| Modified | `src/components/hr/kpis/JobRoleTable.tsx` |
| Modified | `src/components/hr/kpis/KPIEvaluationAlertCard.tsx` |
| Modified | `src/components/hr/kpis/KPIEvaluationTable.tsx` |
| Modified | `src/components/hr/kpis/KPITable.tsx` |
| Modified | `src/components/hr/kpis/index.ts` |
| Modified | `src/components/hr/leave/index.ts` |
| Modified | `src/components/hr/settings/NotificationSettings.tsx` |

##### Layout Components (4 files)
| Status | File |
|--------|------|
| Added | `src/components/layouts/UserProfileMenu.tsx` |
| Modified | `src/components/layouts/HRPortalLayout.tsx` |
| Modified | `src/components/layouts/PortalLayout.tsx` |
| Modified | `src/components/layouts/UnifiedDashboardLayout.tsx` |

##### Lead Management Components - Added (11 files)
| Status | File |
|--------|------|
| Added | `src/components/lead-management/ExportLeadsDialog.tsx` |
| Added | `src/components/lead-management/ImportLeadsDialog.tsx` |
| Added | `src/components/lead-management/LeadActivityFeed.tsx` |
| Added | `src/components/lead-management/LeadDocuments.tsx` |
| Added | `src/components/lead-management/LeadExportButton.tsx` |
| Added | `src/components/lead-management/LeadHealthIndicator.tsx` |
| Added | `src/components/lead-management/LeadPipelineBoard.tsx` |
| Added | `src/components/lead-management/NotificationCenter.tsx` |
| Added | `src/components/lead-management/QuickActionsButton.tsx` |
| Added | `src/components/lead-management/QuickProposalDialog.tsx` |
| Added | `src/components/lead-management/SalesAnalyticsCharts.tsx` |

##### Lead Management Components - Modified (12 files)
| Status | File |
|--------|------|
| Modified | `src/components/lead-management/AddCommunicationDialog.tsx` |
| Modified | `src/components/lead-management/CreateLeadDialog.tsx` |
| Modified | `src/components/lead-management/EditLeadDialog.tsx` |
| Modified | `src/components/lead-management/LeadHistoryTimeline.tsx` |
| Modified | `src/components/lead-management/LeadStatusBadge.tsx` |
| Modified | `src/components/lead-management/LeadTable.tsx` |
| Modified | `src/components/lead-management/SalespersonStatsCard.tsx` |
| Modified | `src/components/lead-management/SendProposalDialog.tsx` |
| Modified | `src/components/lead-management/reminders/AddReminderDialog.tsx` |
| Modified | `src/components/lead-management/sources/CreateSourceDialog.tsx` |
| Modified | `src/components/lead-management/sources/EditSourceDialog.tsx` |
| Modified | `src/components/lead-management/sources/SourcesTable.tsx` |

##### Salesperson Components (3 files)
| Status | File |
|--------|------|
| Modified | `src/components/salesperson/CalendarDayDetailModal.tsx` |
| Modified | `src/components/salesperson/SalespersonLeadTable.tsx` |
| Modified | `src/components/salesperson/SendMeetingInviteDialog.tsx` |

##### Config Files (1 file)
| Status | File |
|--------|------|
| Modified | `src/config/dashboards.ts` |

##### Context Files (1 file)
| Status | File |
|--------|------|
| Added | `src/contexts/SidebarContext.tsx` |

##### Integration Files (1 file)
| Status | File |
|--------|------|
| Modified | `src/integrations/supabase/types.ts` |

##### Lib Files (6 files)
| Status | File |
|--------|------|
| Added | `src/lib/hr/aggregateMonthlyReviews.ts` |
| Added | `src/lib/hr/generateReviewSummary.ts` |
| Added | `src/lib/proposal-template.ts` |
| Modified | `src/lib/ai-document-extraction.ts` |
| Modified | `src/lib/format-utils.ts` |
| Modified | `src/lib/hr-validation.ts` |

##### Localization Files (10 files)
| Status | File |
|--------|------|
| Modified | `src/locales/ar/common.json` |
| Modified | `src/locales/ar/finance.json` |
| Modified | `src/locales/ar/hr.json` |
| Modified | `src/locales/ar/leadManagement.json` |
| Modified | `src/locales/ar/salesperson.json` |
| Modified | `src/locales/en/common.json` |
| Modified | `src/locales/en/finance.json` |
| Modified | `src/locales/en/hr.json` |
| Modified | `src/locales/en/leadManagement.json` |
| Modified | `src/locales/en/salesperson.json` |

##### Styles (1 file)
| Status | File |
|--------|------|
| Modified | `src/styles/globals.css` |

##### Type Files (3 files)
| Status | File |
|--------|------|
| Added | `src/types/employee-export.ts` |
| Added | `src/types/leave-export.ts` |
| Modified | `src/types/finance.ts` |

##### Supabase Edge Functions (3 files)
| Status | File |
|--------|------|
| Added | `supabase/functions/process-leave-escalations/index.ts` |
| Added | `supabase/functions/send-document-threshold-alerts/index.ts` |
| Modified | `supabase/functions/send-document-expiry-digest/index.ts` |

##### Supabase Migrations (11 files)
| Status | File |
|--------|------|
| Added | `supabase/migrations/20260126000001_create_lead_management_tables.sql` |
| Added | `supabase/migrations/20260127000001_add_certification_document_type.sql` |
| Added | `supabase/migrations/20260127000001_create_quarterly_reviews.sql` |
| Added | `supabase/migrations/20260127000002_add_document_threshold_alerts.sql` |
| Added | `supabase/migrations/20260127000003_setup_threshold_alerts_cron.sql` |
| Added | `supabase/migrations/20260128000001_create_leave_approval_workflow.sql` |
| Added | `supabase/migrations/20260128000002_setup_leave_escalation_cron.sql` |
| Added | `supabase/migrations/20260128000003_fix_currency_defaults_to_aed.sql` |
| Added | `supabase/migrations/20260129000001_add_consultation_outcome_fields.sql` |
| Added | `supabase/migrations/20260129000001_auto_call_reminders.sql` |
| Added | `supabase/migrations/20260129000002_create_monthly_reviews.sql` |

---

## Commits on January 24, 2026

### 6. feat: polish Add New Employee page with hero banner and section cards
**Commit:** `1e2c942`
**Author:** v0 (CortekUK)
**Date:** Sat Jan 24 16:56:04 2026

#### Description
- Add hero banner to Add New Employee page
- Update back button styling
- Style form sections with cards
- Improve spacing throughout the form
- Update translations for Arabic and English

#### Files Changed
| Status | File |
|--------|------|
| Modified | `src/app/(admin)/admin/hr/employees/new/page.tsx` |
| Modified | `src/app/(hr)/hr/employees/new/page.tsx` |
| Modified | `src/components/hr/AddEmployeeForm.tsx` |
| Modified | `src/locales/ar/hr.json` |
| Modified | `src/locales/en/hr.json` |

---

### 7. style: match employee banner to dashboard styling
**Commit:** `c78cb4e`
**Author:** v0 (CortekUK)
**Date:** Sat Jan 24 16:39:42 2026

#### Description
- Update employee banner to match dashboard gradient
- Match border, icon, title, and description styling
- Consistent design across employee pages

#### Files Changed
| Status | File |
|--------|------|
| Modified | `src/app/(admin)/admin/hr/employees/page.tsx` |
| Modified | `src/app/(hr)/hr/employees/page.tsx` |
| Modified | `src/components/hr/EmployeeTable.tsx` |
| Modified | `src/locales/ar/hr.json` |
| Modified | `src/locales/en/hr.json` |

---

### 8. fix: resolve translation and styling issues on Employees page
**Commit:** `11e5388`
**Author:** v0 (CortekUK)
**Date:** Sat Jan 24 15:38:47 2026
**Files Changed:** 63 (+1007 / -11504 lines)

#### Description
- Remove debug log statements
- Fix translation key conflict
- Rename header key for consistency
- Update EmployeeTable component
- Add Arabic translation for status column

#### Files Changed (All 63 Files)

##### Documentation (6 files)
| Status | File |
|--------|------|
| Modified | `AI_EMIRATES_ID_EXTRACTION_SETUP.md` |
| Modified | `README copy.md` |
| Modified | `README.md` |
| Modified | `README_ADMIN.md` |
| Modified | `RESET_DATABASE_INSTRUCTIONS.md` |
| Modified | `WATERMARK_GUIDE.md` |

##### Root App Files (5 files)
| Status | File |
|--------|------|
| Added | `app/globals.css` |
| Added | `app/layout.tsx` |
| Added | `app/page.tsx` |
| Added | `components/theme-provider.tsx` |
| Added | `lib/utils.ts` |

##### Documentation (1 file)
| Status | File |
|--------|------|
| Modified | `docs/lead-management-salesperson-implementation.md` |

##### Package Files (2 files)
| Status | File |
|--------|------|
| Deleted | `package-lock.json` |
| Modified | `package.json` |

##### Public Assets (9 files)
| Status | File |
|--------|------|
| Added | `public/apple-icon.png` |
| Added | `public/icon-dark-32x32.png` |
| Added | `public/icon-light-32x32.png` |
| Added | `public/icon.svg` |
| Added | `public/placeholder-logo.png` |
| Added | `public/placeholder-logo.svg` |
| Added | `public/placeholder-user.jpg` |
| Added | `public/placeholder.jpg` |
| Added | `public/placeholder.svg` |

##### Admin Pages (2 files)
| Status | File |
|--------|------|
| Modified | `src/app/(admin)/admin/manage-users/page.tsx` |
| Modified | `src/app/(admin)/admin/page.tsx` |

##### HR Pages (2 files)
| Status | File |
|--------|------|
| Modified | `src/app/(hr)/hr/employees/page.tsx` |
| Modified | `src/app/(hr)/hr/page.tsx` |

##### Components (12 files)
| Status | File |
|--------|------|
| Modified | `src/components/admin/CreateClientModal.tsx` |
| Modified | `src/components/hr/EmployeeTable.tsx` |
| Modified | `src/components/hr/ExpiryAlertCard.tsx` |
| Modified | `src/components/hr/attendance/AttendanceSummaryCard.tsx` |
| Modified | `src/components/hr/kpis/KPIEvaluationAlertCard.tsx` |
| Modified | `src/components/hr/leave-analytics/LeaveAnalyticsWidget.tsx` |
| Modified | `src/components/hr/leave/LeaveSummaryWidget.tsx` |
| Modified | `src/components/layouts/UnifiedDashboardLayout.tsx` |
| Modified | `src/components/ui/SignaturePad.tsx` |
| Modified | `src/components/will-form/BeneficiaryDocUpload.tsx` |
| Modified | `src/components/will-form/DocumentUploadSection.tsx` |
| Modified | `src/components/will-form/PassportUploadSection.tsx` |

##### Lib Files (1 file)
| Status | File |
|--------|------|
| Modified | `src/lib/validation-messages.ts` |

##### Localization Files (6 files)
| Status | File |
|--------|------|
| Modified | `src/locales/ar/admin.json` |
| Modified | `src/locales/ar/common.json` |
| Modified | `src/locales/ar/hr.json` |
| Modified | `src/locales/en/admin.json` |
| Modified | `src/locales/en/common.json` |
| Modified | `src/locales/en/hr.json` |

##### Styles (1 file)
| Status | File |
|--------|------|
| Added | `styles/globals.css` |

##### Supabase Files (4 files)
| Status | File |
|--------|------|
| Modified | `supabase/.temp/cli-latest` |
| Modified | `supabase/functions/extract-passport-number/README.md` |
| Modified | `supabase/functions/notify-executors/index.ts` |
| Modified | `supabase/functions/send-edit-request-email/index.ts` |

##### Supabase Migrations (12 files)
| Status | File |
|--------|------|
| Modified | `supabase/migrations/20251002211420_e4c18a57-5f41-45e2-991f-892b9717c60c.sql` |
| Modified | `supabase/migrations/20251002211439_368688f5-213c-4f71-9843-802cc5975df5.sql` |
| Modified | `supabase/migrations/20251002212458_c47d01d2-c6a5-4bed-8dd8-117de618f0a7.sql` |
| Modified | `supabase/migrations/20251002213115_2b6e6c84-79a3-4de1-b740-0834064a0c16.sql` |
| Modified | `supabase/migrations/20251002213926_425ae423-1707-412e-a104-6436ec7790c8.sql` |
| Modified | `supabase/migrations/20251002214429_5908bd8c-e4eb-461c-b25d-4242abc4ed0b.sql` |
| Modified | `supabase/migrations/20251002215429_e184a797-b492-4f00-9a9b-a1d2caabba4c.sql` |
| Modified | `supabase/migrations/20251003183028_05556551-6628-44e2-a45c-b58a8b329919.sql` |
| Modified | `supabase/migrations/20251007092550_5b96b4a5-f162-46eb-bc25-0e8ad7ebfd29.sql` |
| Modified | `supabase/migrations/20251007092723_6eef3bad-2cf3-4355-a502-7e44b24a2abe.sql` |
| Modified | `supabase/migrations/20251009122010_3d96026c-9a4b-4e54-bcb8-a6b883c3b35b.sql` |

##### SQL Files (1 file)
| Status | File |
|--------|------|
| Modified | `supabase_schema_update_poa.sql` |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total Commits | 8 |
| Features Added | 3 |
| Bug Fixes | 3 |
| Refactors | 1 |
| Style Updates | 1 |

### Files Changed Per Commit
| Commit | Files Changed |
|--------|---------------|
| `05ec807` | 15 files |
| `80e61b5` | 13 files |
| `421ba3f` | 2 files |
| `512cf2d` | 2 files |
| `ad7592e` | **198 files** (87 Added, 105 Modified, 6 Deleted) |
| `1e2c942` | 5 files |
| `c78cb4e` | 5 files |
| `11e5388` | **63 files** (+1007 / -11504 lines) |

### Key Features Added
1. **HR Email Logs** - New page for viewing email logs in HR settings
2. **KPI Department Export** - PDF export functionality for department KPI summaries
3. **Lead Management Reports** - Comprehensive reports pages for lead management
4. **HR Reviews System** - Monthly and quarterly review management
5. **Export Functionality** - Export buttons for employees, transactions, invoices, leads
6. **Leave Approval Workflow** - Automated leave escalation features
7. **Document Threshold Alerts** - Alerts for document expiry thresholds
8. **Sales Analytics Charts** - Visual analytics for sales data
9. **Lead Pipeline Board** - Visual pipeline management for leads
10. **Notification Center** - Centralized notification component

### Currency Standardization
- All currency symbols changed from £ and $ to AED throughout the system

### Localization Updates
- Arabic translations added/updated for:
  - `salesperson.json`
  - `hr.json`
  - `common.json`
  - `admin.json`
  - `finance.json`
  - `leadManagement.json`
- English translations updated correspondingly

---

*Generated on January 27, 2026*
