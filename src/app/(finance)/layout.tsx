"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardHeaderLayout } from "@/components/layouts/DashboardHeaderLayout";

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requiredRole="finance" dashboardType="finance">
      <DashboardHeaderLayout dashboardType="finance">
        {children}
      </DashboardHeaderLayout>
    </ProtectedRoute>
  );
}
