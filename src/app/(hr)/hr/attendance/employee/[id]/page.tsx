"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { useTranslation } from "react-i18next";
import {
  Loader2,
  CheckCircle2,
  Clock,
  Home,
  Plane,
  Thermometer,
  XCircle,
  ArrowLeft,
  Calendar,
  TrendingUp,
  FileSpreadsheet,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { SendWarningModal } from "@/components/hr/attendance/SendWarningModal";
import { ExportAttendanceModal } from "@/components/hr/attendance";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, subMonths, startOfYear, parseISO } from "date-fns";
import { Database } from "@/integrations/supabase/types";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  job_role_name: string | null;
  department_name: string | null;
  employment_status: string | null;
}

interface AttendanceRecord {
  id: string;
  date: string;
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

type PeriodOption = "7" | "30" | "90" | "180" | "year";

const getPeriodOptions = (t: (key: string) => string): { value: PeriodOption; label: string }[] => [
  { value: "7", label: t("period.last7days") },
  { value: "30", label: t("period.last30days") },
  { value: "90", label: t("period.last3months") },
  { value: "180", label: t("period.last6months") },
  { value: "year", label: t("period.thisYear") },
];

const PAGE_SIZE = 20;

export default function EmployeeAttendanceHistoryPage() {
  const { t } = useTranslation(["hr"]);
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const employeeId = params?.id as string;
  const statusConfig = getStatusConfig(t);
  const periodOptions = getPeriodOptions(t);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [period, setPeriod] = useState<PeriodOption>("30");
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);

