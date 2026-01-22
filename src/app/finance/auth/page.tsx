"use client";

import { DashboardAuthLayout } from "@/components/auth/DashboardAuthLayout";
import { SignInForm } from "@/components/auth/SignInForm";

export default function FinanceAuth() {
  return (
    <DashboardAuthLayout dashboardType="finance">
      <SignInForm dashboardType="finance" />
    </DashboardAuthLayout>
  );
}
