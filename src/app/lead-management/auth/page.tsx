"use client";

import { DashboardAuthLayout } from "@/components/auth/DashboardAuthLayout";
import { SignInForm } from "@/components/auth/SignInForm";

export default function LeadManagementAuth() {
  return (
    <DashboardAuthLayout dashboardType="lead-management">
      <SignInForm dashboardType="lead-management" />
    </DashboardAuthLayout>
  );
}
