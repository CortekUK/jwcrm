"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Bell, 
  BellOff,
  Check,
  CheckCheck,
  Target,
  TrendingUp,
  User,
  FileText,
  Clock,
  Trash2,
  Settings,
  Loader2,
  X,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO, isToday } from "date-fns";
import { cn } from "@/lib/utils";

export type NotificationType = 
  | "lead_assigned"
  | "status_changed"
  | "reminder_due"
  | "proposal_viewed"
  | "proposal_paid"
  | "new_lead";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  lead_id?: string;
  lead_name?: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationCenterProps {
  className?: string;
}

const NOTIFICATION_ICONS: Record<NotificationType, typeof Bell> = {
  lead_assigned: User,
  status_changed: TrendingUp,
  reminder_due: Clock,
  proposal_viewed: FileText,
  proposal_paid: FileText,
  new_lead: Target,
};

const NOTIFICATION_COLORS: Record<NotificationType, { bg: string; text: string }> = {
  lead_assigned: { bg: "#E6E6FF", text: "#4F46E5" },
  status_changed: { bg: "#F3E8FF", text: "#7C3AED" },
  reminder_due: { bg: "#FFF7ED", text: "#D97706" },
  proposal_viewed: { bg: "#FFF9E6", text: "#C6A03B" },
  proposal_paid: { bg: "#D4EDDA", text: "#0C5536" },
  new_lead: { bg: "#E6F7F1", text: "#0C5536" },
};

export function NotificationCenter({ className }: NotificationCenterProps) {
  const { t } = useTranslation("leadManagement");
  const { user } = useAuth();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      // Simulate notifications since the table doesn't exist yet
      // In production, this would fetch from Supabase
      const storedNotifications = localStorage.getItem(`notifications_${user.id}`);
      if (storedNotifications) {
        setNotifications(JSON.parse(storedNotifications));
      } else {
        // Generate some mock notifications
        const mockNotifications = generateMockNotifications();
        setNotifications(mockNotifications);
        localStorage.setItem(`notifications_${user.id}`, JSON.stringify(mockNotifications));
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.is_read).length;
  }, [notifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (activeTab === "unread") {
      return notifications.filter(n => !n.is_read);
    }
    return notifications;
  }, [notifications, activeTab]);

  // Mark as read
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      );
      if (user?.id) {
        localStorage.setItem(`notifications_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });
  }, [user?.id]);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, is_read: true }));
      if (user?.id) {
        localStorage.setItem(`notifications_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });
  }, [user?.id]);

  // Delete notification
  const deleteNotification = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== notificationId);
      if (user?.id) {
        localStorage.setItem(`notifications_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });
  }, [user?.id]);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    if (user?.id) {
      localStorage.setItem(`notifications_${user.id}`, JSON.stringify([]));
    }
  }, [user?.id]);

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.lead_id) {
      router.push(`/admin/lead-management/leads/${notification.lead_id}`);
      setIsOpen(false);
    }
  };

  // Render notification item
  const renderNotification = (notification: Notification) => {
    const Icon = NOTIFICATION_ICONS[notification.type];
    const colors = NOTIFICATION_COLORS[notification.type];

    return (
      <div
        key={notification.id}
        className={cn(
          "flex gap-3 p-3 border-b border-[#E6E6E4] last:border-b-0 cursor-pointer transition-colors",
          !notification.is_read ? "bg-[#FAFAF8]" : "hover:bg-[#FAFAF8]"
        )}
        onClick={() => handleNotificationClick(notification)}
      >
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: colors.bg }}
        >
          <Icon className="h-4 w-4" style={{ color: colors.text }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={cn(
                "text-sm",
                !notification.is_read ? "font-semibold text-[#222222]" : "text-[#555555]"
              )}>
                {notification.title}
              </p>
              {notification.lead_name && (
                <p className="text-xs text-[#6B6B6B] truncate">{notification.lead_name}</p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!notification.is_read && (
                <div className="h-2 w-2 rounded-full bg-[#C6A03B]" />
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNotification(notification.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-[#999999] mt-1">
            {formatDistanceToNow(parseISO(notification.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative h-9 w-9", className)}
        >
          <Bell className="h-5 w-5 text-[#555555]" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 text-xs bg-[#C6A03B] text-white border-0"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[380px] p-0" 
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E6E6E4]">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <h3 className="font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("notifications", "Notifications")}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-7 text-xs text-[#6B6B6B]"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                {t("markAllRead", "Mark all read")}
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v: "all" | "unread") => setActiveTab(v)}>
          <TabsList className="w-full rounded-none border-b border-[#E6E6E4] bg-transparent p-0">
            <TabsTrigger 
              value="all" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-[#C6A03B] data-[state=active]:bg-transparent data-[state=active]:text-[#0C5536]"
            >
              {t("all", "All")}
            </TabsTrigger>
            <TabsTrigger 
              value="unread"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-[#C6A03B] data-[state=active]:bg-transparent data-[state=active]:text-[#0C5536]"
            >
              {t("unread", "Unread")}
              {unreadCount > 0 && (
                <Badge className="ml-1.5 h-5 px-1.5 text-xs bg-[#C6A03B] text-white border-0">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="m-0">
            <div className="max-h-[400px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--jw-primary-green))]" />
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="text-center py-12">
                  <BellOff className="h-10 w-10 mx-auto mb-3 text-[#E6E6E4]" />
                  <p className="text-sm text-[#6B6B6B]">
                    {activeTab === "unread" 
                      ? t("noUnreadNotifications", "No unread notifications")
                      : t("noNotifications", "No notifications yet")
                    }
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#E6E6E4]">
                  {filteredNotifications.map(renderNotification)}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between p-3 border-t border-[#E6E6E4] bg-[#FAFAF8]">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-7 text-xs text-[#6B6B6B] hover:text-[#C0392B]"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              {t("clearAll", "Clear all")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin/lead-management/settings")}
              className="h-7 text-xs text-[#6B6B6B]"
            >
              <Settings className="h-3 w-3 mr-1" />
              {t("settings", "Settings")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Generate mock notifications for demo
function generateMockNotifications(): Notification[] {
  const now = new Date();
  
  return [
    {
      id: "1",
      type: "lead_assigned",
      title: "New lead assigned to you",
      message: "A new lead has been assigned to you",
      lead_id: "lead-1",
      lead_name: "John Smith",
      is_read: false,
      created_at: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
    },
    {
      id: "2",
      type: "reminder_due",
      title: "Reminder due",
      message: "Follow-up call with client",
      lead_id: "lead-2",
      lead_name: "Emma Wilson",
      is_read: false,
      created_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: "3",
      type: "status_changed",
      title: "Lead status updated",
      message: "Lead moved to Qualified",
      lead_id: "lead-3",
      lead_name: "David Brown",
      is_read: false,
      created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "4",
      type: "proposal_paid",
      title: "Payment received!",
      message: "Proposal has been paid - AED 599",
      lead_id: "lead-4",
      lead_name: "Lisa Taylor",
      is_read: true,
      created_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "5",
      type: "proposal_viewed",
      title: "Proposal viewed",
      message: "Your proposal has been viewed",
      lead_id: "lead-5",
      lead_name: "Robert Johnson",
      is_read: true,
      created_at: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "6",
      type: "new_lead",
      title: "New lead from website",
      message: "New lead from contact form",
      lead_id: "lead-6",
      lead_name: "Alice Cooper",
      is_read: true,
      created_at: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(),
    },
  ];
}
