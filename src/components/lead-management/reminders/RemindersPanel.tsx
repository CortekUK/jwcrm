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

interface LeadNotification {
  id: string;
  event_type: string;
  title: string;
  body: string | null;
  created_at: string;
}

interface RemindersPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RemindersPanel({ open, onOpenChange }: RemindersPanelProps) {
  const { t } = useTranslation("leadManagement");
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notifications, setNotifications] = useState<LeadNotification[]>([]);
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

  // The lead-management notification feed (new lead assigned, status changed,
  // lead gone stale). Empty when "browser notifications" is switched off in
  // the Settings page — that switch means this in-app feed, not Web Push.
  const fetchNotifications = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(`/api/lead-management/notifications?user_id=${user.id}`);
      if (!response.ok) return;
      const { data } = await response.json();
      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  useEffect(() => {
    if (open && user?.id) {
      fetchReminders();
      fetchNotifications();
    }
  }, [open, user?.id]);

  // Opening the panel is the acknowledgement — clear the feed on close so the
  // badge does not keep counting things the user has now seen.
  const handleOpenChange = async (nextOpen: boolean) => {
    if (!nextOpen && notifications.length > 0 && user?.id) {
      try {
        await fetch("/api/lead-management/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id }),
        });
        setNotifications([]);
      } catch (error) {
        console.error("Error marking notifications read:", error);
      }
    }
    onOpenChange(nextOpen);
  };

  const activeReminders = reminders.filter(
    (r) => r.status === "pending" || r.status === "triggered"
  );
  const completedReminders = reminders.filter(
    (r) => r.status === "done" || r.status === "dismissed"
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("reminders")}</SheetTitle>
          <SheetDescription>{t("remindersDescription")}</SheetDescription>
        </SheetHeader>

        {notifications.length > 0 && (
          <div className="mt-6 space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="rounded-lg border border-[#E6E6E4] bg-[#FAFAF8] p-3"
              >
                <p className="text-sm font-medium text-[#222222]">{notification.title}</p>
                {notification.body && (
                  <p className="text-xs text-[#6B6B6B] mt-0.5">{notification.body}</p>
                )}
              </div>
            ))}
          </div>
        )}

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
