"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import {
  FileBarChart,
  FileText,
  CheckCircle,
  Clock,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  Tooltip,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO, differenceInDays } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  in_progress: "#9E9E9E",
  awaiting_review: "#C6A03B",
  under_review: "#557A95",
  draft_ready: "#0C5536",
  draft_released: "#128277",
  finalized: "#083D29",
};

const APPROVAL_COLORS = {
  approved: "#22c55e",
  disapproved: "#ef4444",
  pending: "#C6A03B",
};

interface Will {
  id: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
  updated_at: string;
  client_approval_status: string | null;
  client_approval_at: string | null;
  pdf_generated_at: string | null;
}

interface WillAnalytics {
  totalWills: number;
  willsThisMonth: number;
  finalizedWills: number;
  avgProcessingDays: number;
  approvalRate: number;
  willsByStatus: { name: string; value: number; color: string }[];
  monthlySubmissions: { month: string; submitted: number; finalized: number }[];
  approvalStats: { name: string; value: number; color: string }[];
}

export default function WillsReportsPage() {
  const { t, i18n } = useTranslation(["admin", "common"]);
  const isRtl = i18n.language === "ar";

  const [loading, setLoading] = useState(true);
  const [wills, setWills] = useState<Will[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("wills")
        .select(`
          id,
          status,
          created_at,
          submitted_at,
          updated_at,
          client_approval_status,
          client_approval_at,
          pdf_generated_at
        `)
        .not("submitted_at", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWills((data as Will[]) || []);
    } catch (error) {
      console.error("Error fetching wills:", error);
    } finally {
      setLoading(false);
    }
  };

  const analytics = useMemo((): WillAnalytics => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    // Total wills
    const totalWills = wills.length;

    // Wills this month
    const willsThisMonth = wills.filter((w) => {
      if (!w.submitted_at) return false;
      const submitDate = parseISO(w.submitted_at);
      return isWithinInterval(submitDate, { start: currentMonthStart, end: currentMonthEnd });
    }).length;

    // Finalized wills
    const finalizedWills = wills.filter((w) => w.status === "finalized").length;

    // Average processing time (from submitted to finalized)
    const finalizedWithDates = wills.filter(
      (w) => w.status === "finalized" && w.submitted_at
    );
    const avgProcessingDays = finalizedWithDates.length > 0
      ? Math.round(
          finalizedWithDates.reduce((sum, w) => {
            const submitted = parseISO(w.submitted_at!);
            const updated = parseISO(w.updated_at);
            return sum + differenceInDays(updated, submitted);
          }, 0) / finalizedWithDates.length
        )
      : 0;

    // Approval rate (approved / (approved + disapproved))
    const approvedCount = wills.filter((w) => w.client_approval_status === "approved").length;
    const disapprovedCount = wills.filter((w) => w.client_approval_status === "disapproved").length;
    const totalReviewed = approvedCount + disapprovedCount;
    const approvalRate = totalReviewed > 0 ? Math.round((approvedCount / totalReviewed) * 100) : 0;

    // Wills by status
    const statusCount: Record<string, number> = {};
    wills.forEach((w) => {
      statusCount[w.status] = (statusCount[w.status] || 0) + 1;
    });

    const statusOrder = ["in_progress", "awaiting_review", "under_review", "draft_ready", "draft_released", "finalized"];
    const willsByStatus = statusOrder
      .filter((status) => statusCount[status] > 0)
      .map((status) => ({
        name: t(`admin:${status}`, status.replace("_", " ")),
        value: statusCount[status],
        color: STATUS_COLORS[status] || "#6b7280",
      }));

    // Monthly submissions (last 6 months)
    const monthlySubmissions = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, "MMM");

      const monthSubmitted = wills.filter((w) => {
        if (!w.submitted_at) return false;
        const submitDate = parseISO(w.submitted_at);
        return isWithinInterval(submitDate, { start: monthStart, end: monthEnd });
      }).length;

      const monthFinalized = wills.filter((w) => {
        if (w.status !== "finalized") return false;
        const updateDate = parseISO(w.updated_at);
        return isWithinInterval(updateDate, { start: monthStart, end: monthEnd });
      }).length;

      monthlySubmissions.push({ month: monthLabel, submitted: monthSubmitted, finalized: monthFinalized });
    }

    // Approval stats
    const pendingApproval = wills.filter(
      (w) => w.status === "draft_released" && !w.client_approval_status
    ).length;

    const approvalStats = [
      { name: t("admin:clientApproval.approved", "Approved"), value: approvedCount, color: APPROVAL_COLORS.approved },
      { name: t("admin:clientApproval.changesRequested", "Changes Requested"), value: disapprovedCount, color: APPROVAL_COLORS.disapproved },
      { name: t("admin:reports.pendingReview", "Pending Review"), value: pendingApproval, color: APPROVAL_COLORS.pending },
    ].filter((s) => s.value > 0);

    return {
      totalWills,
      willsThisMonth,
      finalizedWills,
      avgProcessingDays,
      approvalRate,
      willsByStatus,
      monthlySubmissions,
      approvalStats,
    };
  }, [wills, t]);

  const exportWillsData = async () => {
    try {
      const { data, error } = await supabase
        .from("wills")
        .select(`
          id,
          status,
          created_at,
          submitted_at,
          updated_at,
          client_approval_status,
          client_approval_at,
          pdf_generated_at,
          pdf_path
        `)
        .not("submitted_at", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get profiles for client names
      const userIds = data.map((w) => w.user_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);

      // Create CSV content
      const headers = ["ID", "Client Name", "Status", "Created At", "Submitted At", "Updated At", "Client Approval", "PDF Generated"];
      const rows = data.map((w: any) => [
        w.id,
        profileMap.get(w.user_id) || "Unknown",
        w.status,
        w.created_at ? format(parseISO(w.created_at), "yyyy-MM-dd HH:mm") : "",
        w.submitted_at ? format(parseISO(w.submitted_at), "yyyy-MM-dd HH:mm") : "",
        w.updated_at ? format(parseISO(w.updated_at), "yyyy-MM-dd HH:mm") : "",
        w.client_approval_status || "N/A",
        w.pdf_generated_at ? format(parseISO(w.pdf_generated_at), "yyyy-MM-dd HH:mm") : "No",
      ]);

      const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `wills-export-${format(new Date(), "yyyy-MM-dd")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting wills:", error);
    }
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
                {t("admin:reports.title", "Reports & Analytics")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {t("admin:reports.subtitle", "Will statistics, trends, and data exports")}
            </p>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--jw-primary-green))] mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
          {t("admin:reports.overview", "Overview")}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Wills This Month */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#6B6B6B]">{t("admin:reports.willsThisMonth", "Wills This Month")}</p>
                    <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                      <FileText className="h-5 w-5 text-[#0C5536]" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-[#222222]">{analytics.willsThisMonth}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total Wills */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#6B6B6B]">{t("admin:reports.totalWills", "Total Wills")}</p>
                    <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                      <FileText className="h-5 w-5 text-[#0C5536]" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-[#222222]">{analytics.totalWills}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Finalized Wills */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#6B6B6B]">{t("admin:reports.finalizedWills", "Finalized Wills")}</p>
                    <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-[#0C5536]" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-[#222222]">{analytics.finalizedWills}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Average Processing Time */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#6B6B6B]">{t("admin:reports.averageProcessingTime", "Avg. Processing Time")}</p>
                    <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                      <Clock className="h-5 w-5 text-[#0C5536]" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-[#222222]">
                    {analytics.avgProcessingDays} <span className="text-sm font-normal text-[#777777]">{t("admin:reports.days", "days")}</span>
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
          {t("admin:reports.insights", "Insights")}
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Monthly Submissions */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("admin:reports.monthlySubmissions", "Monthly Submissions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.monthlySubmissions}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E4" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#777777" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#777777" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #E6E6E4",
                          borderRadius: "8px",
                          padding: "8px 12px",
                        }}
                      />
                      <Bar dataKey="submitted" fill="#C6A03B" name={t("admin:reports.submitted", "Submitted")} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="finalized" fill="#0C5536" name={t("admin:finalized", "Finalized")} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Wills by Status */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("admin:reports.willsByStatus", "Wills by Status")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : analytics.willsByStatus.length > 0 ? (
                <div className="h-[200px] flex flex-col">
                  <div className="flex-1 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={analytics.willsByStatus}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {analytics.willsByStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #E6E6E4",
                            borderRadius: "8px",
                            padding: "8px 12px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {analytics.willsByStatus.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[#555555]">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[#777777]">
                  {t("admin:reports.noData", "No data available")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Client Approvals */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("admin:reports.clientApprovals", "Client Approvals")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : analytics.approvalStats.length > 0 ? (
                <div className="h-[200px] flex flex-col">
                  <div className="flex-1 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={analytics.approvalStats}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {analytics.approvalStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #E6E6E4",
                            borderRadius: "8px",
                            padding: "8px 12px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {analytics.approvalStats.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[#555555]">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[#777777]">
                  {t("admin:reports.noData", "No data available")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Approval Rate */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("admin:reports.approvalRate", "Approval Rate")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center">
                  <div className="relative">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="#E6E6E4"
                        strokeWidth="12"
                        fill="none"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="#22c55e"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${(analytics.approvalRate / 100) * 352} 352`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold text-[#222222]">{analytics.approvalRate}%</span>
                    </div>
                  </div>
                  <p className="text-sm text-[#777777] mt-4">
                    {t("admin:reports.clientApprovalRate", "Client Approval Rate")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Data Exports */}
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--jw-primary-green))] mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
          {t("admin:reports.dataExports", "Data Exports")}
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Wills Export */}
          <Card className="border-[#E6E6E4] hover:border-[#C6A03B] transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-[#0C5536]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#222222]">{t("admin:reports.exportWills", "Export Wills")}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#999999] mt-1 mb-3">
                    <FileSpreadsheet className="h-3 w-3" />
                    <span>CSV</span>
                  </div>
                  <Button
                    onClick={exportWillsData}
                    variant="outline"
                    size="sm"
                    className="w-full border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
                  >
                    <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("admin:download", "Download")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
