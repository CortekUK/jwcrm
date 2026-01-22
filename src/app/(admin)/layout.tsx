"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { UnifiedDashboardLayout } from "@/components/layouts/UnifiedDashboardLayout";
import { SelectedRoleProvider } from "@/hooks/useSelectedRole";

export default function AdminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute allowInternalRoles dashboardType="admin">
      <SelectedRoleProvider>
        <UnifiedDashboardLayout>{children}</UnifiedDashboardLayout>
      </SelectedRoleProvider>
    </ProtectedRoute>
  );
}
