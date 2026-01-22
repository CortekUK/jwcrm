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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, isAfter, startOfDay, startOfMonth, endOfMonth } from "date-fns";
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
    bgColor: "bg-green-50",
    label: t("attendanceStatus.present"),
  },
  late: {
    icon: Clock,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    label: t("attendanceStatus.late"),
  },
  wfh: {
    icon: Home,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    label: t("attendanceStatus.wfh"),
  },
  on_leave: {
    icon: Plane,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    label: t("attendanceStatus.onLeave"),
  },
  sick_leave: {
    icon: Thermometer,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    label: t("attendanceStatus.sickLeave"),
  },
  absent: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
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

  // Calendar-specific state
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarAttendanceRecord[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Get the minimum date (7 days ago)
  const minDate = format(subDays(new Date(), 7), "yyyy-MM-dd");
  const maxDate = format(new Date(), "yyyy-MM-dd");

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
        } else if (hasStarted) {
          // Default to present only if employee has started
          initialAttendance[emp.id] = {
            employee_id: emp.id,
            status: "present",
            check_in_time: "09:00",
            reason: null,
          };
        }
        // If employee hasn't started, don't add them to initialAttendance
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
    setAttendance((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        status,
        // Set default check-in time for present/late
        check_in_time: status === "present" ? "09:00" : status === "late" ? "09:30" : null,
      },
    }));
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

  const canEdit = !isAfter(startOfDay(new Date(minDate)), startOfDay(new Date(selectedDate)));

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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#222222]">
            {t("attendance", "Attendance")}
          </h1>
          <p className="text-[#6B6B6B]">
            {t("calendar.pageDescription", "Mark and view attendance for all employees")}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowExportModal(true)}
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          {t("calendar.exportReport", "Export Report")}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="mark" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            {t("calendar.markAttendance", "Mark Attendance")}
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t("calendar.calendarView", "Calendar View")}
          </TabsTrigger>
        </TabsList>

        {/* Mark Attendance Tab */}
        <TabsContent value="mark" className="space-y-6 mt-6">
          {/* Mark Attendance Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={minDate}
              max={maxDate}
              className="w-40"
            />
            <Button variant="outline" onClick={markAllPresent} disabled={!canEdit}>
              <CheckCheck className="h-4 w-4 mr-2" />
              {t("attendancePage.markAllPresent")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || sendingEmail || !canEdit}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("sending")}
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  {t("attendancePage.saveAndEmail")}
                </>
              )}
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B6B]">{t("attendancePage.total")}</p>
                <p className="text-2xl font-bold text-[#222222]">{startedCount}</p>
                {employees.length !== startedCount && (
                  <p className="text-xs text-gray-400">({employees.length - startedCount} {t("attendancePage.notYetStarted")})</p>
                )}
              </div>
              <Users className="h-8 w-8 text-[#6B6B6B]" />
            </div>
          </CardContent>
        </Card>

        {(Object.keys(statusConfig) as AttendanceStatus[]).map((status) => {
          const config = statusConfig[status];
          const Icon = config.icon;
          const count = counts[status];

          return (
            <Card
              key={status}
              className={`border-[#E6E6E4] ${count > 0 ? config.bgColor : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#6B6B6B]">{config.label}</p>
                    <p className={`text-2xl font-bold ${count > 0 ? config.color : "text-[#222222]"}`}>
                      {count}
                    </p>
                  </div>
                  <Icon className={`h-6 w-6 ${count > 0 ? config.color : "text-[#E6E6E4]"}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Attendance Rate */}
      <Card className="border-[#E6E6E4]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#6B6B6B]">{t("attendancePage.attendanceRate")}</p>
              <p className={`text-2xl font-bold ${attendanceRate >= 85 ? "text-green-600" : attendanceRate >= 70 ? "text-yellow-600" : "text-red-600"}`}>
                {attendanceRate}%
              </p>
            </div>
            <div className="w-48 h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${attendanceRate >= 85 ? "bg-green-500" : attendanceRate >= 70 ? "bg-yellow-500" : "bg-red-500"}`}
                style={{ width: `${attendanceRate}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee List */}
      <Card className="border-[#E6E6E4]">
        <CardHeader>
          <CardTitle className="text-lg">
            {t("employees")} ({employees.length})
            {!canEdit && (
              <Badge variant="outline" className="ml-2 text-yellow-600 border-yellow-300">
                {t("attendancePage.readOnlyDateTooOld")}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {employees.map((employee) => {
              const record = attendance[employee.id];
              const hasStarted = employee.start_date <= selectedDate;
              const config = record ? statusConfig[record.status] : statusConfig.present;
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
                  className={`p-3 rounded-lg border ${hasStarted ? `${config.bgColor} ${config.color.replace("text", "border")}/30` : "bg-gray-50 border-gray-200"} flex flex-col md:flex-row md:items-center gap-3`}
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
                      <span className={`font-medium ${hasStarted ? "text-[#222222]" : "text-gray-400"}`}>{employee.full_name}</span>
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
                          value={record?.status || "present"}
                          onValueChange={(value) => handleStatusChange(employee.id, value as AttendanceStatus)}
                          disabled={!canEdit}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
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
              <div className="text-center py-8 text-[#6B6B6B]">
                <Users className="h-12 w-12 mx-auto mb-2 text-[#E6E6E4]" />
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
    </div>
  );
}
