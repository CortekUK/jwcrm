"use client";

// Admin-side mirror of /hr/settings/email-logs, following the same re-export
// pattern as the neighbouring admin HR pages.
//
// Without this route, "View All Logs" on /admin/hr/settings had nowhere to go:
// linking to /hr/... dropped an admin into the (hr) route group, whose layout
// has no role switcher, and linking to /admin/hr/... 404'd.
import HRSettingsEmailLogsPage from "@/app/(hr)/hr/settings/email-logs/page";

export default function AdminHRSettingsEmailLogsPage() {
  return <HRSettingsEmailLogsPage />;
}
