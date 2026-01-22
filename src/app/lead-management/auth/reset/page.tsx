"use client";

import { DashboardAuthLayout } from "@/components/auth/DashboardAuthLayout";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function LeadManagementAuthReset() {
  return (
    <DashboardAuthLayout dashboardType="lead-management">
      <ResetPasswordForm dashboardType="lead-management" />
    </DashboardAuthLayout>
  );
}
