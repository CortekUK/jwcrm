"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import {
  FileBarChart,
  Users,
  Trophy,
  DollarSign,
  TrendingUp,
  Target,
  FileSpreadsheet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LeadExportButton } from "@/components/lead-management/LeadExportButton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
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
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  not_started: "#6B6B6B",
  contacted: "#0C5536",
  consultation: "#0369A1",
  meeting: "#2563EB",
  hold: "#D97706",
  qualified: "#7C3AED",
  negotiation: "#4F46E5",
  pending: "#C6A03B",
  won: "#22c55e",
  lost: "#ef4444",
};

const SOURCE_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#ef4444", 
  "#6366f1", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

interface Lead {
  id: string;
  status: string;
  source_id: string | null;
  is_paid: boolean;
  paid_amount: number | null;
  paid_currency: string | null;
  created_at: string;
  source_data?: { id: string; name: string } | null;
}

interface SalespersonAnalytics {
  myTotalLeads: number;
  myDealsWon: number;
  myRevenue: number;
  myConversionRate: number;
  currency: string;
  myLeadsByStatus: { name: string; value: number; color: string }[];
  myLeadsBySource: { name: string; value: number; color: string }[];
  myMonthlyTrend: { month: string; leads: number; won: number }[];
  myRevenueTrend: { month: string; revenue: number }[];
}

