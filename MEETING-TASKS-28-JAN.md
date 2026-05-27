# Meeting Tasks — January 28 Zoom Call

> **Attendees:** Melisa Becirovic, Neema Ghanbarinia
> **Recording:** [Fathom Link](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd)
> **Date:** January 28, 2026

---

## Tier 1 — Quick Wins (< 1 hour each)

- [ ] **Move "Evaluation deadline approaching" card next to KPI summary**
  - Module: HR Dashboard
  - Details: Reorder the KPI cards so "Evaluation deadline approaching" sits directly next to the KPI status summary section.
  - Complexity: CSS/layout reorder only
  - Timestamp: [4:45](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=274.9999)

- [ ] **Remove "Transactions" link from finance dashboard**
  - Module: Finance
  - Details: The transactions shortcut link is redundant. Remove it from the finance dashboard nav.
  - Complexity: Delete one nav item
  - Timestamp: [33:07](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=1987.9999)

- [ ] **Remove auto-email for KPI review summaries; keep export-only**
  - Module: HR / KPIs
  - Details: Melisa confirmed they don't need auto-email for review summaries. Export/download is sufficient. Remove or disable the email trigger.
  - Complexity: Remove email trigger, keep export button
  - Timestamp: [18:27](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=1096.9999)

- [ ] **Enable click-through on active/total employee counts**
  - Module: HR Dashboard
  - Details: Clicking the active employees or total employees stat card should navigate to the employee list page.
  - Complexity: Wrap stat cards with Link component
  - Timestamp: [5:10](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=299.9999)

---

## Tier 2 — Small Tasks (1–3 hours each)

- [ ] **Add separate notes section in client history**
  - Module: Lead Management / Sales
  - Details: Currently notes are inline within the history tab. Add a standalone notes section. Requires a new `lead_notes` table + simple CRUD UI.
  - Schema Change: New `lead_notes` table
  - Timestamp: [28:14](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=1683.9999)

- [ ] **Add "Working from abroad/overseas" leave type**
  - Module: HR / Leave Management
  - Details: Staff frequently work from overseas. Add `working_from_abroad` to the leave type options.
  - Schema Change: Add value to `leave_type` enum in Supabase + update UI dropdowns
  - Timestamp: [19:28](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=1159.9999)

- [ ] **Add custom setting for 3-attempts follow-up cadence**
  - Module: Lead Management / Settings
  - Details: The 3-attempt follow-up rule is currently hardcoded at ~2 days. Add a configurable setting in the UI.
  - Schema Change: New row in `system_settings` table
  - Timestamp: [25:43](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=1543.9999)

- [ ] **Keep client history editable by Melisa/Caitlin (account managers)**
  - Module: Lead Management
  - Details: Client history (communication, proposals, call logs) should be editable by account managers, not restricted to MD only.
  - Schema Change: Adjust RLS policies / permission checks
  - Timestamp: [25:54](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=1549.9999)

---

## Tier 3 — Medium Tasks (3–8 hours each)

- [ ] **Implement custom KPIs per employee**
  - Module: HR / KPIs
  - Details: KPIs are currently tied to `job_role_id` only. Need ability to assign individual KPIs per employee (e.g., one drafter may have different targets than another in the same role).
  - Schema Change: Add optional `employee_id` to `kpis` table for per-employee overrides
  - Timestamp: [10:01](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=600.9999)

- [ ] **Add review template dropdown on review creation**
  - Module: HR / Reviews
  - Details: Currently the favorited template is auto-selected. Add a dropdown to choose from all available templates when creating a review.
  - Timestamp: [11:51](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=709.9999)

- [ ] **Add/remove fields + required/optional toggle on review templates**
  - Module: HR / Settings
  - Details: Review templates need ability to dynamically add/remove fields and mark each as required or optional.
  - Schema Change: New `review_templates` + `review_template_fields` tables, dynamic form builder UI
  - Timestamp: [11:51](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=709.9999)

