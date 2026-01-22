"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  isAfter,
  startOfDay,
  addMonths,
  subMonths,
  isFriday,
  isSaturday,
} from "date-fns";
import Holidays from "date-holidays";
import { Database } from "@/integrations/supabase/types";
import { CalendarDayCell, DayAttendanceData } from "./CalendarDayCell";
import { CalendarLegend } from "./CalendarLegend";
import { DayDetailModal } from "./DayDetailModal";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

// Initialize UAE holidays
const uaeHolidays = new Holidays("AE");

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  status: AttendanceStatus;
  check_in_time: string | null;
  reason: string | null;
}

export interface Employee {
  id: string;
  full_name: string;
  department_id: string | null;
  department_name?: string;
}

export interface AttendanceCalendarProps {
  // Required data
  attendanceData: AttendanceRecord[];
  employees: Employee[];

  // Optional configuration
  selectedEmployeeId?: string;
  defaultMonth?: Date;
  showLegend?: boolean;
  showEmployeeFilter?: boolean;
  readOnly?: boolean;

  // Callbacks
  onDayClick?: (date: Date, records: AttendanceRecord[]) => void;
  onMonthChange?: (month: Date) => void;
  onEmployeeFilterChange?: (employeeId: string | null) => void;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AttendanceCalendar({
  attendanceData,
  employees,
  selectedEmployeeId: initialSelectedEmployeeId,
  defaultMonth,
  showLegend = true,
  showEmployeeFilter = true,
  readOnly = false,
  onDayClick,
  onMonthChange,
  onEmployeeFilterChange,
}: AttendanceCalendarProps) {
  const { t } = useTranslation(["hr"]);
  const [currentMonth, setCurrentMonth] = useState(defaultMonth || new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    initialSelectedEmployeeId || null
  );
  const [selectedDay, setSelectedDay] = useState<DayAttendanceData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const today = new Date();

  // Get days in the current month
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Get the day of week the month starts on (0 = Sunday)
  const startDayOfWeek = getDay(startOfMonth(currentMonth));

  // Get holidays for the current month
  const holidaysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const holidays = uaeHolidays.getHolidays(year);

    const holidayMap = new Map<string, string>();
    holidays.forEach((holiday) => {
      const holidayDate = new Date(holiday.date);
      if (holidayDate.getMonth() === month) {
        const dateKey = format(holidayDate, "yyyy-MM-dd");
        holidayMap.set(dateKey, holiday.name);
      }
    });
    return holidayMap;
  }, [currentMonth]);

  // Process attendance data for each day
  const dayDataMap = useMemo(() => {
    const map = new Map<string, DayAttendanceData>();

    daysInMonth.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const isWeekend = isFriday(day) || isSaturday(day);
      const holidayName = holidaysInMonth.get(dateStr);
      const isHoliday = !!holidayName;
      const isFuture = isAfter(startOfDay(day), startOfDay(today));

      // Filter attendance records for this day
      let dayRecords = attendanceData.filter((record) => record.date === dateStr);

      // If employee filter is active, filter further
      if (selectedEmployeeId) {
        dayRecords = dayRecords.filter((record) => record.employee_id === selectedEmployeeId);
      }

      // Map records with employee names
      const records = dayRecords.map((record) => {
        const employee = employees.find((e) => e.id === record.employee_id);
        return {
          employeeId: record.employee_id,
          employeeName: employee?.full_name || "Unknown",
          status: record.status,
          checkInTime: record.check_in_time,
        };
      });

      map.set(dateStr, {
        date: dateStr,
        records,
        isWeekend,
        isHoliday,
        holidayName,
        isFuture,
      });
    });

    return map;
  }, [daysInMonth, attendanceData, employees, selectedEmployeeId, holidaysInMonth, today]);

  const handlePreviousMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const handleEmployeeChange = (value: string) => {
    const newEmployeeId = value === "all" ? null : value;
    setSelectedEmployeeId(newEmployeeId);
    onEmployeeFilterChange?.(newEmployeeId);
  };

  const handleDayClick = (dateStr: string) => {
    if (readOnly) return;

    const dayData = dayDataMap.get(dateStr);
    if (!dayData || dayData.isFuture) return;

    setSelectedDay(dayData);
    setModalOpen(true);

    const dayRecords = attendanceData.filter((record) => record.date === dateStr);
    onDayClick?.(new Date(dateStr), dayRecords);
  };

  const handleMarkAttendance = () => {
    if (!selectedDay) return;
    setModalOpen(false);
    // The parent component handles navigation via onDayClick
  };

  return (
    <Card className="border-[#E6E6E4]">
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("calendar.title", "Attendance Calendar")}
          </CardTitle>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Employee Filter */}
            {showEmployeeFilter && (
              <Select
                value={selectedEmployeeId || "all"}
                onValueChange={handleEmployeeChange}
              >
                <SelectTrigger className="w-48">
                  <Users className="h-4 w-4 mr-2 text-gray-500" />
                  <SelectValue placeholder={t("calendar.allEmployees", "All Employees")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("calendar.allEmployees", "All Employees")}
                  </SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Month Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousMonth}
                className="h-9 w-9"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="w-36 text-center font-medium text-[#222222]">
                {format(currentMonth, "MMMM yyyy")}
              </div>
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
            <div key={`empty-${index}`} className="h-16 md:h-20" />
          ))}

          {/* Day cells */}
          {daysInMonth.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayData = dayDataMap.get(dateStr) || null;
            const isToday = isSameDay(day, today);

            return (
              <CalendarDayCell
                key={dateStr}
                day={day.getDate()}
                data={dayData}
                selectedEmployeeId={selectedEmployeeId}
                onClick={readOnly ? undefined : () => handleDayClick(dateStr)}
                isToday={isToday}
              />
            );
          })}
        </div>

        {/* Legend */}
        {showLegend && <CalendarLegend className="mt-4" />}
      </CardContent>

      {/* Day Detail Modal */}
      <DayDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        data={selectedDay}
        onMarkAttendance={handleMarkAttendance}
      />
    </Card>
  );
}
