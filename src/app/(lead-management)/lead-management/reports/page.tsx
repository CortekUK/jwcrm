"use client";

// Portal twin of /admin/lead-management/reports. See the sources page next door
// for why this exists: the dashboard's "View Reports" action resolved to
// /lead-management/reports, which had no page and 404'd.
import AdminLeadReportsPage from "@/app/(admin)/admin/lead-management/reports/page";

export default function LeadManagementReportsPage() {
  return <AdminLeadReportsPage />;
}
