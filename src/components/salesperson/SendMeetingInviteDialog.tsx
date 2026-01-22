"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addHours, isBefore } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CalendarIcon,
  Clock,
  Send,
  Mail,
  MapPin,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface SendMeetingInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  leadEmail: string;
  defaultDate?: Date;
  onSuccess?: () => void;
}

const meetingFormSchema = z.object({
  title: z.string().min(1, "Meeting title is required"),
  date: z.date({ required_error: "Please select a date" }),
  hour: z.string().min(1, "Please select hour"),
  minute: z.string().min(1, "Please select minute"),
  duration: z.string().min(1, "Please select duration"),
  location: z.string().optional(),
  description: z.string().optional(),
});

type MeetingFormValues = z.infer<typeof meetingFormSchema>;

const DURATION_OPTIONS = [
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
];

export function SendMeetingInviteDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  leadEmail,
  defaultDate,
  onSuccess,
}: SendMeetingInviteDialogProps) {
  const { t } = useTranslation("salesperson");
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate hours array (00-23)
  const hours = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        value: i.toString().padStart(2, "0"),
        label: i.toString().padStart(2, "0"),
      })),
    []
  );

  // Generate minutes array (00, 15, 30, 45)
  const minutes = useMemo(
    () =>
      ["00", "15", "30", "45"].map((m) => ({
        value: m,
        label: m,
      })),
    []
  );

  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      title: "",
      hour: "10",
      minute: "00",
      duration: "60",
      location: "",
      description: "",
    },
  });

  const watchDate = form.watch("date");
  const watchHour = form.watch("hour");
  const watchMinute = form.watch("minute");
  const watchDuration = form.watch("duration");

  // Compute the meeting start/end times
  const meetingTimes = useMemo(() => {
    if (!watchDate) return null;
    const year = watchDate.getFullYear();
    const month = watchDate.getMonth();
    const day = watchDate.getDate();
    const hour = parseInt(watchHour || "10", 10);
    const minute = parseInt(watchMinute || "0", 10);
    const durationMinutes = parseInt(watchDuration || "60", 10);

    const startTime = new Date(year, month, day, hour, minute, 0, 0);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    return { startTime, endTime };
  }, [watchDate, watchHour, watchMinute, watchDuration]);

  // Check if meeting time is in the past
  const isPastTime = useMemo(() => {
    if (!meetingTimes) return false;
    return isBefore(meetingTimes.startTime, new Date());
  }, [meetingTimes]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      const initialDate = defaultDate || addHours(new Date(), 1);
      const roundedHour = initialDate.getHours();
      const roundedMinute = Math.ceil(initialDate.getMinutes() / 15) * 15;

      form.reset({
        title: `Meeting with ${leadName}`,
        date: initialDate,
        hour: roundedHour.toString().padStart(2, "0"),
        minute: (roundedMinute % 60).toString().padStart(2, "0"),
        duration: "60",
        location: "",
        description: "",
      });
    }
  }, [open, form, leadName, defaultDate]);

  const handleSubmit = async (data: MeetingFormValues) => {
    if (!meetingTimes) return;

    if (isPastTime) {
      toast.error(t("meetingCannotBeInPast"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/lead-management/meeting-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          title: data.title,
          startTime: meetingTimes.startTime.toISOString(),
          endTime: meetingTimes.endTime.toISOString(),
          location: data.location || null,
          description: data.description || null,
          userId: user?.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send meeting invitation");
      }

      toast.success(t("meetingInviteSent"));
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error sending meeting invitation:", error);
      toast.error(
        error instanceof Error ? error.message : t("failedToSendMeetingInvite")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("sendMeetingInvite")}
          </DialogTitle>
          <DialogDescription>{t("sendMeetingInviteDescription")}</DialogDescription>
        </DialogHeader>

        {/* Recipient Display */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
          <Mail className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">{t("recipient")}:</span>
          <span className="text-sm font-medium text-gray-900">{leadEmail}</span>
          <Badge variant="secondary" className="ml-auto">
            {leadName}
          </Badge>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Meeting Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("meetingTitle")} *</FormLabel>
                  <FormControl>
                    <Input placeholder={t("meetingTitlePlaceholder")} {...field} />
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
                          disabled={(date) =>
                            isBefore(date, new Date(new Date().setHours(0, 0, 0, 0)))
                          }
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
                        <Select value={field.value} onValueChange={field.onChange}>
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
                        <Select value={field.value} onValueChange={field.onChange}>
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

            {/* Duration */}
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("meetingDuration")} *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectDuration")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DURATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preview */}
            {meetingTimes && (
              <div
                className={cn(
                  "rounded-lg border p-3 space-y-2",
                  isPastTime
                    ? "border-red-200 bg-red-50"
                    : "border-green-200 bg-green-50"
                )}
              >
                {isPastTime ? (
                  <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                    <Clock className="h-4 w-4" />
                    <span>{t("meetingInPast")}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Clock className="h-4 w-4" />
                      <span>
                        {format(meetingTimes.startTime, "EEE, MMM d 'at' h:mm a")} -{" "}
                        {format(meetingTimes.endTime, "h:mm a")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Location */}
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {t("meetingLocation")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("meetingLocationPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description/Agenda */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {t("meetingDescription")}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("meetingDescriptionPlaceholder")}
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
              <Button type="submit" disabled={isSubmitting || isPastTime}>
                {isSubmitting && (
                  <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                )}
                <Send className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                {t("sendInvite")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
