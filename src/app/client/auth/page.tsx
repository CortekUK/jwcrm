"use client";

import { DashboardAuthLayout } from "@/components/auth/DashboardAuthLayout";
import { SignInForm } from "@/components/auth/SignInForm";

export default function ClientAuth() {
  return (
    <DashboardAuthLayout dashboardType="client">
      <SignInForm dashboardType="client" />
    </DashboardAuthLayout>
  );
}
