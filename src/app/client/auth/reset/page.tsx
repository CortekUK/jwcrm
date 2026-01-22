"use client";

import { DashboardAuthLayout } from "@/components/auth/DashboardAuthLayout";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ClientAuthReset() {
  return (
    <DashboardAuthLayout dashboardType="client">
      <ResetPasswordForm dashboardType="client" />
    </DashboardAuthLayout>
  );
}
