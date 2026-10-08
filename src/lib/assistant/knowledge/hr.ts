// Help-assistant knowledge: HR screens, My Leave, and general account tasks
// (signing in, role switcher, language, password, Report an issue).
//
// Role tagging notes:
// - Every HR screen lives under /admin/hr and is only in the sidebar when the
//   "HR" role is selected in the role switcher, so HR sections are tagged
//   ["hr"]. Admin / Super Admin only see HR menus if they also hold the HR role.
// - Some actions inside HR are limited to HR users with "head" permission
//   (deactivate employee, delete department / job role, archive KPI, add or
//   edit leave approval rules). The content says so where it applies.

import { ALL_STAFF, type KnowledgeSection } from "./types";

export const hrSections: KnowledgeSection[] = [
  // ---------------------------------------------------------------------------
  // Account basics (every staff member)
  // ---------------------------------------------------------------------------
  {
    id: "account-signing-in",
    title: "Signing in to the staff dashboard",
    roles: [ALL_STAFF],
    content: `All staff sign in on the same page: \`/admin/auth\`.

1. Enter your **Email** and **Password** and click **Sign In**.
2. You are taken to the dashboard for your main role (for example HR goes to the HR Dashboard, Finance to the Finance dashboard, salespeople and Managing Directors to Leads, Account Managers to My Cases, Super Admin to Manage Users).
3. If you have more than one role, use the role switcher at the top of the sidebar to move between them.

Things to know:
- Signing in automatically marks you **Present** for today in attendance, as long as your login email matches your employee record. A second sign-in the same day changes nothing, and it never overwrites a status HR has already set.
- "Invalid email or password" means the details are wrong. Use **Forgot password?** to reset.
- "Account Deactivated" or "Access Denied" means your account has no staff access. Ask a Super Admin to check your account.
- Clients use a separate login (the **Client Login** link at the bottom of the page). Staff should not use it.`,
  },
  {
    id: "account-forgot-password",
    title: "Resetting a forgotten password",
    roles: [ALL_STAFF],
    content: `1. Go to the staff sign-in page (\`/admin/auth\`) and click **Forgot password?**.
2. On **Reset Your Password**, enter your email and click **Send reset link**.
3. You'll see **Check Your Inbox**. Open the email and click the link. It can take a few minutes, so check your spam or junk folder too. If nothing arrives, use **Didn't get the email? Resend Link** once the countdown ends.
4. The link opens **Set a New Password**. Enter a **New password** and **Confirm Password**, then click **Update password**.
5. When you see **Your Password Has Been Reset**, click **Return to Login** and sign in.

The new password must be at least 8 characters, and both boxes must match. If you can still sign in and just want a new password, see "Changing your password while signed in" (available to HR, Finance and Managing Director users).`,
  },
  {
    id: "account-change-password",
    title: "Changing your password while signed in",
    roles: ["hr", "finance", "lead_management"],
    content: `You can change your password from your **Settings** page:

- **HR:** select HR in the role switcher, click **Settings** in the sidebar, and stay on the **Account** tab.
- **Finance:** select Finance, then click **Settings**.
- **Managing Director (Leads):** select Leads, click **Settings**, then open the **Account** tab.

Scroll to **Change Password**, enter the new password twice, and save.

Rules: at least 8 characters, with at least 1 uppercase letter, 1 lowercase letter and 1 special character. Otherwise you'll see "Weak Password".

The same page shows your **Account Information**: full name, email, role and language preference.

Staff whose role has no Settings page with this option (Wills/Admin, Sales, My Cases, Super Admin) can sign out and use **Forgot password?** on the sign-in page instead.`,
  },
  {
    id: "account-role-switcher",
    title: "Switching between your roles (role switcher)",
    roles: [ALL_STAFF],
    content: `If your account has more than one role (for example HR and Finance), you switch between them with the role switcher.

1. Look at the top of the left sidebar, just under "Just Wills / Internal Dashboard". On a phone, tap the menu icon at the top first.
2. Click the dropdown showing your current role and pick another. The names shown are **Super Admin**, **Wills** (Admin), **HR**, **Finance**, **Leads** (Managing Director), **Sales** (Executive Assistant) and **My Cases** (Account Manager).
3. You're taken to that role's home page, and the sidebar changes to that role's menu.

Things to know:
- If you only have one role, the switcher shows your role name and isn't clickable.
- The app remembers your last chosen role on that browser.
- A menu item you expect (for example **Leave** or **Employees**) only appears when the right role is selected. HR screens need the HR role.
- You can't add roles to yourself. A Super Admin assigns roles in **Manage Users**.`,
  },
  {
    id: "account-profile-menu-language",
    title: "Switching language to Arabic or English, changing theme, and signing out",
    roles: [ALL_STAFF],
    content: `These are all in the profile menu at the bottom of the left sidebar (your initials, first name and current role).

1. Click your name card at the bottom of the sidebar. On a phone, tap the menu icon at the top first.
2. In the menu that opens:
   - **Language:** choose **English** or **Arabic**. The whole dashboard switches right away, and in Arabic the layout runs right to left.
   - **Theme:** choose **Light**, **Dark** or **System**.
   - **Sign Out:** logs you out.

When the HR role is selected, a notification bell also appears next to your name card (see "HR notifications bell").

To collapse the sidebar into icons only, use the small arrow button beside "Just Wills" at the top of the sidebar.`,
  },
  {
    id: "account-report-issue",
    title: "Reporting a problem or suggestion (Report an issue)",
    roles: [ALL_STAFF],
    content: `Use **Report an issue** to tell the team something isn't working or could be better.

1. On a computer, click **Report an issue** at the bottom of the left sidebar, just above your name card. On a phone, tap the report icon in the top bar.
2. Choose a **Category**: **Something isn't working**, **Suggestion** or **Question**.
3. Write your **Message**: what happened and what you expected. It needs at least 5 characters and can be up to 5,000.
4. Optionally attach a **Screenshot**: a PNG, JPEG, GIF or WebP image of **3 MB or smaller**.
5. Check the **From** and **Page** details, which are filled in automatically, then click **Send report**.

You'll see "Thanks — your report has been sent to the team." The report is emailed to the office. If you see "Your session has expired", sign in again and resend it.`,
  },

  // ---------------------------------------------------------------------------
  // My Leave (every staff member)
  // ---------------------------------------------------------------------------
  {
    id: "my-leave-request",
    title: "Requesting leave for yourself (My Leave)",
    roles: [ALL_STAFF],
    content: `1. Click **My Leave** in the left sidebar (\`/admin/my-leave\`). Every role's menu has it except Super Admin. If Super Admin is your only role, open \`/admin/my-leave\` directly.
2. Under **Request Leave**, choose the **Leave Type**, then a **Start Date** and **End Date**. All three are required.
3. Optionally add a **Reason** and **Attach certificate**, for example a medical certificate. It must be a PDF, JPG or PNG of up to 5 MB, and only HR can see it.
4. Click **Submit Request**. You'll see "Leave request submitted for approval", and the request appears under **My Requests** as **pending**.

Things to know:
- If you see "Your account isn't linked to an employee record yet", the button is disabled. Ask HR to add you as an employee using the same email you sign in with.
- The day count includes every calendar day from start to end date, weekends included.
- If you get a warning that your balance couldn't be updated, the request was still created. Tell HR.
- HR (and any other approvers) review it. You can't edit or cancel a request yourself, so ask HR.`,
  },
  {
    id: "my-leave-status",
    title: "Checking whether your leave was approved",
    roles: [ALL_STAFF],
    content: `1. Click **My Leave** in the sidebar (\`/admin/my-leave\`).
2. Look at **My Requests**. Each request shows the leave type, dates, number of days and a status badge: **pending**, **approved** or **denied**.
3. For a denied request, the reason HR gave appears under it in red.

You also get an email when a request is fully approved or denied. The approval email includes your remaining balance where that leave type is tracked.

A request can need more than one approval (for example Manager, then HR). It stays **pending** until the last approver signs off.

My Leave doesn't show your remaining leave balance. Ask HR, who can see it under **Leave → View Balances**.`,
  },

  // ---------------------------------------------------------------------------
  // HR dashboard
  // ---------------------------------------------------------------------------
  {
    id: "hr-dashboard-overview",
    title: "Using the HR Dashboard",
    roles: ["hr"],
    content: `Select **HR** in the role switcher and click **Dashboard** (\`/admin/hr\`).

From top to bottom you'll see:
- **Quick Actions:** **Add Employee**, **Submit Leave** (opens a new leave request for an employee), **Record Attendance**, **Add KPI**.
- Stat cards: **Total Employees**, **Active Employees**, **Departments**, **Expiring Documents** (red when any documents expire within 90 days). Click a card to open that list.
- **Pending Monthly Reviews** / **Pending Quarterly Reviews:** employees with KPI evaluations still to do, grouped by month or quarter. Click a name to evaluate.
- **Review Alerts**, a KPI evaluation alert, and a KPI performance overview.
- **Pending Approvals:** leave waiting for a decision, flagged **Overdue**, **Escalating Soon** or **New**.
- **Leave Requests** summary and **Leave & Attendance Analytics**. Click **Generate Insights** for AI-detected patterns.
- **Attendance Alerts** (repeated lateness, low attendance, absences) and **Today's Attendance**.
- **Document Expiry Alerts**, with buttons to open **Documents** or batch-export them.

**HR notifications bell:** when HR is selected, a bell next to your name card at the bottom of the sidebar opens **HR Notifications**, with **All / Docs / Leave / Reviews** tabs for expiring documents, pending leave and overdue reviews.`,
  },

  // ---------------------------------------------------------------------------
  // Employees
  // ---------------------------------------------------------------------------
  {
    id: "hr-employees-find",
    title: "Finding an employee and viewing their profile",
    roles: ["hr"],
    content: `1. Select **HR** in the role switcher and click **Employees** (\`/admin/hr/employees\`).
2. Use **Search employees...**, the status filter (**All Statuses / Active / Inactive / On Leave / Terminated**) and the **All Departments** filter. Columns: **Name, Job Role, Department, Start Date, Status, Actions**.
3. Click a row, or **Actions → View Details**, to open the profile.

The profile has buttons for **View Attendance**, **View KPIs**, **Edit** and (for active staff) **Deactivate**. It also has two tabs:
- **Details:** **Personal Information**, **Job Information** (job role, department, start date, salary), **Document Expiry Status** for passport, visa and Emirates ID, and termination details if they've left.
- **Documents:** **Uploaded Documents**, **Upload New Document** and **Document History** (older replaced versions).

To download the staff list, click **Export** above the table. Choose **Excel (.xlsx)** or **CSV (.csv)**, a department, which employment statuses to include, and optionally **Include salary information**, then click **Download**.`,
  },
  {
    id: "hr-employees-add",
    title: "Adding a new employee",
    roles: ["hr"],
    content: `1. Go to **Employees** (\`/admin/hr/employees\`) and click **Add Employee**. You can also use **Add Employee** in Quick Actions on the HR Dashboard.
2. **Personal Information:** **Full Name** (required), **Email**, **Phone**, **Date of Birth**.
3. **Job Information:** **Department**, **Job Role** (choose the department first), **Start Date** (required), **Salary** (AED per month), **Employment Status**.
4. **Required Documents:** upload the **Passport**, **Employment Visa** and **Emirates ID**, each with an **Expiry Date**. All three are mandatory for a new employee. Optionally add an **Employment Contract**.
   - Files: PDF, PNG or JPG, up to 10 MB each. Drag and drop or click to select.
   - AI reads the expiry date from the document and marks it **AI Extracted**. Always check it.
5. Click **Add Employee**.

Important: enter the **same email the person uses to sign in**. That links their login to this record, which they need for **My Leave** and automatic attendance on sign-in.

Adding an employee doesn't create a login. A Super Admin does that in **Manage Users**.`,
  },
  {
    id: "hr-employees-edit",
    title: "Editing an employee's details",
    roles: ["hr"],
    content: `1. Go to **Employees** (\`/admin/hr/employees\`).
2. Open the **Actions** menu on the employee's row and click **Edit**. Or open their profile and click **Edit**.
3. Change any field: name, email, phone, date of birth, department, job role, start date, salary or employment status.
4. Click **Update Employee**.

When editing, you don't have to re-upload the mandatory documents. To add or replace a document (for example a renewed passport), open the profile, go to the **Documents** tab and click **Upload New Document**. The old version moves to **Document History**.

If you change the employee's email, make sure it still matches the email they sign in with, or **My Leave** will stop working for them.`,
  },
  {
    id: "hr-employees-deactivate",
    title: "Deactivating an employee who has left",
    roles: ["hr"],
    content: `1. Go to **Employees** (\`/admin/hr/employees\`).
2. Open the **Actions** menu on the employee's row and click **Deactivate**. Or open their profile and click **Deactivate**. Only active employees have this option. In the list it only shows for HR users with head-level permission.
3. In **Deactivate Employee**, choose a **Termination Reason** (**Resignation**, **Termination**, **End of Contract** or **Other**) and the **Last Working Day**. Both are required. Optionally add **Notes**.
4. Click **Confirm Deactivation**.

The employee is marked **Terminated**. Nothing is deleted, and all records are kept for compliance. Their profile shows a **Termination Information** section, and you can still find them with the **Terminated** status filter.

This doesn't remove their login to the dashboard. Ask a Super Admin to deactivate their user in **Manage Users**.`,
  },

  // ---------------------------------------------------------------------------
  // Departments, job roles, KPIs
  // ---------------------------------------------------------------------------
  {
    id: "hr-departments",
    title: "Adding or deleting departments",
    roles: ["hr"],
    content: `1. Select **HR** in the role switcher and click **Departments** (\`/admin/hr/departments\`).
2. To add one, type a name under **Add New Department** and click **Add**. Duplicate names are rejected with "Department already exists".
3. **Existing Departments** lists each department with its employee count. Click a department to see who is in it, then click a person to open their profile.
4. To delete a department, use the delete icon on its row.

Things to know:
- Departments can only be deleted if no employees are assigned. Move people to another department first by editing their profile.
- Only HR users with head-level permission see the delete option.
- Departments can't be renamed here. To fix a name, add a new department, move the employees over, then delete the old one.`,
  },
  {
    id: "hr-job-roles",
    title: "Managing job roles",
    roles: ["hr"],
    content: `1. Select **HR** in the role switcher and click **Job Roles** (\`/admin/hr/job-roles\`).
2. The table shows **Role Name**, **Department**, **Employees Assigned**, **KPIs Assigned** and **Actions**. Use **Search job roles...** to filter.
3. To create one, click **Add Job Role**, enter the **Role Name** (required), optionally pick a **Department**, and click **Add Job Role**.
4. Row actions: **View KPIs**, **Add KPI** (adds a KPI for that role), **Edit** and **Delete**.

Things to know:
- A job role can only be deleted when no employees are assigned to it.
- Only HR users with head-level permission see **Delete**.
- KPIs are set per job role, so assign each employee a job role (in **Edit** employee) before evaluating their KPIs.`,
  },
  {
    id: "hr-kpis-manage",
    title: "Creating, editing and archiving KPIs",
    roles: ["hr"],
    content: `1. Select **HR** in the role switcher and click **KPIs** (\`/admin/hr/kpis\`). Stay on the **KPIs** tab.
2. Click **Add KPI**, or use **Add KPI** in Quick Actions on the HR Dashboard. Fill in:
   - **Job Role**, **KPI Name**, **Target Value**, **Unit** and **Weighting (%)** (all required), plus an optional **Description**.
   - The form shows the role's current weighting, the remaining weighting and the new total. The total for a role can't go over 100%, and the aim is for it to equal exactly 100%.
3. Click **Add KPI**. To change a KPI, click edit on its row, make the change and click **Save Changes**.
4. To retire a KPI, use **Archive KPI** on its row. Archived KPIs are hidden but kept for history. Tick **Show Archived** to see them and restore them.

Filter the table by job role to see that role's weighting. Only HR users with head-level permission can archive KPIs.`,
  },
  {
    id: "hr-kpis-evaluate",
    title: "Evaluating an employee's KPIs for the month",
    roles: ["hr"],
    content: `1. Go to **KPIs** (\`/admin/hr/kpis\`) and open the **Evaluations** tab. Alternatively, click a name under **Pending Monthly Reviews** on the HR Dashboard.
2. Pick the month and year, and optionally filter by job role or status (**Pending / Completed**). The table shows **Employee Name, Job Role, Evaluation Status, Overall Score**.
3. Click **Evaluate** on the employee's row.
4. On their evaluation page, check the year and month. Under **Assigned KPIs**, enter the **Achieved Value** for each KPI against its **Monthly Target**. A **Score** is calculated, and you can add **Notes**.
5. Click **Save**. You'll see "All evaluations saved successfully" and an **Overall Score** at the top.

Extras:
- Add more of the role's KPIs from **Available KPIs to Assign**.
- Click **Add Personal KPI** to create a KPI just for this person.
- An employee with no job role has no KPIs. Set their job role first.
- KPIs that already have evaluation data can't be unassigned or deleted.`,
  },
  {
    id: "hr-kpis-reports",
    title: "Downloading KPI reports and department summaries",
    roles: ["hr"],
    content: `All of these are on the **KPIs** page (\`/admin/hr/kpis\`).

**One employee:** on the **Evaluations** tab, click **Evaluate** for the person, then **Download PDF**. Choose a **Monthly Report** or a **Quarterly Report** (the average of 3 months). If there are no KPIs for that period you'll be told so.

**Several employees:** on the **Evaluations** tab, click **Bulk Download**. Choose the **Report Type** (Monthly or Quarterly), tick employees under **Select Employees**, and download one combined PDF.

**By department:** open the **Summaries** tab to see KPI results per department and job role. Click **Export Summary** to download it as PDF or Excel.

**Charts:** the **Analytics** tab shows KPI trends and comparisons.`,
  },

  // ---------------------------------------------------------------------------
  // Performance reviews
  // ---------------------------------------------------------------------------
  {
    id: "hr-reviews-quarterly",
    title: "Creating and approving a quarterly performance review",
    roles: ["hr"],
    content: `Reviews aren't in the sidebar. Open them from **Review Alerts → View All Reviews** on the HR Dashboard, or go to \`/admin/hr/reviews\`.

1. On **Performance Reviews**, click **Create Review** and select the employee.
2. In the **Quarterly Review** form, check the **Quarter**, **Year**, the template (**Select Template**) and the **Deadline**.
3. **KPI Performance** is filled in from KPI evaluations. Under **Monthly Reviews Reference** you can **Import** text from that quarter's monthly reviews. **Generate Summary** drafts the summary for you.
4. Complete the sections (for example Performance Summary, Strengths, Areas for Improvement, Goals for Next Quarter, Development Plan, Manager Comments). Click **Save Draft** at any time, then **Submit for Approval**.
5. To approve, open the review from the **Pending Approval** tab and click **Approve**. After approval, click **Mark Complete**.
6. **Download PDF** is available once a review is approved or complete.

Drafts can still be edited with **Edit**. The page header shows **Overdue** counts. To change review sections or the default template, use **Settings → Review Templates**.`,
  },
  {
    id: "hr-reviews-monthly",
    title: "Creating and approving a monthly review",
    roles: ["hr"],
    content: `1. Open **Performance Reviews** (from **Review Alerts → View All Reviews** on the HR Dashboard, or \`/admin/hr/reviews\`) and click **Monthly Reviews**. This opens \`/admin/hr/reviews/monthly\`.
2. Click **Create Monthly Review**, search for the employee and select them.
3. Set the **Month**, **Year** and **Deadline**. **KPI Performance** shows the score from that month's KPI evaluations.
4. Fill in **Performance Summary** (required), **Achievements**, **Challenges**, **Goals Progress** and the optional **Manager Notes**.
5. Click **Save Draft**, or **Submit for Approval**.
6. To approve, open the review from the **Pending Approval** tab, click **Approve**, then **Mark Complete** when finished.

The page shows **Total Reviews**, **Pending Approval**, **Completion Rate** and **Overdue Reviews** for the current month. Monthly review text can later be imported into the quarterly review.`,
  },
  {
    id: "hr-review-templates",
    title: "Managing review templates",
    roles: ["hr"],
    content: `1. Select **HR** in the role switcher, click **Settings** (\`/admin/hr/settings\`) and open the **Review Templates** tab.
2. The table lists each template's **Template Name**, **Description**, number of **Sections** and **Status**.
3. Click **New Template** to create one, give it a name, and add or remove sections and custom fields.
4. Use the row actions to edit or delete a template, or to set it as the default. You'll see "Default Template Set".

The default template is pre-selected when you create a quarterly review. You can still pick another one in **Select Template** on the review form.`,
  },

  // ---------------------------------------------------------------------------
  // Employee documents
  // ---------------------------------------------------------------------------
  {
    id: "hr-documents-view-upload",
    title: "Viewing and uploading employee documents",
    roles: ["hr"],
    content: `**See all documents:** select **HR** in the role switcher and click **Documents** (\`/admin/hr/documents\`). The top shows **Total Documents**, **Active Documents**, **Expiring Soon** (within 90 days) and **Expired**, plus **Documents by Type**. In **Documents List**, search by employee or document and filter by type (**Passport, Employment Visa, Emirates ID, Employment Contract, Certification**), by status (**Active, Expiring Soon, Expired, Archived**) and by employment status. Click **View** to open a file. Use the export button at the top to download documents in bulk.

**Upload or replace a document:**
1. Open the employee's profile (**Employees** → click the name) and go to the **Documents** tab.
2. Click **Upload New Document**, choose the **Document Type**, and drop in the file (JPG, PNG or PDF, max 10 MB).
3. Check the **Expiry Date**, which AI fills in where it can, and click **Upload Document**.

Uploading a document of the same type archives the previous version, which you can still see under **Document History**.`,
  },
  {
    id: "hr-documents-expiry-alerts",
    title: "Handling expiring documents (renewals and reminders)",
    roles: ["hr"],
    content: `Expiring documents appear in **Document Expiry Alerts** on the HR Dashboard (\`/admin/hr\`) and under the **Docs** tab of the HR notifications bell.

Alerts are grouped by urgency: **Expired**, **Critical** (0–7 days), **Urgent** (8–14), **Warning** (15–30), **Advisory** (31–90) and **Renewal in Progress**. You can filter by document type, sort by urgency, or search by employee name.

Each document has action buttons:
- **View Documents:** opens the employee's documents.
- **Send Reminder:** emails the employee a reminder. You can edit the **Message** first.
- **Mark as Renewal in Progress:** enter the **Submission Date** and an optional **Expected Return Date**. The document moves to the Renewal in Progress group.
- **Upload Renewed Document:** uploads the new copy with its new expiry date.
- **Mark as Complete** / **Cancel Renewal:** shown for documents already in renewal.

To get these alerts by email automatically, see "Setting up document expiry email alerts".`,
  },
  {
    id: "hr-documents-expiry-email-settings",
    title: "Setting up document expiry email alerts",
    roles: ["hr"],
    content: `1. Select **HR** in the role switcher, click **Settings** (\`/admin/hr/settings\`) and open the **Notifications** tab.
2. **Document Expiry Notifications** sends a daily digest:
   - Turn on **Enable Email Notifications**.
   - Set the **Send Time**, **Timezone**, **Recipient Name** and **Recipient Email**.
   - Under **Include in Digest**, tick **Expired Documents**, **Critical** (0–7 days) and/or **Urgent** (8–14 days).
   - Click **Save Changes**. Use **Send Test Notification** to check it arrives.
3. **Expiry Threshold Alerts** sends a one-off alert when a document reaches a set number of days before expiry:
   - Turn on **Enable Threshold Alerts**.
   - Under **Select Alert Thresholds**, tick any of 90, 60, 30, 14 and 7 days. Each threshold is sent only once per document.
   - Set the recipient, send time and timezone, then click **Save Changes**.

**Recent Notifications** and **Threshold Alert History** show what was sent (**Sent / Failed / Skipped**). Click **View All Logs** for the full email log.`,
  },

  // ---------------------------------------------------------------------------
  // Attendance
  // ---------------------------------------------------------------------------
  {
    id: "hr-attendance-mark",
    title: "Marking daily attendance",
    roles: ["hr"],
    content: `1. Select **HR** in the role switcher and click **Attendance** (\`/admin/hr/attendance\`). Or use **Record Attendance** on the HR Dashboard.
2. On the **Mark Attendance** tab, pick the date with the arrows or the **Today**, **Yesterday**, **This Week**, **Last Week** and **This Month** buttons. Filter by department if you need to.
3. Set each employee's status: **Present**, **Late**, **WFH**, **On Leave**, **Sick Leave** or **Absent**. A **Reason (optional)** can be added.
4. Or click **Mark All Present**, then adjust the exceptions.
5. Click **Save Attendance**, or **Save & Email** to also email that day's summary to your own email address.

Things to know:
- **Late** requires a check-in time.
- You can only edit the last 7 days. Older dates show **View Only**.
- Staff are marked Present automatically when they sign in. You can still change it.
- People with approved leave show an **Approved Leave** badge. Approving leave marks those weekdays On Leave or Sick Leave automatically.
- The **Calendar View** tab shows the month at a glance. Click a recent day to jump to marking it.`,
  },
  {
    id: "hr-attendance-employee-warning",
    title: "Checking one employee's attendance and sending a warning",
    roles: ["hr"],
    content: `**Open an employee's attendance:**
- From **Employees**, open the profile and click **View Attendance**.
- Or click a name under **Attendance Alerts** or **Today's Attendance** on the HR Dashboard.

The page (\`/admin/hr/attendance/employee/…\`) shows a **Summary** with the **Attendance Rate** (rated **Excellent**, **Good** or **Needs Improvement**), counts per status, and **Recent Activity** with check-in times. Change the period between **Last 7 days**, **Last 30 days**, **Last 3 months**, **Last 6 months** and **This year**. **Export Report** downloads this employee's attendance.

**Send a warning:**
1. Click **Send Warning** on that page, or **Send Warning** on an alert in **Attendance Alerts**.
2. Review the employee and the **Issue**, then write your **Message**.
3. Click **Send Warning**. It is emailed to the employee, so they need an email on file.

**Attendance Alerts** on the HR Dashboard flags people who were late 3+ times this week, have an attendance rate under 85%, or have 3+ absences this month.`,
  },
  {
    id: "hr-attendance-export",
    title: "Exporting an attendance report",
    roles: ["hr"],
    content: `1. Select **HR** in the role switcher and click **Attendance** (\`/admin/hr/attendance\`).
2. Click **Export Report** at the top of the page.
3. In **Export Attendance Report**, choose the **Report Type**:
   - **All Employees**
   - **Individual Employee**, then **Select Employee**
   - **By Department**, then **Select Department**
4. Set the **Period** with the **From** and **To** dates. The start must be before the end.
5. Under **Include**, tick what you want: **Summary statistics**, **Daily breakdown**, **Late arrivals with times**, **Leave days**, **Warnings issued**.
6. Click **Generate Report**. An Excel file downloads.

For one person you can also use **Export Report** on their attendance page (profile → **View Attendance**).`,
  },

  // ---------------------------------------------------------------------------
  // Leave management (HR)
  // ---------------------------------------------------------------------------
  {
    id: "hr-leave-approve-deny",
    title: "Approving or denying a leave request",
    roles: ["hr"],
    content: `1. Select **HR** in the role switcher and click **Leave** (\`/admin/hr/leave\`). It opens on **Pending Requests**. Search by employee or filter by status or type.
2. Each request shows the dates, days, reason and a badge such as **Awaiting HR** or **Awaiting Manager — step 1 of 2**. **View Certificate** opens any attachment.
3. Click **Approve**, or click **Deny**, enter a **Reason for Denial** (required) and click **Deny Request**.

What happens:
- With several approval steps, your approval only moves the request on ("Sent to … for step 2 of 3"). It stays pending until the last step.
- On final approval, the days are deducted from the balance (for leave types that track a balance), the weekdays are marked **On Leave** or **Sick Leave** in attendance, and the employee is emailed.
- If attendance was already recorded for those days, you'll see **Attendance Conflict Detected**. Choose **Override & Approve** or **Cancel**.
- A denial ends the request at any step, releases the reserved days and emails the employee the reason.
- Greyed-out buttons mean the request is waiting on a different approver. Hover over them for the reason. Only Admin or Super Admin users can approve **Director** steps.`,
  },
  {
    id: "hr-leave-request-on-behalf",
    title: "Submitting a leave request on behalf of an employee",
    roles: ["hr"],
    content: `1. Go to **Leave** (\`/admin/hr/leave\`) and click **New Request**. Or click **Submit Leave** in Quick Actions on the HR Dashboard.
2. In **Submit Leave Request**, choose the **Employee** (active employees only) and the **Leave Type**, then set the **Start Date** and **End Date**. All are required.
3. The dialog shows the **Working days** count, which excludes weekends.
4. Optionally enter a **Reason**, then click **Submit Request**.

The request is created as **Pending** and still goes through the normal approval steps, so approve it afterwards if appropriate. For leave types that track a balance, the days are held as "pending" against the employee's balance until it's approved or denied.

If a certificate was handed in on paper, scan it and use **Attach Certificate** on the request in the list (or **Replace Certificate** to swap it).`,
  },
  {
    id: "hr-leave-balances",
    title: "Checking or editing an employee's remaining leave balance",
    roles: ["hr"],
    content: `1. Go to **Leave** (\`/admin/hr/leave\`) and click **View Balances**. This opens \`/admin/hr/leave/balances\`.
2. **Leave Balances** shows the current year. The top cards are **Total Employees**, **Annual Used**, **Sick Used** and **Low Balance** (employees with 5 or fewer annual days left).
3. In **Employee Balances**, search for the person. Columns show **Annual** (Used, Pending, Remaining) and **Sick** (Used, Remaining).
4. To change someone's entitlement, click the edit icon (**Edit Entitlement**) on their row. Set the days for each balance-tracked leave type (for example **Annual Leave Entitlement (days)** or **Sick Leave Entitlement (days)**) and click **Save Changes**.

The dialog shows UAE guidance: annual leave is 30 days after 1 year of service, and sick leave is 90 days per year.

Click the employee's row, or the history icon, to open their full leave history.`,
  },
  {
    id: "hr-leave-history-employee",
    title: "Viewing an employee's leave history",
    roles: ["hr"],
    content: `Open the history page (\`/admin/hr/leave/history/…\`) in either of these ways:
- **Leave → View Balances**, then click the employee's row or the **View History** icon.
- **Leave → Leave Calendar**, click a day, then click **View History** next to the person.

The page shows:
- A year selector covering the current year and the 2 before it.
- Balance cards for **Annual Leave** and **Sick Leave** (and any other tracked leave types), with **Entitled**, **Used**, **Pending** and **Remaining**.
- **Leave History** for that year, which you can filter by leave type and by status (**Approved / Pending / Denied**). Each entry shows the dates, reason, denial reason if any, the approval date, and **View Certificate** if one was attached.`,
  },
  {
    id: "hr-leave-calendar",
    title: "Seeing who is on leave (leave calendar and coverage)",
    roles: ["hr"],
    content: `1. Go to **Leave** (\`/admin/hr/leave\`) and click **Leave Calendar**. This opens \`/admin/hr/leave/calendar\`.
2. The top shows **Total Employees**, **On Leave Today**, **Available Today** and a **Coverage** percentage.
3. Move between months with the arrows, or click **Today**. Filter by department with **All Departments**.
4. Days with approved leave are highlighted. Weekends and UAE public holidays are marked (**Weekend**, **Holiday**). Hover over a holiday to see its name.
5. Click a day to see **Employees on Leave** that day and how many people are available. Click **View History** for anyone's full leave record.

Only **approved** leave appears on the calendar. Pending requests are on the main **Leave** page.

For a quick view of today, the HR Dashboard's **Today's Attendance** card also shows who is On Leave or on Sick Leave.`,
  },
  {
    id: "hr-leave-export",
    title: "Exporting a leave report",
    roles: ["hr"],
    content: `1. Go to **Leave** (\`/admin/hr/leave\`) and click **Export** at the top.
2. In **Export Leave Report**, choose the **Report Type**: **All Employees**, or **By Department** and then pick the **Department**.
3. Set the **Start Date** and **End Date**. The default is the last 3 months up to today.
4. Optionally limit the **Leave Types** and **Statuses**. If you select none, all are included.
5. Click **Export Excel**. A file named like "Leave_Report_[start]_to_[end].xlsx" downloads.`,
  },
  {
    id: "hr-leave-approval-rules-escalation",
    title: "Setting leave approval steps and escalation",
    roles: ["hr"],
    content: `1. Select **HR** in the role switcher, click **Settings** (\`/admin/hr/settings\`), open **Leave Approvals**, and stay on **Approval Rules**.
2. **Approval Chain Rules** lists each rule's **Leave Type**, **Duration**, **Approval Chain**, **Escalation** and status.
3. Click **Add Rule** (or edit a row). Set:
   - **Leave Type** (or **All Types**), **Min Days** and **Max Days** (optional).
   - **Approval Chain:** tick **Manager Approval**, **HR Approval** and/or **Director Approval**. The steps run in that order.
   - **Escalation After (days)** and **Priority** (lower numbers are checked first).
   - **Rule Active**, then **Save**.

How it works: the most specific matching rule applies to each new request. If nobody responds within the escalation period, the request auto-escalates to HR. On the HR Dashboard, **Pending Approvals** flags requests as **Escalating Soon**, **Overdue** or **Escalated N×**.

Only HR users with head-level permission can add, edit or delete rules.`,
  },
  {
    id: "hr-leave-delegation",
    title: "Delegating your leave approvals while you're away",
    roles: ["hr"],
    content: `1. Select **HR** in the role switcher, click **Settings** (\`/admin/hr/settings\`), open **Leave Approvals**, then the **Delegations** tab.
2. Click **Add Delegation**.
3. Choose who to **Delegate To**, set the **Start Date** and **End Date** (all required), and optionally limit it to certain **Leave Types** or a maximum number of days.
4. Save.

While the delegation is active, your delegate can approve or deny requests that are waiting on you. On the Leave page those requests show an **Acting as delegate** badge. Each delegation shows as **Upcoming**, **Active**, **Expired** or **Inactive**, and you can edit or delete it.

Your delegate can only act if they can open the HR **Leave** page, which means they need the HR role.`,
  },
  {
    id: "hr-leave-types",
    title: "Adding or changing leave types",
    roles: ["hr"],
    content: `1. Select **HR** in the role switcher, click **Settings** (\`/admin/hr/settings\`) and open the **Leave Types** tab.
2. The table shows each type's **Name**, **Slug**, **Color**, **Tracks Balance** (Yes/No) and status (**Active / Inactive**).
3. Click **Add Leave Type**. Enter the **Name** (required, e.g. "Annual Leave") and choose an **Icon** and **Color Theme**. The **Slug** is generated automatically and can't be changed later.
4. Turn on **Tracks Balance** if this type should deduct from the employee's balance.
5. Click **Save**.

Things to know:
- Use **Edit** to change a type, and **Archive** to hide it from new leave requests (**Restore** brings it back). Inactive types don't appear in **My Leave** or **New Request**.
- After creating a balance-tracked type, set each employee's entitlement under **Leave → View Balances → Edit Entitlement**.`,
  },
];
