"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clock,
  TrendingDown,
  TrendingUp,
  Minus,
  CalendarX,
  ChevronRight,
  Eye,
  Mail,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, getDay } from "date-fns";
import { cn } from "@/lib/utils";

interface AttendanceAlert {
  id: string;
  name: string;
  alertType: "late" | "low_attendance" | "absences";
  primaryIssue: string;
  secondaryInfo?: string;
  dayPattern?: string;
  trend: "worsening" | "improving" | "stable";
  severity: "warning" | "critical";
  lateCount?: number;
  absenceCount?: number;
  attendanceRate?: number;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function AttendanceAlertsCard() {
  const { t, i18n } = useTranslation(["hr"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AttendanceAlert[]>([]);

  useEffect(() => {
    fetchAttendanceAlerts();
  }, []);

  const fetchAttendanceAlerts = async () => {
    try {
      const today = new Date();
      const thirtyDaysAgo = format(subDays(today, 30), "yyyy-MM-dd");
      const fourteenDaysAgo = format(subDays(today, 14), "yyyy-MM-dd");
      const sevenDaysAgo = format(subDays(today, 7), "yyyy-MM-dd");
      const todayStr = format(today, "yyyy-MM-dd");

      // Get all active employees
      const { data: employees } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("employment_status", "active");

      if (!employees || employees.length === 0) {
        setLoading(false);
        return;
      }

      // Get last 30 days attendance for all employees
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("employee_id, date, status")
        .gte("date", thirtyDaysAgo)
        .lte("date", todayStr);

      const alertsList: AttendanceAlert[] = [];

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
        const absentDays30 = last30Days.filter((r: any) => r.status === "absent").length;
        const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

        // Calculate current week (last 7 days) stats
        const currentWeekRecords = empRecords.filter((r: any) => r.date >= sevenDaysAgo);
        const currentWeekLate = currentWeekRecords.filter((r: any) => r.status === "late").length;
        const currentWeekAbsent = currentWeekRecords.filter((r: any) => r.status === "absent").length;

        // Calculate previous week (7-14 days ago) stats for trend analysis
        const previousWeekRecords = empRecords.filter(
          (r: any) => r.date >= fourteenDaysAgo && r.date < sevenDaysAgo
        );
        const previousWeekLate = previousWeekRecords.filter((r: any) => r.status === "late").length;
        const previousWeekAbsent = previousWeekRecords.filter((r: any) => r.status === "absent").length;

        // Analyze day-of-week pattern for late arrivals
        const lateRecords = empRecords.filter((r: any) => r.status === "late");
        const lateDayCount: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        
        lateRecords.forEach((r: any) => {
          const dayOfWeek = getDay(new Date(r.date));
          lateDayCount[dayOfWeek]++;
        });

        // Find most frequent late day (if pattern exists - at least 2 occurrences)
        let dayPattern: string | undefined;
        const maxLateDay = Object.entries(lateDayCount)
          .filter(([_, count]) => count >= 2)
          .sort((a, b) => b[1] - a[1])[0];
        
        if (maxLateDay) {
          const dayName = t(`hr:attendanceAlerts.days.${DAY_NAMES[parseInt(maxLateDay[0])].toLowerCase()}`, DAY_NAMES[parseInt(maxLateDay[0])]);
          dayPattern = t("hr:attendanceAlerts.oftenLateOn", { day: dayName });
        }

        // Determine trend
        const determineTrend = (current: number, previous: number): "worsening" | "improving" | "stable" => {
          if (current > previous) return "worsening";
          if (current < previous) return "improving";
          return "stable";
        };

        // Check for late arrivals pattern (3+ times this week)
        if (currentWeekLate >= 3) {
          const lateTrend = determineTrend(currentWeekLate, previousWeekLate);
          alertsList.push({
            id: emp.id,
            name: emp.full_name,
            alertType: "late",
            primaryIssue: t("hr:attendanceAlerts.lateThisWeek", { count: currentWeekLate }),
            secondaryInfo: dayPattern,
            dayPattern,
            trend: lateTrend,
            severity: currentWeekLate >= 5 ? "critical" : "warning",
            lateCount: currentWeekLate,
          });
        }
        // Check for low attendance rate
        else if (attendanceRate < 85 && totalDays >= 5) {
          const prevPresentDays = previousWeekRecords.filter(
            (r: any) => r.status === "present" || r.status === "late" || r.status === "wfh"
          ).length;
          const prevTotal = previousWeekRecords.length;
          const prevRate = prevTotal > 0 ? Math.round((prevPresentDays / prevTotal) * 100) : 100;
          const attendanceTrend = determineTrend(100 - attendanceRate, 100 - prevRate);

          alertsList.push({
            id: emp.id,
            name: emp.full_name,
            alertType: "low_attendance",
            primaryIssue: t("hr:attendanceAlerts.lowAttendance", { rate: attendanceRate }),
            secondaryInfo: absentDays30 > 0 
              ? t("hr:attendanceAlerts.absencesCount", { count: absentDays30 })
              : undefined,
            trend: attendanceTrend,
            severity: attendanceRate < 75 ? "critical" : "warning",
            attendanceRate,
            absenceCount: absentDays30,
          });
        }
        // Check for excessive absences
        else if (absentDays30 >= 3) {
          const absenceTrend = determineTrend(currentWeekAbsent, previousWeekAbsent);
          alertsList.push({
            id: emp.id,
            name: emp.full_name,
            alertType: "absences",
            primaryIssue: t("hr:attendanceAlerts.absencesMonth", { count: absentDays30 }),
            trend: absenceTrend,
            severity: absentDays30 >= 5 ? "critical" : "warning",
            absenceCount: absentDays30,
          });
        }
      });

      // Sort by severity (critical first), then by type
      alertsList.sort((a, b) => {
        if (a.severity === "critical" && b.severity !== "critical") return -1;
        if (a.severity !== "critical" && b.severity === "critical") return 1;
        return 0;
      });

      setAlerts(alertsList);
    } catch (error) {
      console.error("Error fetching attendance alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  const getAlertIcon = (type: AttendanceAlert["alertType"]) => {
    switch (type) {
      case "late":
        return Clock;
      case "low_attendance":
        return TrendingDown;
      case "absences":
        return CalendarX;
    }
  };

  const getTrendIcon = (trend: AttendanceAlert["trend"]) => {
    switch (trend) {
      case "worsening":
        return TrendingUp;
      case "improving":
        return TrendingDown;
      case "stable":
        return Minus;
    }
  };

  const getTrendLabel = (trend: AttendanceAlert["trend"]) => {
    switch (trend) {
      case "worsening":
        return t("hr:attendanceAlerts.trend.worsening");
      case "improving":
        return t("hr:attendanceAlerts.trend.improving");
      case "stable":
        return t("hr:attendanceAlerts.trend.stable");
    }
  };

  const getTrendColor = (trend: AttendanceAlert["trend"]) => {
    switch (trend) {
      case "worsening":
        return "text-red-600";
      case "improving":
        return "text-green-600";
      case "stable":
        return "text-gray-500";
    }
  };

  if (loading) {
    return (
      <Card className="border-[#E6E6E4] dark:border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3 rounded-lg border">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="border-[#E6E6E4] dark:border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
              <Users className="h-4 w-4 text-green-600" />
            </div>
            {t("hr:attendanceAlerts.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mb-3">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-[#222222] dark:text-foreground font-medium">{t("hr:attendanceAlerts.noAlerts")}</p>
            <p className="text-sm text-[#6B6B6B] dark:text-muted-foreground mt-1">{t("hr:attendanceAlerts.allGood")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E6E6E4] dark:border-border border-l-4 border-l-orange-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </div>
            {t("hr:attendanceAlerts.title")}
          </CardTitle>
          <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950/30 text-orange-700 border-orange-200">
            {alerts.length} {alerts.length === 1 ? t("hr:attendanceAlerts.alert") : t("hr:attendanceAlerts.alerts")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => {
          const AlertIcon = getAlertIcon(alert.alertType);
          const TrendIcon = getTrendIcon(alert.trend);

          return (
            <div
              key={alert.id}
              className={cn(
                "p-4 rounded-lg border transition-colors",
                alert.severity === "critical"
                  ? "bg-red-50 dark:bg-red-950/30 border-red-200 hover:bg-red-100 dark:hover:bg-red-950/50"
                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Alert type icon */}
                  <div className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0",
                    alert.severity === "critical" ? "bg-red-100 dark:bg-red-950/50" : "bg-amber-100 dark:bg-amber-950/50"
                  )}>
                    <AlertIcon className={cn(
                      "h-4 w-4",
                      alert.severity === "critical" ? "text-red-600" : "text-amber-600"
                    )} />
                  </div>

                  {/* Alert content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[#222222] dark:text-foreground truncate">
                        {alert.name}
                      </p>
                      {/* Trend indicator */}
                      <div className={cn("flex items-center gap-1 text-xs", getTrendColor(alert.trend))}>
                        <TrendIcon className="h-3 w-3" />
                        <span>{getTrendLabel(alert.trend)}</span>
                      </div>
                    </div>
                    
                    {/* Primary issue */}
                    <p className={cn(
                      "text-sm font-medium mt-0.5",
                      alert.severity === "critical" ? "text-red-700" : "text-amber-700"
                    )}>
                      {alert.primaryIssue}
                    </p>

                    {/* Secondary info & day pattern */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {alert.secondaryInfo && (
                        <span className="text-xs text-[#6B6B6B] dark:text-muted-foreground">
                          {alert.secondaryInfo}
                        </span>
                      )}
                      {alert.dayPattern && (
                        <Badge variant="outline" className="text-xs bg-white/50 dark:bg-amber-950/30 border-amber-300 text-amber-700">
                          {alert.dayPattern}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Severity indicator */}
                <Badge
                  variant="outline"
                  className={cn(
                    "flex-shrink-0",
                    alert.severity === "critical"
                      ? "bg-red-100 dark:bg-red-950/50 text-red-700 border-red-300"
                      : "bg-amber-100 dark:bg-amber-950/50 text-amber-700 border-amber-300"
                  )}
                >
                  {alert.severity === "critical" 
                    ? t("hr:attendanceAlerts.critical")
                    : t("hr:attendanceAlerts.warning")}
                </Badge>
              </div>

              {/* Action buttons */}
              <div className={cn("flex items-center gap-2 mt-3 pt-3 border-t", 
                alert.severity === "critical" ? "border-red-200" : "border-amber-200",
                isRtl && "flex-row-reverse"
              )}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/hr/attendance/employee/${alert.id}`)}
                  className={cn(
                    "text-xs",
                    alert.severity === "critical"
                      ? "border-red-300 text-red-700 hover:bg-red-100"
                      : "border-amber-300 text-amber-700 hover:bg-amber-100"
                  )}
                >
                  <Eye className={cn("h-3 w-3", isRtl ? "ml-1" : "mr-1")} />
                  {t("hr:attendanceAlerts.viewDetails")}
                </Button>
                {alert.severity === "critical" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/hr/attendance/employee/${alert.id}?action=warn`)}
                    className="text-xs border-red-300 text-red-700 hover:bg-red-100"
                  >
                    <Mail className={cn("h-3 w-3", isRtl ? "ml-1" : "mr-1")} />
                    {t("hr:attendanceAlerts.sendWarning")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {/* View all link */}
        <Button
          variant="ghost"
          className="w-full text-[#0C5536] hover:text-[hsl(var(--jw-hover-green))] hover:bg-[rgba(198,160,59,0.1)]"
          onClick={() => router.push("/hr/attendance")}
        >
          {t("hr:attendanceAlerts.viewAllAttendance")}
          <ChevronRight className={cn("h-4 w-4", isRtl ? "mr-1 rotate-180" : "ml-1")} />
        </Button>
      </CardContent>
    </Card>
  );
}
