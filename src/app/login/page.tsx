"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import {
  Shield,
  User,
  Users,
  Wallet,
  Target,
  ArrowRight
} from "lucide-react";
import JustWillsLogo from "@/assets/justwills.png";
import { DASHBOARD_CONFIGS, DashboardType } from "@/config/dashboards";

interface DashboardOption {
  type: DashboardType;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const dashboardOptions: DashboardOption[] = [
  {
    type: "admin",
    icon: <Shield className="h-8 w-8" />,
    color: "text-purple-600",
    bgColor: "bg-purple-50 hover:bg-purple-100",
  },
  {
    type: "client",
    icon: <User className="h-8 w-8" />,
    color: "text-blue-600",
    bgColor: "bg-blue-50 hover:bg-blue-100",
  },
  {
    type: "hr",
    icon: <Users className="h-8 w-8" />,
    color: "text-green-600",
    bgColor: "bg-green-50 hover:bg-green-100",
  },
  {
    type: "finance",
    icon: <Wallet className="h-8 w-8" />,
    color: "text-amber-600",
    bgColor: "bg-amber-50 hover:bg-amber-100",
  },
  {
    type: "lead-management",
    icon: <Target className="h-8 w-8" />,
    color: "text-rose-600",
    bgColor: "bg-rose-50 hover:bg-rose-100",
  },
];

export default function LoginSelector() {
  const { t } = useTranslation(["common", "auth", "admin", "portal", "hr", "finance", "leadManagement"]);
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // If user is already logged in, redirect to their dashboard
  useEffect(() => {
    if (!loading && user && profile?.role) {
      const dashboardConfig = DASHBOARD_CONFIGS[profile.role as DashboardType];
      if (dashboardConfig) {
        router.push(dashboardConfig.basePath);
      }
    }
  }, [user, profile, loading, router]);

  const getDashboardName = (type: DashboardType): string => {
    const config = DASHBOARD_CONFIGS[type];
    return t(config.nameKey);
  };

  const getDashboardDescription = (type: DashboardType): string => {
    switch (type) {
      case "admin":
        return t("auth:loginSelector.adminDescription", "Manage users, wills, and system settings");
      case "client":
        return t("auth:loginSelector.clientDescription", "Create and manage your will documents");
      case "hr":
        return t("auth:loginSelector.hrDescription", "Human resources management portal");
      case "finance":
        return t("auth:loginSelector.financeDescription", "Financial management and reporting");
      case "lead-management":
        return t("auth:loginSelector.leadManagementDescription", "Track and manage leads");
      default:
        return "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A1A19]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col">
      {/* Header */}
      <header className="w-full py-4 px-6 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <Image src={JustWillsLogo} alt="JustWills" width={140} height={40} priority />
        </Link>
        <LanguageSwitcher />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-[#1A1A19] mb-2">
              {t("auth:loginSelector.title", "Choose Your Portal")}
            </h1>
            <p className="text-[#6B6B6B]">
              {t("auth:loginSelector.subtitle", "Select the dashboard you want to sign in to")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboardOptions.map((option) => {
              const config = DASHBOARD_CONFIGS[option.type];
              return (
                <Link key={option.type} href={config.authPath}>
                  <Card className={`cursor-pointer transition-all duration-200 border-[#E6E6E4] ${option.bgColor} h-full`}>
                    <CardHeader className="pb-2">
                      <div className={`${option.color} mb-2`}>
                        {option.icon}
                      </div>
                      <CardTitle className="text-lg text-[#1A1A19]">
                        {getDashboardName(option.type)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-[#6B6B6B] mb-4">
                        {getDashboardDescription(option.type)}
                      </CardDescription>
                      <div className="flex items-center text-sm font-medium text-[#1A1A19]">
                        {t("auth:loginSelector.signIn", "Sign in")}
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Sign up link for new clients */}
          <div className="text-center mt-8">
            <p className="text-[#6B6B6B]">
              {t("auth:loginSelector.newClient", "New client?")}{" "}
              <Link href="/client/auth/signup" className="text-[#1A1A19] font-medium hover:underline">
                {t("auth:loginSelector.signUpHere", "Sign up here")}
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-sm text-[#6B6B6B]">
        {t("auth:loginSelector.copyright", "© 2024 JustWills. All rights reserved.")}
      </footer>
    </div>
  );
}
