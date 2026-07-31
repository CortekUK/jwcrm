"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { 
  Users, 
  LayoutDashboard, 
  TrendingUp, 
  Target, 
  Trophy,
  Clock,
  UserPlus,
  FolderOpen,
  Plus,
  ChevronRight,
  Loader2,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { LeadStatus, LeadStatusBadge } from "@/components/lead-management/LeadStatusBadge";
import { fetchCollectedRevenue } from "@/lib/finance/collectedRevenueClient";
import { collectedFor, sumCollectedRevenue } from "@/lib/finance/collectedRevenue";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Tooltip,
} from "recharts";

interface DashboardStats {
  totalLeads: number;
  activePipeline: number;
  wonThisMonth: number;
  conversionRate: number;
  totalRevenue: number;
}

interface LeadHistoryEntry {
  id: string;
  lead_id: string;
  type: string;
  description: string;
  created_at: string;
  lead?: {
    full_name: string;
  };
}

interface SalespersonStats {
  user_id: string;
  full_name: string;
  totalLeads: number;
  wonLeads: number;
  revenue: number;
  conversionRate: number;
}

interface SourceStats {
  id: string;
  name: string;
  count: number;
  won: number;
  revenue: number;
}

// Pipeline status colors
const STATUS_COLORS: Record<LeadStatus, string> = {
  not_started: "#6B6B6B",
  contacted: "#0C5536",
  consultation: "#0369A1",
  consultation_completed: "#0284C7",
  meeting: "#2563EB",
  qualified: "#7C3AED",
  negotiation: "#4F46E5",
  pending: "#C6A03B",
  won: "#16A34A",
  lost: "#DC2626",
  hold: "#F59E0B",
  unreachable: "#9CA3AF",
};

