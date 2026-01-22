"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  Loader2,
  ArrowLeft,
  Plane,
  Thermometer,
  AlertCircle,
  Wallet,
  Minus,
  Star,
  User,
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
  startOfWeek,
  endOfWeek,
  getWeek,
} from "date-fns";
import Holidays from "date-holidays";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";

type LeaveType = Database["public"]["Enums"]["leave_type"];

interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  department_name: string | null;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
}

interface Employee {
  id: string;
  full_name: string;
  department_id: string | null;
  department_name: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface DayLeaveData {
  date: string;
  leaves: {
    employeeId: string;
    employeeName: string;
    leaveType: LeaveType;
    isStart: boolean;
    isEnd: boolean;
  }[];
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
}

const getLeaveTypeConfig = (t: (key: string) => string): Record<LeaveType, { icon: any; color: string; bgColor: string; label: string }> => ({
  annual: { icon: Plane, color: "text-blue-600", bgColor: "bg-blue-100", label: t("leaveBalances.annual") },
  sick: { icon: Thermometer, color: "text-yellow-600", bgColor: "bg-yellow-100", label: t("leaveBalances.sick") },
  emergency: { icon: AlertCircle, color: "text-orange-600", bgColor: "bg-orange-100", label: t("leaveType.emergency") },
  unpaid: { icon: Wallet, color: "text-gray-600", bgColor: "bg-gray-100", label: t("leaveType.unpaid") },
});

// UAE holidays instance will be created with language in component

const getWeekdayLabels = (t: (key: string) => string): string[] => [
  t("weekday.sun"), t("weekday.mon"), t("weekday.tue"), t("weekday.wed"),
  t("weekday.thu"), t("weekday.fri"), t("weekday.sat")
];

export default function LeaveCalendarPage() {
  const { t, i18n } = useTranslation(["hr"]);
  const router = useRouter();
  const { toast } = useToast();
  const leaveTypeConfig = getLeaveTypeConfig(t);
  const WEEKDAY_LABELS = getWeekdayLabels(t);

  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  // Modal state
  const [selectedDay, setSelectedDay] = useState<DayLeaveData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const today = new Date();

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch approved leave requests
      const { data: requestsData } = await supabase
        .from("leave_requests")
        .select(`
          id,
          employee_id,
          leave_type,
          start_date,
          end_date,
          total_days,
          reason,
          employees!inner(full_name, department_id, departments(name))
        `)
        .eq("status", "approved");

      const formattedRequests: LeaveRequest[] = (requestsData || []).map((req: any) => ({
        id: req.id,
        employee_id: req.employee_id,
        employee_name: req.employees.full_name,
        department_name: req.employees.departments?.name || null,
        leave_type: req.leave_type,
        start_date: req.start_date,
        end_date: req.end_date,
        total_days: req.total_days,
        reason: req.reason,
      }));

      setLeaveRequests(formattedRequests);

      // Fetch employees
      const { data: employeesData } = await supabase
        .from("employees")
        .select(`
          id,
          full_name,
          department_id,
          departments(name)
        `)
        .eq("employment_status", "active");

      const formattedEmployees: Employee[] = (employeesData || []).map((emp: any) => ({
        id: emp.id,
        full_name: emp.full_name,
        department_id: emp.department_id,
        department_name: emp.departments?.name || null,
      }));

      setEmployees(formattedEmployees);

      // Fetch departments
      const { data: deptData } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");

      setDepartments(deptData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: t("common.error"),
        description: t("leavePage.failedToFetch"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get days in the current month
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Get the day of week the month starts on (0 = Sunday)
  const startDayOfWeek = getDay(startOfMonth(currentMonth));

  // Get holidays for the current month with proper language
  const holidaysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // Initialize holidays with current language
    const uaeHolidays = new Holidays("AE");
    uaeHolidays.setLanguages(i18n.language === "ar" ? "ar" : "en");

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
  }, [currentMonth, i18n.language]);

  // Filter employees by department
  const filteredEmployees = useMemo(() => {
    if (!selectedDepartment) return employees;
    return employees.filter((emp) => emp.department_id === selectedDepartment);
  }, [employees, selectedDepartment]);

  // Filter leave requests by department
  const filteredLeaveRequests = useMemo(() => {
    if (!selectedDepartment) return leaveRequests;
    const employeeIds = new Set(filteredEmployees.map((e) => e.id));
    return leaveRequests.filter((req) => employeeIds.has(req.employee_id));
  }, [leaveRequests, selectedDepartment, filteredEmployees]);

  // Expand leave requests into daily records
  const leaveDaysMap = useMemo(() => {
    const map = new Map<string, DayLeaveData["leaves"]>();

    filteredLeaveRequests.forEach((request) => {
      const days = eachDayOfInterval({
        start: new Date(request.start_date),
        end: new Date(request.end_date),
      });

      days.forEach((day, index) => {
        // Skip weekends
        if (isFriday(day) || isSaturday(day)) return;

        const dateStr = format(day, "yyyy-MM-dd");
        const existing = map.get(dateStr) || [];
        existing.push({
          employeeId: request.employee_id,
          employeeName: request.employee_name,
          leaveType: request.leave_type,
          isStart: index === 0,
          isEnd: index === days.length - 1,
        });
        map.set(dateStr, existing);
      });
    });

    return map;
  }, [filteredLeaveRequests]);

  // Process data for each day
  const dayDataMap = useMemo(() => {
    const map = new Map<string, DayLeaveData>();

    daysInMonth.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const isWeekend = isFriday(day) || isSaturday(day);
      const holidayName = holidaysInMonth.get(dateStr);
      const isHoliday = !!holidayName;
      const leaves = leaveDaysMap.get(dateStr) || [];

      map.set(dateStr, {
        date: dateStr,
        leaves,
        isWeekend,
        isHoliday,
        holidayName,
      });
    });

    return map;
  }, [daysInMonth, holidaysInMonth, leaveDaysMap]);

  // Calculate weekly coverage
  const weeklyCoverage = useMemo(() => {
    const weeks = new Map<number, { total: number; onLeave: number }>();

    daysInMonth.forEach((day) => {
      if (isFriday(day) || isSaturday(day)) return;

      const weekNum = getWeek(day);
      const dateStr = format(day, "yyyy-MM-dd");
      const leaves = leaveDaysMap.get(dateStr) || [];

      const existing = weeks.get(weekNum) || { total: filteredEmployees.length, onLeave: 0 };
      existing.onLeave = Math.max(existing.onLeave, leaves.length);
      weeks.set(weekNum, existing);
    });

    return weeks;
  }, [daysInMonth, leaveDaysMap, filteredEmployees.length]);

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDepartmentChange = (value: string) => {
    setSelectedDepartment(value === "all" ? null : value);
  };

  const handleDayClick = (dateStr: string) => {
    const dayData = dayDataMap.get(dateStr);
    if (dayData && dayData.leaves.length > 0) {
      setSelectedDay(dayData);
      setModalOpen(true);
    }
  };

  const handleViewHistory = (employeeId: string) => {
    setModalOpen(false);
    router.push(`/admin/hr/leave/history/${employeeId}`);
  };

  // Calculate current coverage
  const currentCoverage = useMemo(() => {
    const todayStr = format(today, "yyyy-MM-dd");
    const todayLeaves = leaveDaysMap.get(todayStr) || [];
    const totalEmployees = filteredEmployees.length;
    const onLeave = todayLeaves.length;
    const present = totalEmployees - onLeave;
    const percentage = totalEmployees > 0 ? Math.round((present / totalEmployees) * 100) : 100;

    return { totalEmployees, onLeave, present, percentage };
  }, [today, leaveDaysMap, filteredEmployees.length]);

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
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/hr/leave")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#222222]">{t("leaveCalendar.title")}</h1>
            <p className="text-[#6B6B6B]">{t("leaveCalendar.description")}</p>
          </div>
        </div>
      </div>

      {/* Coverage Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B6B]">{t("leaveCalendar.totalEmployees")}</p>
                <p className="text-2xl font-bold text-[#222222]">{currentCoverage.totalEmployees}</p>
              </div>
              <Users className="h-8 w-8 text-[#E6E6E4]" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B6B]">{t("leaveCalendar.onLeaveToday")}</p>
                <p className="text-2xl font-bold text-blue-600">{currentCoverage.onLeave}</p>
              </div>
              <Plane className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B6B]">{t("leaveCalendar.availableToday")}</p>
                <p className="text-2xl font-bold text-green-600">{currentCoverage.present}</p>
              </div>
              <User className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B6B]">{t("leaveCalendar.coverage")}</p>
                <p className={`text-2xl font-bold ${currentCoverage.percentage >= 85 ? "text-green-600" : currentCoverage.percentage >= 70 ? "text-yellow-600" : "text-red-600"}`}>
                  {currentCoverage.percentage}%
                </p>
              </div>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${currentCoverage.percentage >= 85 ? "bg-green-100" : currentCoverage.percentage >= 70 ? "bg-yellow-100" : "bg-red-100"}`}>
                {currentCoverage.percentage >= 85 ? (
                  <span className="text-green-600 text-lg">✓</span>
                ) : (
                  <AlertCircle className={`h-5 w-5 ${currentCoverage.percentage >= 70 ? "text-yellow-600" : "text-red-600"}`} />
                )}
              </div>
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

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Department Filter */}
              <Select
                value={selectedDepartment || "all"}
                onValueChange={handleDepartmentChange}
              >
                <SelectTrigger className="w-48">
                  <Users className="h-4 w-4 mr-2 text-gray-500" />
                  <SelectValue placeholder={t("leaveCalendar.allDepartments")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("leaveCalendar.allDepartments")}</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  {t("leaveCalendar.today")}
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
              const dayData = dayDataMap.get(dateStr);
              const isToday = isSameDay(day, today);
              const dayNumber = day.getDate();

              if (!dayData) return null;

              const { isWeekend, isHoliday, holidayName, leaves } = dayData;

              // Weekend styling
              if (isWeekend) {
                return (
                  <div
                    key={dateStr}
                    className="h-20 md:h-24 flex flex-col items-center justify-center bg-gray-100 rounded-md"
                    title="Weekend"
                  >
                    <span className="text-sm font-medium text-gray-400">{dayNumber}</span>
                    <Minus className="h-4 w-4 text-gray-400 mt-1" />
                  </div>
                );
              }

              // Holiday styling
              if (isHoliday) {
                return (
                  <div
                    key={dateStr}
                    className="h-20 md:h-24 flex flex-col items-center justify-center bg-amber-50 rounded-md border border-amber-200"
                    title={holidayName}
                  >
                    <span className="text-sm font-medium text-amber-700">{dayNumber}</span>
                    <Star className="h-4 w-4 text-amber-500 mt-1" />
                  </div>
                );
              }

              // Regular day with leaves
              const hasLeaves = leaves.length > 0;
              const coveragePercent = filteredEmployees.length > 0
                ? Math.round(((filteredEmployees.length - leaves.length) / filteredEmployees.length) * 100)
                : 100;
              const coverageColor =
                coveragePercent >= 85 ? "bg-green-50" :
                coveragePercent >= 70 ? "bg-yellow-50" :
                "bg-red-50";

              return (
                <div
                  key={dateStr}
                  className={`h-20 md:h-24 p-1 rounded-md border transition-colors ${
                    isToday ? "ring-2 ring-[hsl(var(--jw-primary-green))]" : ""
                  } ${
                    hasLeaves
                      ? `${coverageColor} border-gray-200 cursor-pointer hover:opacity-80`
                      : "bg-white border-gray-100"
                  }`}
                  onClick={() => hasLeaves && handleDayClick(dateStr)}
                  title={hasLeaves ? `${leaves.length} on leave` : "No leaves"}
                >
                  <div className="flex justify-between items-start">
                    <span className={`text-sm font-medium ${isToday ? "text-[hsl(var(--jw-primary-green))]" : "text-gray-700"}`}>
                      {dayNumber}
                    </span>
                    {hasLeaves && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        {leaves.length}
                      </Badge>
                    )}
                  </div>
                  {hasLeaves && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {leaves.slice(0, 3).map((leave, idx) => {
                        const config = leaveTypeConfig[leave.leaveType];
                        return (
                          <div
                            key={idx}
                            className={`w-2 h-2 rounded-full ${config.bgColor}`}
                            title={`${leave.employeeName} - ${config.label}`}
                          />
                        );
                      })}
                      {leaves.length > 3 && (
                        <span className="text-xs text-gray-500">+{leaves.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-100">
            {(Object.keys(leaveTypeConfig) as LeaveType[]).map((type) => {
              const config = leaveTypeConfig[type];
              const Icon = config.icon;
              return (
                <div key={type} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${config.bgColor}`} />
                  <Icon className={`h-4 w-4 ${config.color}`} />
                  <span className="text-sm text-gray-600">{config.label}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-2 ml-4">
              <div className="w-3 h-3 rounded bg-gray-100" />
              <Minus className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">{t("leaveCalendar.weekend")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-100" />
              <Star className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-gray-600">{t("leaveCalendar.holiday")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day Detail Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              {selectedDay && format(new Date(selectedDay.date), "EEEE, MMMM d, yyyy")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedDay && (
              <>
                <div className="mb-4 p-3 rounded-lg bg-gray-50">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{t("leaveCalendar.employeesOnLeave")}</span>
                    <Badge variant="secondary">{selectedDay.leaves.length}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {t("leaveCalendar.coverage")}: {filteredEmployees.length - selectedDay.leaves.length}/{filteredEmployees.length} {t("leaveCalendarPage.employeesAvailable")}
                  </div>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {selectedDay.leaves.map((leave, idx) => {
                    const config = leaveTypeConfig[leave.leaveType];
                    const Icon = config.icon;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${config.bgColor}`}>
                            <Icon className={`h-4 w-4 ${config.color}`} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{leave.employeeName}</p>
                            <p className="text-sm text-gray-500">{config.label}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewHistory(leave.employeeId)}
                          className="text-[hsl(var(--jw-primary-green))] hover:text-[hsl(var(--jw-hover-green))]"
                        >
                          {t("leaveCalendar.viewHistory")}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
