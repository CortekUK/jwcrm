"use client";

import { DashboardAuthLayout } from "@/components/auth/DashboardAuthLayout";
import { SignInForm } from "@/components/auth/SignInForm";

export default function AdminAuth() {
  return (
    <DashboardAuthLayout dashboardType="admin">
      <SignInForm dashboardType="admin" />
    </DashboardAuthLayout>
  );
}
