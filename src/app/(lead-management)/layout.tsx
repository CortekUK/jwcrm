"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardHeaderLayout } from "@/components/layouts/DashboardHeaderLayout";

export default function LeadManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requiredRole="lead_management" dashboardType="lead-management">
      <DashboardHeaderLayout dashboardType="lead-management">
        {children}
      </DashboardHeaderLayout>
    </ProtectedRoute>
  );
}
