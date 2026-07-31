"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import {
  FileBarChart,
  Users,
  Trophy,
  BarChart3,
  TrendingUp,
  Target,
  FileSpreadsheet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCollectedRevenue } from "@/lib/finance/collectedRevenueClient";
import { sumCollectedRevenue, type LeadCollectedRevenue } from "@/lib/finance/collectedRevenue";
import { LeadExportButton } from "@/components/lead-management/LeadExportButton";
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
  FunnelChart,
  Funnel as RechartsFunnel,
  LabelList,
  Tooltip,
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

interface LeadAnalytics {
  totalLeads: number;
  dealsWon: number;
  totalRevenue: number;
  conversionRate: number;
  currency: string;
  leadsByStatus: { name: string; value: number; color: string }[];
  leadsBySource: { name: string; value: number; color: string }[];
  monthlyTrend: { month: string; leads: number; won: number }[];
  conversionFunnel: { name: string; value: number; fill: string }[];
}

export default function LeadManagementReportsPage() {
  const { t, i18n } = useTranslation(["leadManagement", "common"]);
  const isRtl = i18n.language === "ar";

  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  // Money per lead, reconciled from the payment ledger and the legacy
  // leads.paid_amount — see src/lib/finance/collectedRevenue.ts.
  const [revenueByLead, setRevenueByLead] = useState<Map<string, LeadCollectedRevenue>>(
    new Map()
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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
        .order("created_at", { ascending: false });

      if (error) throw error;
      const leadRows = (data as Lead[]) || [];
      setLeads(leadRows);
      setRevenueByLead(await fetchCollectedRevenue(leadRows));
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const analytics = useMemo((): LeadAnalytics => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    // Current month leads
    const currentMonthLeads = leads.filter((l) => {
      const leadDate = parseISO(l.created_at);
      return isWithinInterval(leadDate, { start: currentMonthStart, end: currentMonthEnd });
    });

    const totalLeads = currentMonthLeads.length;
    const dealsWon = leads.filter((l) => l.status === "won").length;
    const totalRevenue = sumCollectedRevenue(
      revenueByLead,
      leads.map((l) => l.id)
    );

    const conversionRate = leads.length > 0 
      ? Math.round((dealsWon / leads.length) * 100) 
      : 0;

    // Leads by status
    const statusCount: Record<string, number> = {};
    leads.forEach((l) => {
      statusCount[l.status] = (statusCount[l.status] || 0) + 1;
    });

    const leadsByStatus = Object.entries(statusCount)
      .map(([status, count]) => ({
        name: t(`leadManagement:leadStatus.${status}`, status.replace("_", " ")),
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

    const leadsBySource = Object.values(sourceCount)
      .map((s, i) => ({
        name: s.name,
        value: s.count,
        color: SOURCE_COLORS[i % SOURCE_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Monthly trend (last 6 months)
    const monthlyTrend = [];
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

      monthlyTrend.push({ month: monthLabel, leads: monthLeads.length, won: monthWon });
    }

    // Conversion funnel
    const funnelStages = [
      { stage: "not_started", label: t("leadManagement:leadStatus.not_started", "New") },
      { stage: "contacted", label: t("leadManagement:leadStatus.contacted", "Contacted") },
      { stage: "consultation", label: t("leadManagement:leadStatus.consultation", "Consultation") },
      { stage: "qualified", label: t("leadManagement:leadStatus.qualified", "Qualified") },
      { stage: "negotiation", label: t("leadManagement:leadStatus.negotiation", "Negotiation") },
      { stage: "won", label: t("leadManagement:leadStatus.won", "Won") },
    ];

    const conversionFunnel = funnelStages.map((s) => ({
      name: s.label,
      value: leads.filter((l) => l.status === s.stage).length,
      fill: STATUS_COLORS[s.stage] || "#6b7280",
    }));

    return {
      totalLeads,
      dealsWon,
      totalRevenue,
      conversionRate,
      currency: "AED",
      leadsByStatus,
      leadsBySource,
      monthlyTrend,
      conversionFunnel,
    };
  }, [leads, revenueByLead, t]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: analytics.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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
                {t("leadManagement:reports.title", "Reports & Analytics")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {t("leadManagement:reports.subtitle", "Sales insights, trends, and data exports")}
            </p>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--jw-primary-green))] mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
          {t("leadManagement:reports.overview", "Overview")}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Leads */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#6B6B6B]">{t("leadManagement:reports.leadsThisMonth", "Leads This Month")}</p>
                    <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                      <Users className="h-5 w-5 text-[#0C5536]" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-[#222222]">{analytics.totalLeads}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Deals Won */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#6B6B6B]">{t("leadManagement:reports.dealsWon", "Deals Won")}</p>
                    <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                      <Trophy className="h-5 w-5 text-[#0C5536]" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-[#222222]">{analytics.dealsWon}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total Revenue */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#6B6B6B]">{t("leadManagement:reports.totalRevenue", "Total Revenue")}</p>
                    <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-[#0C5536]" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-[#222222]">{formatCurrency(analytics.totalRevenue)}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Conversion Rate */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#6B6B6B]">{t("leadManagement:reports.conversionRate", "Conversion Rate")}</p>
                    <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-[#0C5536]" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-[#222222]">{analytics.conversionRate}%</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analytics Charts */}
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--jw-primary-green))] mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
          {t("leadManagement:reports.insights", "Insights")}
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Monthly Performance */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("leadManagement:reports.monthlyPerformance", "Monthly Performance")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.monthlyTrend}>
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

          {/* Leads by Status */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("leadManagement:reports.leadsByStatus", "Leads by Status")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : analytics.leadsByStatus.length > 0 ? (
                <div className="h-[200px] flex flex-col">
                  <div className="flex-1 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={analytics.leadsByStatus}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {analytics.leadsByStatus.map((entry, index) => (
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
                    {analytics.leadsByStatus.slice(0, 5).map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[#555555]">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[#777777]">
                  {t("leadManagement:reports.noData", "No data available")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leads by Source */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("leadManagement:reports.leadsBySource", "Leads by Source")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : analytics.leadsBySource.length > 0 ? (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.leadsBySource} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E4" />
                      <XAxis type="number" tick={{ fontSize: 12 }} stroke="#777777" />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} stroke="#777777" width={80} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {analytics.leadsBySource.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[#777777]">
                  {t("leadManagement:reports.noData", "No data available")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversion Funnel */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("leadManagement:reports.conversionFunnel", "Conversion Funnel")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="h-[200px] flex flex-col justify-center space-y-2">
                  {analytics.conversionFunnel.map((stage, index) => {
                    const maxValue = Math.max(...analytics.conversionFunnel.map(s => s.value), 1);
                    const width = (stage.value / maxValue) * 100;
                    return (
                      <div key={stage.name} className="flex items-center gap-3">
                        <span className="text-xs text-[#555555] w-24 truncate">{stage.name}</span>
                        <div className="flex-1 bg-[#E6E6E4] rounded-full h-5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all flex items-center justify-end pr-2"
                            style={{ width: `${Math.max(width, 10)}%`, backgroundColor: stage.fill }}
                          >
                            <span className="text-xs text-white font-medium">{stage.value}</span>
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
      </div>

      {/* Data Exports */}
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--jw-primary-green))] mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
          {t("leadManagement:reports.dataExports", "Data Exports")}
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Leads Export */}
          <Card className="border-[#E6E6E4] hover:border-[#C6A03B] transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center flex-shrink-0">
                  <Target className="h-5 w-5 text-[#0C5536]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#222222]">{t("leadManagement:reports.leads", "Leads")}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#999999] mt-1 mb-3">
                    <FileSpreadsheet className="h-3 w-3" />
                    <span>CSV / Excel</span>
                  </div>
                  <LeadExportButton />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
