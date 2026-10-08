import type { KnowledgeSection } from "./types";

// Lead management and sales: pipeline, communications, reminders, calendar,
// proposals, invoices, payments, sources, QR codes, settings and reports.
// Role tags follow the sidebar in src/config/dashboards.ts plus the in-page
// checks (head-only deletes, settings write roles, deal ownership rule).

export const leadsSections: KnowledgeSection[] = [
  {
    id: "leads-open-list",
    title: "Finding the leads list",
    roles: ["lead_management", "salesperson"],
    content: `1. In the left sidebar click **Leads** (Lead Management) or **My Leads** (Salesperson). Both open the same page, \`/admin/lead-management/leads\`.
2. The page is titled **Leads** and shows a count badge (e.g. "24 Leads") at the top right.
3. Each row shows Name, Email, Phone, Source, Assigned To, Created, Status, Health, Reminder, Proposal and Actions.

If you hold more than one role, use the role switcher in the sidebar to switch into Lead Management or Salesperson first, otherwise the Leads menu item will not appear.`,
  },
  {
    id: "leads-statuses",
    title: "What the lead statuses mean (and which ones change automatically)",
    roles: ["lead_management", "salesperson"],
    content: `Statuses: **Not Started, Contacted, Consultation, Consultation Completed, Meeting, On Hold, Qualified, Negotiation, Pending, Drafting, Won, Lost, Unreachable**.

Some move on their own:
- **Contacted**: set when the first communication is logged on a Not Started lead (if the "Auto-update status on first contact" rule is on).
- **Pending**: set when you send a proposal.
- **Unreachable**: set after the configured number of failed call attempts (3 by default).
- **Drafting**: set when the client has paid the "Due upfront" part of a staged invoice. Work can start; the rest is still owed.
- **Won**: set when the invoice is fully paid.

A payment never moves a lead out of Won, Lost or On Hold. You can always change a status by hand.`,
  },
  {
    id: "leads-change-status",
    title: "Changing a lead's status",
    roles: ["lead_management", "salesperson"],
    content: `**From the table:**
1. Go to **Leads** / **My Leads**.
2. In the **Status** column click the status button on the lead's row.
3. Pick the new status from the list at the top of the menu. A "Status updated" message confirms it.

**From the Kanban board:** switch to **Kanban** (top right) and drag the card into another column.

**From Edit Lead:** click the pencil icon in Actions, change **Status**, then **Save Changes**.

Status changes send the "Status Changes" notification to the lead's owner, and moving to Won can also alert the lead-management team if that automation rule is on.`,
  },
  {
    id: "leads-search-filter",
    title: "Searching and filtering leads",
    roles: ["lead_management", "salesperson"],
    content: `On the **Leads** page, above the table:
1. **Search leads...** matches name, email, phone or company. Results update a moment after you stop typing.
2. **Filter by status**: choose **All Statuses**, **Active Pipeline** (everything except Won and Lost) or a single status.
3. **Date range**: pick a range or a preset (today, this week, month and so on) to filter by created date.
4. **Payment**: All, Paid, Part paid or Unpaid.
5. Click **Clear** to reset the filters.

Click a column heading (Name, Email, Source, Assigned To, Created, Status) to sort. Use **Rows per page** at the bottom to show more rows.`,
  },
  {
    id: "leads-kanban-view",
    title: "Switching between table and Kanban (pipeline board) view",
    roles: ["lead_management", "salesperson"],
    content: `1. On the **Leads** page use the toggle at the top right: **Table** or **Kanban**.
2. Kanban shows one column per status, from Not Started through Drafting, Won, Lost and Unreachable.
3. Drag a card to another column to change its status.
4. Each card's menu offers **View Details, Edit, View History, Send Proposal, View Proposals** and **Set Reminder**.

Your choice is remembered in this browser next time you open the page.`,
  },
  {
    id: "leads-create",
    title: "Adding a new lead",
    roles: ["lead_management", "salesperson"],
    content: `1. On the **Leads** page click **Create Lead** (green button, top right of the filters). You can also press **Ctrl+N**, or use the floating Quick Actions button.
2. Fill in **Full Name**, **Lead Type** (Individual or Corporate), **Email**, **Phone**, **Company** (optional), **Source** and **Notes**.
3. Click **Create Lead**.

What happens next:
- The client is automatically emailed a "Thank You for Your Enquiry" confirmation, so check the email address first.
- The lead is assigned automatically according to the Team settings (by source, round robin, or not at all if set to manual).
- The assigned salesperson gets a **"Call new lead within 15 minutes"** reminder.

If the Source list says "No sources available", a lead-management user must create a source first.`,
  },
  {
    id: "leads-edit",
    title: "Editing a lead's details",
    roles: ["lead_management", "salesperson"],
    content: `1. Go to **Leads** / **My Leads**.
2. In the **Actions** column click the pencil icon (**Edit Lead**). In Kanban, use the card menu and choose **Edit**.
3. Update Full Name, Email, Phone, Company, Lead Type, Source, Status or Notes.
4. Click **Save Changes**.

Tip: you can also correct the client's name, email or phone inside the **Send Proposal** dialog by clicking **Edit** next to Client Information. This updates the lead too.`,
  },
  {
    id: "leads-assign",
    title: "Assigning or reassigning a lead to a salesperson",
    roles: ["lead_management"],
    content: `1. Go to **Leads** and click the pencil icon (**Edit Lead**) on the lead.
2. In **Assigned To** choose the salesperson. The current one is marked "(current)". Any salesperson can be picked, whatever the lead's source.
3. Click **Save Changes**.

What happens:
- The newly assigned salesperson is notified by email (subject to notification settings and working hours).
- They automatically get a **"Call new lead within 15 minutes"** reminder.
- The main assignee owns the lead's reminders, receives the client's acceptance email, and is the name client emails go out under.

New leads are usually assigned automatically. See "How new leads are assigned automatically".`,
  },
  {
    id: "leads-co-assign",
    title: "Adding a second salesperson (co-assignee) to a lead",
    roles: ["lead_management"],
    content: `1. Open **Edit Lead** (pencil icon on the lead's row).
2. Below **Assigned To** you'll see **Additional Assignees**. Tick each extra salesperson who should work the lead.
3. Click **Save Changes**. Newly added people are emailed.

Gotcha: the person in **Assigned To** stays the main owner. A salesperson who is only a co-assignee **cannot send proposals, invoices or record payments** on that lead. The system refuses with "This lead is not assigned to you". Make them the main assignee if they need to close the deal.`,
  },
  {
    id: "leads-delete",
    title: "Deleting a lead",
    roles: ["lead_management"],
    content: `1. Go to **Leads**.
2. In the **Actions** column (Table view) click the red bin icon (**Delete Lead**).
3. Confirm in the "Are you sure?" box. This cannot be undone.

Only the **head** of Lead Management (or a superadmin) sees the delete button. Lead-management team members at employee level and salespeople do not. If you just want the lead out of the active pipeline, set its status to **Lost** instead.`,
  },
  {
    id: "leads-export",
    title: "Exporting leads to CSV or Excel",
    roles: ["lead_management", "salesperson"],
    content: `1. On the **Leads** page (Table view) click **Export** at the right, above the table.
2. Optional: tick the checkboxes on specific rows first. The button then shows the count, e.g. "Export (3)".
3. In **Export Leads** choose **What to export** (All leads or Selected leads), the **Format** (CSV or Excel) and the **Fields** (Select All / Default).
4. Click **Export**. The file downloads as leads_<date>.

The export uses the leads currently loaded, so set your search and filters first.`,
  },
  {
    id: "lead-detail-page",
    title: "Opening a lead's full history (lead detail page)",
    roles: ["lead_management", "salesperson"],
    content: `1. On the **Leads** page click the clock icon (**View History**) in the Actions column. In Kanban use **View Details** or **View History**.
2. The detail page (\`/admin/lead-management/leads/<lead>\`) shows the lead's name, status and Paid / Part paid badge.
3. Buttons at the top: **Add Communication**, **Meeting Invite**, **Set Reminder**, **Generate Invoice**.
4. **Lead Details** shows email, phone, company, source, assigned salesperson and notes.
5. **Activity Timeline** lists everything in order: created, assigned, communications, proposal sent, invoice sent and payments received.
6. **Notes** at the bottom is a free-text box that saves automatically.`,
  },
  {
    id: "lead-notes",
    title: "Adding notes to a lead",
    roles: ["lead_management", "salesperson"],
    content: `1. Open the lead's detail page (clock icon **View History** on the Leads list).
2. Scroll to **Notes** and type in "Add notes about this lead...".
3. It saves automatically a moment after you stop typing. You'll see "Saving..." and then "Last edited". "Unsaved changes" means it hasn't saved yet.

You can also edit the Notes field in **Edit Lead**. To record a call or email with the client, use **Add Communication** instead so it appears on the timeline and calendar.`,
  },
  {
    id: "comms-log",
    title: "Logging a call, email or other communication with a lead",
    roles: ["lead_management", "salesperson"],
    content: `**From the Leads list:**
1. Click the lead's status button in the **Status** column.
2. Under **Communication**, pick the method (e.g. phone, email, message, video, in-person).

**From the lead page:** click **Add Communication** and choose the **Communication Method**.

Then:
3. For a phone call choose the **Call Outcome**: Answered, No Answer, Voicemail, Busy or Wrong Number (required).
4. Set **Date & Time** and add **Notes**.
5. Save. You'll see "Communication logged successfully".

Logging a communication is an internal record only. It does **not** email the client. To actually invite the client, use **Meeting Invite**.`,
  },
  {
    id: "comms-call-attempts",
    title: "Failed call attempts, automatic retry reminders and Unreachable",
    roles: ["lead_management", "salesperson"],
    content: `When you log a phone call with a failed outcome (No Answer, Voicemail, Busy, and Wrong Number by default):
1. The attempt is counted.
2. A reminder **"Retry call - Attempt X of 3"** is created for the lead's owner, due **2 hours** later.
3. When the failed attempts reach the maximum (3 by default), the lead is moved to **Unreachable** automatically and you'll see "Lead marked as unreachable after 3 failed contact attempts". No retry reminder is made for the last attempt.

An **Answered** call resets the count.

The maximum attempts, which outcomes count as failed, and whether to auto-mark Unreachable are set by Lead Management under **Settings > Automation > Contact Cadence**.`,
  },
  {
    id: "reminders-set",
    title: "Setting a reminder to follow up with a lead",
    roles: ["lead_management", "salesperson"],
    content: `1. On the **Leads** list click **Set Reminder** (gold bell button in the Reminder column). Or use **Set Reminder** on the lead's detail page or Kanban card.
2. Enter a **Title** (defaults to "Follow up with <name>"), pick the **Date** and **Time**, and add **Notes** if you like.
3. The dialog shows "Fires in ..." so you can check the timing. A time in the past is blocked.
4. Click **Set Reminder**.

The reminder belongs to **you**, whoever the lead is assigned to. When it falls due it shows in your reminders bell (salesperson view), on your sales calendar, and you get a reminder email during working hours.`,
  },
  {
    id: "reminders-bell",
    title: "Seeing, completing or dismissing your reminders",
    roles: ["salesperson"],
    content: `1. While in the **Salesperson** role, click the bell icon next to your name in the sidebar. The red number counts due reminders plus unread lead notifications. It refreshes every 30 seconds.
2. The **Reminders** panel has **Active** and **Completed** tabs. Reminders are grouped as Overdue, Today and Upcoming.
3. On a reminder choose **Mark as Done**, **Dismiss** or **Delete**.

Your reminders also appear as gold chips on **Calendar**. Click a chip to see details and **View Lead**.

The bell only shows in the Salesperson view. If you're in another role, use the role switcher.`,
  },
  {
    id: "reminders-new-lead-15min",
    title: "The automatic \"Call new lead within 15 minutes\" reminder",
    roles: ["lead_management", "salesperson"],
    content: `Whenever a lead is assigned (a new lead, or a reassignment to someone else), the system automatically creates a reminder for the **newly assigned salesperson** titled **"Call new lead within 15 minutes"**, due 15 minutes later.

- It appears in their reminders bell and on their Calendar.
- They get the reminder email when it falls due, but only inside working hours (9am to 6pm Dubai by default). Outside those hours the email waits until the next working-hours start.
- To clear it, log the call (**Add Communication**) and then **Mark as Done** in the reminders panel.

Adding co-assignees does not create this reminder for them. Only the main assignee gets it.`,
  },
  {
    id: "reminders-stale-leads",
    title: "Automatic follow-up reminders for stale (quiet) leads",
    roles: ["lead_management", "salesperson"],
    content: `Once a day (early morning, Dubai time) the system looks for open, assigned leads with no logged communication for **7 days** (or since creation if nothing was ever logged). It creates a follow-up reminder for the lead's owner.

- Won, Lost and Unreachable leads are skipped, and so are unassigned leads.
- A lead that already has an open reminder is skipped, so you get one reminder, not one every day.
- The **Health** column also flags these leads: Hot, Warm, Stale (7+ days without contact) and Cold (14+ days).

Lead Management can change the number of days or switch the rule off under **Settings > Automation** ("Auto-create reminder for stale leads").`,
  },
  {
    id: "reminders-email-timing",
    title: "Why didn't my reminder email arrive yet?",
    roles: ["lead_management", "salesperson"],
    content: `Reminder emails follow these rules:
1. **Working hours only.** Emails go out only inside team working hours, 9:00 to 18:00 **Dubai time** by default (Settings > Team). A reminder due at 8pm is emailed at the next working-hours start. The in-app bell still shows it on time.
2. **Checked every few minutes**, not to the second, so allow up to about 5 minutes.
3. **Notification settings** (Settings > Notifications, org-wide): if **Reminders Due** is off, no reminder emails are sent at all. If frequency is **Daily Digest** or **Weekly Digest**, reminders are bundled into the digest (around 8am Dubai; weekly on Mondays) instead of sent one by one.
4. The email goes to whoever **owns the reminder**, meaning the person who set it, or the lead's assignee for automatic ones.

Also check your Junk folder.`,
  },
  {
    id: "calendar-view",
    title: "Using your sales calendar",
    roles: ["salesperson"],
    content: `1. In the sidebar click **Calendar** (\`/admin/salesperson/calendar\`).
2. Switch between **Month** and **Week**, use the arrows to move, and **Today** to jump back.
3. Summary cards show **Upcoming Today**, **This Week**, **Next 7 Days** and **Overdue**.
4. The calendar shows two kinds of item:
   - **Communications and meetings** logged on leads assigned to you, colour-coded by type (Phone Calls, Emails, Messages, Video, In-Person).
   - **Calls / reminders** as gold chips. These are your own reminders, including retry calls, the 15-minute new-lead call and stale-lead follow-ups. Finished ones are faded and crossed out.
5. Click a day's items to see details, the lead's phone and email, and **View Lead**. Reminder statuses read Upcoming, Due or Done.`,
  },
  {
    id: "calendar-schedule-call",
    title: "Scheduling a call or reminder from the calendar",
    roles: ["salesperson"],
    content: `1. Open **Calendar** in the sidebar.
2. Hover a day and click the **+** button on it.
3. In **Add to Calendar** choose **Schedule call / reminder**. (The other option, **Send Meeting Invite**, emails the client an invite.)
4. Search for and pick the lead from your leads.
5. The **Set Reminder** dialog opens. Enter the title, date, time and notes, then click **Set Reminder**.

The reminder appears as a gold chip on that day and in your reminders bell. You get an email when it falls due (during working hours).`,
  },
  {
    id: "meeting-invite",
    title: "Sending a meeting invite to a client",
    roles: ["lead_management", "salesperson"],
    content: `Where to start:
- **Leads list:** the calendar-plus icon in Actions, or **Meeting Invite** in the Status button's menu.
- **Lead page:** the **Meeting Invite** button.
- **Calendar** (salespeople): **+** on a day, then **Send Meeting Invite**.

Then:
1. Check the **Recipient** (or **Select Lead** if you started from the calendar).
2. Enter the **Meeting Title**, **Date**, **Time** (15-minute steps) and **Duration** (30 minutes to 2 hours).
3. Add **Location** and **Description / Agenda** if needed.
4. Click **Send Invite**.

The client gets an email with an .ics calendar file plus Google and Outlook links. The meeting is logged on the lead's timeline and calendar. The button is greyed out if the lead has no email address. Times in the past are blocked.`,
  },
  {
    id: "proposal-send",
    title: "Creating and sending a proposal",
    roles: ["lead_management", "salesperson"],
    content: `1. On the **Leads** list click **Proposal** on the lead's row, then **Send Proposal**.
2. Check **Client Information**. Click **Edit** to correct the name, email or phone (this updates the lead too).
3. Under **Estimated Charges** enter the fee lines, quantities and amounts, and tick **Due upfront** where needed.
4. Tick the **Registration court** option(s) and type each fee.
5. Set **VAT %** if it differs from the default.
6. Review the **Proposal Agreement** wording.
7. Click **Preview** to see the client's PDF, or **Save Draft** to finish later.
8. Click **Send Proposal**.

The client is emailed the proposal PDF with an **Accept Proposal** button, and the lead moves to **Pending**. A salesperson can only send for leads where they are the main assignee.`,
  },
  {
    id: "proposal-line-items",
    title: "Adding line items, quantities (x1/x2) and notarization fees",
    roles: ["lead_management", "salesperson"],
    content: `In **Send Proposal** (and **Send Invoice** / **Generate Invoice**), each charge row has:
1. A **Description** (e.g. Will Drafting (UAE), POA, MOFA & MOJ).
2. A small **quantity** box. It is printed in the COST column as x1, x2 and so on. Use 2 for, say, mirror wills for a couple.
3. The **amount** in AED.
4. A **Due upfront** tick (see "Taking part of the fee upfront").

Buttons below: **Add item** adds a blank row. **Add notarization fee** adds the standard notarization line as a normal priced item. Use the bin icon to remove a row (at least one must remain).

A totals line shows Subtotal, VAT and Total so you can check the figures before sending.`,
  },
  {
    id: "proposal-vat",
    title: "Changing the VAT rate on a proposal or invoice",
    roles: ["lead_management", "salesperson"],
    content: `VAT is set per proposal or invoice, so zero-rated matters are possible.
1. In **Send Proposal** find **VAT %** below the charges. In **Send Invoice** or **Generate Invoice** it is the **VAT %** field.
2. It starts at the company default. Type a different rate (e.g. 0), or leave it blank on a proposal to use the default.
3. The totals line, preview, PDF and payment link all use this rate, so what the client pays always matches the document.`,
  },
  {
    id: "proposal-due-upfront",
    title: "Taking part of the fee upfront (staged / part payments)",
    roles: ["lead_management", "salesperson"],
    content: `Use this when the client should pay, for example, the drafting fee before work starts and the court fees later.
1. In **Send Proposal** (or **Send Invoice**), tick **Due upfront (payable before work starts)** on each row the client must pay first, usually the drafting fee.
2. Leave court or notarization rows unticked.
3. Below the rows you'll see "Payable now AED X · At court stage AED Y" (VAT included).

How it works:
- The client **never types an amount**. The payment link charges the upfront part first, then the remainder the next time it is used.
- When the upfront part is paid, the lead moves to **Drafting** and the client is emailed that work is starting. When everything is paid, the lead moves to **Won**.
- The invoice shows "Payment required now incl VAT" and "Remaining balance amount". These boxes keep the agreed figures even after payment.
- If nothing is ticked, the full amount is due at once.`,
  },
  {
    id: "proposal-registration-court",
    title: "Offering registration court options (Abu Dhabi, Dubai, DIFC)",
    roles: ["lead_management", "salesperson"],
    content: `1. In **Send Proposal**, find **Registration court (government fee)**.
2. Tick **Abu Dhabi**, **Dubai** and/or **DIFC**. For each one ticked, type a description, quantity and fee. There are no default fees, and every ticked court needs a fee above zero.
3. **One court ticked:** it is charged as a normal line.
   **Two or three ticked:** the client sees them as alternatives and chooses one on the accept page. They are not added together. The summary shows the total for each choice.
4. Send the proposal.

Rules:
- The client's choice is **locked once they accept**. They must contact the team to change it, and only staff can change it (see "Changing the client's registration court").
- DIFC is a payment option only. The team does not draft DIFC wills.
- The wording's court step names the chosen court automatically ("the relevant court" until one is chosen).`,
  },
  {
    id: "proposal-wording",
    title: "Editing the proposal wording before sending",
    roles: ["lead_management", "salesperson"],
    content: `1. In **Send Proposal**, scroll to **Proposal Agreement**. It is pre-filled with the standard UAE Will proposal wording.
2. Edit the text for this client as needed. Changes apply to this proposal only, not to the standard template.
3. Keep the **{{FEE_TABLE}}** placeholder. That is where the fee table is drawn in the PDF and email. You can move it to reposition the table, but the figures always come from the charges you entered.
4. **{{COURT}}** is replaced with the chosen court automatically.
5. Click **Preview** to check how it reads.

"Editing existing proposal" means you are changing a proposal already saved or sent to this lead.

The covering email text is a separate template, edited by Lead Management under **Settings > Email Templates > Proposal Email**.`,
  },
  {
    id: "proposal-resend-changed-terms",
    title: "Re-sending a proposal after changing the terms",
    roles: ["lead_management", "salesperson"],
    content: `1. On the **Leads** list click **Proposal > Send Proposal** again. It opens the lead's current proposal ("Editing existing proposal").
2. Change the amounts, items, Due upfront ticks, courts or wording.
3. Click **Send Proposal**.

What happens if the terms changed:
- Any earlier **acceptance is cleared**, so the client must accept again.
- An invoice that was already raised is **voided** if nothing has been paid on it. Old payment links stop working and show "This invoice is no longer active". Send a fresh invoice afterwards.
- If any payment has already been received, the invoice is kept.

Re-sending with no changes keeps the acceptance. A fully paid or cancelled deal is never reused. Sending again starts a new proposal.`,
  },
  {
    id: "proposal-check-accepted",
    title: "Checking whether the client accepted the proposal",
    roles: ["lead_management", "salesperson"],
    content: `The client accepts by clicking **Accept Proposal** in the email or PDF, then confirming on the Just Wills page (choosing a registration court if several were offered).

To check:
1. On the **Leads** list click **Proposal > View** on the lead.
2. In **Proposals for <name>**, an accepted proposal shows a green **Accepted** badge and an "Accepted: <date>" line. If courts were offered, the **Registration court** shows the client's choice or "Awaiting the client's choice".

The lead's main assignee is also emailed when the client accepts, as a cue to send the invoice. Acceptance does **not** raise the invoice automatically, and the leads list itself does not show an Accepted badge.`,
  },
  {
    id: "proposal-change-court",
    title: "Changing the client's registration court",
    roles: ["lead_management", "salesperson"],
    content: `Clients cannot change their court after accepting. They must contact you.
1. On the **Leads** list click **Proposal > View**.
2. On the proposal card find **Registration court**. It only appears when two or more courts were offered.
3. Choose the court in **Select a court** and click **Save**. You'll see "Registration court updated".

This is also how to record a court the client gave you by phone.

Locked cases:
- If the invoice has already been raised, change the court fee in **Send Invoice** instead.
- If the proposal is paid or cancelled, the court can no longer be changed.`,
  },
  {
    id: "invoice-send",
    title: "Sending an invoice with a payment link",
    roles: ["lead_management", "salesperson"],
    content: `1. On the **Leads** list click **Proposal > Send Invoice** (or **Generate Invoice** on the lead's page).
2. The items, Due upfront ticks and VAT are pre-filled from the proposal. Check them.
3. If the client hasn't chosen a registration court, you'll be asked to pick one to add its fee.
4. Adjust **VAT %**, and optionally add an **Invoice Description** (leave blank for the default).
5. Use **Preview Invoice** to check, then send. In Generate Invoice, keep **Email this invoice to the client** ticked to email it.

The client gets the invoice PDF with a payment link, due in 7 days. Sending an invoice does not change the lead's status. If the email fails you'll see "Invoice created, but the email could not be sent". The invoice still exists, so fix the address and resend.`,
  },
  {
    id: "invoice-payment-link",
    title: "Getting the payment link or asking the client for the next payment",
    roles: ["lead_management", "salesperson"],
    content: `1. On the **Leads** list click **Proposal > View**.
2. On an unpaid invoice:
   - **Payment Link** opens the client's payment page. Copy its address to share by WhatsApp or email.
   - **Request AED X** emails the client a request for whatever is payable right now: the upfront part on a staged invoice, otherwise the balance.

The link always charges what is currently due. After a part payment, the same link collects the remainder, and the client never chooses an amount.

Use **Request** for the second instalment rather than asking the client to find the original email.

Automatic chaser: if an invoice is still unpaid 6 hours after it was sent, the client receives one "Complete Payment" follow-up email.`,
  },
  {
    id: "payments-record-manual",
    title: "Recording a bank transfer, cash or other manual payment",
    roles: ["lead_management", "salesperson"],
    content: `1. On the **Leads** list click **Proposal > View**.
2. On the invoice card click **Record Payment**. The amount is pre-filled with what is due now: the upfront part on a staged invoice, otherwise the balance.
3. Adjust the amount if needed, choose the method (**Bank Transfer**, **Stripe / Card**, **Cash** or **Other**) and add notes (optional).
4. Click **Save**. You'll see "Payment recorded".

This works exactly like an online card payment:
- Upfront part covered: the lead moves to **Drafting** and the client is emailed that payment is received and drafting is starting.
- Fully paid: the invoice is marked **Paid** and the lead moves to **Won**.

Record Payment only appears once an invoice has been raised.`,
  },
  {
    id: "payments-check-balance",
    title: "Checking what a client has paid and what's outstanding",
    roles: ["lead_management", "salesperson"],
    content: `- **Leads list:** a yellow **Part paid** badge (hover to see the outstanding amount) or a green **Paid** badge shows next to the status. Use the **Payment** filter to list Paid, Part paid or Unpaid leads.
- **Lead page:** the same badge appears next to the lead's name, and payments appear on the Activity Timeline.
- **Proposal > View:** each invoice shows "AED X of AED Y paid", "AED Z outstanding" or "Fully paid". Staged invoices also show "Drafting fee ... due now · ... at court stage" or "Drafting fee paid · ... due at court stage", plus a list of each payment with method, notes and date.`,
  },
  {
    id: "pdfs-download",
    title: "Viewing or downloading proposal and invoice PDFs",
    roles: ["lead_management", "salesperson"],
    content: `1. On the **Leads** list click **Proposal > View** for the lead.
2. Each proposal card has two menus:
   - **Proposal**: **View** (on-screen preview) or **Download** (PDF).
   - **Invoice**: **View** or **Download**.
3. The card header shows the reference number, whether it's a Proposal or an Invoice, its status (Draft, Sent, Part paid, Paid, Cancelled) and the Created, Sent, Accepted and Paid dates.

Downloaded PDFs include working Accept and payment links, so you can forward them by hand.`,
  },
  {
    id: "auto-emails-to-clients",
    title: "Which emails clients receive automatically",
    roles: ["lead_management", "salesperson"],
    content: `- **Enquiry confirmation**: sent when staff add a lead with **Create Lead**. Leads from the QR enquiry form do not get one.
- **Proposal**: when you click Send Proposal, with the PDF and an Accept Proposal button.
- **Invoice**: when you send or generate one, with the PDF and payment link.
- **Payment follow-up**: once, about **6 hours** after an invoice was sent, if it's still unpaid. Uses the "Follow-up Email" template.
- **Payment received / drafting starting**: when the upfront part (or the whole invoice) is paid, online or recorded by hand.
- **Meeting invites** and **payment requests**: only when you send them.

Client emails go out under the name of the lead's assigned salesperson. Replies go to that person and the shared info inbox. Logging a communication never emails the client.`,
  },
  {
    id: "sources-manage",
    title: "Managing lead sources and linking salespeople to them",
    roles: ["lead_management"],
    content: `1. In the sidebar click **Sources** (\`/admin/lead-management/sources\`).
2. Click **Create Source**. Enter a **Source Name** (e.g. Website, Referral), a **Description**, and tick salespeople under **Assign Salespeople**.
3. To change one, click **Edit Source** on its row. You can rename it, change salespeople, or untick **Active** (inactive sources can't be picked for new leads).
4. Use **Search sources...**, the status filter and **Export CSV** as needed.

Gotchas:
- Each salesperson can be linked to **only one source**.
- New leads from a source are auto-assigned to its linked salespeople when Team settings use "By Source".
- **Delete Source** is head-only. It permanently removes the source and unlinks its salespeople.`,
  },
  {
    id: "settings-team-assignment",
    title: "How new leads are assigned automatically (Team settings and working hours)",
    roles: ["lead_management"],
    content: `Go to **Settings** (\`/admin/lead-management/settings\`), open the **Team** tab, change the settings, then click **Save Settings**.
- **Default Assignment Method**:
  - **By Source**: goes to the salespeople linked to the lead's source, choosing whoever has the fewest leads. If the source has nobody linked, it goes to the least-loaded salesperson overall.
  - **Round Robin**: always goes to the least-loaded salesperson.
  - **Manual**: nobody is assigned automatically.
- **Auto-assign New Leads**: if off, nothing is assigned automatically, whatever the method.
- **Notify on Assignment**: emails the salesperson when they get a lead.
- **Working Hours** (Start Time / End Time, Dubai time, default 09:00 to 18:00): staff reminder and notification emails are held outside these hours.

Leads from a personal QR code always go to that code's owner. The Automation rule "Auto-assign by source" must also be on for By Source to use the source links.`,
  },
  {
    id: "settings-notifications",
    title: "Changing lead notification settings",
    roles: ["lead_management"],
    content: `1. Go to **Settings** and open the **Notifications** tab.
2. Under **Email Notifications**, toggle **New Lead Assigned**, **Status Changes** and **Reminders Due**.
3. **Notification Frequency**: **Immediate (Real-time)**, **Daily Digest** or **Weekly Digest**. Digests arrive around 8am Dubai time, and the weekly one on Mondays.
4. **Browser Notifications** controls the in-app bell feed only. It does not send desktop push notifications.
5. Click **Save Settings**.

Important: these settings apply to the **whole team**, not just you. Turning off Reminders Due stops reminder emails for every salesperson.`,
  },
  {
    id: "settings-automation",
    title: "Automation rules and contact cadence settings",
    roles: ["lead_management"],
    content: `Go to **Settings**, open the **Automation** tab, then click **Save Settings** after changes.

**Automation Rules** (switch each on or off):
- **Auto-create reminder for stale leads**: follow-up reminder after a set number of days without contact (default 7, set in the days box).
- **Auto-update status on first contact**: Not Started becomes Contacted when a communication is logged.
- **Notify manager on deal won**: emails the lead-management team when a lead becomes Won (off by default).
- **Auto-assign by source**: lets "By Source" assignment use the source's linked salespeople.

**Contact Cadence**:
- **Maximum Contact Attempts** (default 3) before a lead becomes Unreachable.
- **Days Between Attempts**: a recommended gap. Automatic retry reminders are still created 2 hours after a failed call.
- **Auto-mark as unreachable** on or off.
- **Call outcomes counted as failed**: No Answer, Voicemail, Busy, Wrong Number.`,
  },
  {
    id: "settings-email-templates",
    title: "Editing the automatic email templates",
    roles: ["lead_management"],
    content: `1. Go to **Settings** and open the **Email Templates** tab.
2. Pick a template on the left:
   - **Proposal Email**: the covering email sent with a proposal.
   - **Reminder Email**: the email staff receive when a reminder falls due.
   - **Follow-up Email**: the client chaser sent about 6 hours after an unpaid invoice.
   - **Meeting Invitation**: the meeting invite email.
3. Edit the **Subject** and **Body**. Use the **Available Variables** shown (e.g. {{lead_name}}, {{amount}}, {{salesperson_name}}). Unknown variables are not filled in.
4. Use the Active switch to turn a template off. The built-in wording is then used instead.
5. Click **Test** to send a test to your own address, then **Save Settings**.

Branding, the fee table, payment buttons and calendar links are always added automatically.`,
  },
  {
    id: "intake-qr-code",
    title: "Where is my QR code? (personal enquiry QR code)",
    roles: ["lead_management", "salesperson"],
    content: `1. In the sidebar click **QR Code** (\`/admin/lead-management/intake-qr\`).
2. **My Enquiry QR Code** shows your personal code ("Scan to enquire — <your name>").
3. Click **Download QR (PNG)** to print it, the copy icon to copy the link, or **Open form** to test the enquiry form.

Anyone who scans it fills in the enquiry form. They become a new lead (source "QR Form") **assigned straight to you**, bypassing the normal assignment rules. You also get the usual "Call new lead within 15 minutes" reminder.

Lead-management users also get a **Generate a code for** dropdown to produce any salesperson's code. If your account has no sales role, leads from your own code follow the team assignment rule instead.`,
  },
  {
    id: "salesperson-leads-view",
    title: "Seeing all leads assigned to one salesperson",
    roles: ["lead_management"],
    content: `1. On the **Leads** list, click the blue salesperson name badge in the **Assigned To** column.
2. This opens a page listing that salesperson's assigned leads ("Viewing leads assigned to <name>").
3. Use **Search leads...** and **Filter by status** to narrow it down, and the **View History** icon to open a lead.`,
  },
  {
    id: "reports-lead-management",
    title: "Viewing lead reports and analytics (team-wide)",
    roles: ["lead_management"],
    content: `Reports are not in the sidebar. Open them by address:
1. Go to \`/admin/lead-management\` for the **Dashboard**: Total Leads, Active Pipeline, Won This Month, Conversion Rate, Pipeline Overview, Top Lead Sources, Top Salespeople and Recent Activity. Its Quick Actions include **Add Lead**, **View Leads**, **Manage Sources** and **View Reports**.
2. Click **View Reports** (or go to \`/admin/lead-management/reports\`) for **Reports & Analytics**: Leads This Month, Deals Won, Total Revenue, Conversion Rate, Monthly Performance, Leads by Status, Leads by Source, Conversion Funnel and **Data Exports**.

Revenue figures count money actually collected, so part-paid invoices count only what has been received.`,
  },
  {
    id: "reports-salesperson",
    title: "Viewing my own sales performance",
    roles: ["salesperson"],
    content: `Your personal report is not in the sidebar. Open it by going to \`/admin/salesperson/reports\` in the address bar.

It shows your own figures, such as your total leads, deals won, revenue collected and conversion rate, along with charts of your leads over time.

For day-to-day work, use **My Leads** (use the **Payment** filter to see Part paid or Unpaid deals) and **Calendar** (Overdue and Upcoming Today cards).`,
  },
];
