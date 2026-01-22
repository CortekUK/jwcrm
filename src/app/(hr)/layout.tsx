"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { HRPortalLayout } from "@/components/layouts/HRPortalLayout";

export default function HRLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole="hr" dashboardType="hr">
      <HRPortalLayout>{children}</HRPortalLayout>
    </ProtectedRoute>
  );
}