  const getDateRange = useCallback((periodValue: PeriodOption) => {
    const today = new Date();
    let startDate: Date;

    switch (periodValue) {
      case "7":
        startDate = subDays(today, 7);
        break;
      case "30":
        startDate = subDays(today, 30);
        break;
      case "90":
        startDate = subMonths(today, 3);
        break;
      case "180":
        startDate = subMonths(today, 6);
        break;
      case "year":
        startDate = startOfYear(today);
        break;
      default:
        startDate = subDays(today, 30);
    }

    return {
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(today, "yyyy-MM-dd"),
    };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch employee details
      const { data: employeeData, error: empError } = await supabase
        .from("employees")
        .select(`
          id,
          full_name,
          email,
          employment_status,
          job_roles(name),
          departments(name)
        `)
        .eq("id", employeeId)
        .single();

      if (empError) throw empError;

      setEmployee({
        id: employeeData.id,
        full_name: employeeData.full_name,
        email: employeeData.email,
        job_role_name: (employeeData.job_roles as { name: string } | null)?.name ?? null,
        department_name: (employeeData.departments as { name: string } | null)?.name ?? null,
        employment_status: employeeData.employment_status,
      });

      // Fetch attendance records for the period
      const { startDate, endDate } = getDateRange(period);

      const { data: attendanceData, error: attError, count } = await supabase
        .from("attendance")
        .select("id, date, status, check_in_time, reason", { count: "exact" })
        .eq("employee_id", employeeId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (attError) throw attError;

      setRecords(attendanceData || []);
      setTotalRecords(count || 0);
      setDisplayCount(PAGE_SIZE);
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
  }, [employeeId, period, getDateRange, toast]);

  useEffect(() => {
    if (employeeId) {
      fetchData();
    }
  }, [employeeId, fetchData]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: t("common.error"),
          description: t("attendancePage.notAuthenticated"),
          variant: "destructive",
        });
        return;
      }

      const { startDate, endDate } = getDateRange(period);

      const response = await fetch("/api/hr/attendance/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          employeeId,
          startDate,
          endDate,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Export failed");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_${employee?.full_name.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: t("employeeAttendance.exportComplete"),
        description: t("employeeAttendance.exportCompleteDesc"),
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: t("employeeAttendance.exportFailed"),
        description: error instanceof Error ? error.message : t("attendancePage.failedToFetch"),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  // Calculate statistics
  const getStats = () => {
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

    const totalDays = records.length;
    const attendedDays = counts.present + counts.late + counts.wfh;
    const attendanceRate = totalDays > 0 ? Math.round((attendedDays / totalDays) * 100) : 0;

    return { counts, totalDays, attendanceRate };
  };

  const { counts, totalDays, attendanceRate } = getStats();

  const getAttendanceRateBadge = (rate: number) => {
    if (rate >= 95) {
      return <Badge className="bg-green-600 text-white">{t("employeeAttendance.excellent")}</Badge>;
    }
    if (rate >= 85) {
      return <Badge className="bg-yellow-500 text-white">{t("employeeAttendance.good")}</Badge>;
    }
    return <Badge className="bg-red-500 text-white">{t("employeeAttendance.needsImprovement")}</Badge>;
  };

  const displayedRecords = records.slice(0, displayCount);
  const hasMore = displayCount < records.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6">
        <p className="text-[#6B6B6B]">{t("employeeNotFound")}</p>
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
            size="sm"
            onClick={() => router.back()}
            className="text-[#6B6B6B]"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("common.back")}
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-[hsl(var(--jw-primary-green))] flex items-center justify-center text-white text-xl font-bold">
              {employee.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#222222]">{employee.full_name}</h1>
              <p className="text-sm text-[#6B6B6B]">
                {employee.job_role_name || t("hr:noJobRole")}
                {employee.department_name && ` • ${employee.department_name}`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setShowExportModal(true)}
            disabled={records.length === 0}
            className="border-[hsl(var(--jw-primary-green))] text-[hsl(var(--jw-primary-green))]"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {t("employeeAttendance.exportReport")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowWarningModal(true)}
            className="border-orange-500 text-orange-500 hover:bg-orange-50"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            {t("employeeAttendance.sendWarning")}
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <Card className="border-[#E6E6E4]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("employeeAttendance.summary")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Attendance Rate */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#6B6B6B]">{t("attendancePage.attendanceRate")}</span>
                {getAttendanceRateBadge(attendanceRate)}
              </div>
              <span className={`text-2xl font-bold ${
                attendanceRate >= 95 ? "text-green-600" :
                attendanceRate >= 85 ? "text-yellow-600" : "text-red-600"
              }`}>
                {attendanceRate}%
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  attendanceRate >= 95 ? "bg-green-500" :
                  attendanceRate >= 85 ? "bg-yellow-500" : "bg-red-500"
                }`}
                style={{ width: `${attendanceRate}%` }}
              />
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <p className="text-xs text-[#6B6B6B]">{t("employeeAttendance.totalDays")}</p>
              <p className="text-xl font-bold text-[#222222]">{totalDays}</p>
            </div>
            {(Object.keys(statusConfig) as AttendanceStatus[]).map((status) => {
              const config = statusConfig[status];
              const count = counts[status];
              const percentage = totalDays > 0 ? Math.round((count / totalDays) * 100) : 0;
              const Icon = config.icon;

              return (
                <div
                  key={status}
                  className={`p-3 rounded-lg border text-center ${count > 0 ? config.bgColor : "bg-gray-50"} ${count > 0 ? "border-current/20" : "border-gray-200"}`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Icon className={`h-4 w-4 ${count > 0 ? config.color : "text-gray-400"}`} />
                    <p className="text-xs text-[#6B6B6B]">{config.label}</p>
                  </div>
                  <p className={`text-xl font-bold ${count > 0 ? config.color : "text-gray-400"}`}>
                    {count}
                  </p>
                  <p className="text-xs text-[#6B6B6B]">({percentage}%)</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="border-[#E6E6E4]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("employeeAttendance.recentActivity")}
            <Badge variant="outline" className="ml-2">{records.length} {t("employeeAttendance.records")}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-8 text-[#6B6B6B]">
              <Calendar className="h-12 w-12 mx-auto mb-2 text-[#E6E6E4]" />
              <p>{t("employeeAttendance.noAttendanceRecords")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedRecords.map((record) => {
                const config = statusConfig[record.status];
                const Icon = config.icon;
                const recordDate = parseISO(record.date);

                return (
                  <div
                    key={record.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${config.bgColor} ${config.color.replace("text", "border")}/30`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${config.color}`} />
                      <div>
                        <p className="font-medium text-[#222222]">
                          {format(recordDate, "EEEE, MMMM d, yyyy")}
                        </p>
                        <p className={`text-sm ${config.color}`}>{config.label}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {record.check_in_time && (
                        <p className="text-sm text-[#6B6B6B]">
                          {t("employeeAttendance.checkIn")}: {record.check_in_time.substring(0, 5)}
                        </p>
                      )}
                      {record.reason && (
                        <p className="text-xs text-[#6B6B6B] italic">{record.reason}</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {hasMore && (
                <Button
                  variant="ghost"
                  onClick={() => setDisplayCount((prev) => prev + PAGE_SIZE)}
                  className="w-full text-[#6B6B6B] hover:text-[#222222]"
                >
                  <ChevronDown className="h-4 w-4 mr-2" />
                  {t("employeeAttendance.loadMore")} ({records.length - displayCount} {t("employeeAttendance.remaining")})
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Warning Modal */}
      {employee && (
        <SendWarningModal
          open={showWarningModal}
          onOpenChange={setShowWarningModal}
          employee={{
            id: employee.id,
            name: employee.full_name,
            email: employee.email || null,
          }}
          issueSummary={
            attendanceRate < 85
              ? `${attendanceRate}% attendance rate (30 days)`
              : counts.absent >= 3
                ? `${counts.absent} absences in selected period`
                : `Attendance review required`
          }
        />
      )}

      {/* Export Modal */}
      {employee && (
        <ExportAttendanceModal
          open={showExportModal}
          onOpenChange={setShowExportModal}
          mode="individual"
          preselectedEmployee={{
            id: employee.id,
            name: employee.full_name,
          }}
          defaultDateRange={{
            from: new Date(getDateRange(period).startDate),
            to: new Date(getDateRange(period).endDate),
          }}
        />
      )}
    </div>
  );
}
