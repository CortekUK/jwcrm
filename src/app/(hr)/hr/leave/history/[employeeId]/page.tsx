"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { useRouter, useParams } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  // Used by the Annual Leave and Sick Leave balance cards below. Their absence
  // threw a ReferenceError at render, so this page never painted — and
  // next.config.ts sets typescript.ignoreBuildErrors, so the build shipped it.
  Plane,
  Thermometer,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";
import { useLeaveTypes } from "@/hooks/useLeaveTypes";
import { openLeaveCertificate } from "@/lib/hr/leaveAttachmentClient";
import { getLeaveTypeIcon } from "@/lib/leave-type-icons";
import {
  fetchEmployeeLeaveBalances,
  balanceFor,
  type LeaveBalanceMap,
} from "@/lib/hr/leaveBalances";

type LeaveRequestStatus = Database["public"]["Enums"]["leave_request_status"];

interface Employee {
  id: string;
  full_name: string;
  department_name: string | null;
}

interface LeaveBalance {
  annual_entitled: number;
  annual_used: number;
  annual_pending: number;
  sick_entitled: number;
  sick_used: number;
}

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: LeaveRequestStatus;
  denial_reason: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  attachment_path: string | null;
  created_at: string;
  source: "request"; // From leave_requests table
}

interface AttendanceLeave {
  id: string;
  date: string;
  leave_type: "annual" | "sick";
  reason: string | null;
  created_at: string;
  source: "attendance"; // From attendance table
}

type LeaveRecord = LeaveRequest | AttendanceLeave;

