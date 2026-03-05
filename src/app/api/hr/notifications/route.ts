import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface NotificationItem {
  type: "document" | "leave" | "review";
  title: string;
  description: string;
  link?: string;
  createdAt: string;
  urgency: "critical" | "warning";
}

export async function GET() {
  try {
    const items: NotificationItem[] = [];
    const now = new Date();
    const in14Days = new Date(now);
    in14Days.setDate(in14Days.getDate() + 14);

    // 1. Expiring documents (within 14 days, active only)
    const { data: expiringDocs, error: docsError } = await supabaseAdmin
      .from("employee_documents")
      .select(`
        id,
        document_type,
        document_name,
        expiry_date,
        employee_id,
        employees (
          id,
          full_name
        )
      `)
      .eq("is_active", true)
      .not("expiry_date", "is", null)
      .lte("expiry_date", in14Days.toISOString().split("T")[0])
      .order("expiry_date", { ascending: true });

    if (!docsError && expiringDocs) {
      for (const doc of expiringDocs) {
        const expiryDate = new Date(doc.expiry_date);
        const isExpired = expiryDate < now;
        const employee = (doc.employees as unknown as { id: string; full_name: string } | null);
        const employeeName = employee?.full_name || "Unknown";

        const documentTypeLabels: Record<string, string> = {
          passport: "Passport",
          employment_visa: "Employment Visa",
          emirates_id: "Emirates ID",
          employment_contract: "Employment Contract",
        };

        items.push({
          type: "document",
          title: `${documentTypeLabels[doc.document_type] || doc.document_type} - ${employeeName}`,
          description: isExpired
            ? `Expired on ${expiryDate.toLocaleDateString()}`
            : `Expires on ${expiryDate.toLocaleDateString()}`,
          link: `/admin/hr/employees/${doc.employee_id}?tab=documents`,
          createdAt: doc.expiry_date,
          urgency: isExpired ? "critical" : "warning",
        });
      }
    }

    // 2. Pending leave requests
    const { data: pendingLeaves, error: leaveError } = await supabaseAdmin
      .from("leave_requests")
      .select(`
        id,
        leave_type,
        start_date,
        end_date,
        total_days,
        created_at,
        employee_id,
        employees (
          id,
          full_name
        )
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!leaveError && pendingLeaves) {
      for (const leave of pendingLeaves) {
        const employee = (leave.employees as unknown as { id: string; full_name: string } | null);
        const employeeName = employee?.full_name || "Unknown";

        const leaveTypeLabels: Record<string, string> = {
          annual: "Annual",
          sick: "Sick",
          emergency: "Emergency",
          unpaid: "Unpaid",
        };

        items.push({
          type: "leave",
          title: `${leaveTypeLabels[leave.leave_type] || leave.leave_type} Leave - ${employeeName}`,
          description: `${leave.total_days} day${leave.total_days !== 1 ? "s" : ""} (${leave.start_date} to ${leave.end_date})`,
          link: "/admin/hr/leave",
          createdAt: leave.created_at || new Date().toISOString(),
          urgency: "warning",
        });
      }
    }

    // 3. Overdue reviews (draft/submitted past deadline)
    const { data: overdueReviews, error: reviewError } = await supabaseAdmin
      .from("quarterly_reviews")
      .select(`
        id,
        quarter,
        year,
        status,
        deadline_date,
        created_at,
        employee_id,
        employees:employee_id (
          id,
          full_name
        )
      `)
      .in("status", ["draft", "submitted"])
      .not("deadline_date", "is", null)
      .lt("deadline_date", now.toISOString().split("T")[0])
      .order("deadline_date", { ascending: true });

    if (!reviewError && overdueReviews) {
      for (const review of overdueReviews) {
        const employee = (review.employees as unknown as { id: string; full_name: string } | null);
        const employeeName = employee?.full_name || "Unknown";

        items.push({
          type: "review",
          title: `Q${review.quarter} ${review.year} Review - ${employeeName}`,
          description: `Status: ${review.status}, deadline was ${new Date(review.deadline_date!).toLocaleDateString()}`,
          link: "/admin/hr/reviews",
          createdAt: review.created_at || new Date().toISOString(),
          urgency: "critical",
        });
      }
    }

    return NextResponse.json({
      count: items.length,
      items,
    });
  } catch (error) {
    console.error("Error fetching HR notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
