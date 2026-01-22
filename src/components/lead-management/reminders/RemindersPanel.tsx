"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RemindersList } from "./RemindersList";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  remind_at: string;
  status: "pending" | "triggered" | "done" | "dismissed";
  completed_at: string | null;
  lead: {
    id: string;
    full_name: string;
    email: string;
    company_name: string | null;
    status: string;
  } | null;
}

interface RemindersPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RemindersPanel({ open, onOpenChange }: RemindersPanelProps) {
  const { t } = useTranslation("leadManagement");
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

  const fetchReminders = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/lead-management/reminders?salesperson_id=${user.id}`);
      if (!response.ok) throw new Error("Failed to fetch reminders");
      const { data } = await response.json();
      setReminders(data || []);
    } catch (error) {
      console.error("Error fetching reminders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && user?.id) {
      fetchReminders();
    }
  }, [open, user?.id]);

  const activeReminders = reminders.filter(
    (r) => r.status === "pending" || r.status === "triggered"
  );
  const completedReminders = reminders.filter(
    (r) => r.status === "done" || r.status === "dismissed"
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("reminders")}</SheetTitle>
          <SheetDescription>{t("remindersDescription")}</SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active" className="relative">
                {t("active")}
                {activeReminders.length > 0 && (
                  <span className="ltr:ml-1 rtl:mr-1 inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                    {activeReminders.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed">
                {t("completed")}
                {completedReminders.length > 0 && (
                  <span className="ltr:ml-1 rtl:mr-1 inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                    {completedReminders.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <RemindersList
                  reminders={activeReminders}
                  onReminderUpdate={fetchReminders}
                />
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <RemindersList
                  reminders={completedReminders}
                  onReminderUpdate={fetchReminders}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
