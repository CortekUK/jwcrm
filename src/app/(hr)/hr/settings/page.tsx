"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { NotificationSettings } from "@/components/hr/settings/NotificationSettings";
import { LeaveApprovalSettings } from "@/components/hr/settings/LeaveApprovalSettings";
import { ReviewTemplateManager } from "@/components/hr/reviews";
import { useTranslation } from "react-i18next";
import { User, Bell, Settings, GitBranch, FileText } from "lucide-react";

export default function HRSettings() {
  const { t } = useTranslation(["hr", "common"]);

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
            {t("hr:settingsDescription", "Manage your account preferences and notification settings")}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="bg-white border border-[#E6E6E4] p-1.5 rounded-xl w-full grid grid-cols-4 h-auto">
            <TabsTrigger
              value="account"
              className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[#555555] font-medium transition-all"
            >
              <User className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("hr:accountSettings")}
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[#555555] font-medium transition-all"
            >
              <Bell className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("hr:notifications")}
            </TabsTrigger>
            <TabsTrigger
              value="approvals"
              className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[#555555] font-medium transition-all"
            >
              <GitBranch className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("hr:leaveApprovals", "Leave Approvals")}
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[#555555] font-medium transition-all"
            >
              <FileText className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("hr:reviewTemplates", "Review Templates")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <DashboardHome dashboardType="hr" />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationSettings />
          </TabsContent>

          <TabsContent value="approvals">
            <LeaveApprovalSettings />
          </TabsContent>

          <TabsContent value="templates">
            <ReviewTemplateManager />
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <div className="max-w-4xl mx-auto mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("legalNotice")}
        </p>
      </div>
    </div>
  );
}
