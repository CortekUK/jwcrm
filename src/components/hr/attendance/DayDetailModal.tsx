"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  Home,
  Plane,
  Thermometer,
  XCircle,
  CalendarCheck,
  Star,
  AlertCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { format, differenceInDays, startOfDay } from "date-fns";
import { Database } from "@/integrations/supabase/types";
import { DayAttendanceData } from "./CalendarDayCell";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

interface DayDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DayAttendanceData | null;
  onMarkAttendance?: () => void;
}

const statusConfig: Record<
  AttendanceStatus,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  present: {
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50",
    label: "Present",
  },
  late: {
    icon: Clock,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    label: "Late",
  },
  wfh: {
    icon: Home,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    label: "WFH",
  },
  on_leave: {
    icon: Plane,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    label: "On Leave",
  },
  sick_leave: {
    icon: Thermometer,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    label: "Sick Leave",
  },
  absent: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    label: "Absent",
  },
};

export function DayDetailModal({
  open,
  onOpenChange,
  data,
  onMarkAttendance,
}: DayDetailModalProps) {
  const { t } = useTranslation(["hr"]);

  if (!data) return null;

  const { date, records, isWeekend, isHoliday, holidayName, isFuture } = data;
  const formattedDate = format(new Date(date), "EEEE, MMMM d, yyyy");

  // Calculate summary counts
  const counts: Record<AttendanceStatus, number> = {
    present: 0,
    late: 0,
    wfh: 0,
    on_leave: 0,
    sick_leave: 0,
    absent: 0,
  };

  records.forEach((record) => {
    counts[record.status]++;
  });

  const totalRecords = records.length;
  const presentCount = counts.present + counts.late + counts.wfh;
  const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {formattedDate}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Special day indicators */}
          {isWeekend && (
            <div className="p-3 bg-gray-100 rounded-lg text-center">
              <p className="text-sm text-gray-600">
                {t("calendar.modal.weekend", "This is a weekend day (non-working)")}
              </p>
            </div>
          )}

          {isHoliday && holidayName && (
            <div className="p-3 bg-amber-50 rounded-lg flex items-center justify-center gap-2 border border-amber-200">
              <Star className="h-4 w-4 text-amber-500" />
              <p className="text-sm text-amber-700 font-medium">{holidayName}</p>
            </div>
          )}

          {isFuture && (
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">
                {t("calendar.modal.futureDate", "This is a future date")}
              </p>
            </div>
          )}

          {/* Summary section */}
          {!isWeekend && !isFuture && totalRecords > 0 && (
            <>
              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#222222]">
                    {t("calendar.modal.attendanceRate", "Attendance Rate")}
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      attendanceRate >= 85
                        ? "bg-green-50 text-green-600 border-green-200"
                        : attendanceRate >= 70
                          ? "bg-yellow-50 text-yellow-600 border-yellow-200"
                          : "bg-red-50 text-red-600 border-red-200"
                    }
                  >
                    {attendanceRate}%
                  </Badge>
                </div>

                {/* Status breakdown */}
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(statusConfig) as AttendanceStatus[]).map((status) => {
                    const config = statusConfig[status];
                    const Icon = config.icon;
                    const count = counts[status];

                    if (count === 0) return null;

                    return (
                      <div
                        key={status}
                        className={`flex items-center gap-1.5 p-2 rounded ${config.bgColor}`}
                      >
                        <Icon className={`h-4 w-4 ${config.color}`} />
                        <span className="text-xs text-gray-700">
                          {count} {config.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Employee list */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-[#222222]">
                  {t("calendar.modal.employees", "Employees")} ({totalRecords})
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {records.map((record) => {
                    const config = statusConfig[record.status];
                    const Icon = config.icon;

                    return (
                      <div
                        key={record.employeeId}
                        className={`flex items-center justify-between p-2 rounded ${config.bgColor}`}
                      >
                        <span className="text-sm text-[#222222]">{record.employeeName}</span>
                        <div className="flex items-center gap-2">
                          {record.checkInTime && (
                            <span className="text-xs text-gray-500">{record.checkInTime}</span>
                          )}
                          <div className="flex items-center gap-1">
                            <Icon className={`h-4 w-4 ${config.color}`} />
                            <span className={`text-xs ${config.color}`}>{config.label}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* No records message */}
          {!isWeekend && !isFuture && totalRecords === 0 && (
            <div className="p-4 text-center text-gray-500">
              <CalendarCheck className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">
                {t("calendar.modal.noRecords", "No attendance records for this day")}
              </p>
            </div>
          )}

          {/* Action button */}
          {onMarkAttendance && !isFuture && (() => {
            const selectedDate = startOfDay(new Date(date));
            const today = startOfDay(new Date());
            const daysDiff = differenceInDays(today, selectedDate);
            const isTooOld = daysDiff >= 7;

            if (isTooOld) {
              return (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">
                      {t("calendar.modal.cannotMarkAttendance", "Cannot Mark Attendance")}
                    </p>
                  </div>
                  <p className="text-sm text-amber-600 mt-1 ml-7">
                    {t("calendar.modal.dateTooOld", "Attendance can only be marked for dates within the last 7 days.")}
                  </p>
                </div>
              );
            }

            return (
              <Button
                onClick={onMarkAttendance}
                className="w-full bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
              >
                <CalendarCheck className="h-4 w-4 mr-2" />
                {t("calendar.modal.markAttendance", "Mark Attendance for This Day")}
              </Button>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
