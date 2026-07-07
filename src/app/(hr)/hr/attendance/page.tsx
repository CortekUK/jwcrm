"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  CheckCircle2,
  Clock,
  Home,
  Plane,
  Thermometer,
  XCircle,
  Users,
  Save,
  CheckCheck,
  Circle,
  AlertTriangle,
  Mail,
  Calendar,
  ClipboardList,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, isAfter, startOfDay, startOfMonth, endOfMonth, subWeeks, startOfWeek, endOfWeek, subMonths } from "date-fns";
import { Database } from "@/integrations/supabase/types";
import { AttendanceCalendar, ExportAttendanceModal } from "@/components/hr/attendance";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

interface Employee {
  id: string;
  full_name: string;
  department_id: string | null;
  department_name?: string;
  start_date: string;
}

interface AttendanceRecord {
  employee_id: string;
  status: AttendanceStatus;
  check_in_time: string | null;
  reason: string | null;
}

const getStatusConfig = (t: (key: string) => string): Record<
  AttendanceStatus,
  { icon: any; color: string; bgColor: string; label: string }
> => ({
  present: {
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    label: t("attendanceStatus.present"),
  },
  late: {
    icon: Clock,
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    label: t("attendanceStatus.late"),
  },
  wfh: {
    icon: Home,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    label: t("attendanceStatus.wfh"),
  },
  on_leave: {
    icon: Plane,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    label: t("attendanceStatus.onLeave"),
  },
  sick_leave: {
    icon: Thermometer,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 dark:bg-amber-950/30",
    label: t("attendanceStatus.sickLeave"),
  },
  absent: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    label: t("attendanceStatus.absent"),
  },
});

interface CalendarAttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  status: AttendanceStatus;
  check_in_time: string | null;
  reason: string | null;
}

