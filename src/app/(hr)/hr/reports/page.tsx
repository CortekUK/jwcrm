"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  FileBarChart,
  Users,
  Calendar,
  CalendarDays,
  FolderOpen,
  Target,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  ArrowRight,
  FileArchive,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { ExportLeaveModal } from "@/components/hr/leave/ExportLeaveModal";
import { ExportEmployeesButton } from "@/components/hr/ExportEmployeesButton";
import { ExportAttendanceModal } from "@/components/hr/attendance/ExportAttendanceModal";
import { BatchDocumentExportButton } from "@/components/hr/documents/BatchDocumentExportButton";
import { KPIExportButton } from "@/components/hr/kpis/KPIExportButton";
import { supabase } from "@/integrations/supabase/client";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

// Chart colors
const COLORS = {
  excellent: "#10b981",
  good: "#f59e0b",
  needsImprovement: "#ef4444",
  notEvaluated: "#9ca3af",
  primary: "#0C5536",
  gold: "#C6A03B",
  annual: "#3b82f6",
  sick: "#ef4444",
  emergency: "#f59e0b",
  unpaid: "#6b7280",
  present: "#10b981",
  late: "#f59e0b",
  absent: "#ef4444",
};

interface AnalyticsData {
  totalEmployees: number;
  attendanceRate: number;
  pendingLeave: number;
  avgKpiScore: number | null;
  kpiDistribution: { name: string; value: number; color: string }[];
  leaveByType: { name: string; value: number; color: string }[];
  attendanceTrend: { day: string; rate: number }[];
  reviewStats: { complete: number; pending: number; overdue: number };
}

