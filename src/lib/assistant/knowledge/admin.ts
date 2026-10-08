// Help-assistant knowledge: finance, wills/cases, admin dashboard, user
// management and the client portal switch. Written from the real screens —
// labels match the English UI. See types.ts for the section contract.

import { ALL_STAFF, type KnowledgeSection } from "./types";

export const adminSections: KnowledgeSection[] = [
  // ---------------------------------------------------------------------------
  // FINANCE
  // ---------------------------------------------------------------------------
  {
    id: "finance-dashboard-overview",
    title: "Finding your way around the Finance Dashboard",
    roles: ["finance"],
    content: `Open **Dashboard** in the sidebar while the **Finance** dashboard is selected in the role switcher at the top of the sidebar (\`/admin/finance\`).

What you'll see:
1. **Summary cards** at the top: Total Invoices, Paid Invoices, Pending Invoices (finance heads only), plus Total Earnings, Total Expenses and Net Profit. Clicking a card jumps to the matching tab with a filter applied.
2. **Tabs**:
   - **Invoices** – Outstanding Balances plus the full Invoices List (finance heads only).
   - **Earnings & Expenses** – every transaction you can see, with search, filters and add buttons.
   - **Analytics** – charts of earnings, expenses and invoice status.
3. A round gold **+** button in the bottom-right corner for a quick **Add Earning** / **Add Expense**.

Finance employees land on **Earnings & Expenses** because they don't have the Invoices tab.`,
  },
  {
    id: "finance-head-vs-employee",
    title: "What finance heads can do that finance employees can't",
    roles: ["finance"],
    content: `Finance users are either **heads** or **employees**.

**Finance heads** (and anyone who also holds the Admin or Super Admin role):
- See the **Invoices** tab, the **Outstanding Balances** list and the invoice summary cards.
- See **all** earnings and expenses recorded by anyone.
- See invoice charts and the invoice CSV export on the Reports page.

**Finance employees**:
- See only the **Earnings & Expenses** and **Analytics** tabs.
- See only the transactions **they recorded themselves**, so their totals reflect their own entries only.

Deleting a transaction is also restricted: the bin icon only appears if your account was created with the **Head** permission level for Finance.

Gotcha: invoice access (head vs employee) is a separate setting from the permission level chosen when your account was created. If you should see invoices but don't, ask the system administrator to mark you as a finance head; it can't be changed from Manage Users.`,
  },
  {
    id: "finance-record-earning",
    title: "How do I record an earning (money received)?",
    roles: ["finance"],
    content: `1. Go to the Finance Dashboard (\`/admin/finance\`) and open the **Earnings & Expenses** tab.
2. Click **Add Earning** (above the table), or use the gold **+** button bottom-right and pick **Add Earning**.
3. In the **Add Transaction** form fill in:
   - **Type**: Earning (already selected).
   - **Category**: Consultation Fee, Service Fee or Other Income.
   - **Amount** (must be above zero) and **Currency**: AED, USD, EUR, GBP or SAR.
   - **Transaction Date**.
   - Optional: **Reference Number** (e.g. REC-001), **Receipt** upload, **Description**.
4. Click **Add Transaction**. You'll see "Transaction added successfully" and it appears in the list.

Note: this is the finance ledger only. It does **not** mark a client's invoice as paid. Payments against an invoice are recorded on the invoice itself in Lead Management (the **Record Payment** button), which updates Outstanding Balances.`,
  },
  {
    id: "finance-record-expense",
    title: "How do I record an expense and attach a receipt?",
    roles: ["finance"],
    content: `1. Open the Finance Dashboard (\`/admin/finance\`) and go to the **Earnings & Expenses** tab.
2. Click **Add Expense**, or use the gold **+** button bottom-right and choose **Add Expense**.
3. Choose a **Category**: Salary, Rent, Utilities, Marketing, Software, Office Supplies, Travel, Legal, Taxes or Other Expense.
4. Enter **Amount**, **Currency** and **Transaction Date** (all required).
5. Under **Receipt** click **Upload Receipt** and choose the file. Allowed: JPG, PNG, GIF, WebP or PDF, **max 5MB**. Larger files or other types are rejected.
6. Optionally add a **Reference Number** and **Description**, then click **Add Transaction**.

To view a receipt later, click the receipt icon in the **Receipt** column of the transactions table.`,
  },
  {
    id: "finance-edit-delete-transaction",
    title: "Editing or deleting a transaction",
    roles: ["finance"],
    content: `On the Finance Dashboard (\`/admin/finance\`), **Earnings & Expenses** tab, find the row and use the icons in the **Actions** column.

**Edit** (pencil icon):
1. The **Edit Transaction** form opens with the current details.
2. Change the category, amount, currency, date, reference, description or receipt. You **can't change the Type**. To turn an earning into an expense, delete it and add a new one.
3. Click **Save Changes**.

**Delete** (bin icon):
1. Confirm in the **Delete Transaction** dialog. This can't be undone.
2. The bin icon only shows for users with the **Head** permission level for Finance. If you don't see it, ask a finance head to delete it.

Finance employees only see, and so can only edit, transactions they recorded themselves.`,
  },
  {
    id: "finance-filter-export-transactions",
    title: "Searching, filtering and exporting transactions",
    roles: ["finance"],
    content: `On the **Earnings & Expenses** tab of the Finance Dashboard (\`/admin/finance\`):

1. **Search transactions...** matches the description and reference.
2. **Type** dropdown: All Types, Earning or Expense.
3. **Date range**: pick presets such as Today, This Week, This Month, This Quarter, This Year or Last Month, or choose your own dates.
4. **Category**: tick one or more categories.
5. **Amount**: set a Min Amount and/or Max Amount.
6. **Clear** resets all filters.

Click a column header (Date, Type, Category, Description, Amount) to sort.

**Export CSV** downloads the rows you've ticked. If none are ticked, it downloads everything that matches your current filters.

Tip: on the **Analytics** tab, clicking a monthly bar or a category slice takes you back here with that month or category already filtered.`,
  },
  {
    id: "finance-view-download-invoice",
    title: "Viewing and downloading a client's invoice PDF",
    roles: ["finance"],
    content: `Finance heads only. Employees don't have the Invoices tab.

1. Open the Finance Dashboard (\`/admin/finance\`) and go to the **Invoices** tab.
2. Scroll past Outstanding Balances to the **Invoices List**.
3. Find the invoice with **Search invoices...** (invoice number, client name or email), or filter by status: **Draft, Sent, Paid, Cancelled**.
4. In the **Actions** column click **View Proposal** or **Download Invoice** (both open the **Invoice Preview**).
5. Click **Download PDF** in the preview. The file is saved as \`Invoice-<number>.pdf\`.

If the invoice has an online payment link, a third **Payment Link** icon opens the client's payment page.

**Export CSV** above the list downloads the ticked invoices, or all filtered ones if none are ticked.

Invoices are created and sent from Lead Management, not from Finance.`,
  },
  {
    id: "finance-outstanding-balances",
    title: "How do I see which invoices still have money owed?",
    roles: ["finance"],
    content: `Finance heads only.

1. Open the Finance Dashboard (\`/admin/finance\`) and go to the **Invoices** tab.
2. The **Outstanding Balances** card at the top lists every issued invoice that isn't fully paid, with **Client, Invoice, Total, Paid** and **Outstanding** columns. **Total outstanding** is shown top-right.

Badges next to a client's name:
- **Part paid**: some money has been received.
- **Drafting fee unpaid**: on a staged invoice, the upfront drafting fee hasn't been paid, so work hasn't started. Chase these first.
- **Court fees pending**: drafting fee paid, and the court fees + VAT are still to come.

Totals include VAT, matching the client's invoice. An invoice stays listed until its balance is cleared. Cancelled invoices, and proposals never turned into invoices, aren't listed.

"Nothing outstanding" means every issued invoice is paid in full. Payments are recorded on the invoice in Lead Management.`,
  },
  {
    id: "finance-overdue-invoices",
    title: "Spotting overdue invoices",
    roles: ["finance"],
    content: `Finance heads only.

In the **Invoices List** on the **Invoices** tab (\`/admin/finance\`), an invoice with status **Sent** that is more than **30 days** past its sent date turns amber. A small warning badge shows how many days overdue it is (e.g. "12d").

To list only the unpaid ones, set the status filter to **Sent**, or click the **Pending Invoices** summary card at the top of the dashboard.

For a money-owed view that includes part-paid invoices, use the **Outstanding Balances** card above the list instead.`,
  },
  {
    id: "finance-weekly-outstanding-digest",
    title: "What is the weekly Monday outstanding-balance email?",
    roles: ["finance"],
    content: `Every **Monday at 08:00 (UAE time)** the system emails a summary of all invoices that still have money owed. It's called the **Outstanding Balance Digest**.

What it contains:
- The total amount outstanding.
- One row per invoice with Client, Invoice, Total, Paid and Outstanding, largest first.
- The same **part paid / drafting fee unpaid / court fees pending** labels as the Outstanding Balances card.

Good to know:
- It goes **to your team only**. Clients never receive it, and chasing is left to a person.
- If nothing is outstanding that week, **no email is sent**.
- It goes to the address set under **Settings** → **Outstanding Balance Digest**. If that's blank, a default server address is used.
- Turning it off stops the email only. The Outstanding Balances list on the dashboard stays.`,
  },
  {
    id: "finance-digest-settings",
    title: "Changing who receives the weekly digest (or turning it off)",
    roles: ["finance"],
    content: `1. Click **Settings** in the sidebar under the Finance dashboard (\`/admin/finance/settings\`).
2. In the **Outstanding Balance Digest** card:
   - **Send the digest to**: the email address that should receive it. Leave it blank to use the default address configured on the server.
   - **Recipient name**: defaults to "Finance Team".
   - **Send the weekly digest**: the toggle. Turn it off to stop the Monday email.
3. Click **Save**. You'll see "Settings saved – The weekly digest will go to this address."

Only one address can be entered. An invalid email is rejected with "Please enter a valid email address."

The same Settings page also shows your **Account Information** and lets you change your password.`,
  },
  {
    id: "finance-analytics-tab",
    title: "Using the finance Analytics charts",
    roles: ["finance"],
    content: `1. Open the Finance Dashboard (\`/admin/finance\`) and click the **Analytics** tab.
2. You'll see charts for monthly earnings vs expenses, an **Expense Breakdown** and an **Earnings Breakdown** by category, and (finance heads only) an **Invoice Status Breakdown**.
3. Charts are clickable:
   - Click a **month bar** to jump to Earnings & Expenses filtered to that month.
   - Click a **category slice** to filter transactions by that category.
   - Click an **invoice status slice** to open the Invoices tab filtered to that status.

Finance employees' charts only include the transactions they recorded themselves.`,
  },
  {
    id: "finance-reports-page",
    title: "Finance Reports & Analytics page and CSV exports",
    roles: ["finance"],
    content: `There is a separate **Reports & Analytics** page at \`/admin/finance/reports\`. It isn't in the sidebar, so type the address or bookmark it.

It shows:
- **Overview**: Revenue This Month, Expenses This Month, Net Profit and, for finance heads, **Outstanding** (unpaid invoices that have been sent).
- **Insights**: Revenue vs Expenses (last 6 months), 7-Day Revenue Trend, Expenses by Category and, for heads, Invoice Status.
- **Data Exports**:
  - **Transactions** → **Export**: choose a date range and transaction type, then download a CSV.
  - **Invoices** → **Export**: heads only.

For a quick export of exactly what you've filtered, the **Export CSV** button on the dashboard tables is often easier.`,
  },

  // ---------------------------------------------------------------------------
  // WILLS / CASES
  // ---------------------------------------------------------------------------
  {
    id: "wills-find-a-will",
    title: "Finding a will in All Wills (filters, sorting, draft age)",
    roles: ["admin", "account_manager"],
    content: `Click **All Wills** in the sidebar (\`/admin/wills\`). Account managers see the same page as **My Cases**.

The table shows **Client, Created At, Draft Age, Status, Account Manager** (admins only), **PDF** and **Actions**. Only wills that have been submitted appear.

- **Filters**: **Status**, **From Date** and **To Date**. Use **Reset Filters** to clear them.
- **Sorting**: click **Created At** to switch between oldest and newest first.
- **Draft Age**: shows days open against a 5-day target (e.g. "3d / 5d") while the will is being drafted. It turns to a **Drafted** badge once a draft is done.
- Next to **Draft Released**, a badge shows **Approved** or **Changes Req.** once the client responds.

Gotcha: the Status filter's options don't match every status. Under Review and Draft Ready aren't listed, and some options may return nothing. If a filter shows no results, clear it and scan the Status column instead.

Click **View Details** to open a will.`,
  },
  {
    id: "wills-my-cases",
    title: "What is My Cases and why can't I see every will?",
    roles: ["account_manager"],
    content: `As an account manager, click **My Cases** in the sidebar (\`/admin/wills\`).

- You only see wills where **you** are the assigned account manager. The Account Manager column is hidden because they're all yours.
- If you open a will that isn't assigned to you (for example from a link), you won't be able to load it.
- A case appears here only after an admin assigns you to it on the will's detail page. If a case is missing, ask an admin to check the **Account Manager** dropdown on that will.
- Client support and edit requests for a will are routed to its assigned account manager.

From My Cases you can open a will with **View Details**, download its PDF, change its status, upload revised PDFs and add activity notes. Generating a draft from the template is for admins only.`,
  },
  {
    id: "wills-status-meanings",
    title: "What each will status means",
    roles: ["admin", "account_manager"],
    content: `Wills move through these statuses, roughly in order:

1. **In Progress**: the client is still filling in their details.
2. **Awaiting Review**: submitted and waiting for the team.
3. **Under Review**: being drafted or revised. Also used when a client asks for changes.
4. **Draft Ready**: a reviewer has checked the draft. Choosing this records who reviewed it and when. It's required before release.
5. **Draft Released**: the draft is marked visible to the client for approval.
6. **Finalized**: the will is complete.

Rules the system enforces:
- **Draft Released** and **Finalized** are greyed out until a draft PDF exists.
- **Draft Released** fails unless the will has first been marked **Draft Ready**.
- Moving a will **away** from Draft Released clears the client's approval or feedback, starting a fresh review round.

Every change is recorded in the **Activity** tab with who made it and when.`,
  },
  {
    id: "wills-change-status",
    title: "How do I change a will's status?",
    roles: ["admin", "account_manager"],
    content: `Two ways:

**From the list** (\`/admin/wills\`): use the status dropdown at the end of the row, next to **View Details**.

**From the will page** (\`/admin/wills/[id]\`):
1. Open the will with **View Details**.
2. In the **Quick Actions** card on the left, pick the new status from the dropdown.
3. You'll see "Status updated" and the page switches to the **Overview** tab.

If it fails, read the message:
- "Cannot release draft: No PDF uploaded": generate or upload a draft first.
- "...must be reviewed and marked 'Draft Ready' first": set **Draft Ready**, then **Draft Released**.
- "Cannot finalize: No document exists yet": a draft PDF is needed.

The change is logged in the **Activity** tab.`,
  },
  {
    id: "wills-download-pdf",
    title: "Where do I download a client's will PDF?",
    roles: ["admin", "account_manager"],
    content: `**Quickest**: in All Wills / My Cases (\`/admin/wills\`), click **Download** in the **PDF** column. If it says **Not Generated**, no draft exists yet.

**On the will page**:
1. Click **View Details**, then open the **Draft PDF** tab (it's called **Final PDF** once the will is finalized).
2. Click **Download**, or **Load PDF Preview** to view it in the page.
3. **Draft Version History** in Quick Actions lists every version (v1, v2...). Use **Open PDF** for the PDF or the Word icon to **Download Word draft (.docx)**.

**Client-signed copy**: once the client signs, a **Client-signed copy** box appears in Quick Actions and on the PDF tab. Use **Open signed copy** to get it. It's a separate file from the unsigned original.

Links open in a new tab and expire after about an hour, so re-click if one stops working.`,
  },
  {
    id: "wills-generate-draft-template",
    title: "How do I generate a will draft from the template?",
    roles: ["admin"],
    content: `1. Open the will from **All Wills** (\`/admin/wills\`) → **View Details**.
2. In **Quick Actions**, find **Generate Draft from Template**.
3. Choose **Abu Dhabi template** or **Dubai template**.
4. Click **Generate Draft**.

This produces **both a PDF and an editable Word draft** and adds a new entry to **Draft Version History**. Use **Download Word draft (.docx)** to amend the wording.

Gotchas:
- This button requires the **Admin** role. Account managers without it will get an "Admin access required" error, so ask an admin.
- Until the will is **Finalized**, the generated PDF carries a watermark, and the client's signature is left as a blank line. To get the clean final version, set the status to Finalized first, then generate again.`,
  },
  {
    id: "wills-upload-revised-pdf",
    title: "Uploading a revised or custom will PDF",
    roles: ["admin", "account_manager"],
    content: `Use this after editing the Word draft, or to replace the draft with your own PDF.

1. Open the will (\`/admin/wills\` → **View Details**).
2. Either:
   - In **Quick Actions**, click **Upload revised PDF**, or
   - On the **Draft PDF** tab, click **Upload New** (or **Upload PDF** if nothing has been uploaded yet).
3. Choose the PDF. Only PDF files are accepted. Export your Word document to PDF first.
4. Wait for "PDF uploaded successfully". It becomes the current draft.

Gotcha: if the will is **not Finalized**, a faint diagonal **JUST WILLS** watermark is added to every page automatically. To upload a clean, unwatermarked final document, set the status to **Finalized** first, then upload.`,
  },
  {
    id: "wills-watermark",
    title: "Why does the will PDF have a JUST WILLS watermark?",
    roles: ["admin", "account_manager"],
    content: `Any will PDF produced **before the will is Finalized** is watermarked so a draft can't be mistaken for the final document. This covers PDFs that are:
- Uploaded with **Upload PDF / Upload New / Upload revised PDF**
- Generated with **Generate Draft**
- Created from the print page's **Upload PDF** button

The watermark is a faint, diagonal gold **JUST WILLS** on every page.

To get a clean copy:
1. Change the status to **Finalized** in **Quick Actions** (a draft PDF must already exist).
2. Then upload the final PDF again, or (admins) click **Generate Draft** again.

If you see the warning "Watermark could not be added, uploading original PDF", the file went up **without** a watermark. Check it before sending.`,
  },
  {
    id: "wills-release-draft",
    title: "How do I release a draft to the client?",
    roles: ["admin", "account_manager"],
    content: `1. Make sure a draft PDF exists (generate or upload it). The **PDF** column shouldn't say Not Generated.
2. Have the draft checked, then set the status to **Draft Ready** in **Quick Actions**. This records the reviewer and time, shown as **Reviewed** in Quick Actions.
3. Set the status to **Draft Released**. The draft is marked visible to the client, and the release time is recorded.

You can't skip step 2. Releasing straight from Under Review fails with "must be reviewed and marked 'Draft Ready' first".

Important: the client portal is currently **switched off**, so clients can't log in to see or approve a released draft in the app. Share the draft with the client through your usual channel until the portal goes live.`,
  },
  {
    id: "wills-client-feedback",
    title: "Handling a client's approval or requested changes",
    roles: ["admin", "account_manager"],
    content: `Once a client responds to a released draft:

- **All Wills** shows an **Approved** or **Changes Req.** badge next to the status.
- The **Admin Dashboard** header shows a "changes | approved" counter. Click it to open All Wills filtered to client reviews (\`/admin/wills?filter=client_review\`). Use **Clear Review Filter** to go back.

On the will page, the client review card shows their decision and date.
- **Changes requested**: click **View Change Request Details** to see the **Subject**, **Message** and any **Attached Image**. Then click **Move to Under Review**, revise the draft, upload the new PDF and release again (Draft Ready → Draft Released).
- **Approved**: check the draft, then set the status to **Finalized**.

Moving away from Draft Released clears the client's previous response.

Note: with the client portal currently off, clients can't submit these responses in the app yet.`,
  },
  {
    id: "wills-edit-client-details",
    title: "Correcting details on a client's will",
    roles: ["admin", "account_manager"],
    content: `1. Open the will (\`/admin/wills\` → **View Details**). Stay on the **Overview** tab.
2. Each section has a pencil icon in its header: **Personal Details**, Executors, Trustees, Interim Guardians, Permanent Guardians, Receipt & Disinherit, Beneficiaries, General Beneficiaries, Assets and Special Requests.
3. Click the pencil, make your changes, then click **Save Changes** (or **Cancel**).
4. You'll see "Updated successfully".

Changes don't update an existing PDF. Generate or upload a new draft afterwards so the document matches.

In the Receipt & Disinherit area, the **Include Signature in PDF** switch controls whether the client's signature appears in the generated will.`,
  },
  {
    id: "wills-notify-executors",
    title: "Emailing executors, trustees or guardians about their role",
    roles: ["admin", "account_manager"],
    content: `1. Open the will (\`/admin/wills\` → **View Details**), **Overview** tab.
2. Scroll to the **Executors**, **Trustees**, **Interim Guardians**, **Permanent Guardians** or beneficiaries section.
3. If the client gave permission, you'll see a "Permission Granted to Contact" note and a **Send Notification Emails** button. Click it. It shows "Sending..." while it works.

If the client didn't give permission, the section says "No Permission to Contact" and there's no button. Don't contact those people.

Each section sends separately, so click the button in every section you want notified.`,
  },
  {
    id: "wills-client-uploads",
    title: "Viewing documents a client uploaded with their will",
    roles: ["admin", "account_manager"],
    content: `1. Open the will (\`/admin/wills\` → **View Details**).
2. Click the **Uploads** tab.
3. Each file shows its name and upload date. Click **View** to open it, or the download button to save it.

If you see "No uploads yet – Client hasn't uploaded any documents", nothing was attached to this will.

To manage a client's identity documents (Passport, Visa, Emirates ID) separately, admins can use **View Docs / Add Docs** on the Admin Dashboard.`,
  },
  {
    id: "wills-activity-notes",
    title: "Adding an activity note and seeing a will's history",
    roles: ["admin", "account_manager"],
    content: `1. Open the will (\`/admin/wills\` → **View Details**) and click the **Activity** tab.
2. The status history lists every status change: from → to, who made it and when, plus any notes.
3. Under **Add Activity Note**, type in the **Note** box and click **Add Note**.

Notes are for internal record keeping, such as a call with the client or what was changed in a revision.

The **Timestamps** card on the left also shows when the will was Created and Submitted, and when its PDF was generated.`,
  },
  {
    id: "wills-assign-account-manager",
    title: "Assigning or changing a will's account manager",
    roles: ["admin"],
    content: `1. Open the will from **All Wills** (\`/admin/wills\`) → **View Details**.
2. In the **Client** card on the left, find **Account Manager**.
3. Pick a person from the dropdown, or **Unassigned** to remove them. You'll see "Account manager updated".

Effects:
- The case appears in that person's **My Cases** list. Account managers only see wills assigned to them.
- Client support and edit requests for this will go to the selected account manager.

Only admins can change this. Account managers see the name but no dropdown. The **Account Manager** column in All Wills shows who has each case, or "Unassigned".`,
  },
  {
    id: "wills-print-version",
    title: "Using the will's print version (Generate PDF button)",
    roles: ["admin", "account_manager"],
    content: `1. Open the will (\`/admin/wills\` → **View Details**).
2. In **Quick Actions**, click **Generate PDF**. This opens the print version (\`/admin/wills/[id]/print\`).
3. Choose:
   - **Upload PDF**: builds a PDF from this page in your browser and saves it as the will's draft. It's watermarked unless the will is Finalized.
   - **Print Only**: opens your browser's print dialog. To save a clean copy, choose "Save as PDF" and untick **Headers and footers** in More settings.
4. **Back to Will Details** returns you to the will.

For the official template wording, admins should use **Generate Draft from Template** instead.`,
  },
  {
    id: "wills-reports",
    title: "Will statistics and exporting all wills to CSV",
    roles: ["admin"],
    content: `Go to \`/admin/wills/reports\`. It isn't in the sidebar, so type the address or bookmark it.

The **Reports & Analytics** page shows:
- **Overview**: Wills This Month, Total Wills, Finalized Wills, Avg. Processing Time (days).
- **Insights**: Monthly Submissions (submitted vs finalized), Wills by Status, and Client Approvals (Approved / Changes Requested / Pending Review).
- **Data Exports**: **Export Wills** downloads a CSV of every submitted will with client name, status and key dates.

Only submitted wills are counted.`,
  },

  // ---------------------------------------------------------------------------
  // ADMIN DASHBOARD
  // ---------------------------------------------------------------------------
  {
    id: "admin-dashboard-overview",
    title: "What's on the Admin Dashboard",
    roles: ["admin"],
    content: `Click **Dashboard** in the sidebar while the **Wills** dashboard is selected in the role switcher (\`/admin\`).

You'll see:
1. **Summary cards**: Total Users (registered clients), Total Wills, Drafts Generated and Finalized Wills.
2. A **client review counter** in the header ("X changes | Y Approved") when clients have responded. Click it to see those wills.
3. A **Users** table of clients only (staff are hidden), with **Search clients by name or email…**. Columns show each client's wills count, created date, review status and Active/Deactivated status. **View All Wills** opens the full list.
4. A **Recent Activity** feed of the latest status changes and who made them.

The "..." menu on a client row has **View Wills** and **View Docs** / **Add Docs**.`,
  },
  {
    id: "admin-client-identity-documents",
    title: "Uploading or checking a client's passport, visa or Emirates ID",
    roles: ["admin"],
    content: `1. Go to the **Admin Dashboard** (\`/admin\`).
2. Find the client in the **Users** table (use the search box).
3. Open the row's "..." menu and click **View Docs**. It says **Add Docs** if nothing has been uploaded.
4. In **Manage Identity Documents**, choose **Passport**, **Visa** or **Emirates ID** and upload the file.
5. The system tries to read the passport number, or the Emirates ID number and name, automatically. If it can't, you'll see "Could Not Extract". Type the number in yourself and save it.

You can also view or delete an uploaded document. Deleting is permanent.`,
  },

  // ---------------------------------------------------------------------------
  // USER MANAGEMENT (superadmin)
  // ---------------------------------------------------------------------------
  {
    id: "users-create-staff",
    title: "How do I add a new staff member?",
    roles: ["superadmin"],
    content: `1. Click **Manage Users** in the sidebar (\`/admin/manage-users\`).
2. Click **Create User**.
3. Enter **Full Name** and **Email Address** (both required).
4. Under **User Roles**, click to select one or more roles. **Client is selected by default**, so click it to deselect it when creating staff. At least one role must stay selected.
5. For HR, Finance, Managing Director or Administrator, choose a **Permission Level**: **Head** (full access) or **Employee** (critical actions restricted). The default is Head.
6. Click **Create User**.

A welcome email with login details is sent automatically. The next screen shows the email and **Temporary Password**. Use **Copy Credentials** if the email failed ("Email Not Sent"), then send them yourself. The password won't be shown again after you close the screen.`,
  },
  {
    id: "users-roles-explained",
    title: "Which role to give a staff member",
    roles: ["superadmin"],
    content: `Role names in **Create User** (\`/admin/manage-users\`) and what each person sees:

- **Administrator**: the Wills dashboard: Admin Dashboard, All Wills, will details.
- **HR**: the HR dashboard (employees, leave, attendance, KPIs).
- **Finance**: the Finance dashboard (transactions, invoices, digest settings).
- **Managing Director**: lead management (leads, sources, intake QR codes).
- **Executive Assistant**: their own assigned leads and calendar.
- **Account Manager**: **My Cases**, meaning only wills assigned to them.
- **Client**: a client account. Leave this unticked for staff.

A person can hold several roles and switch between dashboards with the role switcher at the top of the sidebar.

Gotchas:
- **Roles can't be edited after the account is created**. There's no edit option, so choose carefully.
- Finance **invoice access** (finance head) is a separate setting from the Head permission level. Ask the system administrator if a finance user needs the Invoices tab.`,
  },
  {
    id: "users-deactivate-reactivate",
    title: "Deactivating or reactivating a staff account",
    roles: ["superadmin"],
    content: `1. Go to **Manage Users** (\`/admin/manage-users\`).
2. Find the person with **Search by name or email...**.
3. Click the actions menu at the end of their row.
4. Choose **Deactivate** (red) or **Activate** (green).

What happens:
- **Deactivate** blocks the person from logging in straight away. Their status badge changes to **Inactive**. Nothing is deleted: their records, entries and history stay.
- **Activate** restores their login with the same roles.

Deactivating is the safe choice when someone leaves. Use **Delete** only when you really want the account gone.`,
  },
  {
    id: "users-delete",
    title: "Deleting a user account",
    roles: ["superadmin"],
    content: `1. Go to **Manage Users** (\`/admin/manage-users\`) and find the person.
2. Open the actions menu on their row and click **Delete**.
3. Confirm in the **Delete User** dialog. This **can't be undone**, and all of the user's data, including wills and documents, is permanently deleted.

Gotcha: deletion is often **blocked** for staff who have records tied to them. Examples are finance transactions they logged, leave requests they approved, attendance they marked, KPI evaluations, or documents they uploaded. The error message lists exactly what's blocking it ("Cannot delete ... they still have associated records...").

In that case, **Deactivate** the account instead. It stops them logging in and keeps the history intact.`,
  },

  // ---------------------------------------------------------------------------
  // CLIENT PORTAL
  // ---------------------------------------------------------------------------
  {
    id: "client-portal-switched-off",
    title: "Can clients log in to the client portal?",
    roles: [ALL_STAFF],
    content: `**Not yet.** The client portal is currently **switched off** for launch.

What this means for staff:
- When a client pays, they still get their payment confirmation, but **no portal account is created** and no login details are emailed.
- Clients can't log in to view, approve or sign a released draft, raise edit requests or upload documents themselves. Handle these with the client directly, and record outcomes in the CRM (for example an activity note on the will).
- Statuses like **Draft Released** still work for internal tracking.

The portal is turned on by a system setting, not from any screen in the CRM. When it goes live, clients who have paid their upfront fee will be given accounts. Ask management or the system administrator if you need to know when.`,
  },
];
