"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CalendarDays,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Plane,
  Thermometer,
  AlertCircle,
  Wallet,
  User,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, isWeekend, eachDayOfInterval, isFriday, isSaturday } from "date-fns";
import { Database } from "@/integrations/supabase/types";

type LeaveType = Database["public"]["Enums"]["leave_type"];
type LeaveRequestStatus = Database["public"]["Enums"]["leave_request_status"];

interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: LeaveRequestStatus;
  created_at: string;
  leave_balance?: number;
}

interface Employee {
  id: string;
  full_name: string;
}

interface AttendanceConflict {
  date: string;
  status: string;
}

const getLeaveTypeConfig = (t: (key: string) => string): Record<LeaveType, { icon: any; color: string; label: string }> => ({
  annual: { icon: Plane, color: "text-blue-600", label: t("leaveType.annual") },
  sick: { icon: Thermometer, color: "text-yellow-600", label: t("leaveType.sick") },
  emergency: { icon: AlertCircle, color: "text-orange-600", label: t("leaveType.emergency") },
  unpaid: { icon: Wallet, color: "text-gray-600", label: t("leaveType.unpaid") },
});

// Calculate working days (excluding Fri-Sat)
function calculateWorkingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) return 0;

  const days = eachDayOfInterval({ start, end });
  return days.filter((day) => !isFriday(day) && !isSaturday(day)).length;
}

// Send leave notification email
async function sendLeaveNotification(params: {
  employeeName: string;
  employeeEmail: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: "approved" | "denied";
  denialReason?: string;
  remainingBalance?: number;
  approverName?: string;
}) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      console.error("No auth token for email notification");
      return;
    }

    const response = await fetch("/api/hr/leave/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to send leave notification:", errorData);
    } else {
      console.log("Leave notification sent successfully");
    }
  } catch (error) {
    console.error("Error sending leave notification:", error);
  }
}