export default function LeadManagementDashboard() {
  const { t } = useTranslation(["leadManagement", "common"]);
  const pathname = usePathname();
  const router = useRouter();
  const basePath = pathname?.startsWith("/admin") ? "/admin/lead-management" : "/lead-management";
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    activePipeline: 0,
    wonThisMonth: 0,
    conversionRate: 0,
    totalRevenue: 0,
  });
  const [recentActivity, setRecentActivity] = useState<LeadHistoryEntry[]>([]);
  const [pipelineData, setPipelineData] = useState<{ status: string; count: number; color: string }[]>([]);
  const [sourceData, setSourceData] = useState<SourceStats[]>([]);
  const [topSalespeople, setTopSalespeople] = useState<SalespersonStats[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch all leads
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select(`
          id, 
          status, 
          is_paid, 
          paid_amount, 
          paid_currency,
          created_at, 
          updated_at,
          assigned_to,
          source_id,
          source_data:lead_sources(id, name)
        `);

      if (leadsError) throw leadsError;

      // Calculate stats
      const totalLeads = leads?.length || 0;
      const activePipeline = leads?.filter(l => 
        !["won", "lost"].includes(l.status)
      ).length || 0;
      
      const now = new Date();
      const monthStart = startOfMonth(now);
      const wonThisMonth = leads?.filter(l => 
        l.status === "won" && 
        new Date(l.updated_at) >= monthStart
      ).length || 0;
      
      const wonLeads = leads?.filter(l => l.status === "won").length || 0;
      const lostLeads = leads?.filter(l => l.status === "lost").length || 0;
      const conversionRate = wonLeads + lostLeads > 0 
        ? (wonLeads / (wonLeads + lostLeads)) * 100 
        : 0;

      // Money per lead comes from the payment ledger where it exists and from
      // the legacy leads.paid_amount only where it does not — see
      // src/lib/finance/collectedRevenue.ts. Two extra queries for the whole
      // set, not one per lead.
      const revenueByLead = await fetchCollectedRevenue(leads || []);
      const totalRevenue = sumCollectedRevenue(
        revenueByLead,
        (leads || []).map((l) => l.id)
      );

      setStats({
        totalLeads,
        activePipeline,
        wonThisMonth,
        conversionRate,
        totalRevenue,
      });

      // Calculate pipeline distribution
      const statusCount: Record<string, number> = {};
      leads?.forEach(l => {
        statusCount[l.status] = (statusCount[l.status] || 0) + 1;
      });

      const pipelineStats = Object.entries(statusCount)
        .map(([status, count]) => ({
          status: status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
          count,
          color: STATUS_COLORS[status as LeadStatus] || "#6B6B6B",
        }))
        .sort((a, b) => b.count - a.count);

      setPipelineData(pipelineStats);

      // Calculate source performance
      const sourceStats: Record<string, SourceStats> = {};
      leads?.forEach(l => {
        const sourceId = l.source_id || "unknown";
        const sourceName = l.source_data?.name || "Unknown";
        
        if (!sourceStats[sourceId]) {
          sourceStats[sourceId] = {
            id: sourceId,
            name: sourceName,
            count: 0,
            won: 0,
            revenue: 0,
          };
        }
        
        sourceStats[sourceId].count++;
        if (l.status === "won") {
          sourceStats[sourceId].won++;
          sourceStats[sourceId].revenue += collectedFor(revenueByLead, l.id);
        }
      });

      setSourceData(
        Object.values(sourceStats)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      );

      // Calculate salesperson performance
      // First get salesperson user_ids from user_roles table
      const { data: salespersonRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "salesperson");

      const salespersonIds = (salespersonRoles || []).map(r => r.user_id);

      const { data: profiles } = salespersonIds.length > 0
        ? await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", salespersonIds)
        : { data: [] as { user_id: string; full_name: string | null }[] };

      const salespersonStats: Record<string, SalespersonStats> = {};
      
      profiles?.forEach(p => {
        salespersonStats[p.user_id] = {
          user_id: p.user_id,
          full_name: p.full_name || "Unknown",
          totalLeads: 0,
          wonLeads: 0,
          revenue: 0,
          conversionRate: 0,
        };
      });

      leads?.forEach(l => {
        if (l.assigned_to && salespersonStats[l.assigned_to]) {
          salespersonStats[l.assigned_to].totalLeads++;
          if (l.status === "won") {
            salespersonStats[l.assigned_to].wonLeads++;
            salespersonStats[l.assigned_to].revenue += collectedFor(revenueByLead, l.id);
          }
        }
      });

      // Calculate conversion rates
      Object.values(salespersonStats).forEach(sp => {
        const lostCount = leads?.filter(l => 
          l.assigned_to === sp.user_id && l.status === "lost"
        ).length || 0;
        sp.conversionRate = sp.wonLeads + lostCount > 0 
          ? (sp.wonLeads / (sp.wonLeads + lostCount)) * 100 
          : 0;
      });

      setTopSalespeople(
        Object.values(salespersonStats)
          .filter(sp => sp.totalLeads > 0)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
      );

      // Fetch recent activity from lead_communications (lead_history table doesn't exist)
      const { data: recentComms } = await supabase
        .from("lead_communications")
        .select(`
          id,
          lead_id,
          type,
          notes,
          created_at,
          lead:leads(full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (recentComms) {
        setRecentActivity(recentComms.map(c => ({
          id: c.id,
          lead_id: c.lead_id,
          type: c.type,
          description: c.notes || c.type,
          created_at: c.created_at,
          lead: c.lead as any,
        })));
      }

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#C6A03B]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Header */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 mb-6 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <LayoutDashboard className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("leadManagement:dashboard", "Lead Management Dashboard")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {t("leadManagement:dashboardDescription", "Overview of your lead pipeline, performance metrics, and team activity")}
            </p>
          </div>

          {stats.activePipeline > 0 && (
            <Link href={`${basePath}/leads?status=active`}>
              <div className="flex items-center gap-3 px-3 py-2 bg-white border border-[#E6E6E4] rounded-md hover:border-[#C6A03B] transition-all cursor-pointer">
                <Target className="h-4 w-4 text-[#777777]" />
                <span className="text-[#0C5536] font-medium text-sm">
                  {stats.activePipeline} {t("leadManagement:active", "Active")}
                </span>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("common:quickActions", "Quick Actions")}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 px-4 flex flex-col items-center gap-2 border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8] transition-all group"
              onClick={() => router.push(`${basePath}/leads?action=new`)}
            >
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center group-hover:bg-[rgba(198,160,59,0.25)] transition-colors">
                <UserPlus className="h-5 w-5 text-[#0C5536]" />
              </div>
              <span className="text-sm font-medium text-[#222222]">{t("leadManagement:addLead", "Add Lead")}</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 px-4 flex flex-col items-center gap-2 border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8] transition-all group"
              onClick={() => router.push(`${basePath}/leads`)}
            >
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center group-hover:bg-[rgba(198,160,59,0.25)] transition-colors">
                <Users className="h-5 w-5 text-[#0C5536]" />
              </div>
              <span className="text-sm font-medium text-[#222222]">{t("leadManagement:viewLeads", "View Leads")}</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 px-4 flex flex-col items-center gap-2 border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8] transition-all group"
              onClick={() => router.push(`${basePath}/sources`)}
            >
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center group-hover:bg-[rgba(198,160,59,0.25)] transition-colors">
                <FolderOpen className="h-5 w-5 text-[#0C5536]" />
              </div>
              <span className="text-sm font-medium text-[#222222]">{t("leadManagement:manageSources", "Manage Sources")}</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 px-4 flex flex-col items-center gap-2 border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8] transition-all group"
              onClick={() => router.push(`${basePath}/reports`)}
            >
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center group-hover:bg-[rgba(198,160,59,0.25)] transition-colors">
                <BarChart3 className="h-5 w-5 text-[#0C5536]" />
              </div>
              <span className="text-sm font-medium text-[#222222]">{t("leadManagement:viewReports", "View Reports")}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card 
          className="rounded-lg border border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all duration-100 group cursor-pointer"
          onClick={() => router.push(`${basePath}/leads`)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-[#777777]">
                {t("leadManagement:totalLeads", "Total Leads")}
              </CardTitle>
              <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(198, 160, 59, 0.15)' }}>
                <Users className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-[#222222]">
              {stats.totalLeads}
            </div>
            <p className="text-xs text-[#777777] mt-2">
              {t("leadManagement:allLeadsInSystem", "All leads in system")}
            </p>
            <div className="h-0.5 w-0 group-hover:w-full bg-[#C6A03B] transition-all duration-300 mt-3"></div>
          </CardContent>
        </Card>

        <Card 
          className="rounded-lg border border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all duration-100 group cursor-pointer"
          onClick={() => router.push(`${basePath}/leads?status=active`)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-[#777777]">
                {t("leadManagement:activePipeline", "Active Pipeline")}
              </CardTitle>
              <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(198, 160, 59, 0.15)' }}>
                <Target className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-[#222222]">
              {stats.activePipeline}
            </div>
            <p className="text-xs text-[#777777] mt-2">
              {t("leadManagement:leadsInProgress", "Leads in progress")}
            </p>
            <div className="h-0.5 w-0 group-hover:w-full bg-[#C6A03B] transition-all duration-300 mt-3"></div>
          </CardContent>
        </Card>

        <Card 
          className="rounded-lg border border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all duration-100 group cursor-pointer"
          onClick={() => router.push(`${basePath}/leads?status=won`)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-[#777777]">
                {t("leadManagement:wonThisMonth", "Won This Month")}
              </CardTitle>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E6F7F1]">
                <Trophy className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-[#0C5536]">
              {stats.wonThisMonth}
            </div>
            <p className="text-xs text-[#777777] mt-2">
              {t("leadManagement:dealsClosedThisMonth", "Deals closed this month")}
            </p>
            <div className="h-0.5 w-0 group-hover:w-full bg-[#0C5536] transition-all duration-300 mt-3"></div>
          </CardContent>
        </Card>

        <Card 
          className="rounded-lg border border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all duration-100 group cursor-pointer"
          onClick={() => router.push(`${basePath}/reports`)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-[#777777]">
                {t("leadManagement:conversionRate", "Conversion Rate")}
              </CardTitle>
              <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(198, 160, 59, 0.15)' }}>
                <TrendingUp className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-[#222222]">
              {stats.conversionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-[#777777] mt-2">
              {t("leadManagement:wonVsLost", "Won vs. lost leads")}
            </p>
            <div className="h-0.5 w-0 group-hover:w-full bg-[#C6A03B] transition-all duration-300 mt-3"></div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Overview */}
        <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("leadManagement:pipelineOverview", "Pipeline Overview")}
                </CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push(`${basePath}/leads`)}
                className="text-[#0C5536]"
              >
                {t("common:viewAll", "View All")}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pipelineData.length === 0 ? (
              <div className="text-center py-8">
                <Target className="h-8 w-8 mx-auto mb-2 text-[#C6A03B]" />
                <p className="text-[#6B6B6B]">{t("leadManagement:noLeadsYet", "No leads yet")}</p>
              </div>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E4" />
                    <XAxis type="number" tick={{ fill: '#6B6B6B', fontSize: 12 }} />
                    <YAxis 
                      type="category" 
                      dataKey="status" 
                      tick={{ fill: '#6B6B6B', fontSize: 11 }} 
                      width={100}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #E6E6E4',
                        borderRadius: '8px',
                      }} 
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {pipelineData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead Sources */}
        <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("leadManagement:topSources", "Top Lead Sources")}
                </CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push(`${basePath}/sources`)}
                className="text-[#0C5536]"
              >
                {t("common:viewAll", "View All")}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <div className="text-center py-8">
                <FolderOpen className="h-8 w-8 mx-auto mb-2 text-[#C6A03B]" />
                <p className="text-[#6B6B6B]">{t("leadManagement:noSourcesYet", "No sources yet")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sourceData.map((source, index) => (
                  <div 
                    key={source.id}
                    className="flex items-center justify-between p-3 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center text-sm font-semibold text-[#0C5536]">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-[#222222]">{source.name}</p>
                        <p className="text-xs text-[#6B6B6B]">
                          {source.count} {t("leadManagement:leads", "leads")} • {source.won} {t("leadManagement:won", "won")}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-[#E6F7F1] text-[#0C5536] border-0">
                      {source.revenue > 0 ? `${source.revenue.toLocaleString()} AED` : "-"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Salespeople */}
        <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("leadManagement:topSalespeople", "Top Salespeople")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {topSalespeople.length === 0 ? (
              <div className="text-center py-8">
                <Trophy className="h-8 w-8 mx-auto mb-2 text-[#C6A03B]" />
                <p className="text-[#6B6B6B]">{t("leadManagement:noSalespeopleYet", "No salespeople data yet")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topSalespeople.map((sp, index) => (
                  <div 
                    key={sp.user_id}
                    className="flex items-center justify-between p-3 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                        index === 0 ? "bg-[#FFF9E6] text-[#C6A03B]" :
                        index === 1 ? "bg-[#F5F5F5] text-[#6B6B6B]" :
                        index === 2 ? "bg-[#FEF3E6] text-[#D97706]" :
                        "bg-[rgba(198,160,59,0.15)] text-[#0C5536]"
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-[#222222]">{sp.full_name}</p>
                        <p className="text-xs text-[#6B6B6B]">
                          {sp.totalLeads} {t("leadManagement:leads", "leads")} • {sp.wonLeads} {t("leadManagement:won", "won")} • {sp.conversionRate.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-[#E6F7F1] text-[#0C5536] border-0">
                      {sp.revenue > 0 ? `${sp.revenue.toLocaleString()} AED` : "-"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("leadManagement:recentActivity", "Recent Activity")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-8 w-8 mx-auto mb-2 text-[#C6A03B]" />
                <p className="text-[#6B6B6B]">{t("leadManagement:noActivityYet", "No activity yet")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((activity) => (
                  <div 
                    key={activity.id}
                    className="flex items-start gap-3 p-3 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]"
                  >
                    <div className="h-8 w-8 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-4 w-4 text-[#0C5536]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#222222] truncate">
                        {activity.description}
                      </p>
                      <p className="text-xs text-[#6B6B6B]">
                        {activity.lead?.full_name} • {format(parseISO(activity.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer Legal Notice */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("leadManagement:legalNotice", "© 2024 Just Wills. All rights reserved.")}
        </p>
      </div>
    </div>
  );
}
