"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Lock, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { DashboardType, getDashboardBySlug } from "@/config/dashboards";

interface DashboardHomeProps {
  dashboardType: DashboardType;
}

export function DashboardHome({ dashboardType }: DashboardHomeProps) {
  const { profile, user } = useAuth();
  const { t } = useTranslation(["common", "portal", "hr", "finance", "leadManagement"]);

  const dashboardConfig = getDashboardBySlug(dashboardType);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Welcome Header */}
      <div className="space-y-2">
        <h1
          className="text-2xl font-semibold text-[#0C5536]"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          {t("common:welcome")}, {profile?.full_name || t("common:user")}
        </h1>
        <p className="text-sm text-[#777777]">
          {t("common:loggedInTo")} {t(dashboardConfig.nameKey)}
        </p>
      </div>

      {/* User Details Card */}
      <Card className="rounded-lg border border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
        <CardHeader>
          <CardTitle
            className="text-xl font-semibold text-[#0C5536] flex items-center gap-2"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            <User className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("common:accountInformation")}
          </CardTitle>
          <CardDescription className="text-sm text-[#777777]">
            {t("common:yourAccountDetails")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-[#555555] text-sm">
                {t("common:fullName")}
              </Label>
              <p className="mt-1 text-[#222222] font-medium">
                {profile?.full_name || t("common:notAvailable")}
              </p>
            </div>
            <div>
              <Label className="text-[#555555] text-sm flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {t("common:email")}
              </Label>
              <p className="mt-1 text-[#222222] font-medium">{user?.email}</p>
            </div>
          </div>
          <div>
            <Label className="text-[#555555] text-sm">{t("common:role")}</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {profile?.roles?.map((role) => (
                <Badge
                  key={role}
                  variant="secondary"
                  className="bg-[rgba(12,85,54,0.1)] text-[#0C5536] border-[#0C5536]/20"
                >
                  {role.charAt(0).toUpperCase() +
                    role.slice(1).replace("_", " ")}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[#555555] text-sm">
              {t("common:languagePreference")}
            </Label>
            <p className="mt-1 text-[#222222] font-medium">
              {profile?.locale === "ar" ? "العربية (Arabic)" : "English"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card className="rounded-lg border border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
        <CardHeader>
          <CardTitle
            className="text-xl font-semibold text-[#0C5536] flex items-center gap-2"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            <Lock className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("portal:settings.changePassword")}
          </CardTitle>
          <CardDescription className="text-sm text-[#777777]">
            {t("portal:settings.updatePasswordSecure")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
