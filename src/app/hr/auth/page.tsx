"use client";

import { DashboardAuthLayout } from "@/components/auth/DashboardAuthLayout";
import { SignInForm } from "@/components/auth/SignInForm";

export default function HRAuth() {
  return (
    <DashboardAuthLayout dashboardType="hr">
      <SignInForm dashboardType="hr" />
    </DashboardAuthLayout>
  );
}