export default function LeavePage() {
  const { t } = useTranslation(["hr"]);
  const router = useRouter();
  const { toast } = useToast();
  const leaveTypeConfig = getLeaveTypeConfig(t);

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // New request dialog
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deny dialog
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [denialReason, setDenialReason] = useState("");

  // Conflict dialog
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictRequest, setConflictRequest] = useState<LeaveRequest | null>(null);
  const [conflicts, setConflicts] = useState<AttendanceConflict[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch pending leave requests with employee names
      const { data: requestsData } = await supabase
        .from("leave_requests")
        .select(`
          *,
          employees!inner(full_name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      const formattedRequests: LeaveRequest[] = (requestsData || []).map((req: any) => ({
        id: req.id,
        employee_id: req.employee_id,
        employee_name: req.employees.full_name,
        leave_type: req.leave_type,
        start_date: req.start_date,
        end_date: req.end_date,
        total_days: req.total_days,
        reason: req.reason,
        status: req.status,
        created_at: req.created_at,
      }));

      setRequests(formattedRequests);

      // Fetch employees for new request form
      const { data: employeesData } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("employment_status", "active")
        .order("full_name");

      setEmployees(employeesData || []);
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
  }, [toast, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Check for attendance conflicts before approving
  const checkAttendanceConflicts = async (request: LeaveRequest): Promise<AttendanceConflict[]> => {
    const days = eachDayOfInterval({
      start: new Date(request.start_date),
      end: new Date(request.end_date),
    }).filter((day) => !isFriday(day) && !isSaturday(day));

    const dateStrings = days.map((day) => format(day, "yyyy-MM-dd"));

    const { data: existingAttendance } = await supabase
      .from("attendance")
      .select("date, status")
      .eq("employee_id", request.employee_id)
      .in("date", dateStrings);

    // Filter to only conflicts (not already on_leave or sick_leave)
    const conflictingRecords = (existingAttendance || []).filter(
      (a) => a.status !== "on_leave" && a.status !== "sick_leave"
    );

    return conflictingRecords.map((a) => ({
      date: a.date,
      status: a.status,
    }));
  };

  // Execute the actual approval (called after conflict check)
  const executeApproval = async (request: LeaveRequest) => {
    try {
      const { data: userData } = await supabase.auth.getUser();

      // Update request status
      const { error: updateError } = await supabase
        .from("leave_requests")
        .update({
          status: "approved",
          approved_by: userData.user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (updateError) throw updateError;

      // Update leave balance
      const year = new Date().getFullYear();
      const balanceField =
        request.leave_type === "annual" ? "annual_used" : request.leave_type === "sick" ? "sick_used" : null;

      if (balanceField) {
        // Get or create leave balance
        const { data: balanceData } = await supabase
          .from("leave_balances")
          .select("*")
          .eq("employee_id", request.employee_id)
          .eq("year", year)
          .single();

        if (balanceData) {
          // Update existing balance
          await supabase
            .from("leave_balances")
            .update({
              [balanceField]: (balanceData[balanceField] || 0) + request.total_days,
              annual_pending:
                request.leave_type === "annual"
                  ? Math.max(0, (balanceData.annual_pending || 0) - request.total_days)
                  : balanceData.annual_pending,
            })
            .eq("id", balanceData.id);
        } else {
          // Create new balance
          await supabase.from("leave_balances").insert({
            employee_id: request.employee_id,
            year,
            [balanceField]: request.total_days,
          });
        }
      }

      // Mark attendance as on_leave for those dates
      const days = eachDayOfInterval({
        start: new Date(request.start_date),
        end: new Date(request.end_date),
      }).filter((day) => !isFriday(day) && !isSaturday(day));

      const attendanceRecords = days.map((day) => ({
        employee_id: request.employee_id,
        date: format(day, "yyyy-MM-dd"),
        status: (request.leave_type === "sick" ? "sick_leave" : "on_leave") as Database["public"]["Enums"]["attendance_status"],
        marked_by: userData.user?.id,
      }));

      if (attendanceRecords.length > 0) {
        await supabase.from("attendance").upsert(attendanceRecords, {
          onConflict: "employee_id,date",
        });
      }

      toast({
        title: t("leavePage.leaveApproved"),
        description: t("leavePage.leaveApprovedDesc", { name: request.employee_name }),
      });

      // Send email notification (non-blocking)
      // Get employee email
      const { data: empData } = await supabase
        .from("employees")
        .select("email")
        .eq("id", request.employee_id)
        .single();

      // Get approver name
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userData.user?.id || "")
        .single();

      // Calculate remaining balance
      const { data: updatedBalance } = await supabase
        .from("leave_balances")
        .select("annual_entitled, annual_used, annual_pending")
        .eq("employee_id", request.employee_id)
        .eq("year", year)
        .single();

      const remaining = updatedBalance
        ? updatedBalance.annual_entitled - updatedBalance.annual_used - updatedBalance.annual_pending
        : undefined;

      sendLeaveNotification({
        employeeName: request.employee_name,
        employeeEmail: empData?.email || "unknown@email.com",
        leaveType: request.leave_type,
        startDate: format(new Date(request.start_date), "MMM d, yyyy"),
        endDate: format(new Date(request.end_date), "MMM d, yyyy"),
        totalDays: request.total_days,
        status: "approved",
        remainingBalance: remaining,
        approverName: profileData?.full_name || undefined,
      });

      fetchData();
    } catch (error) {
      console.error("Error approving leave:", error);
      toast({
        title: t("common.error"),
        description: t("leavePage.failedToApprove"),
        variant: "destructive",
      });
    }
  };

  // Main approve handler - checks conflicts first
  const handleApprove = async (request: LeaveRequest) => {
    try {
      const foundConflicts = await checkAttendanceConflicts(request);

      if (foundConflicts.length > 0) {
        // Show conflict dialog
        setConflictRequest(request);
        setConflicts(foundConflicts);
        setConflictDialogOpen(true);
      } else {
        // No conflicts, proceed with approval
        await executeApproval(request);
      }
    } catch (error) {
      console.error("Error checking conflicts:", error);
      toast({
        title: t("common.error"),
        description: t("leavePage.failedToCheckConflicts"),
        variant: "destructive",
      });
    }
  };

  // Handle confirmation from conflict dialog
  const handleConfirmOverride = async () => {
    if (!conflictRequest) return;

    setConflictDialogOpen(false);
    await executeApproval(conflictRequest);
    setConflictRequest(null);
    setConflicts([]);
  };

  const handleDeny = async () => {
    if (!selectedRequest || !denialReason.trim()) {
      toast({
        title: t("common.error"),
        description: t("leavePage.provideReasonForDenial"),
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: "denied",
          denial_reason: denialReason,
          approved_by: userData.user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      // Reduce pending balance if it was annual leave
      if (selectedRequest.leave_type === "annual") {
        const year = new Date().getFullYear();
        const { data: balanceData } = await supabase
          .from("leave_balances")
          .select("*")
          .eq("employee_id", selectedRequest.employee_id)
          .eq("year", year)
          .single();

        if (balanceData) {
          await supabase
            .from("leave_balances")
            .update({
              annual_pending: Math.max(0, (balanceData.annual_pending || 0) - selectedRequest.total_days),
            })
            .eq("id", balanceData.id);
        }
      }

      toast({
        title: t("leavePage.leaveDenied"),
        description: t("leavePage.leaveDeniedDesc", { name: selectedRequest.employee_name }),
      });

      // Send denial notification email (non-blocking)
      const { data: empData } = await supabase
        .from("employees")
        .select("email")
        .eq("id", selectedRequest.employee_id)
        .single();

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userData.user?.id || "")
        .single();

      sendLeaveNotification({
        employeeName: selectedRequest.employee_name,
        employeeEmail: empData?.email || "unknown@email.com",
        leaveType: selectedRequest.leave_type,
        startDate: format(new Date(selectedRequest.start_date), "MMM d, yyyy"),
        endDate: format(new Date(selectedRequest.end_date), "MMM d, yyyy"),
        totalDays: selectedRequest.total_days,
        status: "denied",
        denialReason: denialReason,
        approverName: profileData?.full_name || undefined,
      });

      setDenyDialogOpen(false);
      setSelectedRequest(null);
      setDenialReason("");
      fetchData();
    } catch (error) {
      console.error("Error denying leave:", error);
      toast({
        title: t("common.error"),
        description: t("leavePage.failedToDeny"),
        variant: "destructive",
      });
    }
  };

  const handleSubmitRequest = async () => {
    if (!selectedEmployee || !startDate || !endDate) {
      toast({
        title: t("common.error"),
        description: t("leavePage.fillRequiredFields"),
        variant: "destructive",
      });
      return;
    }

    const workingDays = calculateWorkingDays(startDate, endDate);
    if (workingDays <= 0) {
      toast({
        title: t("common.error"),
        description: t("leavePage.invalidDateRange"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("leave_requests").insert({
        employee_id: selectedEmployee,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        total_days: workingDays,
        reason: reason || null,
        status: "pending",
      });

      if (error) throw error;

      // Update pending balance for annual leave
      if (leaveType === "annual") {
        const year = new Date().getFullYear();
        const { data: balanceData } = await supabase
          .from("leave_balances")
          .select("*")
          .eq("employee_id", selectedEmployee)
          .eq("year", year)
          .single();

        if (balanceData) {
          await supabase
            .from("leave_balances")
            .update({
              annual_pending: (balanceData.annual_pending || 0) + workingDays,
            })
            .eq("id", balanceData.id);
        } else {
          await supabase.from("leave_balances").insert({
            employee_id: selectedEmployee,
            year,
            annual_pending: workingDays,
          });
        }
      }

      toast({
        title: t("leavePage.leaveRequestCreated"),
        description: t("leavePage.leaveRequestCreatedDesc", { days: workingDays }),
      });

      setNewRequestOpen(false);
      setSelectedEmployee("");
      setLeaveType("annual");
      setStartDate("");
      setEndDate("");
      setReason("");
      fetchData();
    } catch (error) {
      console.error("Error creating leave request:", error);
      toast({
        title: t("common.error"),
        description: t("leavePage.failedToCreate"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculatedDays = startDate && endDate ? calculateWorkingDays(startDate, endDate) : 0;

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
          <h1 className="text-2xl font-bold text-[#222222]">{t("leavePage.leaveRequests")}</h1>
          <p className="text-[#6B6B6B]">{t("leavePage.manageLeaveRequests")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push("/admin/hr/leave/calendar")}>
            <Calendar className="h-4 w-4 mr-2" />
            {t("leaveCalendar.title")}
          </Button>
          <Button variant="outline" onClick={() => router.push("/admin/hr/leave/balances")}>
            {t("leavePage.viewBalances")}
          </Button>
          <Button
            onClick={() => setNewRequestOpen(true)}
            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("leavePage.newRequest")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B6B]">{t("leavePage.pendingCount")}</p>
                <p className="text-2xl font-bold text-yellow-600">{requests.length}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        {(Object.keys(leaveTypeConfig) as LeaveType[]).slice(0, 3).map((type) => {
          const config = leaveTypeConfig[type];
          const Icon = config.icon;
          const count = requests.filter((r) => r.leave_type === type).length;

          return (
            <Card key={type} className="border-[#E6E6E4]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#6B6B6B]">{config.label}</p>
                    <p className={`text-2xl font-bold ${count > 0 ? config.color : "text-[#222222]"}`}>{count}</p>
                  </div>
                  <Icon className={`h-8 w-8 ${count > 0 ? config.color : "text-[#E6E6E4]"}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pending Requests */}
      <Card className="border-[#E6E6E4]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            {t("leavePage.pendingRequests")} ({requests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-[#6B6B6B]">
              <CalendarDays className="h-12 w-12 mx-auto mb-2 text-[#E6E6E4]" />
              <p>{t("leavePage.noPendingRequests")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => {
                const config = leaveTypeConfig[request.leave_type];
                const Icon = config.icon;
                const daysAgo = differenceInDays(new Date(), new Date(request.created_at));

                return (
                  <div
                    key={request.id}
                    className="p-4 rounded-lg border border-[#E6E6E4] bg-white hover:bg-gray-50"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <User className="h-5 w-5 text-[#6B6B6B]" />
                          <span className="font-medium text-[#222222]">{request.employee_name}</span>
                          <Badge className={`${config.color.replace("text", "bg").replace("600", "100")} ${config.color}`}>
                            <Icon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                        </div>
                        <div className="text-sm text-[#6B6B6B] space-y-1 ml-8">
                          <p>
                            <span className="font-medium">{t("leavePage.dates")}:</span>{" "}
                            {format(new Date(request.start_date), "MMM d")} -{" "}
                            {format(new Date(request.end_date), "MMM d, yyyy")}
                            <span className="ml-2 font-medium">({request.total_days} {t("days")})</span>
                          </p>
                          {request.reason && (
                            <p>
                              <span className="font-medium">{t("common.reason")}:</span> {request.reason}
                            </p>
                          )}
                          <p className="text-xs text-[#999999]">
                            {daysAgo === 0 ? t("leavePage.submittedToday") : daysAgo === 1 ? t("leavePage.submittedYesterday") : t("leavePage.submittedDaysAgo", { days: daysAgo })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-8 md:ml-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => {
                            setSelectedRequest(request);
                            setDenyDialogOpen(true);
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          {t("leavePage.deny")}
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApprove(request)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {t("leavePage.approve")}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Request Dialog */}
      <Dialog open={newRequestOpen} onOpenChange={setNewRequestOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("leavePage.submitLeaveRequest")}</DialogTitle>
            <DialogDescription>{t("leavePage.submitRequestDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="employee">{t("leavePage.employee")}</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder={t("leavePage.selectEmployee")} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="leave_type">{t("leavePage.leaveTypeLabel")}</Label>
              <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(leaveTypeConfig) as LeaveType[]).map((type) => {
                    const config = leaveTypeConfig[type];
                    const Icon = config.icon;
                    return (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${config.color}`} />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start_date">{t("leavePage.startDate")}</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end_date">{t("leavePage.endDate")}</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
            </div>
            {calculatedDays > 0 && (
              <p className="text-sm text-[#6B6B6B]">
                {t("leavePage.workingDays")}: <span className="font-medium text-[#222222]">{calculatedDays}</span>{" "}
                <span className="text-xs">({t("leavePage.excludingFriSat")})</span>
              </p>
            )}
            <div className="grid gap-2">
              <Label htmlFor="reason">{t("leavePage.reasonOptional")}</Label>
              <Textarea
                id="reason"
                placeholder={t("leavePage.enterReason")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRequestOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSubmitRequest}
              disabled={isSubmitting || !selectedEmployee || !startDate || !endDate}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("leavePage.submitting")}
                </>
              ) : (
                t("leavePage.submitRequest")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deny Dialog */}
      <Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("leavePage.denyLeaveRequest")}</DialogTitle>
            <DialogDescription>
              {selectedRequest && t("leavePage.denyDescription", { name: selectedRequest.employee_name, type: leaveTypeConfig[selectedRequest.leave_type].label })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="denial_reason">{t("leavePage.reasonForDenial")}</Label>
              <Textarea
                id="denial_reason"
                placeholder={t("leavePage.enterDenialReason")}
                value={denialReason}
                onChange={(e) => setDenialReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleDeny}
              disabled={!denialReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              <XCircle className="mr-2 h-4 w-4" />
              {t("leavePage.denyRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Conflict Warning Dialog */}
      <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-5 w-5" />
              {t("leavePage.conflictDetected")}
            </DialogTitle>
            <DialogDescription>
              {conflictRequest && t("leavePage.conflictDescription", { name: conflictRequest.employee_name })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800 font-medium mb-2">{t("leavePage.conflictingRecords")}:</p>
              <ul className="space-y-1">
                {conflicts.map((conflict, idx) => (
                  <li key={idx} className="text-sm text-yellow-700 flex items-center gap-2">
                    <span className="font-medium">{format(new Date(conflict.date), "MMM d, yyyy")}</span>
                    <span>-</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {conflict.status.replace("_", " ")}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-sm text-[#6B6B6B] mt-3">
              {t("leavePage.approvingWillOverwrite")}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConflictDialogOpen(false);
                setConflictRequest(null);
                setConflicts([]);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleConfirmOverride} className="bg-yellow-600 hover:bg-yellow-700">
              <AlertCircle className="mr-2 h-4 w-4" />
              {t("leavePage.overrideAndApprove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
