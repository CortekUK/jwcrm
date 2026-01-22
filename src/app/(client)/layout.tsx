"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PortalLayout } from "@/components/layouts/PortalLayout";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requiredRole="client" dashboardType="client">
      <PortalLayout>{children}</PortalLayout>
    </ProtectedRoute>
  );
}
