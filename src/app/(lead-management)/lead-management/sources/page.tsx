"use client";

// Portal twin of /admin/lead-management/sources.
//
// The dashboard's Quick Actions resolve their base path from the current URL,
// so a user sitting on /lead-management got /lead-management/sources — which
// did not exist and 404'd. The real implementation lives on the admin side;
// this re-exports it so both prefixes resolve.
import AdminLeadSourcesPage from "@/app/(admin)/admin/lead-management/sources/page";

export default function LeadManagementSourcesPage() {
  return <AdminLeadSourcesPage />;
}
