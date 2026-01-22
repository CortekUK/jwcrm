"use client";

import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { DashboardType, getDashboardBySlug } from "@/config/dashboards";

interface DashboardHeaderLayoutProps {
  children: ReactNode;
  dashboardType: DashboardType;
}

export function DashboardHeaderLayout({
  children,
  dashboardType,
}: DashboardHeaderLayoutProps) {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation(["common", "admin", "hr", "finance", "leadManagement"]);

  const dashboardConfig = getDashboardBySlug(dashboardType);

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(180deg, #FFFFFF 0%, #F8F6EC 100%)",
      }}
    >
      <header
        className="border-b bg-card/80 backdrop-blur-sm"
        style={{ borderBottom: "2px solid rgba(198, 160, 59, 0.2)" }}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <div>
              <h1 className="text-xl font-semibold">
                {t(dashboardConfig.nameKey)}
              </h1>
            </div>
            <nav className="hidden md:flex items-center gap-2">
              {dashboardConfig.navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    onClick={() => router.push(item.path)}
                    className={cn(
                      "gap-2",
                      pathname === item.path && "bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t(item.labelKey)}
                  </Button>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <div className="flex items-center gap-3 px-3 py-1.5 bg-[rgba(12,85,54,0.08)] rounded-lg border border-[#0C5536]/20">
              <div className="hidden md:flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0C5536] text-white text-sm font-semibold">
                  {profile?.full_name?.charAt(0).toUpperCase() || "U"}
                </div>
                <span className="text-sm font-medium text-[#0C5536]">
                  {profile?.full_name || t("common:user")}
                </span>
              </div>
              <Button
                variant="ghost"
                onClick={signOut}
                className="text-[#0C5536] hover:text-[#C6A03B] hover:bg-transparent h-auto py-1 px-2"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="p-6 lg:p-8">{children}</main>
    </div>
  );
}