export default function ReportsPage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const router = useRouter();
  const isRtl = i18n.language === "ar";

  const [leaveExportOpen, setLeaveExportOpen] = useState(false);
  const [attendanceExportOpen, setAttendanceExportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalEmployees: 0,
    attendanceRate: 0,
    pendingLeave: 0,
    avgKpiScore: null,
    kpiDistribution: [],
    leaveByType: [],
    attendanceTrend: [],
    reviewStats: { complete: 0, pending: 0, overdue: 0 },
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      const currentQuarter = Math.ceil(currentMonth / 3);

      // Fetch all data in parallel
      const [
        employeesResult,
        attendanceResult,
        leaveResult,
        kpiResult,
        reviewsResult,
      ] = await Promise.all([
        // Active employees count
        supabase
          .from("employees")
          .select("id", { count: "exact" })
          .eq("employment_status", "active"),
        
        // This month's attendance
        supabase
          .from("attendance")
          .select("status, date")
          .gte("date", `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`),
        
        // Pending leave requests
        supabase
          .from("leave_requests")
          .select("id, leave_type, status")
          .eq("status", "pending"),
        
        // KPI evaluations for current period
        supabase
          .from("kpi_evaluations")
          .select("score, status")
          .eq("year", currentYear)
          .eq("month", currentMonth),
        
        // Quarterly reviews
        supabase
          .from("quarterly_reviews")
          .select("status")
          .eq("year", currentYear)
          .eq("quarter", currentQuarter),
      ]);

      // Process employees
      const totalEmployees = employeesResult.count || 0;

      // Process attendance
      const attendanceRecords = attendanceResult.data || [];
      const presentCount = attendanceRecords.filter(
        (a) => a.status === "present" || a.status === "late" || a.status === "wfh"
      ).length;
      const totalAttendance = attendanceRecords.length;
      const attendanceRate = totalAttendance > 0 
        ? Math.round((presentCount / totalAttendance) * 100) 
        : 0;

      // Calculate 7-day attendance trend
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const dayRecords = attendanceRecords.filter((a) => a.date === dateStr);
        const dayPresent = dayRecords.filter(
          (a) => a.status === "present" || a.status === "late" || a.status === "wfh"
        ).length;
        const dayRate = dayRecords.length > 0 
          ? Math.round((dayPresent / dayRecords.length) * 100)
          : 0;
        last7Days.push({
          day: date.toLocaleDateString(isRtl ? "ar-EG" : "en-US", { weekday: "short" }),
          rate: dayRate,
        });
      }

      // Process leave
      const pendingLeave = leaveResult.data?.length || 0;
      const leaveByTypeMap: Record<string, number> = {};
      (leaveResult.data || []).forEach((l) => {
        leaveByTypeMap[l.leave_type] = (leaveByTypeMap[l.leave_type] || 0) + 1;
      });
      const leaveByType = [
        { name: t("hr:leaveTypeLabels.annual", "Annual"), value: leaveByTypeMap["annual"] || 0, color: COLORS.annual },
        { name: t("hr:leaveTypeLabels.sick", "Sick"), value: leaveByTypeMap["sick"] || 0, color: COLORS.sick },
        { name: t("hr:leaveTypeLabels.emergency", "Emergency"), value: leaveByTypeMap["emergency"] || 0, color: COLORS.emergency },
        { name: t("hr:leaveTypeLabels.unpaid", "Unpaid"), value: leaveByTypeMap["unpaid"] || 0, color: COLORS.unpaid },
      ].filter((l) => l.value > 0);

      // Process KPIs
      const kpiEvaluations = kpiResult.data || [];
      const completedKpis = kpiEvaluations.filter((k) => k.status === "completed" && k.score !== null);
      const avgKpiScore = completedKpis.length > 0
        ? Math.round(completedKpis.reduce((sum, k) => sum + (k.score || 0), 0) / completedKpis.length)
        : null;

      // KPI distribution
      const excellent = completedKpis.filter((k) => (k.score || 0) >= 80).length;
      const good = completedKpis.filter((k) => (k.score || 0) >= 60 && (k.score || 0) < 80).length;
      const needsImprovement = completedKpis.filter((k) => (k.score || 0) < 60).length;
      const notEvaluated = kpiEvaluations.filter((k) => k.status !== "completed").length;

      const kpiDistribution = [
        { name: t("hr:analytics.excellent", "Excellent"), value: excellent, color: COLORS.excellent },
        { name: t("hr:analytics.good", "Good"), value: good, color: COLORS.good },
        { name: t("hr:analytics.needsImprovement", "Needs Improvement"), value: needsImprovement, color: COLORS.needsImprovement },
        { name: t("hr:analytics.notEvaluated", "Not Evaluated"), value: notEvaluated, color: COLORS.notEvaluated },
      ].filter((k) => k.value > 0);

      // Process reviews
      const reviews = reviewsResult.data || [];
      const reviewStats = {
        complete: reviews.filter((r) => r.status === "complete" || r.status === "approved").length,
        pending: reviews.filter((r) => r.status === "draft" || r.status === "submitted").length,
        overdue: 0, // Would need deadline calculation
      };

      setAnalytics({
        totalEmployees,
        attendanceRate,
        pendingLeave,
        avgKpiScore,
        kpiDistribution,
        leaveByType,
        attendanceTrend: last7Days,
        reviewStats,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = () => {
    return "bg-[rgba(198,160,59,0.15)] text-[#0C5536]";
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FileBarChart className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("hr:reports.titleAnalytics", "Reports & Analytics")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {t("hr:reports.subtitleAnalytics", "HR insights, trends, and data exports")}
            </p>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--jw-primary-green))] mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
          {t("hr:analytics.overview", "Overview")}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Employees */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#6B6B6B]">{t("hr:analytics.activeEmployees", "Active Employees")}</p>
                    <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                      <Users className="h-5 w-5 text-[#0C5536]" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-[#222222]">{analytics.totalEmployees}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Attendance Rate */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#6B6B6B]">{t("hr:analytics.attendanceThisMonth", "Attendance This Month")}</p>
                    <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-[#0C5536]" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-[#222222]">{analytics.attendanceRate}%</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Pending Leave */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#6B6B6B]">{t("hr:analytics.pendingLeaveRequests", "Pending Leave Requests")}</p>
                    <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                      <Clock className="h-5 w-5 text-[#0C5536]" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-[#222222]">{analytics.pendingLeave}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* KPI Score */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#6B6B6B]">{t("hr:analytics.avgKpiScore", "Avg. KPI Score")}</p>
                    <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                      <Target className="h-5 w-5 text-[#0C5536]" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-[#222222]">
                    {analytics.avgKpiScore !== null ? `${analytics.avgKpiScore}%` : "—"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analytics Charts */}
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--jw-primary-green))] mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
          {t("hr:analytics.insights", "Insights")}
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {/* KPI Distribution */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("hr:analytics.kpiDistribution", "KPI Performance Distribution")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : analytics.kpiDistribution.length > 0 ? (
                <div className="h-[200px]">
                  <div className="h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.kpiDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {analytics.kpiDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {analytics.kpiDistribution.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[#555555]">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[#777777]">
                  {t("hr:analytics.noData", "No data available")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attendance Trend */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("hr:analytics.attendanceTrend", "7-Day Attendance Trend")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : analytics.attendanceTrend.length > 0 ? (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.attendanceTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E4" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#777777" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#777777" />
                      <Line
                        type="monotone"
                        dataKey="rate"
                        stroke={COLORS.primary}
                        strokeWidth={2}
                        dot={{ fill: COLORS.primary, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[#777777]">
                  {t("hr:analytics.noData", "No data available")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leave by Type */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("hr:analytics.pendingLeaveByType", "Pending Leave by Type")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : analytics.leaveByType.length > 0 ? (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.leaveByType} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E4" />
                      <XAxis type="number" tick={{ fontSize: 12 }} stroke="#777777" />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="#777777" width={80} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {analytics.leaveByType.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[#777777]">
                  {t("hr:analytics.noPendingLeave", "No pending leave requests")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Review Compliance */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("hr:analytics.reviewCompliance", "Quarterly Review Status")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="h-[200px] flex flex-col justify-center space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-sm text-[#555555]">{t("hr:analytics.completed", "Completed")}</span>
                    </div>
                    <span className="text-xl font-semibold text-[#222222]">{analytics.reviewStats.complete}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-500" />
                      <span className="text-sm text-[#555555]">{t("hr:analytics.inProgress", "In Progress")}</span>
                    </div>
                    <span className="text-xl font-semibold text-[#222222]">{analytics.reviewStats.pending}</span>
                  </div>
                  <div className="w-full bg-[#E6E6E4] rounded-full h-3 mt-2">
                    {(analytics.reviewStats.complete + analytics.reviewStats.pending) > 0 && (
                      <div
                        className="bg-green-500 h-3 rounded-full transition-all"
                        style={{
                          width: `${(analytics.reviewStats.complete / (analytics.reviewStats.complete + analytics.reviewStats.pending)) * 100}%`,
                        }}
                      />
                    )}
                  </div>
                  <p className="text-xs text-[#777777] text-center">
                    {t("hr:analytics.completionRate", "Completion Rate")}: {" "}
                    {(analytics.reviewStats.complete + analytics.reviewStats.pending) > 0
                      ? Math.round((analytics.reviewStats.complete / (analytics.reviewStats.complete + analytics.reviewStats.pending)) * 100)
                      : 0}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Data Exports Section */}
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--jw-primary-green))] mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
          {t("hr:reports.dataExports", "Data Exports")}
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Employee Roster */}
          <Card className="border-[#E6E6E4] hover:border-[#C6A03B] transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${getCategoryColor()}`}>
                  <Users className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#222222]">{t("hr:reports.employeeRoster", "Employee Roster")}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#999999] mt-1 mb-3">
                    <FileSpreadsheet className="h-3 w-3" />
                    <span>Excel / CSV</span>
                  </div>
                  <ExportEmployeesButton />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Report */}
          <Card className="border-[#E6E6E4] hover:border-[#C6A03B] transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${getCategoryColor()}`}>
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#222222]">{t("hr:reports.attendanceReport", "Attendance Report")}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#999999] mt-1 mb-3">
                    <FileSpreadsheet className="h-3 w-3" />
                    <span>Excel</span>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
                    onClick={() => setAttendanceExportOpen(true)}
                  >
                    <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("hr:exportButton", "Export")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leave Report */}
          <Card className="border-[#E6E6E4] hover:border-[#C6A03B] transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${getCategoryColor()}`}>
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#222222]">{t("hr:reports.leaveReport", "Leave Report")}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#999999] mt-1 mb-3">
                    <FileSpreadsheet className="h-3 w-3" />
                    <span>Excel</span>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
                    onClick={() => setLeaveExportOpen(true)}
                  >
                    <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("hr:exportButton", "Export")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents Export */}
          <Card className="border-[#E6E6E4] hover:border-[#C6A03B] transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${getCategoryColor()}`}>
                  <FolderOpen className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#222222]">{t("hr:reports.documentsReport", "Documents")}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#999999] mt-1 mb-3">
                    <FileArchive className="h-3 w-3" />
                    <span>ZIP</span>
                  </div>
                  <BatchDocumentExportButton />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI Reports */}
          <Card className="border-[#E6E6E4] hover:border-[#C6A03B] transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${getCategoryColor()}`}>
                  <Target className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#222222]">{t("hr:reports.kpiReport", "KPI Reports")}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#999999] mt-1 mb-3">
                    <FileSpreadsheet className="h-3 w-3" />
                    <span>PDF</span>
                  </div>
                  <KPIExportButton />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quarterly Reviews */}
          <Card className="border-[#E6E6E4] hover:border-[#C6A03B] transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${getCategoryColor()}`}>
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#222222]">{t("hr:reports.reviewsReport", "Reviews")}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#999999] mt-1 mb-3">
                    <FileSpreadsheet className="h-3 w-3" />
                    <span>PDF</span>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
                    onClick={() => router.push("/hr/reviews")}
                  >
                    <ArrowRight className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("hr:viewAll", "View All")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Export Modals */}
      <ExportLeaveModal
        open={leaveExportOpen}
        onOpenChange={setLeaveExportOpen}
      />

      <ExportAttendanceModal
        open={attendanceExportOpen}
        onOpenChange={setAttendanceExportOpen}
        mode="main"
      />
    </div>
  );
}
