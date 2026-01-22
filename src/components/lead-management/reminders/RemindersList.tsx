"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { format, isPast, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  X,
  Clock,
  User,
  Bell,
  Trash2,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

interface RemindersListProps {
  reminders: Reminder[];
  onReminderUpdate: () => void;
  showLeadInfo?: boolean;
}

export function RemindersList({
  reminders,
  onReminderUpdate,
  showLeadInfo = true
}: RemindersListProps) {
  const { t } = useTranslation("leadManagement");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleMarkDone = async (id: string) => {
    setLoadingId(id);
    try {
      const response = await fetch(`/api/lead-management/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });

      if (!response.ok) throw new Error("Failed to update reminder");

      toast.success(t("reminderMarkedDone"));
      onReminderUpdate();
    } catch (error) {
      console.error("Error marking reminder done:", error);
      toast.error(t("failedToUpdateReminder"));
    } finally {
      setLoadingId(null);
    }
  };

  const handleDismiss = async (id: string) => {
    setLoadingId(id);
    try {
      const response = await fetch(`/api/lead-management/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      });

      if (!response.ok) throw new Error("Failed to dismiss reminder");

      toast.success(t("reminderDismissed"));
      onReminderUpdate();
    } catch (error) {
      console.error("Error dismissing reminder:", error);
      toast.error(t("failedToUpdateReminder"));
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setLoadingId(id);
    try {
      const response = await fetch(`/api/lead-management/reminders/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete reminder");

      toast.success(t("reminderDeleted"));
      onReminderUpdate();
    } catch (error) {
      console.error("Error deleting reminder:", error);
      toast.error(t("failedToDeleteReminder"));
    } finally {
      setLoadingId(null);
    }
  };

  const getStatusBadge = (reminder: Reminder) => {
    const remindAt = new Date(reminder.remind_at);
    const isOverdue = isPast(remindAt) && reminder.status === "pending";
    const isDueToday = isToday(remindAt);

    if (reminder.status === "done") {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle2 className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
          {t("done")}
        </Badge>
      );
    }

    if (reminder.status === "dismissed") {
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">
          <X className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
          {t("dismissed")}
        </Badge>
      );
    }

    if (isOverdue || reminder.status === "triggered") {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 animate-pulse">
          <Bell className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
          {t("overdue")}
        </Badge>
      );
    }

    if (isDueToday) {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <Clock className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
          {t("today")}
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <Clock className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
        {t("upcoming")}
      </Badge>
    );
  };

  if (reminders.length === 0) {
    return (
      <div className="text-center py-8">
        <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">{t("noReminders")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reminders.map((reminder) => {
        const isLoading = loadingId === reminder.id;
        const isActive = reminder.status === "pending" || reminder.status === "triggered";
        const remindAt = new Date(reminder.remind_at);
        const isOverdue = isPast(remindAt) && isActive;

        return (
          <div
            key={reminder.id}
            className={cn(
              "p-4 rounded-lg border transition-colors",
              isOverdue
                ? "border-red-200 bg-red-50/50"
                : isActive
                ? "border-gray-200 bg-white"
                : "border-gray-100 bg-gray-50/50 opacity-75"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className={cn(
                    "font-medium truncate",
                    !isActive && "line-through text-muted-foreground"
                  )}>
                    {reminder.title}
                  </h4>
                  {getStatusBadge(reminder)}
                </div>

                {reminder.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {reminder.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(remindAt, "MMM d, yyyy 'at' h:mm a")}
                  </span>
                  {showLeadInfo && reminder.lead && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {reminder.lead.full_name}
                    </span>
                  )}
                </div>
              </div>

              {isActive && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => handleMarkDone(reminder.id)}
                    disabled={isLoading}
                    title={t("markDone")}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    onClick={() => handleDismiss(reminder.id)}
                    disabled={isLoading}
                    title={t("dismiss")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {!isActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDelete(reminder.id)}
                  disabled={isLoading}
                  title={t("delete")}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
