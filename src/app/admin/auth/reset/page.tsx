"use client";

import { DashboardAuthLayout } from "@/components/auth/DashboardAuthLayout";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function AdminAuthReset() {
  return (
    <DashboardAuthLayout dashboardType="admin">
      <ResetPasswordForm dashboardType="admin" />
    </DashboardAuthLayout>
  );
}
