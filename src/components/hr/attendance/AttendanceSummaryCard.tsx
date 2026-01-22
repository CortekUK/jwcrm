"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  Home,
  Plane,
  Thermometer,
  XCircle,
  CalendarCheck,
  Loader2,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { Database } from "@/integrations/supabase/types";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

interface AttendanceSummary {
  present: number;
  late: number;
  wfh: number;
  on_leave: number;
  sick_leave: number;
  absent: number;
  total: number;
  notMarked: boolean;
}

interface AttentionEmployee {
  id: string;
  name: string;
  issue: string;
  severity: "warning" | "critical";
}

const getStatusConfig = (t: (key: string) => string): Record<
  AttendanceStatus,
  { icon: any; color: string; label: string }
> => ({
  present: { icon: CheckCircle2, color: "text-green-600", label: t("attendanceStatus.present") },
  late: { icon: Clock, color: "text-orange-600", label: t("attendanceStatus.late") },
  wfh: { icon: Home, color: "text-blue-600", label: t("attendanceStatus.wfh") },
  on_leave: { icon: Plane, color: "text-purple-600", label: t("attendanceStatus.onLeave") },
  sick_leave: { icon: Thermometer, color: "text-yellow-600", label: t("attendanceStatus.sickLeave") },
  absent: { icon: XCircle, color: "text-red-600", label: t("attendanceStatus.absent") },
});

