"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { RemindersPanel } from "./RemindersPanel";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface PendingReminder {
  id: string;
  title: string;
  lead: {
    full_name: string;
  } | null;
}

interface ReminderNotificationBadgeProps {
  className?: string;
}

export function ReminderNotificationBadge({ className }: ReminderNotificationBadgeProps) {
  const { t } = useTranslation("leadManagement");
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const seenReminderIds = useRef<Set<string>>(new Set());
  const userIdRef = useRef<string | null>(null);
  const hasFetched = useRef(false);

  // Keep userIdRef in sync
  useEffect(() => {
    userIdRef.current = user?.id || null;
  }, [user?.id]);

  // Fetch pending reminders - stable function that reads from ref.
  //
  // The badge also carries the lead-management notification feed (new lead
  // assigned / status changed / lead gone stale). That feed is what the
  // Settings page calls "browser notifications" — in-app only, no Web Push.
  // When the switch is off the API returns an empty feed, so the badge simply
  // stops counting them.
  const fetchPendingReminders = async () => {
    const userId = userIdRef.current;
    if (!userId) return;

    try {
      const [reminderRes, notificationRes] = await Promise.all([
        fetch(`/api/lead-management/reminders/pending?salesperson_id=${userId}`),
        fetch(`/api/lead-management/notifications?user_id=${userId}`),
      ]);

      let total = 0;

      if (reminderRes.ok) {
        const { data, count: pendingCount } = await reminderRes.json();
        total += pendingCount || 0;
        // Track seen reminders (no toast notification)
        if (data && data.length > 0) {
          data.forEach((r: PendingReminder) => seenReminderIds.current.add(r.id));
        }
      }

      if (notificationRes.ok) {
        const { count: notificationCount } = await notificationRes.json();
        total += notificationCount || 0;
      }

      setCount(total);
    } catch (error) {
      console.error("Error fetching pending reminders:", error);
    }
  };

  // Initial fetch and polling - only runs once when user ID becomes available
  useEffect(() => {
    if (!user?.id) return;

    // Prevent duplicate initial fetches
    if (hasFetched.current) return;
    hasFetched.current = true;

    // Initial fetch
    fetchPendingReminders();

    // Poll every 30 seconds
    const interval = setInterval(fetchPendingReminders, 30000);

    return () => {
      clearInterval(interval);
      hasFetched.current = false;
    };
  }, [user?.id]);

  // Refresh when panel closes
  const handlePanelOpenChange = (open: boolean) => {
    setPanelOpen(open);
    if (!open) {
      // Refresh count when panel closes
      fetchPendingReminders();
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "relative h-10 w-10 rounded-lg bg-sidebar-accent/30 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors",
          className
        )}
        onClick={() => setPanelOpen(true)}
        title={t("reminders")}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 text-xs font-bold bg-red-500 text-white rounded-full animate-pulse">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>

      <RemindersPanel open={panelOpen} onOpenChange={handlePanelOpenChange} />
    </>
  );
}
