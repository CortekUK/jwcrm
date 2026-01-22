"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays, isBefore } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Loader2,
  CalendarIcon,
  Clock,
  Bell,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface AddReminderDialogProps {
  leadId: string;
  leadName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const reminderFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  date: z.date({ required_error: "Please select a date" }),
  hour: z.string().min(1, "Please select hour"),
  minute: z.string().min(1, "Please select minute"),
});

type ReminderFormValues = z.infer<typeof reminderFormSchema>;

export function AddReminderDialog({
  leadId,
  leadName,
  open,
  onOpenChange,
  onSuccess,
}: AddReminderDialogProps) {
  const { t } = useTranslation("leadManagement");
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate hours array (00-23)
  const hours = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({
      value: i.toString().padStart(2, '0'),
      label: i.toString().padStart(2, '0'),
    })),
  []);

  // Generate minutes array (00, 15, 30, 45)
  const minutes = useMemo(() =>
    ['00', '15', '30', '45'].map(m => ({
      value: m,
      label: m,
    })),
  []);

  const form = useForm<ReminderFormValues>({
    resolver: zodResolver(reminderFormSchema),
    defaultValues: {
      title: "",
      description: "",
      hour: "09",
      minute: "00",
    },
  });

  const watchDate = form.watch("date");
  const watchHour = form.watch("hour");
  const watchMinute = form.watch("minute");

  // Compute the full reminder date/time using local timezone
  const reminderDateTime = useMemo(() => {
    if (!watchDate) return null;
    // Create a new date preserving the selected date's year, month, day in local timezone
    const year = watchDate.getFullYear();
    const month = watchDate.getMonth();
    const day = watchDate.getDate();
    const hour = parseInt(watchHour || "9", 10);
    const minute = parseInt(watchMinute || "0", 10);
    // This creates the date in LOCAL timezone
    return new Date(year, month, day, hour, minute, 0, 0);
  }, [watchDate, watchHour, watchMinute]);

  // Check if reminder time is in the past
  const isPastTime = useMemo(() => {
    if (!reminderDateTime) return false;
    return isBefore(reminderDateTime, new Date());
  }, [reminderDateTime]);

  // Calculate time until reminder fires (timezone-agnostic)
  const timeUntilReminder = useMemo(() => {
    if (!reminderDateTime || isPastTime) return null;
    const now = new Date();
    const diffMs = reminderDateTime.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      const remainingHours = diffHours % 24;
      return `${diffDays}d ${remainingHours}h`;
    } else if (diffHours > 0) {
      const remainingMins = diffMins % 60;
      return `${diffHours}h ${remainingMins}m`;
    } else {
      return `${diffMins}m`;
    }
  }, [reminderDateTime, isPastTime]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      const tomorrow = addDays(new Date(), 1);
      tomorrow.setHours(9, 0, 0, 0);

      form.reset({
        title: leadName ? `${t("followUpWith")} ${leadName}` : "",
        description: "",
        date: tomorrow,
        hour: "09",
        minute: "00",
      });
    }
  }, [open, form, leadName, t]);

  const handleSubmit = async (data: ReminderFormValues) => {
    // Construct the reminder datetime in LOCAL timezone
    const year = data.date.getFullYear();
    const month = data.date.getMonth();
    const day = data.date.getDate();
    const hour = parseInt(data.hour, 10);
    const minute = parseInt(data.minute, 10);

    // Create date in local timezone - this is what the user selected
    const remindAt = new Date(year, month, day, hour, minute, 0, 0);

    // Validate not in the past
    if (isBefore(remindAt, new Date())) {
      toast.error(t("reminderCannotBeInPast"));
      return;
    }

    setIsSubmitting(true);
    try {
      // toISOString() automatically converts local time to UTC
      // This is correct: user selects 7pm local -> stored as UTC equivalent
      const response = await fetch("/api/lead-management/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          salesperson_id: user?.id,
          title: data.title,
          description: data.description || null,
          remind_at: remindAt.toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create reminder");
      }

      toast.success(t("reminderCreated"));
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error creating reminder:", error);
      toast.error(error instanceof Error ? error.message : t("failedToCreateReminder"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            {t("setReminder")}
          </DialogTitle>
          <DialogDescription>
            {t("setReminderDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("reminderTitle")} *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("reminderTitlePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date and Time Selection */}
            <div className="grid grid-cols-2 gap-4">
              {/* Date Picker */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("date")} *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>{t("pickDate")}</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => isBefore(date, new Date(new Date().setHours(0, 0, 0, 0)))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Time Picker */}
              <div className="flex flex-col space-y-2">
                <FormLabel>{t("time")} *</FormLabel>
                <div className="flex gap-2">
                  <FormField
                    control={form.control}
                    name="hour"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="HH" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {hours.map((hour) => (
                              <SelectItem key={hour.value} value={hour.value}>
                                {hour.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <span className="flex items-center text-lg font-bold">:</span>
                  <FormField
                    control={form.control}
                    name="minute"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="MM" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {minutes.map((minute) => (
                              <SelectItem key={minute.value} value={minute.value}>
                                {minute.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            {reminderDateTime && (
              <div className={cn(
                "rounded-lg border p-3 space-y-2",
                isPastTime ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950" : "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
              )}>
                {isPastTime ? (
                  <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
                    <Clock className="h-4 w-4" />
                    <span>{t("reminderInPast")}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                        <Clock className="h-4 w-4" />
                        <span>{format(reminderDateTime, "EEE, MMM d 'at' h:mm a")}</span>
                      </div>
                      {timeUntilReminder && (
                        <div className="flex items-center gap-1.5 bg-green-600 text-white px-2.5 py-1 rounded-full text-xs font-semibold">
                          <Timer className="h-3 w-3" />
                          <span>{t("firesIn", { time: timeUntilReminder })}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("notes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("reminderDescriptionPlaceholder")}
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isPastTime}
              >
                {isSubmitting && <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />}
                {t("setReminder")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
