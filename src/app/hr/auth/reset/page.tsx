"use client";

import { DashboardAuthLayout } from "@/components/auth/DashboardAuthLayout";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function HRAuthReset() {
  return (
    <DashboardAuthLayout dashboardType="hr">
      <ResetPasswordForm dashboardType="hr" />
    </DashboardAuthLayout>
  );
}