export function AttendanceSummaryCard() {
  const { t } = useTranslation(["hr"]);
  const router = useRouter();
  const statusConfig = getStatusConfig(t);
  const [loading, setLoading] = useState(true);
  const [attentionExpanded, setAttentionExpanded] = useState(false);
  const [summary, setSummary] = useState<AttendanceSummary>({
    present: 0,
    late: 0,
    wfh: 0,
    on_leave: 0,
    sick_leave: 0,
    absent: 0,
    total: 0,
    notMarked: true,
  });
  const [attentionList, setAttentionList] = useState<AttentionEmployee[]>([]);

  useEffect(() => {
    fetchTodayAttendance();
    fetchAttentionNeeded();
  }, []);

  const fetchTodayAttendance = async () => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");

      // Get total active employees
      const { count: totalCount } = await supabase
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("employment_status", "active");

      // Get today's attendance
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("status")
        .eq("date", today);

      const counts: Record<AttendanceStatus, number> = {
        present: 0,
        late: 0,
        wfh: 0,
        on_leave: 0,
        sick_leave: 0,
        absent: 0,
      };

      (attendanceData || []).forEach((record: any) => {
        if (record.status in counts) {
          counts[record.status as AttendanceStatus]++;
        }
      });

      setSummary({
        ...counts,
        total: totalCount || 0,
        notMarked: (attendanceData || []).length === 0,
      });
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttentionNeeded = async () => {
    try {
      const today = new Date();
      const thirtyDaysAgo = format(subDays(today, 30), "yyyy-MM-dd");
      const sevenDaysAgo = format(subDays(today, 7), "yyyy-MM-dd");
      const todayStr = format(today, "yyyy-MM-dd");

      // Get all active employees
      const { data: employees } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("employment_status", "active");

      if (!employees || employees.length === 0) return;

      // Get last 30 days attendance for all employees
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("employee_id, date, status")
        .gte("date", thirtyDaysAgo)
        .lte("date", todayStr);

      const attention: AttentionEmployee[] = [];

      employees.forEach((emp) => {
        const empRecords = (attendanceData || []).filter(
          (r: any) => r.employee_id === emp.id
        );

        // Calculate 30-day stats
        const last30Days = empRecords;
        const totalDays = last30Days.length;
        const presentDays = last30Days.filter(
          (r: any) => r.status === "present" || r.status === "late" || r.status === "wfh"
        ).length;
        const absentDays = last30Days.filter((r: any) => r.status === "absent").length;
        const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

        // Calculate 7-day stats
        const last7Days = empRecords.filter((r: any) => r.date >= sevenDaysAgo);
        const lateDays = last7Days.filter((r: any) => r.status === "late").length;

        // Check rules
        if (attendanceRate < 85 && totalDays >= 5) {
          attention.push({
            id: emp.id,
            name: emp.full_name,
            issue: `${attendanceRate}% attendance (30d)`,
            severity: attendanceRate < 75 ? "critical" : "warning",
          });
        } else if (lateDays >= 3) {
          attention.push({
            id: emp.id,
            name: emp.full_name,
            issue: `Late ${lateDays}x this week`,
            severity: lateDays >= 5 ? "critical" : "warning",
          });
        } else if (absentDays >= 3) {
          attention.push({
            id: emp.id,
            name: emp.full_name,
            issue: `${absentDays} absences (30d)`,
            severity: absentDays >= 5 ? "critical" : "warning",
          });
        }
      });

      // Sort by severity (critical first)
      attention.sort((a, b) => {
        if (a.severity === "critical" && b.severity !== "critical") return -1;
        if (a.severity !== "critical" && b.severity === "critical") return 1;
        return 0;
      });

      setAttentionList(attention);
    } catch (error) {
      console.error("Error fetching attention list:", error);
    }
  };

  const attendanceRate =
    summary.total > 0
      ? Math.round(((summary.present + summary.late + summary.wfh) / summary.total) * 100)
      : 0;

  if (loading) {
    return (
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-36" />
            </div>
            <Skeleton className="h-4 w-40" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded bg-gray-50">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-6" />
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-[#E6E6E4]">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E6E6E4]">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("attendanceWidget.todaysAttendance")}
          </span>
          <span className="text-sm font-normal text-[#6B6B6B]">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.notMarked ? (
          <div className="text-center py-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-yellow-50 flex items-center justify-center mb-3">
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
            <p className="text-[#222222] font-medium mb-1">{t("attendanceWidget.attendanceNotMarkedYet")}</p>
            <p className="text-sm text-[#6B6B6B] mb-4">{t("attendanceWidget.markAttendanceHint")}</p>
            <Button
              onClick={() => router.push("/admin/hr/attendance")}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              <CalendarCheck className="h-4 w-4 mr-2" />
              {t("attendanceWidget.markAttendance")}
            </Button>
          </div>
        ) : (
          <>
            {/* Status counts */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(statusConfig) as AttendanceStatus[]).map((status) => {
                const config = statusConfig[status];
                const Icon = config.icon;
                const count = summary[status];

                return (
                  <div key={status} className="flex items-center gap-2 p-2 rounded bg-gray-50">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span className="text-sm text-[#6B6B6B]">{config.label}:</span>
                    <span className={`font-semibold ${count > 0 ? config.color : "text-[#222222]"}`}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Attendance rate */}
            <div className="pt-2 border-t border-[#E6E6E4]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#6B6B6B]">{t("attendanceWidget.attendanceRate")}</span>
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
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    attendanceRate >= 85
                      ? "bg-green-500"
                      : attendanceRate >= 70
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>
            </div>

            {/* Action button */}
            <Button
              variant="outline"
              className="w-full border-[#E6E6E4] hover:bg-[#FAFAF8]"
              onClick={() => router.push("/admin/hr/attendance")}
            >
              <CalendarCheck className="h-4 w-4 mr-2 text-[hsl(var(--jw-primary-green))]" />
              {t("attendanceWidget.viewEditAttendance")}
            </Button>

            {/* Needs Attention Section */}
            {attentionList.length > 0 && (
              <div className="pt-3 border-t border-[#E6E6E4]">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium text-[#222222]">
                    {t("attendanceWidget.needsAttention")} ({attentionList.length})
                  </span>
                </div>
                <Collapsible open={attentionExpanded} onOpenChange={setAttentionExpanded}>
                  <div className="space-y-2">
                    {attentionList.slice(0, 3).map((emp) => (
                      <button
                        key={emp.id}
                        onClick={() => router.push(`/admin/hr/attendance/employee/${emp.id}`)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                          emp.severity === "critical"
                            ? "bg-red-50 hover:bg-red-100 border border-red-200"
                            : "bg-yellow-50 hover:bg-yellow-100 border border-yellow-200"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#222222] truncate">
                            {emp.name}
                          </p>
                          <p className={`text-xs ${
                            emp.severity === "critical" ? "text-red-600" : "text-yellow-600"
                          }`}>
                            {emp.issue}
                          </p>
                        </div>
                        <ChevronRight className={`h-4 w-4 flex-shrink-0 rtl:rotate-180 ${
                          emp.severity === "critical" ? "text-red-400" : "text-yellow-400"
                        }`} />
                      </button>
                    ))}
                  </div>
                  {attentionList.length > 3 && (
                    <>
                      <CollapsibleContent className="space-y-2 mt-2">
                        {attentionList.slice(3).map((emp) => (
                          <button
                            key={emp.id}
                            onClick={() => router.push(`/admin/hr/attendance/employee/${emp.id}`)}
                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                              emp.severity === "critical"
                                ? "bg-red-50 hover:bg-red-100 border border-red-200"
                                : "bg-yellow-50 hover:bg-yellow-100 border border-yellow-200"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-[#222222] truncate">
                                {emp.name}
                              </p>
                              <p className={`text-xs ${
                                emp.severity === "critical" ? "text-red-600" : "text-yellow-600"
                              }`}>
                                {emp.issue}
                              </p>
                            </div>
                            <ChevronRight className={`h-4 w-4 flex-shrink-0 rtl:rotate-180 ${
                              emp.severity === "critical" ? "text-red-400" : "text-yellow-400"
                            }`} />
                          </button>
                        ))}
                      </CollapsibleContent>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2 text-xs text-[#6B6B6B] hover:text-[#222222]"
                        >
                          {attentionExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3 mr-1" />
                              {t("attendanceWidget.showLess")}
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3 mr-1" />
                              {t("attendanceWidget.showMore", { count: attentionList.length - 3 })}
                            </>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </>
                  )}
                </Collapsible>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
