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

  // Modal states
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [meetingInviteOpen, setMeetingInviteOpen] = useState(false);
  const [selectedCommunication, setSelectedCommunication] =
    useState<CommunicationData | null>(null);
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null);

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

      const { data } = await response.json();
      setCommunications(data || []);
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

  // Calculate summary stats
  const stats = useMemo(() => {
    const rangeComms = communications.filter((comm) => {
      const commDate = parseISO(comm.scheduled_at);
      return commDate >= dateRange.start && commDate <= dateRange.end;
    });

    const todayStr = format(today, "yyyy-MM-dd");
    const todayComms = communicationsByDate.get(todayStr) || [];

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

    return {
      totalInRange: rangeComms.length,
      upcomingToday: todayComms.length,
      upcoming7Days: next7Days.length,
      thisWeek: thisWeekComms.length,
      overdue: overdue.length,
    };
  }, [communications, communicationsByDate, today, dateRange]);

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

  const handleQuickAddClick = (e: React.MouseEvent, day: Date) => {
    e.stopPropagation();
    setQuickAddDate(day);
    setMeetingInviteOpen(true);
  };

  const handleViewLead = (leadId: string) => {
    setDayModalOpen(false);
    router.push(`/admin/salesperson/leads?leadId=${leadId}`);
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
    const method = comm.method?.icon || "default";
    return COMMUNICATION_COLORS[method] || COMMUNICATION_COLORS.default;
  };

  // Get icon for communication type
  const getCommIcon = (comm: CommunicationData) => {
    const method = comm.method?.icon || "phone";
    return METHOD_ICONS[method] || Phone;
  };

  // Render a single day cell
  const renderDayCell = (day: Date, isWeekView: boolean = false) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayComms = communicationsByDate.get(dateStr) || [];
    const isTodayDate = isToday(day);
    const dayNumber = day.getDate();
    const isWeekend = isFriday(day) || isSaturday(day);
    const hasCommunications = dayComms.length > 0;
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

          {/* Communications */}
          <div className="space-y-1.5 overflow-y-auto max-h-[160px]">
            {dayComms.map((comm, idx) => {
              const colors = getCommColor(comm);
              const Icon = getCommIcon(comm);
              
              return (
                <div
                  key={idx}
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
    if (isWeekend && !hasCommunications) {
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
          hasCommunications
            ? isWeekend
              ? "bg-[#E6F7F1]/70 border-[#0C5536]/20 cursor-pointer hover:bg-[#E6F7F1]"
              : "bg-[#E6F7F1] border-[#0C5536]/20 cursor-pointer hover:bg-[#D4EFE4]"
            : isWeekend
              ? "bg-[#FAFAF8] border-[#FAFAF8]"
              : "bg-white border-[#E6E6E4]",
          !isCurrentMonth && "opacity-50"
        )}
        onClick={() => hasCommunications && handleDayClick(day, dayComms)}
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
          {hasCommunications && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-[#FFF9E6] text-[#C6A03B] border-0">
              {dayComms.length}
            </Badge>
          )}
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

        {hasCommunications && (
          <div className="mt-1 space-y-0.5">
            {dayComms.slice(0, 2).map((comm, idx) => {
              const colors = getCommColor(comm);
              
              return (
                <div
                  key={idx}
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
            {dayComms.length > 2 && (
              <span className="text-xs text-[#777777]">
                +{dayComms.length - 2} more
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
