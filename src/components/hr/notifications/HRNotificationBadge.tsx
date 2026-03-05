"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { HRNotificationsPanel } from "./HRNotificationsPanel";
import { cn } from "@/lib/utils";

interface NotificationItem {
  type: "document" | "leave" | "review";
  title: string;
  description: string;
  link?: string;
  createdAt: string;
  urgency: "critical" | "warning";
}

interface HRNotificationBadgeProps {
  className?: string;
}

export function HRNotificationBadge({ className }: HRNotificationBadgeProps) {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const hasFetched = useRef(false);

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/hr/notifications");
      if (!response.ok) return;

      const data = await response.json();
      setCount(data.count || 0);
      setItems(data.items || []);
    } catch (error) {
      console.error("Error fetching HR notifications:", error);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    fetchNotifications();

    const interval = setInterval(fetchNotifications, 30000);

    return () => {
      clearInterval(interval);
      hasFetched.current = false;
    };
  }, []);

  const handlePanelOpenChange = (open: boolean) => {
    setPanelOpen(open);
    if (open) {
      setIsLoading(true);
      fetchNotifications().finally(() => setIsLoading(false));
    }
    if (!open) {
      fetchNotifications();
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "relative inline-flex items-center justify-center h-9 w-9 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer",
          className
        )}
        onClick={(e) => {
          e.stopPropagation();
          handlePanelOpenChange(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            handlePanelOpenChange(true);
          }
        }}
        title="HR Notifications"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 text-xs font-bold bg-red-500 text-white rounded-full animate-pulse">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </div>

      <HRNotificationsPanel
        open={panelOpen}
        onOpenChange={handlePanelOpenChange}
        items={items}
        isLoading={isLoading}
      />
    </>
  );
}
