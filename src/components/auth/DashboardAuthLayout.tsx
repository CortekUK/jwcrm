"use client";

import { ReactNode, useState, useEffect } from "react";
import Image from "next/image";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import JustWillsLogo from "@/assets/justwills.png";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardType, getDashboardBySlug } from "@/config/dashboards";

interface DashboardAuthLayoutProps {
  children: ReactNode;
  dashboardType: DashboardType;
}

export function DashboardAuthLayout({
  children,
  dashboardType,
}: DashboardAuthLayoutProps) {
  const { t } = useTranslation(["auth", "common"]);
  const { resolvedTheme, setTheme } = useTheme();
  const dashboardConfig = getDashboardBySlug(dashboardType);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#FAFAFA] to-[#F3F3F3] dark:from-background dark:to-background">
      <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 border-[#E6E6E4] dark:border-border"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-[440px] space-y-8 rounded-[10px] border border-[#E6E6E4] dark:border-border bg-white dark:bg-card p-10 shadow-[0_6px_16px_rgba(12,85,54,0.08)] dark:shadow-none animate-scale-in">
        <div className="text-center">
          <Image
            src={JustWillsLogo}
            alt="Just Wills"
            className="h-20 w-auto mx-auto -translate-x-4 mb-2.5 animate-fade-in dark:brightness-110"
            width={200}
            height={80}
          />
          {/* Dashboard name badge - only show for non-client dashboards */}
          {dashboardType !== "client" && (
            <div className="mt-2">
              <span className="inline-block px-3 py-1 text-xs font-medium text-[#0C5536] dark:text-[#C6A03B] bg-[rgba(12,85,54,0.08)] dark:bg-[#C6A03B]/10 rounded-full border border-[#0C5536]/20 dark:border-[#C6A03B]/30">
                {t(dashboardConfig.nameKey)}
              </span>
            </div>
          )}
        </div>

        {children}

        {/* Security Notice Footer */}
        <div className="text-center mt-5 pt-5 border-t border-[#E6E6E4] dark:border-border relative">
          {/* Gold accent line above */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-[2px] bg-gradient-to-r from-transparent via-[#C6A03B] to-transparent" />

          <div className="flex items-center justify-center gap-2 mt-2">
            <p className="text-[12px] text-[#6B6B6B] dark:text-muted-foreground leading-relaxed">
              {t("auth:securityNotice")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