export default function AttendancePage() {
  const { t } = useTranslation(["hr"]);
  const { toast } = useToast();
  const statusConfig = getStatusConfig(t);
  // Neutral visual for an employee who hasn't checked in and hasn't been marked.
  const notMarkedConfig = {
    icon: Circle,
    color: "text-gray-400",
    bgColor: "bg-gray-50 dark:bg-muted",
    label: t("attendancePage.notMarked", "Not marked"),
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [existingRecords, setExistingRecords] = useState<Record<string, string>>({});
  const [employeesOnLeave, setEmployeesOnLeave] = useState<Map<string, string>>(new Map());
  const [activeTab, setActiveTab] = useState("mark");
  const [showExportModal, setShowExportModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "all">("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  // Calendar-specific state
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarAttendanceRecord[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Get the minimum date for editing (7 days ago)
  const minEditableDate = format(subDays(new Date(), 7), "yyyy-MM-dd");
  const maxDate = format(new Date(), "yyyy-MM-dd");
  
  // Date presets for quick selection
  const datePresets = [
    { label: t("attendancePage.today", "Today"), date: format(new Date(), "yyyy-MM-dd") },
    { label: t("attendancePage.yesterday", "Yesterday"), date: format(subDays(new Date(), 1), "yyyy-MM-dd") },
  ];

  // Navigate to previous/next day
  const navigateDay = (direction: "prev" | "next") => {
    const currentDate = new Date(selectedDate);
    const newDate = direction === "prev" 
      ? subDays(currentDate, 1) 
      : new Date(currentDate.setDate(currentDate.getDate() + 1));
    
    // Don't go into the future
    if (direction === "next" && isAfter(newDate, new Date())) return;
    
    setSelectedDate(format(newDate, "yyyy-MM-dd"));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch active employees
      const { data: employeesData } = await supabase
        .from("employees")
        .select(`
          id,
          full_name,
          department_id,
          start_date,
          departments(name)
        `)
        .eq("employment_status", "active")
        .order("full_name");

      const formattedEmployees: Employee[] = (employeesData || []).map((emp: any) => ({
        id: emp.id,
        full_name: emp.full_name,
        department_id: emp.department_id,
        department_name: emp.departments?.name,
        start_date: emp.start_date,
      }));

      setEmployees(formattedEmployees);

      // Fetch existing attendance for selected date
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", selectedDate);

      // Fetch approved leave requests that cover the selected date
      const { data: approvedLeave } = await supabase
        .from("leave_requests")
        .select("employee_id, leave_type")
        .eq("status", "approved")
        .lte("start_date", selectedDate)
        .gte("end_date", selectedDate);

      // Create map of employees on approved leave
      const leaveMap = new Map<string, string>();
      (approvedLeave || []).forEach((leave: { employee_id: string; leave_type: string }) => {
        leaveMap.set(leave.employee_id, leave.leave_type);
      });
      setEmployeesOnLeave(leaveMap);

      const existingAttendance: Record<string, AttendanceRecord> = {};
      const existingIds: Record<string, string> = {};

      (attendanceData || []).forEach((record: any) => {
        existingAttendance[record.employee_id] = {
          employee_id: record.employee_id,
          status: record.status,
          check_in_time: record.check_in_time,
          reason: record.reason,
        };
        existingIds[record.employee_id] = record.id;
      });

      // Initialize attendance state with existing, approved leave, or default values
      // Only for employees who have started working by the selected date
      const initialAttendance: Record<string, AttendanceRecord> = {};
      formattedEmployees.forEach((emp) => {
        // Skip employees who haven't started working yet on the selected date
        const hasStarted = emp.start_date <= selectedDate;

        if (existingAttendance[emp.id]) {
          // Use existing attendance record
          initialAttendance[emp.id] = existingAttendance[emp.id];
        } else if (leaveMap.has(emp.id) && hasStarted) {
          // Pre-fill with approved leave status
          const leaveType = leaveMap.get(emp.id);
          initialAttendance[emp.id] = {
            employee_id: emp.id,
            status: leaveType === "sick" ? "sick_leave" : "on_leave",
            check_in_time: null,
            reason: null,
          };
        }
        // Otherwise leave the employee OUT of initialAttendance so they render
        // as "Not marked" (attendance reflects real logins + explicit HR marks,
        // not a fake default-present). Also skips employees not yet started.
      });

      setAttendance(initialAttendance);
      setExistingRecords(existingIds);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: t("common.error"),
        description: t("attendancePage.failedToFetch"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedDate, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch calendar data for the selected month
  const fetchCalendarData = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const monthStart = format(startOfMonth(calendarMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(calendarMonth), "yyyy-MM-dd");

      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("id, employee_id, date, status, check_in_time, reason")
        .gte("date", monthStart)
        .lte("date", monthEnd);

      if (error) throw error;

      setCalendarData(attendanceData || []);
    } catch (error) {
      console.error("Error fetching calendar data:", error);
      toast({
        title: t("common.error"),
        description: t("attendancePage.failedToFetchCalendar"),
        variant: "destructive",
      });
    } finally {
      setCalendarLoading(false);
    }
  }, [calendarMonth, toast]);

  // Fetch calendar data when tab changes or month changes
  useEffect(() => {
    if (activeTab === "calendar") {
      fetchCalendarData();
    }
  }, [activeTab, fetchCalendarData]);

  const handleStatusChange = (employeeId: string, status: AttendanceStatus) => {
    setAttendance((prev) => {
      const existing = prev[employeeId];
      return {
        ...prev,
        [employeeId]: {
          // employee_id/reason must exist even when marking a previously
          // "Not marked" employee (who had no record in state yet).
          employee_id: employeeId,
          reason: existing?.reason ?? null,
          status,
          // Set default check-in time for present/late
          check_in_time: status === "present" ? "09:00" : status === "late" ? "09:30" : null,
        },
      };
    });
  };

  const handleTimeChange = (employeeId: string, time: string) => {
    setAttendance((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        check_in_time: time,
      },
    }));
  };

  const handleReasonChange = (employeeId: string, reason: string) => {
    setAttendance((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        reason: reason || null,
      },
    }));
  };

  const markAllPresent = () => {
    const newAttendance: Record<string, AttendanceRecord> = {};
    employees.forEach((emp) => {
      // Only mark present if employee has started working by the selected date
      if (emp.start_date <= selectedDate) {
        newAttendance[emp.id] = {
          employee_id: emp.id,
          status: "present",
          check_in_time: "09:00",
          reason: null,
        };
      }
    });
    setAttendance(newAttendance);
  };

  const handleSave = async (): Promise<boolean> => {
    // Validate: time is required for late status
    const invalidRecords = Object.values(attendance).filter(
      (r) => r.status === "late" && !r.check_in_time
    );
    if (invalidRecords.length > 0) {
      toast({
        title: t("attendancePage.validationError"),
        description: t("attendancePage.checkInTimeRequired"),
        variant: "destructive",
      });
      return false;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      // Split into new records (insert) and existing records (update)
      const newRecords: any[] = [];
      const existingUpdates: any[] = [];

      Object.values(attendance).forEach((record) => {
        const base = {
          employee_id: record.employee_id,
          date: selectedDate,
          status: record.status,
          check_in_time: record.check_in_time,
          reason: record.reason,
          marked_by: userData.user?.id,
        };

        if (existingRecords[record.employee_id]) {
          // Existing record - include id for update
          existingUpdates.push({ ...base, id: existingRecords[record.employee_id] });
        } else {
          // New record - no id, let DB generate
          newRecords.push(base);
        }
      });

      // Insert new records
      if (newRecords.length > 0) {
        const { error: insertError } = await supabase
          .from("attendance")
          .insert(newRecords);
        if (insertError) throw insertError;
      }

      // Update existing records
      if (existingUpdates.length > 0) {
        const { error: updateError } = await supabase
          .from("attendance")
          .upsert(existingUpdates, { onConflict: "employee_id,date" });
        if (updateError) throw updateError;
      }

      toast({
        title: t("attendancePage.attendanceSaved"),
        description: t("attendancePage.attendanceSavedDesc", { count: employees.length }),
      });

      // Refresh to get updated IDs
      fetchData();
      return true;
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast({
        title: t("common.error"),
        description: t("attendancePage.failedToSave"),
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndEmail = async () => {
    // First save attendance
    const saved = await handleSave();
    if (!saved) return;

    setSendingEmail(true);
    try {
      // Get session for API auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: t("common.error"),
          description: t("attendancePage.notAuthenticated"),
          variant: "destructive",
        });
        return;
      }

      // Get user email
      const { data: userData } = await supabase.auth.getUser();
      const hrEmail = userData.user?.email || "";

      // Call email API
      const response = await fetch("/api/hr/attendance/email-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          date: selectedDate,
          hrEmail,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send email");
      }

      toast({
        title: t("attendancePage.emailSent"),
        description: t("attendancePage.emailSentDesc"),
      });
    } catch (error) {
      console.error("Error sending email:", error);
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("attendancePage.failedToSave"),
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const getStatusCounts = () => {
    const counts: Record<AttendanceStatus, number> = {
      present: 0,
      late: 0,
      wfh: 0,
      on_leave: 0,
      sick_leave: 0,
      absent: 0,
    };

    Object.values(attendance).forEach((record) => {
      counts[record.status]++;
    });

    return counts;
  };

  const counts = getStatusCounts();
  // Only count employees who have started working by the selected date
  const startedEmployees = employees.filter(emp => emp.start_date <= selectedDate);
  const startedCount = startedEmployees.length;
  const attendanceRate = startedCount > 0
    ? Math.round(((counts.present + counts.late + counts.wfh) / startedCount) * 100)
    : 0;

  // Get unique departments for filter
  const departments = Array.from(
    new Map(
      employees
        .filter(emp => emp.department_id && emp.department_name)
        .map(emp => [emp.department_id, emp.department_name])
    )
  ).map(([id, name]) => ({ id: id as string, name: name as string }));

  const canEdit = !isAfter(startOfDay(new Date(minEditableDate)), startOfDay(new Date(selectedDate)));
  const isHistorical = !canEdit;

  // Calendar event handlers
  const handleCalendarDayClick = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const sevenDaysAgo = subDays(new Date(), 7);

    // Check if date is within editable range (last 7 days)
    if (isAfter(date, sevenDaysAgo) && !isAfter(date, new Date())) {
      setSelectedDate(dateStr);
      setActiveTab("mark");
    }
  };

  const handleCalendarMonthChange = (month: Date) => {
    setCalendarMonth(month);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] dark:from-background dark:to-background border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ClipboardList className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("attendance", "Attendance")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] dark:text-muted-foreground ltr:ml-9 rtl:mr-9">
              {t("calendar.pageDescription", "Mark and view attendance for all employees")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowExportModal(true)}
            className="border-[#E6E6E4] dark:border-border hover:border-[#C6A03B] hover:bg-[#FAFAF8] dark:hover:bg-accent"
          >
            <FileSpreadsheet className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("calendar.exportReport", "Export Report")}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white dark:bg-card border border-[#E6E6E4] dark:border-border p-1.5 rounded-xl w-full grid grid-cols-2 h-auto">
          <TabsTrigger 
            value="mark" 
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[#555555] dark:text-muted-foreground font-medium transition-all flex items-center justify-center gap-2"
          >
            <ClipboardList className="h-4 w-4" />
            {t("calendar.markAttendance", "Mark Attendance")}
          </TabsTrigger>
          <TabsTrigger 
            value="calendar" 
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[#555555] dark:text-muted-foreground font-medium transition-all flex items-center justify-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            {t("calendar.calendarView", "Calendar View")}
          </TabsTrigger>
        </TabsList>

        {/* Mark Attendance Tab */}
        <TabsContent value="mark" className="space-y-6 mt-6">
          {/* Date Selection Card */}
          <Card className="border-[#E6E6E4] dark:border-border">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Date Navigation */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateDay("prev")}
                    className="h-9 w-9 border-[#E6E6E4] dark:border-border hover:border-[#C6A03B] hover:bg-[#FAFAF8] dark:hover:bg-accent"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-[200px] justify-start text-left font-normal border-[#E6E6E4] dark:border-border hover:border-[#C6A03B] hover:bg-[#FAFAF8] dark:hover:bg-accent"
                      >
                        <CalendarDays className="ltr:mr-2 rtl:ml-2 h-4 w-4 text-[#C6A03B]" />
                        <span className="font-medium text-[#222222] dark:text-foreground">
                          {format(new Date(selectedDate), "EEE, MMM d, yyyy")}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={new Date(selectedDate)}
                        onSelect={(date) => date && setSelectedDate(format(date, "yyyy-MM-dd"))}
                        disabled={(date) => isAfter(date, new Date())}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateDay("next")}
                    disabled={selectedDate === maxDate}
                    className="h-9 w-9 border-[#E6E6E4] dark:border-border hover:border-[#C6A03B] hover:bg-[#FAFAF8] dark:hover:bg-accent"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Quick Date Presets */}
                <div className="flex flex-wrap items-center gap-2">
                  {datePresets.map((preset) => (
                    <Button
                      key={preset.label}
                      variant={selectedDate === preset.date ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDate(preset.date)}
                      className={selectedDate === preset.date 
                        ? "bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white" 
                        : "border-[#E6E6E4] dark:border-border hover:border-[#C6A03B] hover:bg-[#FAFAF8] dark:hover:bg-accent"
                      }
                    >
                      {preset.label}
                    </Button>
                  ))}
                  <Button
                    variant={selectedDate >= format(startOfWeek(new Date(), { weekStartsOn: 0 }), "yyyy-MM-dd") && selectedDate <= maxDate && selectedDate !== datePresets[0].date && selectedDate !== datePresets[1].date ? "outline" : "outline"}
                    size="sm"
                    onClick={() => setSelectedDate(format(startOfWeek(new Date(), { weekStartsOn: 0 }), "yyyy-MM-dd"))}
                    className="border-[#E6E6E4] dark:border-border hover:border-[#C6A03B] hover:bg-[#FAFAF8] dark:hover:bg-accent"
                  >
                    {t("attendancePage.thisWeek", "This Week")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDate(format(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 0 }), "yyyy-MM-dd"))}
                    className="border-[#E6E6E4] dark:border-border hover:border-[#C6A03B] hover:bg-[#FAFAF8] dark:hover:bg-accent"
                  >
                    {t("attendancePage.lastWeek", "Last Week")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDate(format(startOfMonth(new Date()), "yyyy-MM-dd"))}
                    className="border-[#E6E6E4] dark:border-border hover:border-[#C6A03B] hover:bg-[#FAFAF8] dark:hover:bg-accent"
                  >
                    {t("attendancePage.thisMonth", "This Month")}
                  </Button>
                </div>

                {/* Historical Mode Indicator */}
                {isHistorical && (
                  <Badge className="bg-[#FFF9E6] text-[#C6A03B] border-[#C6A03B]/30">
                    <Clock className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                    {t("attendancePage.viewOnlyMode", "View Only")}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Mark Attendance Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[180px] border-[#E6E6E4]">
                  <SelectValue placeholder={t("attendancePage.allDepartments", "All Departments")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("attendancePage.allDepartments", "All Departments")}</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={markAllPresent} disabled={!canEdit} className="border-[#E6E6E4] dark:border-border hover:border-[#C6A03B] hover:bg-[#FAFAF8] dark:hover:bg-accent">
                <CheckCheck className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("attendancePage.markAllPresent")}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || sendingEmail || !canEdit}
                className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                    {t("saving")}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("attendancePage.saveAttendance")}
                  </>
                )}
              </Button>
              <Button
                onClick={handleSaveAndEmail}
                disabled={saving || sendingEmail || !canEdit}
                variant="outline"
                className="border-[hsl(var(--jw-primary-green))] text-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))]/10"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                    {t("sending")}
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("attendancePage.saveAndEmail")}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-[#E6E6E4] dark:border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#6B6B6B] dark:text-muted-foreground">{t("attendancePage.total")}</p>
                  <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                    <Users className="h-5 w-5 text-[#0C5536]" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-[#222222] dark:text-foreground mt-2">{startedCount}</p>
                {employees.length !== startedCount && (
                  <p className="text-xs text-[#999999]">({employees.length - startedCount} {t("attendancePage.notYetStarted")})</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#E6E6E4] dark:border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#6B6B6B] dark:text-muted-foreground">{statusConfig.present.label}</p>
                  <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-[#0C5536]" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-[#0C5536] mt-2">{counts.present}</p>
              </CardContent>
            </Card>

            <Card className="border-[#E6E6E4] dark:border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#6B6B6B] dark:text-muted-foreground">{statusConfig.absent.label}</p>
                  <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                    <XCircle className="h-5 w-5 text-[#0C5536]" />
                  </div>
                </div>
                <p className={`text-2xl font-bold mt-2 ${counts.absent > 0 ? "text-[#C0392B]" : "text-[#222222]"}`}>{counts.absent}</p>
              </CardContent>
            </Card>

            <Card className="border-[#E6E6E4] dark:border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#6B6B6B] dark:text-muted-foreground">{t("attendancePage.attendanceRate")}</p>
                  <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                    <CheckCheck className="h-5 w-5 text-[#0C5536]" />
                  </div>
                </div>
                <p className={`text-2xl font-bold mt-2 ${attendanceRate >= 85 ? "text-[#0C5536]" : attendanceRate >= 70 ? "text-[#C6A03B]" : "text-[#C0392B]"}`}>
                  {attendanceRate}%
                </p>
                <div className="h-1.5 bg-[#E6E6E4] dark:bg-muted rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all ${attendanceRate >= 85 ? "bg-[#0C5536]" : attendanceRate >= 70 ? "bg-[#C6A03B]" : "bg-[#C0392B]"}`}
                    style={{ width: `${attendanceRate}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Filters */}
          <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-2.5 rounded-lg border transition-all text-center ${
                statusFilter === "all"
                  ? "border-[hsl(var(--jw-primary-green))] bg-[hsl(var(--jw-primary-green))]/10 text-[hsl(var(--jw-primary-green))] font-medium"
                  : "border-[#E6E6E4] dark:border-border bg-white dark:bg-card text-[#555555] dark:text-muted-foreground hover:border-[#C6A03B] hover:bg-[#FAFAF8] dark:hover:bg-accent"
              }`}
            >
              <span className="text-sm">{t("attendancePage.allStatuses", "All")}</span>
              <span className="block text-lg font-semibold">{startedCount}</span>
            </button>
            {(Object.keys(statusConfig) as AttendanceStatus[]).map((status) => {
              const config = statusConfig[status];
              const count = counts[status];
              const isSelected = statusFilter === status;

              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(isSelected ? "all" : status)}
                  className={`px-3 py-2.5 rounded-lg border transition-all text-center ${
                    isSelected
                      ? `${config.bgColor} ${config.color.replace("text", "border")} font-medium`
                      : count > 0
                      ? "border-[#E6E6E4] dark:border-border bg-white dark:bg-card hover:border-[#C6A03B] hover:bg-[#FAFAF8] dark:hover:bg-accent"
                      : "border-[#E6E6E4] dark:border-border bg-white dark:bg-card"
                  }`}
                >
                  <span className={`text-sm ${isSelected ? config.color : count > 0 ? "text-[#555555] dark:text-muted-foreground" : "text-[#999999]"}`}>
                    {config.label}
                  </span>
                  <span className={`block text-lg font-semibold ${isSelected ? config.color : count > 0 ? "text-[#222222] dark:text-foreground" : "text-[#999999]"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

      {/* Employee List */}
      <Card className="border-[#E6E6E4] dark:border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Users className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("employees")}
              </CardTitle>
              {departmentFilter !== "all" && (
                <Badge variant="outline" className="text-[#555555] dark:text-muted-foreground border-[#E6E6E4] dark:border-border bg-[#FAFAF8] dark:bg-muted">
                  {departments.find(d => d.id === departmentFilter)?.name}
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge className={`${statusConfig[statusFilter].bgColor} ${statusConfig[statusFilter].color} border-0`}>
                  {statusConfig[statusFilter].label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(statusFilter !== "all" || departmentFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusFilter("all");
                    setDepartmentFilter("all");
                  }}
                  className="text-[#6B6B6B] hover:text-[#222222] text-xs"
                >
                  {t("attendancePage.clearFilters", "Clear filters")}
                </Button>
              )}
              {!canEdit && (
                <Badge variant="outline" className="text-[#C6A03B] border-[#C6A03B]/30 bg-[#FFF9E6]">
                  {t("attendancePage.readOnlyDateTooOld")}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {employees
              .filter((employee) => {
                const record = attendance[employee.id];
                const hasStarted = employee.start_date <= selectedDate;
                
                // Department filter
                if (departmentFilter !== "all" && employee.department_id !== departmentFilter) {
                  return false;
                }
                
                // Status filter
                if (statusFilter === "all") return true;
                if (!hasStarted) return false;
                return record?.status === statusFilter;
              })
              .map((employee) => {
              const record = attendance[employee.id];
              const hasStarted = employee.start_date <= selectedDate;
              const config = record ? statusConfig[record.status] : notMarkedConfig;
              const showTimeField = hasStarted && (record?.status === "present" || record?.status === "late");
              const showReasonField = hasStarted && record?.status === "absent";
              const isSaved = !!existingRecords[employee.id];
              const isLateStatus = record?.status === "late";
              // Only show warning if time is strictly after 09:00 (compare HH:mm format)
              const checkTime = record?.check_in_time?.substring(0, 5) || "";
              const isLateArrival = checkTime > "09:00";

              return (
                <div
                  key={employee.id}
                  className={`p-3 rounded-lg border ${hasStarted ? `${config.bgColor} ${config.color.replace("text", "border")}/30` : "bg-gray-50 dark:bg-muted border-gray-200 dark:border-border"} flex flex-col md:flex-row md:items-center gap-3`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Saved status indicator */}
                      {hasStarted ? (
                        isSaved ? (
                          <span title="Saved">
                            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                          </span>
                        ) : (
                          <span title="Not saved">
                            <Circle className="h-5 w-5 text-gray-300 shrink-0" />
                          </span>
                        )
                      ) : (
                        <span title="Not started yet">
                          <Circle className="h-5 w-5 text-gray-200 shrink-0" />
                        </span>
                      )}
                      <span className={`font-medium ${hasStarted ? "text-[#222222] dark:text-foreground" : "text-gray-400"}`}>{employee.full_name}</span>
                      {employee.department_name && (
                        <Badge variant="outline" className={`text-xs ${!hasStarted ? "opacity-50" : ""}`}>
                          {employee.department_name}
                        </Badge>
                      )}
                      {!hasStarted && (
                        <Badge className="text-xs bg-gray-200 text-gray-600 border-gray-300">
                          {t("attendancePage.notStartedYet", { date: format(new Date(employee.start_date), "MMM d, yyyy") })}
                        </Badge>
                      )}
                      {hasStarted && employeesOnLeave.has(employee.id) && (
                        <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                          {t("attendancePage.approvedLeave")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {hasStarted ? (
                      <>
                        <Select
                          value={record?.status ?? ""}
                          onValueChange={(value) => handleStatusChange(employee.id, value as AttendanceStatus)}
                          disabled={!canEdit}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder={t("attendancePage.notMarked", "Not marked")} />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(statusConfig) as AttendanceStatus[]).map((status) => {
                              const cfg = statusConfig[status];
                              const Icon = cfg.icon;
                              return (
                                <SelectItem key={status} value={status}>
                                  <div className="flex items-center gap-2">
                                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                                    {cfg.label}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>

                        {showTimeField && (
                          <div className="flex items-center gap-1">
                            <Input
                              type="time"
                              value={record?.check_in_time || "09:00"}
                              onChange={(e) => handleTimeChange(employee.id, e.target.value)}
                              className={`w-28 ${isLateStatus && !record?.check_in_time ? "border-red-500" : ""}`}
                              disabled={!canEdit}
                            />
                            {isLateStatus && (
                              <span className="text-red-500 text-sm">*</span>
                            )}
                            {isLateArrival && (
                              <span title="Arrived after 9:00 AM">
                                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                              </span>
                            )}
                          </div>
                        )}

                        {showReasonField && (
                          <Input
                            type="text"
                            placeholder={t("attendancePage.reasonOptional")}
                            value={record?.reason || ""}
                            onChange={(e) => handleReasonChange(employee.id, e.target.value)}
                            className="w-48"
                            disabled={!canEdit}
                          />
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-gray-400 italic">
                        {t("attendancePage.startsOn", { date: format(new Date(employee.start_date), "MMM d") })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {employees.length === 0 && (
              <div className="text-center py-12 text-[#6B6B6B] dark:text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
                <p>{t("attendancePage.noActiveEmployees")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        {/* Calendar View Tab */}
        <TabsContent value="calendar" className="mt-6">
          {calendarLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
            </div>
          ) : (
            <AttendanceCalendar
              attendanceData={calendarData}
              employees={employees}
              defaultMonth={calendarMonth}
              showLegend={true}
              showEmployeeFilter={true}
              onDayClick={handleCalendarDayClick}
              onMonthChange={handleCalendarMonthChange}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Export Modal */}
      <ExportAttendanceModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
        mode="main"
      />

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] dark:border-border text-center">
        <p className="text-xs text-[#777777] dark:text-muted-foreground">
          {t("legalNotice")}
        </p>
      </div>
    </div>
  );
}
