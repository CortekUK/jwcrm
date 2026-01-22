"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { NotificationSettings } from "@/components/hr/settings/NotificationSettings";
import { useTranslation } from "react-i18next";
import { User, Bell } from "lucide-react";

export default function HRSettings() {
  const { t } = useTranslation(["hr", "common"]);

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <h1 className="text-2xl font-bold text-[#222222] mb-6">
        {t("common:settings")}
      </h1>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {t("hr:accountSettings")}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t("hr:notifications")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <DashboardHome dashboardType="hr" />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
