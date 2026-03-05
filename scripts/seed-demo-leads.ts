import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  let val = trimmed.slice(eqIdx + 1);
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const USER_EMAIL = "neemaghanbarinia@justwills.ae";

async function seed() {
  console.log("🔍 Looking up user:", USER_EMAIL);

  // 1. Find the user
  const { data: usersData, error: usersError } =
    await supabaseAdmin.auth.admin.listUsers();
  if (usersError) throw usersError;

  const user = usersData.users.find((u) => u.email === USER_EMAIL);
  if (!user) {
    console.error(`User ${USER_EMAIL} not found in auth.users`);
    process.exit(1);
  }
  const userId = user.id;
  console.log("✅ Found user:", userId);

  // 2. Ensure lead sources exist
  const sourceNames = [
    "Website",
    "Referral",
    "Google Ads",
    "Walk-in",
    "Social Media",
    "Partner",
  ];

  const sourceIds: Record<string, string> = {};
  for (const name of sourceNames) {
    const { data: existing } = await supabaseAdmin
      .from("lead_sources")
      .select("id")
      .ilike("name", name)
      .single();

    if (existing) {
      sourceIds[name] = existing.id;
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("lead_sources")
        .insert({ name, is_active: true })
        .select("id")
        .single();
      if (error) throw error;
      sourceIds[name] = created!.id;
    }
  }
  console.log("✅ Lead sources ready");

  // 3. Get communication methods
  const { data: commMethods } = await supabaseAdmin
    .from("communication_methods")
    .select("id, name");
  const methodMap: Record<string, string> = {};
  commMethods?.forEach((m) => {
    methodMap[m.name] = m.id;
  });
  console.log("✅ Communication methods:", Object.keys(methodMap).join(", "));

  // 4. Define realistic leads for a UAE will-drafting company
  const now = new Date();
  const daysAgo = (d: number) =>
    new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();
  const hoursFromNow = (h: number) =>
    new Date(now.getTime() + h * 60 * 60 * 1000).toISOString();

  const leads = [
    // Won deals
    {
      full_name: "Ahmed Al Mansouri",
      email: "ahmed.mansouri@emiratesgroup.ae",
      phone: "+971 50 123 4567",
      company_name: "Emirates Group",
      source_id: sourceIds["Referral"],
      status: "won",
      notes: "Referred by existing client. Wanted mirror wills for himself and wife.",
      is_paid: true,
      paid_amount: 3500,
      paid_currency: "AED",
      paid_at: daysAgo(5),
      needs_identified: "Mirror wills for married couple, property in Dubai Marina and Abu Dhabi",
      quoted_price: 3500,
      quoted_currency: "AED",
      created_at: daysAgo(21),
    },
    {
      full_name: "Sarah Johnson",
      email: "sarah.johnson@outlook.com",
      phone: "+971 55 987 6543",
      company_name: null,
      source_id: sourceIds["Website"],
      status: "won",
      notes: "British expat, needed will covering UAE and UK assets.",
      is_paid: true,
      paid_amount: 4200,
      paid_currency: "AED",
      paid_at: daysAgo(12),
      needs_identified: "Cross-border will covering Dubai apartment, UK pension, and investment accounts",
      quoted_price: 4200,
      quoted_currency: "AED",
      created_at: daysAgo(30),
    },

    // In negotiation
    {
      full_name: "Fatima Al Hashimi",
      email: "fatima.hashimi@adnoc.ae",
      phone: "+971 56 345 6789",
      company_name: "ADNOC",
      source_id: sourceIds["Google Ads"],
      status: "negotiation",
      notes: "Interested in comprehensive estate planning. High-value client. Has properties in multiple emirates.",
      needs_identified: "Full estate plan: will, POA, guardianship for 3 minor children, 4 properties across UAE",
      quoted_price: 8500,
      quoted_currency: "AED",
      next_steps: "Follow up on revised quote - client wants to include business assets",
      created_at: daysAgo(7),
    },
    {
      full_name: "James Richardson",
      email: "j.richardson@hsbc.com",
      phone: "+971 52 111 2233",
      company_name: "HSBC Middle East",
      source_id: sourceIds["Partner"],
      status: "negotiation",
      notes: "HSBC partnership referral. Senior banker wanting will for UAE assets.",
      needs_identified: "Single will, DIFC assets, company shares, wants executor appointment",
      quoted_price: 5000,
      quoted_currency: "AED",
      next_steps: "Awaiting confirmation - comparing with another provider",
      created_at: daysAgo(10),
    },

    // Qualified leads
    {
      full_name: "Priya Sharma",
      email: "priya.sharma@gmail.com",
      phone: "+971 58 444 5566",
      company_name: "Dubai Health Authority",
      source_id: sourceIds["Social Media"],
      status: "qualified",
      notes: "Indian national, concerned about Sharia inheritance law applicability. Wants to protect spouse.",
      needs_identified: "Will to ensure spouse inherits Dubai apartment, life insurance beneficiary review",
      quoted_price: 3000,
      quoted_currency: "AED",
      created_at: daysAgo(4),
    },
    {
      full_name: "Omar Khalid",
      email: "omar.khalid@emaar.ae",
      phone: "+971 50 777 8899",
      company_name: "Emaar Properties",
      source_id: sourceIds["Referral"],
      status: "qualified",
      notes: "Wants mirror wills. Wife also interested. Multiple investment properties.",
      needs_identified: "Mirror wills, 6 investment properties, guardianship clause for children",
      created_at: daysAgo(3),
    },

    // Meeting scheduled
    {
      full_name: "Maria Santos",
      email: "maria.santos@dubaiholding.com",
      phone: "+971 54 222 3344",
      company_name: "Dubai Holding",
      source_id: sourceIds["Walk-in"],
      status: "meeting",
      notes: "Filipino expat, visited office. Very interested but needs to discuss with husband first.",
      created_at: daysAgo(2),
    },
    {
      full_name: "David Chen",
      email: "david.chen@techfirm.ae",
      phone: "+971 55 666 7788",
      company_name: "TechFirm Solutions",
      source_id: sourceIds["Website"],
      status: "meeting",
      notes: "Business owner. Wants will and succession plan for his company.",
      needs_identified: "Business succession planning, personal will, POA",
      created_at: daysAgo(1),
    },

    // Pending (proposal sent)
    {
      full_name: "Lisa Anderson",
      email: "lisa.anderson@emirates.com",
      phone: "+971 56 999 0011",
      company_name: "Emirates Airlines",
      source_id: sourceIds["Google Ads"],
      status: "pending",
      notes: "Received proposal yesterday. Australian expat with Dubai property.",
      needs_identified: "Single will for Dubai villa and bank accounts",
      quoted_price: 2800,
      quoted_currency: "AED",
      created_at: daysAgo(6),
    },

    // Not started (new leads)
    {
      full_name: "Rashid Al Maktoum",
      email: "rashid.m@gmail.com",
      phone: "+971 50 555 1234",
      company_name: null,
      source_id: sourceIds["Website"],
      status: "not_started",
      notes: "Submitted enquiry via website form this morning.",
      created_at: daysAgo(0),
    },
    {
      full_name: "Sophie Williams",
      email: "sophie.w@barclays.com",
      phone: "+971 52 333 4455",
      company_name: "Barclays Bank",
      source_id: sourceIds["Google Ads"],
      status: "not_started",
      notes: "Clicked on Google Ad. Filled enquiry form.",
      created_at: daysAgo(0),
    },
    {
      full_name: "Hassan Mirza",
      email: "hassan.mirza@dubaiports.ae",
      phone: "+971 58 888 9900",
      company_name: "DP World",
      source_id: sourceIds["Social Media"],
      status: "not_started",
      notes: "Messaged on Instagram asking about will drafting services for expats.",
      created_at: daysAgo(1),
    },

    // On hold
    {
      full_name: "Anna Petrova",
      email: "anna.petrova@outlook.com",
      phone: "+971 55 111 0022",
      company_name: null,
      source_id: sourceIds["Referral"],
      status: "hold",
      notes: "Russian national. Interested but travelling back to Moscow for 3 weeks. Follow up mid-March.",
      needs_identified: "Will for UAE property and bank accounts",
      quoted_price: 2500,
      quoted_currency: "AED",
      next_steps: "Follow up after 15th March when she returns to Dubai",
      created_at: daysAgo(14),
    },

    // Lost
    {
      full_name: "Michael O'Brien",
      email: "michael.obrien@yahoo.com",
      phone: "+971 50 222 5566",
      company_name: null,
      source_id: sourceIds["Website"],
      status: "lost",
      notes: "Went with a competitor. Said pricing was too high. Offered AED 1,500 elsewhere.",
      needs_identified: "Simple single will",
      quoted_price: 2800,
      quoted_currency: "AED",
      created_at: daysAgo(25),
    },
  ];

  console.log(`\n📝 Inserting ${leads.length} leads...`);

  const insertedLeads: Array<{ id: string; full_name: string; status: string; created_at: string }> = [];

  for (const lead of leads) {
    const { data, error } = await supabaseAdmin
      .from("leads")
      .insert({
        ...lead,
        assigned_to: userId,
        assigned_at: lead.created_at,
        created_by: userId,
      })
      .select("id, full_name, status, created_at")
      .single();

    if (error) {
      console.error(`  ❌ Failed to insert ${lead.full_name}:`, error.message);
      continue;
    }

    insertedLeads.push(data!);
    console.log(`  ✅ ${lead.full_name} (${lead.status})`);
  }

  // 5. Add communications for some leads
  console.log("\n📞 Adding communication history...");

  const communicationData = [
    // Ahmed - won deal, had multiple comms
    {
      leadName: "Ahmed Al Mansouri",
      comms: [
        { method: "Phone", scheduledAt: daysAgo(20), notes: "Initial call - discussed mirror wills requirements" },
        { method: "WhatsApp", scheduledAt: daysAgo(18), notes: "Sent brochure and pricing info" },
        { method: "Video Call", scheduledAt: daysAgo(14), notes: "Detailed consultation - wife joined call" },
        { method: "Email", scheduledAt: daysAgo(7), notes: "Sent final proposal and payment link" },
        { method: "WhatsApp", scheduledAt: daysAgo(5), notes: "Confirmed payment received, scheduled signing" },
      ],
    },
    // Sarah - won deal
    {
      leadName: "Sarah Johnson",
      comms: [
        { method: "Email", scheduledAt: daysAgo(29), notes: "Responded to website enquiry" },
        { method: "Phone", scheduledAt: daysAgo(27), notes: "Discussed cross-border will requirements" },
        { method: "In-Person", scheduledAt: daysAgo(20), notes: "Office meeting - reviewed all assets" },
        { method: "Email", scheduledAt: daysAgo(15), notes: "Sent proposal with pricing breakdown" },
      ],
    },
    // Fatima - negotiation
    {
      leadName: "Fatima Al Hashimi",
      comms: [
        { method: "Phone", scheduledAt: daysAgo(6), notes: "Initial call - high-value client, multiple properties" },
        { method: "Email", scheduledAt: daysAgo(4), notes: "Sent detailed estate planning proposal" },
        { method: "WhatsApp", scheduledAt: daysAgo(2), notes: "Client asked about including business assets in scope" },
      ],
    },
    // Priya - qualified
    {
      leadName: "Priya Sharma",
      comms: [
        { method: "Phone", scheduledAt: daysAgo(3), notes: "Discussed Sharia law concerns and protection options" },
        { method: "Email", scheduledAt: daysAgo(2), notes: "Sent info pack about DIFC wills for non-Muslims" },
      ],
    },
    // David - meeting
    {
      leadName: "David Chen",
      comms: [
        { method: "WhatsApp", scheduledAt: daysAgo(1), notes: "Confirmed meeting for tomorrow at 2pm" },
      ],
    },
    // Lisa - pending
    {
      leadName: "Lisa Anderson",
      comms: [
        { method: "Phone", scheduledAt: daysAgo(5), notes: "Consultation call about Dubai property will" },
        { method: "Email", scheduledAt: daysAgo(3), notes: "Sent proposal - AED 2,800 for single will" },
      ],
    },
  ];

  for (const { leadName, comms } of communicationData) {
    const lead = insertedLeads.find((l) => l.full_name === leadName);
    if (!lead) continue;

    for (const comm of comms) {
      const methodId = methodMap[comm.method];
      if (!methodId) continue;

      const { error } = await supabaseAdmin
        .from("lead_communications")
        .insert({
          lead_id: lead.id,
          communication_method_id: methodId,
          scheduled_at: comm.scheduledAt,
          notes: comm.notes,
          created_by: userId,
        });

      if (error) {
        console.error(`  ❌ Comm for ${leadName}:`, error.message);
      }
    }
    console.log(`  ✅ ${leadName}: ${comms.length} communications`);
  }

  // 6. Add reminders for active leads
  console.log("\n⏰ Adding reminders...");

  const reminderData = [
    {
      leadName: "Fatima Al Hashimi",
      title: "Follow up on revised quote",
      description: "Client wants business assets included. Send updated proposal with new pricing.",
      remindAt: hoursFromNow(4),
      status: "pending",
    },
    {
      leadName: "James Richardson",
      title: "Check if James has decided",
      description: "He was comparing with another provider. Call to see if he has made a decision.",
      remindAt: hoursFromNow(24),
      status: "pending",
    },
    {
      leadName: "Maria Santos",
      title: "Follow up after husband discussion",
      description: "Maria needed to discuss with her husband. Call to check if they've decided.",
      remindAt: hoursFromNow(48),
      status: "pending",
    },
    {
      leadName: "David Chen",
      title: "Prepare for meeting tomorrow",
      description: "Review business succession planning materials before the meeting at 2pm.",
      remindAt: hoursFromNow(2),
      status: "pending",
    },
    {
      leadName: "Lisa Anderson",
      title: "Chase proposal response",
      description: "Proposal was sent 3 days ago. Follow up to see if she has any questions.",
      remindAt: hoursFromNow(6),
      status: "pending",
    },
    {
      leadName: "Anna Petrova",
      title: "Follow up - returns from Moscow",
      description: "Anna returns to Dubai around 15th March. Schedule a call.",
      remindAt: new Date("2026-03-15T10:00:00").toISOString(),
      status: "pending",
    },
    {
      leadName: "Rashid Al Maktoum",
      title: "Call new website lead",
      description: "New enquiry submitted today. Call within 24 hours.",
      remindAt: hoursFromNow(1),
      status: "pending",
    },
    {
      leadName: "Sophie Williams",
      title: "Respond to Google Ads lead",
      description: "New lead from Google Ads. Send introduction email.",
      remindAt: hoursFromNow(3),
      status: "pending",
    },
    // Completed reminders
    {
      leadName: "Ahmed Al Mansouri",
      title: "Send payment link to Ahmed",
      description: "Mirror wills are ready. Send Stripe payment link.",
      remindAt: daysAgo(6),
      status: "done",
      completedAt: daysAgo(5),
    },
    {
      leadName: "Priya Sharma",
      title: "Call Priya about DIFC will options",
      description: "Discuss DIFC will as an alternative for non-Muslim residents.",
      remindAt: daysAgo(3),
      status: "done",
      completedAt: daysAgo(3),
    },
  ];

  for (const reminder of reminderData) {
    const lead = insertedLeads.find((l) => l.full_name === reminder.leadName);
    if (!lead) continue;

    const { error } = await supabaseAdmin.from("lead_reminders").insert({
      lead_id: lead.id,
      salesperson_id: userId,
      title: reminder.title,
      description: reminder.description,
      remind_at: reminder.remindAt,
      status: reminder.status,
      completed_at: (reminder as any).completedAt || null,
    });

    if (error) {
      console.error(`  ❌ Reminder for ${reminder.leadName}:`, error.message);
    } else {
      console.log(`  ✅ ${reminder.title}`);
    }
  }

  // 7. Add some notifications
  console.log("\n🔔 Adding notifications...");

  const notifications = [
    {
      leadName: "Rashid Al Maktoum",
      type: "new_lead",
      title: "New Lead: Rashid Al Maktoum",
      message: "A new lead has been submitted via the website.",
      is_read: false,
    },
    {
      leadName: "Sophie Williams",
      type: "new_lead",
      title: "New Lead: Sophie Williams",
      message: "A new lead from Google Ads has been assigned to you.",
      is_read: false,
    },
    {
      leadName: "Hassan Mirza",
      type: "lead_assigned",
      title: "Lead Assigned: Hassan Mirza",
      message: "A new social media lead has been assigned to you.",
      is_read: false,
    },
    {
      leadName: "Fatima Al Hashimi",
      type: "status_changed",
      title: "Lead Updated: Fatima Al Hashimi",
      message: "Lead status changed to Negotiation.",
      is_read: true,
    },
    {
      leadName: "Ahmed Al Mansouri",
      type: "proposal_paid",
      title: "Payment Received: Ahmed Al Mansouri",
      message: "Payment of AED 3,500 received for mirror wills.",
      is_read: true,
    },
  ];

  for (const notif of notifications) {
    const lead = insertedLeads.find((l) => l.full_name === notif.leadName);
    if (!lead) continue;

    const { error } = await supabaseAdmin.from("lead_notifications").insert({
      user_id: userId,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      lead_id: lead.id,
      is_read: notif.is_read,
    });

    if (error) {
      console.error(`  ❌ Notification: ${notif.title}:`, error.message);
    } else {
      console.log(`  ✅ ${notif.title}`);
    }
  }

  console.log("\n🎉 Seed complete!");
  console.log(`   ${insertedLeads.length} leads created`);
  console.log(`   Assigned to: ${USER_EMAIL} (${userId})`);
  console.log("\n📊 Status breakdown:");
  const statusCounts: Record<string, number> = {};
  for (const lead of insertedLeads) {
    statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
  }
  for (const [status, count] of Object.entries(statusCounts).sort()) {
    console.log(`   ${status}: ${count}`);
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
