"use client";

import {
  CheckCircle2,
  Clock,
  Home,
  Plane,
  Thermometer,
  XCircle,
  Minus,
  Star,
} from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

export interface DayAttendanceData {
  date: string;
  records: {
    employeeId: string;
    employeeName: string;
    status: AttendanceStatus;
    checkInTime?: string | null;
  }[];
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isFuture: boolean;
}

interface CalendarDayCellProps {
  day: number;
  data: DayAttendanceData | null;
  selectedEmployeeId: string | null;
  onClick?: () => void;
  isToday?: boolean;
}

const statusConfig: Record<AttendanceStatus, { icon: React.ElementType; color: string }> = {
  present: { icon: CheckCircle2, color: "text-green-600" },
  late: { icon: Clock, color: "text-orange-600" },
  wfh: { icon: Home, color: "text-blue-600" },
  on_leave: { icon: Plane, color: "text-purple-600" },
  sick_leave: { icon: Thermometer, color: "text-yellow-600" },
  absent: { icon: XCircle, color: "text-red-600" },
};

function getAttendanceIntensity(records: DayAttendanceData["records"]): {
  bgColor: string;
  textColor: string;
} {
  if (records.length === 0) {
    return { bgColor: "bg-gray-50 dark:bg-muted", textColor: "text-gray-400" };
  }

  const presentCount = records.filter(
    (r) => r.status === "present" || r.status === "late" || r.status === "wfh"
  ).length;
  const rate = (presentCount / records.length) * 100;

  if (rate >= 90) {
    return { bgColor: "bg-green-100 dark:bg-green-950/30", textColor: "text-green-800" };
  } else if (rate >= 75) {
    return { bgColor: "bg-green-50 dark:bg-green-950/30", textColor: "text-green-700" };
  } else if (rate >= 50) {
    return { bgColor: "bg-yellow-50 dark:bg-amber-950/30", textColor: "text-yellow-700" };
  } else {
    return { bgColor: "bg-red-50 dark:bg-red-950/30", textColor: "text-red-700" };
  }
}

function getTooltipText(data: DayAttendanceData, selectedEmployeeId: string | null): string {
  if (data.isHoliday && data.holidayName) {
    return data.holidayName;
  }
  if (data.isWeekend) {
    return "Weekend";
  }
  if (data.isFuture) {
    return "Future date";
  }
  if (data.records.length === 0) {
    return "No attendance records";
  }

  if (selectedEmployeeId) {
    const record = data.records[0];
    if (record) {
      const status = record.status.replace("_", " ");
      return `${status.charAt(0).toUpperCase() + status.slice(1)}${
        record.checkInTime ? ` at ${record.checkInTime}` : ""
      }`;
    }
    return "No record";
  }

  const counts: Record<string, number> = {};
  data.records.forEach((r) => {
    counts[r.status] = (counts[r.status] || 0) + 1;
  });

  const parts: string[] = [];
  if (counts.present) parts.push(`${counts.present} Present`);
  if (counts.late) parts.push(`${counts.late} Late`);
  if (counts.wfh) parts.push(`${counts.wfh} WFH`);
  if (counts.on_leave) parts.push(`${counts.on_leave} Leave`);
  if (counts.sick_leave) parts.push(`${counts.sick_leave} Sick`);
  if (counts.absent) parts.push(`${counts.absent} Absent`);

  return parts.join(", ");
}