const statusConfig: Record<LeaveRequestStatus, { icon: any; color: string; bgColor: string; label: string }> = {
  pending: { icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-100", label: "Pending" },
  approved: { icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100", label: "Approved" },
  denied: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100", label: "Denied" },
};

export default function EmployeeLeaveHistoryPage() {
  const { t } = useTranslation(["hr"]);
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const employeeId = params.employeeId as string;
  const { leaveTypes: leaveTypesList, getBySlug } = useLeaveTypes();

  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  /** Every leave type balance for the selected year, keyed by slug. */
  const [balancesBySlug, setBalancesBySlug] = useState<LeaveBalanceMap>({});
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [attendanceLeaves, setAttendanceLeaves] = useState<AttendanceLeave[]>([]);

  // Filters
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Available years (current year and 2 previous years)
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const fetchData = useCallback(async () => {
    if (!employeeId) return;

    setLoading(true);
    try {
      // Fetch employee details
      const { data: empData } = await supabase
        .from("employees")
        .select(`
          id,
          full_name,
          departments(name)
        `)
        .eq("id", employeeId)
        .single();

      if (empData) {
        setEmployee({
          id: empData.id,
          full_name: empData.full_name,
          department_name: (empData.departments as any)?.name || null,
        });
      }

      // Fetch leave balances for the selected year via the shared helper. It
      // reads the per-leave-type table and falls back to the legacy
      // annual_*/sick_* columns when that table is not present.
      const { balances: balanceMap } = await fetchEmployeeLeaveBalances(
        employeeId,
        selectedYear,
      );

      setBalancesBySlug(balanceMap);

      const annual = balanceFor(balanceMap, "annual");
      const sick = balanceFor(balanceMap, "sick");
      setBalance({
        annual_entitled: annual.entitled,
        annual_used: annual.used,
        annual_pending: annual.pending,
        sick_entitled: sick.entitled,
        sick_used: sick.used,
      });

      // Fetch leave requests
      const { data: requestsData } = await supabase
        .from("leave_requests")
        .select(`
          id,
          leave_type,
          start_date,
          end_date,
          total_days,
          reason,
          status,
          denial_reason,
          approved_by,
          approved_at,
          attachment_path,
          created_at
        `)
        .eq("employee_id", employeeId)
        .gte("start_date", `${selectedYear}-01-01`)
        .lte("start_date", `${selectedYear}-12-31`)
        .order("start_date", { ascending: false });

      // Fetch approver names for approved/denied requests
      const approverIds = (requestsData || [])
        .filter((r) => r.approved_by)
        .map((r) => r.approved_by);

      let approverMap = new Map<string, string>();
      if (approverIds.length > 0) {
        const { data: usersData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", approverIds);

        if (usersData) {
          usersData.forEach((u) => {
            approverMap.set(u.id, u.full_name || "Unknown");
          });
        }
      }

      const formattedRequests: LeaveRequest[] = (requestsData || []).map((req) => ({
        id: req.id,
        leave_type: req.leave_type,
        start_date: req.start_date,
        end_date: req.end_date,
        total_days: req.total_days,
        reason: req.reason,
        status: req.status,
        denial_reason: req.denial_reason,
        approved_by_name: req.approved_by ? approverMap.get(req.approved_by) || null : null,
        approved_at: req.approved_at,
        attachment_path: req.attachment_path,
        created_at: req.created_at,
        source: "request" as const,
      }));

      setRequests(formattedRequests);

      // Fetch attendance-based leaves (sick_leave or on_leave marked directly)
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("id, date, status, reason, created_at")
        .eq("employee_id", employeeId)
        .in("status", ["sick_leave", "on_leave"])
        .gte("date", `${selectedYear}-01-01`)
        .lte("date", `${selectedYear}-12-31`)
        .order("date", { ascending: false });

      // Get leave request dates to exclude (avoid duplicates)
      const requestDates = new Set<string>();
      (requestsData || []).forEach((req) => {
        // Add all dates in the range
        const start = new Date(req.start_date);
        const end = new Date(req.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          requestDates.add(d.toISOString().split("T")[0]);
        }
      });

      // Filter out attendance records that are already covered by leave requests
      const formattedAttendanceLeaves: AttendanceLeave[] = (attendanceData || [])
        .filter((att) => !requestDates.has(att.date))
        .map((att) => ({
          id: att.id,
          date: att.date,
          leave_type: att.status === "sick_leave" ? "sick" : "annual",
          reason: att.reason,
          created_at: att.created_at,
          source: "attendance" as const,
        }));

      setAttendanceLeaves(formattedAttendanceLeaves);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch leave history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [employeeId, selectedYear, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter requests
  // Combine and filter all leave records
  const allRecords = useMemo((): LeaveRecord[] => {
    // Filter leave requests
    const filteredRequests = requests.filter((req) => {
      if (selectedType !== "all" && req.leave_type !== selectedType) return false;
      if (selectedStatus !== "all" && req.status !== selectedStatus) return false;
      return true;
    });

    // Filter attendance leaves (only show if status filter is "all" or "approved" since they're already taken)
    const filteredAttendance = attendanceLeaves.filter((att) => {
      if (selectedType !== "all" && att.leave_type !== selectedType) return false;
      if (selectedStatus !== "all" && selectedStatus !== "approved") return false; // Attendance leaves are effectively "approved"
      return true;
    });

    // Combine and sort by date (most recent first)
    const combined: LeaveRecord[] = [...filteredRequests, ...filteredAttendance];
    combined.sort((a, b) => {
      const dateA = a.source === "request" ? a.start_date : a.date;
      const dateB = b.source === "request" ? b.start_date : b.date;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return combined;
  }, [requests, attendanceLeaves, selectedType, selectedStatus]);

  // Calculate balance metrics
  const annualRemaining = balance
    ? balance.annual_entitled - balance.annual_used - balance.annual_pending
    : 0;
  const annualUsedPercent = balance
    ? Math.round((balance.annual_used / balance.annual_entitled) * 100)
    : 0;
  const sickRemaining = balance ? balance.sick_entitled - balance.sick_used : 0;
  const sickUsedPercent = balance
    ? Math.round((balance.sick_used / balance.sick_entitled) * 100)
    : 0;

  // Balance cards for any OTHER leave type that tracks a balance. Before the
  // employee_leave_balances table existed these could not be stored at all, so
  // there was nothing to show.
  const customTrackedBalances = leaveTypesList
    .filter((lt) => lt.tracks_balance && lt.slug !== "annual" && lt.slug !== "sick")
    .map((lt) => ({ leaveType: lt, bal: balanceFor(balancesBySlug, lt.slug) }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <User className="h-12 w-12 text-gray-300" />
        <p className="text-gray-500">Employee not found</p>
        <Button variant="outline" onClick={() => router.push("/admin/hr/leave")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Leave
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#222222]">{employee.full_name}</h1>
            <p className="text-[#6B6B6B]">
              {employee.department_name || "No Department"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-32">
              <Calendar className="h-4 w-4 mr-2 text-gray-500" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Leave Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Annual Leave */}
        <Card className="border-[#E6E6E4]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              <Plane className="h-5 w-5 text-blue-600" />
              Annual Leave
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Entitled</span>
              <span className="font-medium">{balance?.annual_entitled || 30} days</span>
            </div>
            <Progress value={annualUsedPercent} className="h-2" />
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">{balance?.annual_used || 0}</p>
                <p className="text-xs text-gray-500">Used</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{balance?.annual_pending || 0}</p>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${annualRemaining <= 5 ? "text-red-600" : "text-blue-600"}`}>
                  {annualRemaining}
                </p>
                <p className="text-xs text-gray-500">Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sick Leave */}
        <Card className="border-[#E6E6E4]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              <Thermometer className="h-5 w-5 text-yellow-600" />
              Sick Leave
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Entitled (UAE Law)</span>
              <span className="font-medium">{balance?.sick_entitled || 90} days</span>
            </div>
            <Progress value={sickUsedPercent} className="h-2" />
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-yellow-600">{balance?.sick_used || 0}</p>
                <p className="text-xs text-gray-500">Used</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{sickRemaining}</p>
                <p className="text-xs text-gray-500">Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custom balance-tracking leave types */}
        {customTrackedBalances.map(({ leaveType, bal }) => {
          const TypeIcon = getLeaveTypeIcon(leaveType.icon_name);
          const remaining = bal.entitled - bal.used - bal.pending;
          const usedPercent = bal.entitled
            ? Math.round((bal.used / bal.entitled) * 100)
            : 0;

          return (
            <Card key={leaveType.slug} className="border-[#E6E6E4]">
              <CardHeader className="pb-2">
                <CardTitle
                  className="text-xl font-semibold text-[#0C5536] flex items-center gap-2"
                  style={{ fontFamily: "Playfair Display, serif" }}
                >
                  <TypeIcon className={`h-5 w-5 ${leaveType.color_class}`} />
                  {leaveType.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Entitled</span>
                  <span className="font-medium">{bal.entitled} days</span>
                </div>
                <Progress value={usedPercent} className="h-2" />
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{bal.used}</p>
                    <p className="text-xs text-gray-500">Used</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-600">{bal.pending}</p>
                    <p className="text-xs text-gray-500">Pending</p>
                  </div>
                  <div>
                    <p
                      className={`text-2xl font-bold ${remaining <= 5 ? "text-red-600" : "text-blue-600"}`}
                    >
                      {remaining}
                    </p>
                    <p className="text-xs text-gray-500">Remaining</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Leave History */}
      <Card className="border-[#E6E6E4]">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              <FileText className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              Leave History ({selectedYear})
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {leaveTypesList.map((lt) => (
                    <SelectItem key={lt.slug} value={lt.slug}>
                      {lt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {allRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No leave records found for {selectedYear}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allRecords.map((record) => {
                const lt = getBySlug(record.leave_type);
                const typeConfig = {
                  icon: getLeaveTypeIcon(lt?.icon_name || "Calendar"),
                  color: lt?.color_class || "text-gray-600",
                  bgColor: lt?.bg_color_class || "bg-gray-100",
                  label: lt?.name || record.leave_type,
                };
                const TypeIcon = typeConfig.icon;

                // Handle leave request records
                if (record.source === "request") {
                  const request = record as LeaveRequest;
                  const statusConf = statusConfig[request.status];
                  const StatusIcon = statusConf.icon;

                  return (
                    <div
                      key={request.id}
                      className="p-4 rounded-lg border border-gray-100 bg-white hover:bg-gray-50"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${typeConfig.bgColor}`}>
                            <TypeIcon className={`h-5 w-5 ${typeConfig.color}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">{typeConfig.label}</span>
                              <Badge className={`${statusConf.bgColor} ${statusConf.color} text-xs`}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusConf.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">
                              {format(new Date(request.start_date), "MMM d")} -{" "}
                              {format(new Date(request.end_date), "MMM d, yyyy")}
                              <span className="ml-2 font-medium">({request.total_days} days)</span>
                            </p>
                            {request.reason && (
                              <p className="text-sm text-gray-500 mt-1">
                                <span className="font-medium">Reason:</span> {request.reason}
                              </p>
                            )}
                            {request.status === "denied" && request.denial_reason && (
                              <p className="text-sm text-red-600 mt-1">
                                <span className="font-medium">Denial Reason:</span> {request.denial_reason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-500 ml-10 md:ml-0">
                          {request.status !== "pending" && request.approved_by_name && (
                            <p>
                              {request.status === "approved" ? "Approved" : "Denied"} by{" "}
                              <span className="font-medium">{request.approved_by_name}</span>
                            </p>
                          )}
                          {request.approved_at && (
                            <p className="text-xs">
                              {format(new Date(request.approved_at), "MMM d, yyyy")}
                            </p>
                          )}
                          {request.attachment_path && (
                            <Button
                              variant="link"
                              size="sm"
                              className="text-xs text-blue-600 p-0 h-auto mt-1"
                              onClick={async () => {
                                const problem = await openLeaveCertificate(request.id);
                                if (problem) {
                                  toast({
                                    title: "Could not open certificate",
                                    description: problem,
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              View Certificate
                            </Button>
                          )}
                      </div>
                    </div>
                  </div>
                );
                }

                // Handle attendance-based leave records
                const attLeave = record as AttendanceLeave;
                return (
                  <div
                    key={attLeave.id}
                    className="p-4 rounded-lg border border-gray-100 bg-white hover:bg-gray-50"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${typeConfig.bgColor}`}>
                          <TypeIcon className={`h-5 w-5 ${typeConfig.color}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{typeConfig.label}</span>
                            <Badge className="bg-purple-100 text-purple-600 text-xs">
                              Via Attendance
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {format(new Date(attLeave.date), "MMM d, yyyy")}
                            <span className="ml-2 font-medium">(1 day)</span>
                          </p>
                          {attLeave.reason && (
                            <p className="text-sm text-gray-500 mt-1">
                              <span className="font-medium">Reason:</span> {attLeave.reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500 ml-10 md:ml-0">
                        <p className="text-xs text-purple-600">
                          Marked directly in attendance
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
