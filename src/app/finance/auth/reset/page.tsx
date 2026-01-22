"use client";

import { DashboardAuthLayout } from "@/components/auth/DashboardAuthLayout";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function FinanceAuthReset() {
  return (
    <DashboardAuthLayout dashboardType="finance">
      <ResetPasswordForm dashboardType="finance" />
    </DashboardAuthLayout>
  );
}