export function CalendarDayCell({
  day,
  data,
  selectedEmployeeId,
  onClick,
  isToday = false,
}: CalendarDayCellProps) {
  if (!data) {
    return <div className="h-16 md:h-20" />;
  }

  const { isWeekend, isHoliday, isFuture, records } = data;
  const isClickable = !isFuture && onClick;
  const tooltipText = getTooltipText(data, selectedEmployeeId);

  // Weekend styling
  if (isWeekend) {
    return (
      <div
        className={`h-16 md:h-20 flex flex-col items-center justify-center bg-gray-100 dark:bg-muted rounded-md ${
          isClickable ? "cursor-pointer hover:bg-gray-200 dark:hover:bg-accent" : ""
        }`}
        onClick={isClickable ? onClick : undefined}
        title={tooltipText}
      >
        <span className="text-sm font-medium text-gray-400">{day}</span>
        <Minus className="h-4 w-4 text-gray-400 mt-1" />
      </div>
    );
  }

  // Holiday styling
  if (isHoliday) {
    return (
      <div
        className={`h-16 md:h-20 flex flex-col items-center justify-center bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 ${
          isClickable ? "cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/50" : ""
        }`}
        onClick={isClickable ? onClick : undefined}
        title={tooltipText}
      >
        <span className="text-sm font-medium text-amber-700">{day}</span>
        <Star className="h-4 w-4 text-amber-500 mt-1" />
      </div>
    );
  }

  // Future date styling
  if (isFuture) {
    return (
      <div
        className="h-16 md:h-20 flex flex-col items-center justify-center bg-gray-50 dark:bg-muted rounded-md"
        title={tooltipText}
      >
        <span className="text-sm font-medium text-gray-300">{day}</span>
      </div>
    );
  }

  // Single employee view - show status icon
  if (selectedEmployeeId) {
    const record = records[0];
    if (!record) {
      return (
        <div
          className={`h-16 md:h-20 flex flex-col items-center justify-center bg-gray-50 dark:bg-muted rounded-md ${
            isClickable ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-accent" : ""
          } ${isToday ? "ring-2 ring-[hsl(var(--jw-primary-green))]" : ""}`}
          onClick={isClickable ? onClick : undefined}
          title="No record"
        >
          <span className="text-sm font-medium text-gray-600">{day}</span>
        </div>
      );
    }

    const config = statusConfig[record.status];
    const Icon = config.icon;

    const statusBgClass =
      record.status === "present"
        ? "bg-green-100 dark:bg-green-950/30"
        : record.status === "late"
          ? "bg-orange-200 dark:bg-orange-950/30"
          : record.status === "wfh"
            ? "bg-blue-100 dark:bg-blue-950/30"
            : record.status === "on_leave"
              ? "bg-purple-100 dark:bg-purple-950/30"
              : record.status === "sick_leave"
                ? "bg-yellow-100 dark:bg-amber-950/30"
                : "bg-red-100 dark:bg-red-950/30";

    return (
      <div
        className={`h-16 md:h-20 flex flex-col items-center justify-center rounded-md transition-colors ${statusBgClass} ${
          isClickable ? "cursor-pointer hover:opacity-80" : ""
        } ${isToday ? "ring-2 ring-[hsl(var(--jw-primary-green))]" : ""}`}
        onClick={isClickable ? onClick : undefined}
        title={tooltipText}
      >
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{day}</span>
        <Icon className={`h-4 w-4 ${config.color} mt-1`} />
      </div>
    );
  }

  // All employees view - show intensity
  const { bgColor, textColor } = getAttendanceIntensity(records);
  const presentCount = records.filter(
    (r) => r.status === "present" || r.status === "late" || r.status === "wfh"
  ).length;

  return (
    <div
      className={`h-16 md:h-20 flex flex-col items-center justify-center ${bgColor} rounded-md transition-colors ${
        isClickable ? "cursor-pointer hover:opacity-80" : ""
      } ${isToday ? "ring-2 ring-[hsl(var(--jw-primary-green))]" : ""}`}
      onClick={isClickable ? onClick : undefined}
      title={tooltipText}
    >
      <span className={`text-sm font-medium ${textColor}`}>{day}</span>
      {records.length > 0 && (
        <span className={`text-xs ${textColor} mt-0.5`}>
          {presentCount}/{records.length}
        </span>
      )}
    </div>
  );
}
