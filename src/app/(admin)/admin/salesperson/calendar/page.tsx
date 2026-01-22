"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Loader2,
  ArrowLeft,
  CalendarDays,
  Clock,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  addMonths,
  subMonths,
  isFriday,
  isSaturday,
  isToday,
  parseISO,
} from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  CalendarDayDetailModal,
  CommunicationData,
} from "@/components/salesperson/CalendarDayDetailModal";
import { SendMeetingInviteDialog } from "@/components/salesperson/SendMeetingInviteDialog";

const getWeekdayLabels = (t: (key: string) => string): string[] => [
  t("weekday.sun"),
  t("weekday.mon"),
  t("weekday.tue"),
  t("weekday.wed"),
  t("weekday.thu"),
  t("weekday.fri"),
  t("weekday.sat"),
];

export default function SalespersonCalendarPage() {
  const { t } = useTranslation(["salesperson", "common"]);
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const WEEKDAY_LABELS = getWeekdayLabels(t);

  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [communications, setCommunications] = useState<CommunicationData[]>([]);

  // Modal states
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [meetingInviteOpen, setMeetingInviteOpen] = useState(false);
  const [selectedCommunication, setSelectedCommunication] =
    useState<CommunicationData | null>(null);

  const today = new Date();

  // Fetch communications for the current month
  const fetchCommunications = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);

      const response = await fetch(
        `/api/lead-management/calendar?userId=${user.id}&startDate=${start.toISOString()}&endDate=${end.toISOString()}`
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
      setLoading(false);
    }
  }, [user?.id, currentMonth, toast, t]);

  useEffect(() => {
    fetchCommunications();
  }, [fetchCommunications]);

  // Get days in the current month
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Get the day of week the month starts on (0 = Sunday)
  const startDayOfWeek = getDay(startOfMonth(currentMonth));

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
    const thisMonthComms = communications.length;

    const todayStr = format(today, "yyyy-MM-dd");
    const todayComms = communicationsByDate.get(todayStr) || [];

    return {
      totalThisMonth: thisMonthComms,
      upcomingToday: todayComms.length,
    };
  }, [communications, communicationsByDate, today]);

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDayClick = (day: Date, comms: CommunicationData[]) => {
    if (comms.length > 0) {
      setSelectedDay(day);
      setDayModalOpen(true);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/salesperson/leads")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#222222]">{t("calendar")}</h1>
            <p className="text-[#6B6B6B]">{t("calendarDescription")}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B6B]">{t("thisMonth")}</p>
                <p className="text-2xl font-bold text-[#222222]">
                  {stats.totalThisMonth}
                </p>
              </div>
              <CalendarDays className="h-8 w-8 text-[hsl(var(--jw-primary-green))]" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B6B]">{t("upcomingToday")}</p>
                <p className="text-2xl font-bold text-[hsl(var(--jw-gold-accent))]">
                  {stats.upcomingToday}
                </p>
              </div>
              <Clock className="h-8 w-8 text-[hsl(var(--jw-gold-accent))]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              {format(currentMonth, "MMMM yyyy")}
            </CardTitle>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousMonth}
                className="h-9 w-9"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                {t("today")}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextMonth}
                className="h-9 w-9"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label, index) => (
              <div
                key={label}
                className={`text-center text-xs font-medium py-2 ${
                  index === 5 || index === 6 ? "text-gray-400" : "text-[#6B6B6B]"
                }`}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before the month starts */}
            {Array.from({ length: startDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} className="h-20 md:h-24" />
            ))}

            {/* Day cells */}
            {daysInMonth.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayComms = communicationsByDate.get(dateStr) || [];
              const isTodayDate = isToday(day);
              const dayNumber = day.getDate();
              const isWeekend = isFriday(day) || isSaturday(day);

              const hasCommunications = dayComms.length > 0;

              // Weekend styling (but still show communications if any)
              if (isWeekend && !hasCommunications) {
                return (
                  <div
                    key={dateStr}
                    className="h-20 md:h-24 flex flex-col items-center justify-center bg-gray-100 rounded-md"
                  >
                    <span className="text-sm font-medium text-gray-400">
                      {dayNumber}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={dateStr}
                  className={`h-20 md:h-24 p-1 rounded-md border transition-colors ${
                    isTodayDate
                      ? "ring-2 ring-[hsl(var(--jw-primary-green))]"
                      : ""
                  } ${
                    hasCommunications
                      ? isWeekend
                        ? "bg-green-50/70 border-green-200 cursor-pointer hover:bg-green-100"
                        : "bg-green-50 border-green-200 cursor-pointer hover:bg-green-100"
                      : isWeekend
                        ? "bg-gray-100 border-gray-100"
                        : "bg-white border-gray-100"
                  }`}
                  onClick={() => handleDayClick(day, dayComms)}
                >
                  <div className="flex justify-between items-start">
                    <span
                      className={`text-sm font-medium ${
                        isTodayDate
                          ? "text-[hsl(var(--jw-primary-green))]"
                          : isWeekend
                            ? "text-gray-500"
                            : "text-gray-700"
                      }`}
                    >
                      {dayNumber}
                    </span>
                    {hasCommunications && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        {dayComms.length}
                      </Badge>
                    )}
                  </div>
                  {hasCommunications && (
                    <div className="mt-1 space-y-0.5">
                      {dayComms.slice(0, 2).map((comm, idx) => (
                        <div
                          key={idx}
                          className="text-xs text-gray-600 truncate bg-white rounded px-1"
                          title={`${format(parseISO(comm.scheduled_at), "h:mm a")} - ${comm.lead.full_name}`}
                        >
                          {format(parseISO(comm.scheduled_at), "h:mm a")}
                        </div>
                      ))}
                      {dayComms.length > 2 && (
                        <span className="text-xs text-gray-500">
                          +{dayComms.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-50 border border-green-200" />
              <span className="text-sm text-gray-600">{t("scheduledMeetings")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gray-100" />
              <span className="text-sm text-gray-600">{t("weekend")}</span>
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
      {selectedCommunication && (
        <SendMeetingInviteDialog
          open={meetingInviteOpen}
          onOpenChange={setMeetingInviteOpen}
          leadId={selectedCommunication.lead.id}
          leadName={selectedCommunication.lead.full_name}
          leadEmail={selectedCommunication.lead.email || ""}
          defaultDate={parseISO(selectedCommunication.scheduled_at)}
          onSuccess={handleMeetingInviteSuccess}
        />
      )}
    </div>
  );
}