export default function SalespersonReportsPage() {
  const { t, i18n } = useTranslation(["salesperson", "leadManagement", "common"]);
  const isRtl = i18n.language === "ar";

  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchMyLeads();
    }
  }, [userId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const fetchMyLeads = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          id,
          status,
          source_id,
          is_paid,
          paid_amount,
          paid_currency,
          created_at,
          source_data:lead_sources!leads_source_id_fkey(id, name)
        `)
        .eq("assigned_to", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads((data as Lead[]) || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const analytics = useMemo((): SalespersonAnalytics => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    // Current month leads
    const currentMonthLeads = leads.filter((l) => {
      const leadDate = parseISO(l.created_at);
      return isWithinInterval(leadDate, { start: currentMonthStart, end: currentMonthEnd });
    });

    const myTotalLeads = currentMonthLeads.length;
    const myDealsWon = leads.filter((l) => l.status === "won").length;
    const myRevenue = leads
      .filter((l) => l.is_paid && l.paid_amount)
      .reduce((sum, l) => sum + (l.paid_amount || 0), 0);

    const myConversionRate = leads.length > 0 
      ? Math.round((myDealsWon / leads.length) * 100) 
      : 0;

    // Leads by status
    const statusCount: Record<string, number> = {};
    leads.forEach((l) => {
      statusCount[l.status] = (statusCount[l.status] || 0) + 1;
    });

    const myLeadsByStatus = Object.entries(statusCount)
      .map(([status, count]) => ({
        name: t(`leadManagement:status.${status}`, status.replace("_", " ")),
        value: count,
        color: STATUS_COLORS[status] || "#6b7280",
      }))
      .sort((a, b) => b.value - a.value);

    // Leads by source
    const sourceCount: Record<string, { name: string; count: number }> = {};
    leads.forEach((l) => {
      const sourceName = l.source_data?.name || "Unknown";
      if (!sourceCount[sourceName]) {
        sourceCount[sourceName] = { name: sourceName, count: 0 };
      }
      sourceCount[sourceName].count++;
    });

    const myLeadsBySource = Object.values(sourceCount)
      .map((s, i) => ({
        name: s.name,
        value: s.count,
        color: SOURCE_COLORS[i % SOURCE_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Monthly trend (last 6 months)
    const myMonthlyTrend = [];
    const myRevenueTrend = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, "MMM");

      const monthLeads = leads.filter((l) => {
        const leadDate = parseISO(l.created_at);
        return isWithinInterval(leadDate, { start: monthStart, end: monthEnd });
      });

      const monthWon = monthLeads.filter((l) => l.status === "won").length;
      const monthRevenue = monthLeads
        .filter((l) => l.is_paid && l.paid_amount)
        .reduce((sum, l) => sum + (l.paid_amount || 0), 0);

      myMonthlyTrend.push({ month: monthLabel, leads: monthLeads.length, won: monthWon });
      myRevenueTrend.push({ month: monthLabel, revenue: monthRevenue });
    }

    return {
      myTotalLeads,
      myDealsWon,
      myRevenue,
      myConversionRate,
      currency: "AED",
      myLeadsByStatus,
      myLeadsBySource,
      myMonthlyTrend,
      myRevenueTrend,
    };
  }, [leads, t]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: analytics.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const pieChartConfig = { value: { label: "Count" } } satisfies ChartConfig;

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FileBarChart className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("salesperson:reports.title", "My Reports & Analytics")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {t("salesperson:reports.subtitle", "Your sales performance insights and data exports")}
            </p>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div>
        <h2 className="text-lg font-semibold text-[#222222] mb-4">
          {t("salesperson:reports.myPerformance", "My Performance")}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* My Total Leads */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#222222]">{analytics.myTotalLeads}</p>
                    <p className="text-sm text-[#777777]">{t("salesperson:reports.myLeadsThisMonth", "My Leads This Month")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Deals Won */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-green-50 flex items-center justify-center">
                    <Trophy className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#222222]">{analytics.myDealsWon}</p>
                    <p className="text-sm text-[#777777]">{t("salesperson:reports.myDealsWon", "My Deals Won")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Revenue */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#222222]">{formatCurrency(analytics.myRevenue)}</p>
                    <p className="text-sm text-[#777777]">{t("salesperson:reports.myRevenue", "My Revenue")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Conversion Rate */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-purple-50 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#222222]">{analytics.myConversionRate}%</p>
                    <p className="text-sm text-[#777777]">{t("salesperson:reports.myConversionRate", "My Conversion Rate")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analytics Charts */}
      <div>
        <h2 className="text-lg font-semibold text-[#222222] mb-4">
          {t("salesperson:reports.insights", "Insights")}
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {/* My Monthly Performance */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("salesperson:reports.myMonthlyPerformance", "My Monthly Performance")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.myMonthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E4" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#777777" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#777777" />
                      <Bar dataKey="leads" fill="#3b82f6" name={t("leadManagement:leads", "Leads")} />
                      <Bar dataKey="won" fill="#22c55e" name={t("leadManagement:won", "Won")} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Revenue Trend */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("salesperson:reports.myRevenueTrend", "My Revenue Trend")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.myRevenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E4" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#777777" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#777777" />
                      <Line type="monotone" dataKey="revenue" stroke="#0C5536" strokeWidth={2} dot={{ fill: "#0C5536", r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Pipeline */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("salesperson:reports.myPipeline", "My Pipeline")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : analytics.myLeadsByStatus.length > 0 ? (
                <div className="h-[200px] flex flex-col">
                  <div className="flex-1 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={analytics.myLeadsByStatus}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {analytics.myLeadsByStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {analytics.myLeadsByStatus.slice(0, 5).map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[#555555]">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[#777777]">
                  {t("salesperson:reports.noData", "No data available")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Source Performance */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("salesperson:reports.mySourcePerformance", "My Source Performance")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : analytics.myLeadsBySource.length > 0 ? (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.myLeadsBySource} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E4" />
                      <XAxis type="number" tick={{ fontSize: 12 }} stroke="#777777" />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} stroke="#777777" width={80} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {analytics.myLeadsBySource.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[#777777]">
                  {t("salesperson:reports.noData", "No data available")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Data Exports */}
      <div>
        <h2 className="text-lg font-semibold text-[#222222] mb-4">
          {t("salesperson:reports.dataExports", "Data Exports")}
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* My Leads Export */}
          <Card className="border-[#E6E6E4] hover:border-[#C6A03B] transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Target className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#222222]">{t("salesperson:reports.myLeads", "My Leads")}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#999999] mt-1 mb-3">
                    <FileSpreadsheet className="h-3 w-3" />
                    <span>CSV / Excel</span>
                  </div>
                  <LeadExportButton salespersonId={userId || undefined} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
