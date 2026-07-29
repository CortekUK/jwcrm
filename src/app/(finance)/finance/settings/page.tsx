"use client";

import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { OutstandingDigestSettingsCard } from "@/components/finance/OutstandingDigestSettingsCard";
import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";

export default function FinanceSettings() {
  const { t } = useTranslation(["finance", "common"]);

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
            <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("common:settings")}
            </h1>
          </div>
          <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
            {t("finance:settingsDescription", "Manage your account preferences")}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <OutstandingDigestSettingsCard />
        <DashboardHome dashboardType="finance" />
      </div>

      {/* Footer */}
      <div className="max-w-4xl mx-auto mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("legalNotice", "© 2024 Just Wills. All rights reserved. This system is for authorized users only.")}
        </p>
      </div>
    </div>
  );
}
