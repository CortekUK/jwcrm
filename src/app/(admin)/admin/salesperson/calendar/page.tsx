"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Loader2,
  CalendarDays,
  Clock,
  Phone,
  Mail,
  MessageCircle,
  Video,
  Users,
  Plus,
  Bell,
  AlertCircle,
  PhoneCall,
  User,
  Building,
  ExternalLink,
  Search,
  CheckCircle2,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isFriday,
  isSaturday,
  isToday,
  parseISO,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  isPast,
  isFuture,
  differenceInDays,
} from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  CalendarDayDetailModal,
  CommunicationData,
} from "@/components/salesperson/CalendarDayDetailModal";
import { SendMeetingInviteDialog } from "@/components/salesperson/SendMeetingInviteDialog";
import { AddReminderDialog } from "@/components/lead-management/reminders/AddReminderDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const getWeekdayLabels = (t: (key: string) => string): string[] => [
  t("weekday.sun"),
  t("weekday.mon"),
  t("weekday.tue"),
  t("weekday.wed"),
  t("weekday.thu"),
  t("weekday.fri"),
  t("weekday.sat"),
];

// Color mapping for communication methods
const COMMUNICATION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  phone: { bg: "bg-[#E6F7F1]", text: "text-[#0C5536]", border: "border-[#0C5536]/20" },
  mail: { bg: "bg-[#E6F0FF]", text: "text-[#2563EB]", border: "border-[#2563EB]/20" },
  "message-circle": { bg: "bg-[#FFF9E6]", text: "text-[#C6A03B]", border: "border-[#C6A03B]/20" },
  video: { bg: "bg-[#F3E8FF]", text: "text-[#7C3AED]", border: "border-[#7C3AED]/20" },
  users: { bg: "bg-[#FFEDD5]", text: "text-[#D97706]", border: "border-[#D97706]/20" },
  default: { bg: "bg-[#F5F5F5]", text: "text-[#6B6B6B]", border: "border-[#E6E6E4]" },
};

const METHOD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  phone: Phone,
  mail: Mail,
  "message-circle": MessageCircle,
  video: Video,
  users: Users,
};

type ViewMode = "month" | "week";

// A planned call / follow-up from lead_reminders (Set Reminder dialog,
// call-attempt retries, new-lead and stale-lead follow-ups).
interface CalendarReminder {
  id: string;
  lead_id: string;
  salesperson_id: string;
  title: string;
  description: string | null;
  remind_at: string;
  status: "pending" | "triggered" | "done" | "dismissed";
  completed_at: string | null;
  created_at: string;
  lead: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    company_name: string | null;
  } | null;
}

interface PickerLead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
}

// Reminder chips: gold "call" styling; done ones muted + struck through.
const REMINDER_COLORS = {
  bg: "bg-[#FFF4D6]",
  text: "text-[#8A6D1F]",
  border: "border-[#C6A03B]/40",
};

const isReminderDone = (r: CalendarReminder) => r.status === "done";