- [ ] **Make leave types configurable (admin can add new types)**
  - Module: HR / Settings
  - Details: Replace hardcoded `leave_type` enum with a dynamic `leave_types` table. Add CRUD settings page. Update all leave forms and filters to read from DB.
  - Schema Change: New `leave_types` table replacing enum
  - Timestamp: [19:52](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=1159.9999)

- [ ] **Ensure all reports/exports work across all modules**
  - Module: Cross-cutting (HR, Finance, Leads)
  - Details: Audit every table and report across all modules. Add missing export buttons, PDF generation, and CSV download where needed.
  - Timestamp: [7:59](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=480.9999)

- [ ] **CRM auto-notify EA when invoice is paid**
  - Module: Finance / Notifications
  - Details: When Stripe payment is confirmed, system should automatically update paid status and notify EA via email + in-app notification bell.
  - Timestamp: [34:43](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=2134.9999)

---

## Tier 4 — Large Tasks (1–3 days each)

- [ ] **Finance: employees see only their own data; heads see all**
  - Module: Finance
  - Details: Finance staff (e.g., Uzair B2B, Chloe B2C) should only see their own data. Heads (Samir, Melisa) see an overview of everyone. Requires per-user data scoping across all finance queries, RLS policies, and conditional UI rendering.
  - Schema Change: RLS policies, possible `created_by` scoping on finance tables
  - Timestamp: [31:13](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=1873.9999)

- [ ] **Module-level role restrictions (dropdown/nav visibility)**
  - Module: Admin / Permissions
  - Details: If a user only has the `finance` role, they should only see the finance section in the sidebar. Account managers see client details but not HR or finance. Samir & Melisa see everything.
  - Schema Change: Enforce nav filtering per role, route guards, API-level access restriction
  - Timestamp: [2:27](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=147)

- [ ] **Head vs Employee permission levels within modules**
  - Module: Cross-cutting (HR, Finance, Leads)
  - Details: Within each module, "head" role sees overview of all staff/data, "employee" role sees only their own. Requires new permission layer across all modules.
  - Schema Change: Add `permission_level` to `user_roles` or new `module_permissions` table, middleware checks, UI scoping
  - Timestamp: [32:30](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=1950)

---

## Tier 5 — Complex / Multi-Phase (3+ days)

- [ ] **Google Ads API integration**
  - Module: Lead Management
  - Details: Connect Google Ads to auto-import leads. Requires OAuth setup, API connection, lead auto-import pipeline, source mapping, error handling, and settings UI for credentials.
  - Blocked By: API credentials from Melisa/Samir
  - Timestamp: [23:47](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=1420.9999)

---

## Pending / External Items (Waiting on Samir)

- [ ] **Confirm HR compliance requirements**
  - Melisa to speak with Samir about what compliance tracking is needed. Current compliance section stays as-is until clarified.
  - Timestamp: [15:50](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=950.9999)

- [ ] **Confirm expenses access permissions**
  - Melisa to check with Samir who should have access to expenses (possibly HR/Anika too).
  - Timestamp: [33:25](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=2004.9999)

- [ ] **Send Google Ads API credentials to Neema**
  - Melisa/Samir to provide API connection details.
  - Timestamp: [23:47](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=1420.9999)

- [ ] **Send dashboard screenshots to Samir for review**
  - Neema to share visuals in chat so Melisa can walk through with Samir.
  - Timestamp: [35:31](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=2134.9999)

- [ ] **Send "triggers not over time" email copy to Melisa**
  - Neema to share the automated trigger email template.
  - Timestamp: [24:01](https://fathom.video/share/xgKuDRyXsPsLghueEPWoLWtt6Vak8Ttd?timestamp=1441.9999)

---

## Summary

| Tier | Tasks | Estimated Effort |
|------|-------|-----------------|
| Quick Wins | 4 | ~2–3 hours |
| Small Tasks | 4 | ~6–10 hours |
| Medium Tasks | 6 | ~24–40 hours |
| Large Tasks | 3 | ~5–8 days |
| Complex | 1 | ~3–5 days |
| Pending/External | 5 | Waiting on Samir |
| **Total** | **23 items** | |