export default function SalespersonCalendarPage() {
  const { t } = useTranslation(["salesperson", "common"]);
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const WEEKDAY_LABELS = getWeekdayLabels(t);

  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [communications, setCommunications] = useState<CommunicationData[]>([]);
  const [reminders, setReminders] = useState<CalendarReminder[]>([]);

  // Modal states
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [meetingInviteOpen, setMeetingInviteOpen] = useState(false);
  const [selectedCommunication, setSelectedCommunication] =
    useState<CommunicationData | null>(null);
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null);

  // Reminder detail dialog (one reminder or all of a day's reminders)
  const [reminderDetailOpen, setReminderDetailOpen] = useState(false);
  const [reminderDetailItems, setReminderDetailItems] = useState<CalendarReminder[]>([]);
  const [reminderDetailDate, setReminderDetailDate] = useState<Date | null>(null);

  // Quick-add chooser: "Schedule call / reminder" vs "Send meeting invite"
  const [quickAddChooserOpen, setQuickAddChooserOpen] = useState(false);
  const [quickAddStep, setQuickAddStep] = useState<"choose" | "pickLead">("choose");
  const [pickerLeads, setPickerLeads] = useState<PickerLead[]>([]);
  const [pickerLeadsLoaded, setPickerLeadsLoaded] = useState(false);
  const [pickerLeadsLoading, setPickerLeadsLoading] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [reminderLead, setReminderLead] = useState<PickerLead | null>(null);
  const [addReminderOpen, setAddReminderOpen] = useState(false);

  const today = new Date();

  // Get date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === "week") {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 }),
      };
    }
    return {
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    };
  }, [currentDate, viewMode]);

  // Fetch communications for the current date range
  const fetchCommunications = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      // Extend range slightly for better coverage
      const extendedStart = viewMode === "week" 
        ? dateRange.start 
        : startOfMonth(subMonths(currentDate, 1));
      const extendedEnd = viewMode === "week" 
        ? dateRange.end 
        : endOfMonth(addMonths(currentDate, 1));

      const response = await fetch(
        `/api/lead-management/calendar?userId=${user.id}&startDate=${extendedStart.toISOString()}&endDate=${extendedEnd.toISOString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch communications");
      }

      const { data, reminders: reminderData } = await response.json();
      setCommunications(data || []);
      setReminders(reminderData || []);
    } catch (error) {
      console.error("Error fetching communications:", error);
      toast({
        title: t("common:error"),
        description: t("failedToFetchCalendar"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, currentDate, viewMode, dateRange, toast, t]);

  useEffect(() => {
    fetchCommunications();
  }, [fetchCommunications]);

  // Get days based on view mode
  const daysToDisplay = useMemo(() => {
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [dateRange]);

  // Get the day of week the month starts on (0 = Sunday)
  const startDayOfWeek = getDay(startOfMonth(currentDate));

  // Group communications by date
  const communicationsByDate = useMemo(() => {
    const map = new Map<string, CommunicationData[]>();

    communications.forEach((comm) => {
      const dateStr = format(parseISO(comm.scheduled_at), "yyyy-MM-dd");
      const existing = map.get(dateStr) || [];
      existing.push(comm);
      map.set(dateStr, existing);
    });

    return map;
  }, [communications]);

  // Group reminders by date (local day of remind_at)
  const remindersByDate = useMemo(() => {
    const map = new Map<string, CalendarReminder[]>();

    reminders.forEach((reminder) => {
      const dateStr = format(parseISO(reminder.remind_at), "yyyy-MM-dd");
      const existing = map.get(dateStr) || [];
      existing.push(reminder);
      map.set(dateStr, existing);
    });

    return map;
  }, [reminders]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const rangeComms = communications.filter((comm) => {
      const commDate = parseISO(comm.scheduled_at);
      return commDate >= dateRange.start && commDate <= dateRange.end;
    });

    const todayStr = format(today, "yyyy-MM-dd");
    const todayComms = communicationsByDate.get(todayStr) || [];

    // Open (not done) call reminders count towards the same stats
    const openReminders = reminders.filter((r) => !isReminderDone(r));
    const todayReminders = openReminders.filter(
      (r) => format(parseISO(r.remind_at), "yyyy-MM-dd") === todayStr
    );
    const next7DaysReminders = openReminders.filter((r) => {
      const daysFromNow = differenceInDays(parseISO(r.remind_at), today);
      return daysFromNow >= 0 && daysFromNow <= 7;
    });
    const overdueReminders = openReminders.filter((r) => {
      const d = parseISO(r.remind_at);
      return isPast(d) && !isToday(d);
    });

    // Upcoming in next 7 days
    const next7Days = communications.filter((comm) => {
      const commDate = parseISO(comm.scheduled_at);
      const daysFromNow = differenceInDays(commDate, today);
      return daysFromNow >= 0 && daysFromNow <= 7;
    });

    // Overdue (past scheduled, not completed)
    const overdue = communications.filter((comm) => {
      const commDate = parseISO(comm.scheduled_at);
      return isPast(commDate) && !isToday(commDate);
    });

    // This week's meetings
    const thisWeekStart = startOfWeek(today, { weekStartsOn: 0 });
    const thisWeekEnd = endOfWeek(today, { weekStartsOn: 0 });
    const thisWeekComms = communications.filter((comm) => {
      const commDate = parseISO(comm.scheduled_at);
      return commDate >= thisWeekStart && commDate <= thisWeekEnd;
    });
    const thisWeekReminders = openReminders.filter((r) => {
      const d = parseISO(r.remind_at);
      return d >= thisWeekStart && d <= thisWeekEnd;
    });

    return {
      totalInRange: rangeComms.length,
      upcomingToday: todayComms.length + todayReminders.length,
      upcoming7Days: next7Days.length + next7DaysReminders.length,
      thisWeek: thisWeekComms.length + thisWeekReminders.length,
      overdue: overdue.length + overdueReminders.length,
    };
  }, [communications, communicationsByDate, reminders, today, dateRange]);

  const handlePrevious = () => {
    if (viewMode === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const handleDayClick = (day: Date, comms: CommunicationData[]) => {
    if (comms.length > 0) {
      setSelectedDay(day);
      setDayModalOpen(true);
    }
  };

  const openReminderDetails = (items: CalendarReminder[], day: Date | null) => {
    if (items.length === 0) return;
    setReminderDetailItems(items);
    setReminderDetailDate(day);
    setReminderDetailOpen(true);
  };

  const handleQuickAddClick = (e: React.MouseEvent, day: Date) => {
    e.stopPropagation();
    setQuickAddDate(day);
    setQuickAddStep("choose");
    setLeadSearch("");
    setQuickAddChooserOpen(true);
  };

  const loadPickerLeads = useCallback(async () => {
    if (!user?.id || pickerLeadsLoaded || pickerLeadsLoading) return;
    setPickerLeadsLoading(true);
    try {
      const response = await fetch(`/api/lead-management/salesperson/${user.id}/leads`);
      if (!response.ok) throw new Error("Failed to fetch leads");
      const json = await response.json();
      const leads: PickerLead[] = (json?.data?.leads || []).map(
        (lead: PickerLead) => ({
          id: lead.id,
          full_name: lead.full_name,
          email: lead.email,
          phone: lead.phone,
          company_name: lead.company_name,
        })
      );
      setPickerLeads(leads);
      setPickerLeadsLoaded(true);
    } catch (error) {
      console.error("Error fetching leads for reminder:", error);
      toast({
        title: t("common:error"),
        description: t("failedToFetchLeads", "Failed to load your leads"),
        variant: "destructive",
      });
    } finally {
      setPickerLeadsLoading(false);
    }
  }, [user?.id, pickerLeadsLoaded, pickerLeadsLoading, toast, t]);

  const handleChooseReminder = () => {
    setQuickAddStep("pickLead");
    loadPickerLeads();
  };

  const handleChooseMeetingInvite = () => {
    setQuickAddChooserOpen(false);
    setMeetingInviteOpen(true);
  };

  const handlePickLead = (lead: PickerLead) => {
    setReminderLead(lead);
    setQuickAddChooserOpen(false);
    setAddReminderOpen(true);
  };

  const filteredPickerLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    if (!q) return pickerLeads;
    return pickerLeads.filter((lead) =>
      [lead.full_name, lead.email, lead.phone, lead.company_name]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [pickerLeads, leadSearch]);

  const handleViewLead = (leadId: string) => {
    setDayModalOpen(false);
    setReminderDetailOpen(false);
    // `/admin/salesperson/leads?leadId=…` redirects to a list that ignores the
    // param, so the lead you clicked was lost. Go straight to its detail page.
    router.push(`/admin/lead-management/leads/${leadId}`);
  };

  const handleSendMeetingInvite = (comm: CommunicationData) => {
    setSelectedCommunication(comm);
    setDayModalOpen(false);
    setMeetingInviteOpen(true);
  };

  const handleMeetingInviteSuccess = () => {
    setMeetingInviteOpen(false);
    setSelectedCommunication(null);
    setQuickAddDate(null);
    fetchCommunications();
    toast({
      title: t("common:success"),
      description: t("meetingInviteSent"),
    });
  };

  // Get communications for the selected day
  const selectedDayCommunications = useMemo(() => {
    if (!selectedDay) return [];
    const dateStr = format(selectedDay, "yyyy-MM-dd");
    return communicationsByDate.get(dateStr) || [];
  }, [selectedDay, communicationsByDate]);

  // Get color for communication type
  const getCommColor = (comm: CommunicationData) => {
    const method = comm.communication_method?.icon || "default";
    return COMMUNICATION_COLORS[method] || COMMUNICATION_COLORS.default;
  };

  // Get icon for communication type
  const getCommIcon = (comm: CommunicationData) => {
    const method = comm.communication_method?.icon || "phone";
    return METHOD_ICONS[method] || Phone;
  };

  // Render a single day cell
  const renderDayCell = (day: Date, isWeekView: boolean = false) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayComms = communicationsByDate.get(dateStr) || [];
    const dayReminders = remindersByDate.get(dateStr) || [];
    const isTodayDate = isToday(day);
    const dayNumber = day.getDate();
    const isWeekend = isFriday(day) || isSaturday(day);
    const hasCommunications = dayComms.length > 0;
    const hasReminders = dayReminders.length > 0;
    const hasItems = hasCommunications || hasReminders;

    // Communications and reminders merged in time order for chip rendering
    const dayItems: Array<
      | { kind: "communication"; at: string; comm: CommunicationData }
      | { kind: "reminder"; at: string; reminder: CalendarReminder }
    > = [
      ...dayComms.map((comm) => ({
        kind: "communication" as const,
        at: comm.scheduled_at,
        comm,
      })),
      ...dayReminders.map((reminder) => ({
        kind: "reminder" as const,
        at: reminder.remind_at,
        reminder,
      })),
    ].sort((a, b) => parseISO(a.at).getTime() - parseISO(b.at).getTime());

    const handleCellClick = () => {
      if (hasCommunications) {
        handleDayClick(day, dayComms);
      } else if (hasReminders) {
        openReminderDetails(dayReminders, day);
      }
    };
    const isCurrentMonth = day.getMonth() === currentDate.getMonth();

    // Week view cell
    if (isWeekView) {
      return (
        <div
          key={dateStr}
          className={cn(
            "min-h-[200px] p-2 rounded-lg border transition-colors relative group",
            isTodayDate && "ring-2 ring-[hsl(var(--jw-primary-green))]",
            isWeekend && "bg-[#FAFAF8]",
            !isWeekend && "bg-white border-[#E6E6E4]"
          )}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-sm font-semibold",
                  isTodayDate ? "text-[hsl(var(--jw-primary-green))]" : "text-[#555555]"
                )}
              >
                {format(day, "EEE d")}
              </span>
              {isTodayDate && (
                <Badge className="text-xs bg-[#0C5536] text-white border-0">
                  {t("today")}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => handleQuickAddClick(e, day)}
            >
              <Plus className="h-4 w-4 text-[#C6A03B]" />
            </Button>
          </div>

          {/* Communications + call reminders */}
          <div className="space-y-1.5 overflow-y-auto max-h-[160px]">
            {dayItems.map((item) => {
              if (item.kind === "reminder") {
                const reminder = item.reminder;
                const done = isReminderDone(reminder);
                return (
                  <div
                    key={`r-${reminder.id}`}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded border border-dashed cursor-pointer hover:shadow-sm transition-shadow",
                      REMINDER_COLORS.bg,
                      REMINDER_COLORS.border,
                      done && "opacity-60"
                    )}
                    onClick={() => openReminderDetails([reminder], day)}
                    title={`${t("callReminder", "Call / Reminder")}: ${reminder.title}`}
                  >
                    <PhoneCall className={cn("h-3 w-3 flex-shrink-0", REMINDER_COLORS.text)} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-medium truncate", REMINDER_COLORS.text, done && "line-through")}>
                        {format(parseISO(reminder.remind_at), "h:mm a")} · {reminder.title}
                      </p>
                      <p className={cn("text-xs text-[#6B6B6B] truncate", done && "line-through")}>
                        {reminder.lead?.full_name || t("callReminder", "Call / Reminder")}
                      </p>
                    </div>
                  </div>
                );
              }

              const comm = item.comm;
              const colors = getCommColor(comm);
              const Icon = getCommIcon(comm);

              return (
                <div
                  key={`c-${comm.id}`}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded border cursor-pointer hover:shadow-sm transition-shadow",
                    colors.bg,
                    colors.border
                  )}
                  onClick={() => handleDayClick(day, [comm])}
                >
                  <Icon className={cn("h-3 w-3 flex-shrink-0", colors.text)} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium truncate", colors.text)}>
                      {format(parseISO(comm.scheduled_at), "h:mm a")}
                    </p>
                    <p className="text-xs text-[#6B6B6B] truncate">{comm.lead.full_name}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Month view cell
    if (isWeekend && !hasItems) {
      return (
        <div
          key={dateStr}
          className="h-20 md:h-24 flex flex-col items-center justify-center bg-[#FAFAF8] rounded-md"
        >
          <span className="text-sm font-medium text-[#9CA3AF]">
            {dayNumber}
          </span>
        </div>
      );
    }

    return (
      <div
        key={dateStr}
        className={cn(
          "h-20 md:h-24 p-1 rounded-md border transition-colors relative group",
          isTodayDate && "ring-2 ring-[hsl(var(--jw-primary-green))]",
          hasItems
            ? isWeekend
              ? "bg-[#E6F7F1]/70 border-[#0C5536]/20 cursor-pointer hover:bg-[#E6F7F1]"
              : "bg-[#E6F7F1] border-[#0C5536]/20 cursor-pointer hover:bg-[#D4EFE4]"
            : isWeekend
              ? "bg-[#FAFAF8] border-[#FAFAF8]"
              : "bg-white border-[#E6E6E4]",
          !isCurrentMonth && "opacity-50"
        )}
        onClick={handleCellClick}
      >
        <div className="flex justify-between items-start">
          <span
            className={cn(
              "text-sm font-medium",
              isTodayDate
                ? "text-[hsl(var(--jw-primary-green))]"
                : isWeekend
                  ? "text-[#9CA3AF]"
                  : "text-[#555555]"
            )}
          >
            {dayNumber}
          </span>
          <div className="flex items-center gap-0.5">
            {hasReminders && (
              <Badge
                variant="secondary"
                className="text-xs px-1.5 py-0 bg-[#FFF4D6] text-[#8A6D1F] border-0 gap-0.5 cursor-pointer"
                title={t("callReminders", "Calls / Reminders")}
                onClick={(e) => {
                  e.stopPropagation();
                  openReminderDetails(dayReminders, day);
                }}
              >
                <PhoneCall className="h-2.5 w-2.5" />
                {dayReminders.length}
              </Badge>
            )}
            {hasCommunications && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-[#FFF9E6] text-[#C6A03B] border-0">
                {dayComms.length}
              </Badge>
            )}
          </div>
        </div>

        {/* Quick add button */}
        {!isWeekend && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute bottom-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => handleQuickAddClick(e, day)}
          >
            <Plus className="h-3 w-3 text-[#C6A03B]" />
          </Button>
        )}

        {hasItems && (
          <div className="mt-1 space-y-0.5">
            {dayItems.slice(0, 2).map((item) => {
              if (item.kind === "reminder") {
                const reminder = item.reminder;
                const done = isReminderDone(reminder);
                return (
                  <div
                    key={`r-${reminder.id}`}
                    className={cn(
                      "text-xs truncate rounded px-1 flex items-center gap-1",
                      REMINDER_COLORS.bg,
                      REMINDER_COLORS.text,
                      done && "opacity-60 line-through"
                    )}
                    title={`${format(parseISO(reminder.remind_at), "h:mm a")} - ${reminder.title}${reminder.lead ? ` (${reminder.lead.full_name})` : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openReminderDetails([reminder], day);
                    }}
                  >
                    <PhoneCall className="h-2.5 w-2.5 flex-shrink-0" />
                    <span className="font-medium">{format(parseISO(reminder.remind_at), "h:mm")}</span>
                    <span className="truncate hidden md:inline">{reminder.title}</span>
                  </div>
                );
              }

              const comm = item.comm;
              const colors = getCommColor(comm);

              return (
                <div
                  key={`c-${comm.id}`}
                  className={cn(
                    "text-xs truncate rounded px-1 flex items-center gap-1",
                    colors.bg, colors.text
                  )}
                  title={`${format(parseISO(comm.scheduled_at), "h:mm a")} - ${comm.lead.full_name}`}
                >
                  <span className="font-medium">{format(parseISO(comm.scheduled_at), "h:mm")}</span>
                </div>
              );
            })}
            {dayItems.length > 2 && (
              <span className="text-xs text-[#777777]">
                +{dayItems.length - 2} more
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("calendar")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">{t("calendarDescription")}</p>
          </div>
          {/* View Toggle */}
          <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as ViewMode)} className="bg-white rounded-lg border border-[#E6E6E4] p-1">
            <TabsList className="bg-transparent p-0 h-auto gap-1">
              <TabsTrigger
                value="month"
                className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white rounded-md px-3 py-1.5 text-sm"
              >
                {t("monthView", "Month")}
              </TabsTrigger>
              <TabsTrigger
                value="week"
                className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white rounded-md px-3 py-1.5 text-sm"
              >
                {t("weekView", "Week")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all duration-100 group">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[#6B6B6B]">{t("upcomingToday", "Today")}</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E6F7F1]">
                <Clock className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#222222]">{stats.upcomingToday}</div>
            <div className="h-0.5 w-0 group-hover:w-full bg-[#0C5536] transition-all duration-300 mt-2" />
          </CardContent>
        </Card>

        <Card className="border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all duration-100 group">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[#6B6B6B]">{t("thisWeekMeetings", "This Week")}</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E6F0FF]">
                <CalendarDays className="h-5 w-5 text-[#2563EB]" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#222222]">{stats.thisWeek}</div>
            <div className="h-0.5 w-0 group-hover:w-full bg-[#2563EB] transition-all duration-300 mt-2" />
          </CardContent>
        </Card>

        <Card className="border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all duration-100 group">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[#6B6B6B]">{t("next7Days", "Next 7 Days")}</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF9E6]">
                <Bell className="h-5 w-5 text-[#C6A03B]" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#222222]">{stats.upcoming7Days}</div>
            <div className="h-0.5 w-0 group-hover:w-full bg-[#C6A03B] transition-all duration-300 mt-2" />
          </CardContent>
        </Card>

        <Card className={cn(
          "border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all duration-100 group",
          stats.overdue > 0 && "border-[#C0392B]/30"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[#6B6B6B]">{t("overdueFollowUps", "Overdue")}</p>
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                stats.overdue > 0 ? "bg-[#FEECEC]" : "bg-[#F5F5F5]"
              )}>
                <AlertCircle className={cn("h-5 w-5", stats.overdue > 0 ? "text-[#C0392B]" : "text-[#6B6B6B]")} />
              </div>
            </div>
            <div className={cn(
              "text-2xl font-bold tracking-tight",
              stats.overdue > 0 ? "text-[#C0392B]" : "text-[#222222]"
            )}>
              {stats.overdue}
            </div>
            <div className={cn(
              "h-0.5 w-0 group-hover:w-full transition-all duration-300 mt-2",
              stats.overdue > 0 ? "bg-[#C0392B]" : "bg-[#6B6B6B]"
            )} />
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
        <CardHeader className="pb-4 bg-[#FAFAF8]" style={{ borderBottom: '1px solid #EAEAE8' }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              <Calendar className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              {viewMode === "week" 
                ? `${format(dateRange.start, "MMM d")} - ${format(dateRange.end, "MMM d, yyyy")}`
                : format(currentDate, "MMMM yyyy")
              }
            </CardTitle>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevious}
                className="h-9 w-9 border-[#E6E6E4] hover:bg-[#FDFBF4] hover:border-[#C6A03B]"
              >
                <ChevronLeft className="h-4 w-4 text-[#555555]" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
                className="border-[#E6E6E4] hover:bg-[#FDFBF4] hover:border-[#C6A03B]"
              >
                {t("today")}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNext}
                className="h-9 w-9 border-[#E6E6E4] hover:bg-[#FDFBF4] hover:border-[#C6A03B]"
              >
                <ChevronRight className="h-4 w-4 text-[#555555]" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label, index) => (
              <div
                key={label}
                className={cn(
                  "text-center text-xs font-semibold py-2",
                  index === 5 || index === 6 ? "text-[#9CA3AF]" : "text-[#555555]"
                )}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {viewMode === "month" ? (
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before the month starts */}
              {Array.from({ length: startDayOfWeek }).map((_, index) => (
                <div key={`empty-${index}`} className="h-20 md:h-24" />
              ))}

              {/* Day cells */}
              {daysToDisplay.map((day) => renderDayCell(day, false))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {daysToDisplay.map((day) => renderDayCell(day, true))}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 pt-4 border-t border-[#E6E6E4]">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-[#0C5536]" />
              <span className="text-sm text-[#555555]">{t("phoneCalls", "Phone Calls")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#2563EB]" />
              <span className="text-sm text-[#555555]">{t("emails", "Emails")}</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#C6A03B]" />
              <span className="text-sm text-[#555555]">{t("messages", "Messages")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-[#7C3AED]" />
              <span className="text-sm text-[#555555]">{t("videoMeetings", "Video")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#D97706]" />
              <span className="text-sm text-[#555555]">{t("inPerson", "In-Person")}</span>
            </div>
            <div className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-[#8A6D1F]" />
              <span className="text-sm text-[#555555]">{t("callReminders", "Calls / Reminders")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day Detail Modal */}
      <CalendarDayDetailModal
        open={dayModalOpen}
        onOpenChange={setDayModalOpen}
        selectedDate={selectedDay}
        communications={selectedDayCommunications}
        onViewLead={handleViewLead}
        onSendMeetingInvite={handleSendMeetingInvite}
      />

      {/* Call / Reminder Detail Dialog */}
      <Dialog open={reminderDetailOpen} onOpenChange={setReminderDetailOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]">
              <PhoneCall className="h-5 w-5 text-[#C6A03B]" />
              {reminderDetailItems.length === 1
                ? t("callReminder", "Call / Reminder")
                : t("callReminders", "Calls / Reminders")}
            </DialogTitle>
            {reminderDetailDate && (
              <DialogDescription className="ltr:ml-7 rtl:mr-7">
                {format(reminderDetailDate, "EEEE, MMMM d, yyyy")}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-3 overflow-y-auto py-2">
            {reminderDetailItems.map((reminder) => {
              const done = isReminderDone(reminder);
              const statusLabel =
                reminder.status === "done"
                  ? t("reminderStatusDone", "Done")
                  : reminder.status === "triggered"
                    ? t("reminderStatusDue", "Due")
                    : t("reminderStatusUpcoming", "Upcoming");
              return (
                <div
                  key={reminder.id}
                  className={cn(
                    "p-4 rounded-lg border bg-white",
                    REMINDER_COLORS.border,
                    done && "opacity-70"
                  )}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className={cn("font-semibold text-[#222222]", done && "line-through")}>
                        {reminder.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-sm text-[#555555] mt-1">
                        <Clock className="h-3.5 w-3.5 text-[#C6A03B]" />
                        {format(parseISO(reminder.remind_at), "EEE, MMM d 'at' h:mm a")}
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        "border-0 flex-shrink-0 gap-1",
                        reminder.status === "done"
                          ? "bg-[#E6F7F1] text-[#0C5536]"
                          : reminder.status === "triggered"
                            ? "bg-[#FEECEC] text-[#C0392B]"
                            : "bg-[#FFF4D6] text-[#8A6D1F]"
                      )}
                    >
                      {done ? <CheckCircle2 className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                      {statusLabel}
                    </Badge>
                  </div>

                  {reminder.description && (
                    <p className="text-sm text-[#555555] whitespace-pre-wrap mb-3">
                      {reminder.description}
                    </p>
                  )}

                  {reminder.lead && (
                    <div className="space-y-1 text-sm text-[#555555] border-t border-[#E6E6E4] pt-3">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-[#6B6B6B]" />
                        <span className="font-medium text-[#222222]">{reminder.lead.full_name}</span>
                      </div>
                      {reminder.lead.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-[#6B6B6B]" />
                          <a href={`tel:${reminder.lead.phone}`} className="hover:underline">
                            {reminder.lead.phone}
                          </a>
                        </div>
                      )}
                      {reminder.lead.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-[#6B6B6B]" />
                          <span className="truncate">{reminder.lead.email}</span>
                        </div>
                      )}
                      {reminder.lead.company_name && (
                        <div className="flex items-center gap-2">
                          <Building className="h-3.5 w-3.5 text-[#6B6B6B]" />
                          <span className="truncate">{reminder.lead.company_name}</span>
                        </div>
                      )}
                      <div className="pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#E6E6E4] hover:bg-[#FDFBF4] hover:border-[#C6A03B]"
                          onClick={() => handleViewLead(reminder.lead_id)}
                        >
                          <ExternalLink className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
                          {t("viewLead", "View Lead")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick-add chooser: schedule a call/reminder or send a meeting invite */}
      <Dialog
        open={quickAddChooserOpen}
        onOpenChange={(open) => {
          setQuickAddChooserOpen(open);
          if (!open && !addReminderOpen && !meetingInviteOpen) {
            setQuickAddDate(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]">
              <Plus className="h-5 w-5 text-[#C6A03B]" />
              {quickAddStep === "choose"
                ? t("addToCalendar", "Add to calendar")
                : t("selectLead", "Select a lead")}
            </DialogTitle>
            {quickAddDate && (
              <DialogDescription className="ltr:ml-7 rtl:mr-7">
                {format(quickAddDate, "EEEE, MMMM d, yyyy")}
              </DialogDescription>
            )}
          </DialogHeader>

          {quickAddStep === "choose" ? (
            <div className="grid gap-3 py-2">
              <Button
                variant="outline"
                className="h-auto justify-start gap-3 p-4 border-[#E6E6E4] hover:bg-[#FDFBF4] hover:border-[#C6A03B]"
                onClick={handleChooseReminder}
              >
                <PhoneCall className="h-5 w-5 text-[#C6A03B]" />
                <span className="font-medium text-[#222222]">
                  {t("scheduleCallReminder", "Schedule call / reminder")}
                </span>
              </Button>
              <Button
                variant="outline"
                className="h-auto justify-start gap-3 p-4 border-[#E6E6E4] hover:bg-[#FDFBF4] hover:border-[#C6A03B]"
                onClick={handleChooseMeetingInvite}
              >
                <Mail className="h-5 w-5 text-[#2563EB]" />
                <span className="font-medium text-[#222222]">
                  {t("sendMeetingInvite", "Send meeting invite")}
                </span>
              </Button>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="relative">
                <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                <Input
                  autoFocus
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  placeholder={t("searchLeads", "Search your leads...")}
                  className="ltr:pl-9 rtl:pr-9 border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto rounded-md border border-[#E6E6E4] divide-y divide-[#E6E6E4]">
                {pickerLeadsLoading ? (
                  <div className="flex items-center justify-center p-6">
                    <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--jw-primary-green))]" />
                  </div>
                ) : filteredPickerLeads.length === 0 ? (
                  <p className="p-4 text-sm text-center text-[#777777]">
                    {t("noLeadsFound", "No leads found")}
                  </p>
                ) : (
                  filteredPickerLeads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      className="w-full text-start px-3 py-2 hover:bg-[#FDFBF4] transition-colors"
                      onClick={() => handlePickLead(lead)}
                    >
                      <p className="text-sm font-medium text-[#222222] truncate">{lead.full_name}</p>
                      <p className="text-xs text-[#777777] truncate">
                        {[lead.phone, lead.email, lead.company_name].filter(Boolean).join(" · ")}
                      </p>
                    </button>
                  ))
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuickAddStep("choose")}
                className="text-[#555555]"
              >
                <ChevronLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                {t("common:back", "Back")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule call / reminder for the picked lead */}
      {reminderLead && (
        <AddReminderDialog
          open={addReminderOpen}
          onOpenChange={(open) => {
            setAddReminderOpen(open);
            if (!open) {
              setReminderLead(null);
              setQuickAddDate(null);
            }
          }}
          leadId={reminderLead.id}
          leadName={reminderLead.full_name}
          defaultDate={quickAddDate}
          onSuccess={fetchCommunications}
        />
      )}

      {/* Meeting Invite Dialog */}
      {(selectedCommunication || quickAddDate) && (
        <SendMeetingInviteDialog
          open={meetingInviteOpen}
          onOpenChange={(open) => {
            setMeetingInviteOpen(open);
            if (!open) {
              setSelectedCommunication(null);
              setQuickAddDate(null);
            }
          }}
          leadId={selectedCommunication?.lead.id || ""}
          leadName={selectedCommunication?.lead.full_name || ""}
          leadEmail={selectedCommunication?.lead.email || ""}
          defaultDate={quickAddDate || (selectedCommunication ? parseISO(selectedCommunication.scheduled_at) : undefined)}
          onSuccess={handleMeetingInviteSuccess}
        />
      )}
    </div>
  );
}
