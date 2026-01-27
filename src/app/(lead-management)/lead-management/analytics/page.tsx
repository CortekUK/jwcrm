"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Target, 
  Trophy, 
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Users,
  Coins,
  Percent,
  Calendar,
  Filter,
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer, 
  FunnelChart, 
  Funnel, 
  LabelList,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  Tooltip,
  Legend,
} from "recharts";
import { format, subMonths, differenceInDays, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { LeadStatus } from "@/components/lead-management/LeadStatusBadge";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  full_name: string;
  status: LeadStatus;
  source_id: string | null;
  source_data?: { id: string; name: string } | null;
  assigned_to: string | null;
  is_paid: boolean;
  paid_amount: number | null;
  created_at: string;
  updated_at: string;
}

interface Salesperson {
  user_id: string;
  full_name: string;
}

interface SourceData {
  id: string;
  name: string;
}

type DateRangeOption = "3months" | "6months" | "12months" | "thisYear" | "allTime";
type SortField = "leads" | "won" | "revenue" | "conversion";
type SortDirection = "asc" | "desc";

// Funnel stages in order
const FUNNEL_STAGES: { status: LeadStatus; label: string; color: string }[] = [
  { status: "not_started", label: "Not Started", color: "#6B6B6B" },
  { status: "contacted", label: "Contacted", color: "#0C5536" },
  { status: "consultation", label: "Consultation", color: "#0369A1" },
  { status: "meeting", label: "Meeting", color: "#2563EB" },
  { status: "qualified", label: "Qualified", color: "#7C3AED" },
  { status: "negotiation", label: "Negotiation", color: "#4F46E5" },
  { status: "pending", label: "Pending", color: "#C6A03B" },
  { status: "won", label: "Won", color: "#0C5536" },
];

export default function LeadAnalyticsPage() {
  const { t } = useTranslation("leadManagement");
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [sources, setSources] = useState<SourceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeOption>("6months");
  
  // Leaderboard sorting
  const [leaderboardSort, setLeaderboardSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: "revenue",
    direction: "desc",
  });

  // Source ROI sorting
  const [sourceSort, setSourceSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: "revenue",
    direction: "desc",
  });

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch leads
        const { data: leadsData, error: leadsError } = await supabase
          .from("leads")
          .select(`
            id, full_name, status, source_id, assigned_to, is_paid, paid_amount, created_at, updated_at,
            source_data:lead_sources(id, name)
          `);

        if (leadsError) throw leadsError;
        setLeads(leadsData || []);

        // Fetch salespeople
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("role", "salesperson");

        if (profilesError) throw profilesError;
        setSalespeople(profilesData || []);

        // Fetch sources
        const { data: sourcesData, error: sourcesError } = await supabase
          .from("lead_sources")
          .select("id, name")
          .eq("is_active", true);

        if (sourcesError) throw sourcesError;
        setSources(sourcesData || []);
      } catch (error) {
        console.error("Error fetching analytics data:", error);
        toast.error(t("failedToFetchData", "Failed to fetch analytics data"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [t]);

  // Get date range start
  const getDateRangeStart = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case "3months":
        return subMonths(now, 3);
      case "6months":
        return subMonths(now, 6);
      case "12months":
        return subMonths(now, 12);
      case "thisYear":
        return new Date(now.getFullYear(), 0, 1);
      case "allTime":
        return new Date(2020, 0, 1);
      default:
        return subMonths(now, 6);
    }
  }, [dateRange]);

  // Filter leads by date range
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const createdAt = parseISO(lead.created_at);
      return createdAt >= getDateRangeStart;
    });
  }, [leads, getDateRangeStart]);

  // Conversion funnel data
  const funnelData = useMemo(() => {
    const stageCount: Record<LeadStatus, number> = {
      not_started: 0,
      contacted: 0,
      consultation: 0,
      meeting: 0,
      qualified: 0,
      negotiation: 0,
      pending: 0,
      won: 0,
      lost: 0,
      hold: 0,
    };

    filteredLeads.forEach(lead => {
      stageCount[lead.status]++;
    });

    // For funnel, we need cumulative counts (leads that reached each stage)
    let cumulativeCount = filteredLeads.length;
    const funnelStages = FUNNEL_STAGES.map((stage, index) => {
      // For first stage, it's all leads
      // For subsequent stages, we subtract previous stages' exclusive counts
      if (index === 0) {
        return {
          name: stage.label,
          value: cumulativeCount,
          fill: stage.color,
        };
      }
      
      // Subtract leads that stopped at previous stages
      const previousStages = FUNNEL_STAGES.slice(0, index);
      const stoppedAtPrevious = previousStages.reduce((sum, s) => sum + stageCount[s.status], 0);
      const lostLeads = filteredLeads.filter(l => l.status === "lost").length;
      cumulativeCount = filteredLeads.length - stoppedAtPrevious - (index > 1 ? 0 : 0);
      
      // Actually, let's use a simpler approach: count leads at or beyond each stage
      const stagesFromHere = FUNNEL_STAGES.slice(index);
      const leadsAtOrBeyond = stagesFromHere.reduce((sum, s) => sum + stageCount[s.status], 0);
      
      return {
        name: stage.label,
        value: leadsAtOrBeyond,
        fill: stage.color,
      };
    });

    return funnelStages;
  }, [filteredLeads]);

  // Source ROI data
  const sourceROIData = useMemo(() => {
    const sourceStats: Record<string, { name: string; leads: number; won: number; revenue: number }> = {};

    filteredLeads.forEach(lead => {
      const sourceId = lead.source_id || "unknown";
      const sourceName = lead.source_data?.name || "Unknown";

      if (!sourceStats[sourceId]) {
        sourceStats[sourceId] = { name: sourceName, leads: 0, won: 0, revenue: 0 };
      }

      sourceStats[sourceId].leads++;
      if (lead.status === "won") {
        sourceStats[sourceId].won++;
        sourceStats[sourceId].revenue += lead.paid_amount || 0;
      }
    });

    return Object.entries(sourceStats)
      .map(([id, stats]) => ({
        id,
        ...stats,
        conversion: stats.leads > 0 ? Math.round((stats.won / stats.leads) * 100) : 0,
      }))
      .sort((a, b) => {
        const aVal = a[sourceSort.field as keyof typeof a] as number;
        const bVal = b[sourceSort.field as keyof typeof b] as number;
        return sourceSort.direction === "desc" ? bVal - aVal : aVal - bVal;
      });
  }, [filteredLeads, sourceSort]);

  // Salesperson leaderboard data
  const leaderboardData = useMemo(() => {
    const salespersonStats: Record<string, { name: string; leads: number; won: number; revenue: number }> = {};

    // Initialize all salespeople
    salespeople.forEach(sp => {
      salespersonStats[sp.user_id] = { name: sp.full_name, leads: 0, won: 0, revenue: 0 };
    });

    filteredLeads.forEach(lead => {
      if (lead.assigned_to && salespersonStats[lead.assigned_to]) {
        salespersonStats[lead.assigned_to].leads++;
        if (lead.status === "won") {
          salespersonStats[lead.assigned_to].won++;
          salespersonStats[lead.assigned_to].revenue += lead.paid_amount || 0;
        }
      }
    });

    return Object.entries(salespersonStats)
      .map(([id, stats]) => ({
        id,
        ...stats,
        conversion: stats.leads > 0 ? Math.round((stats.won / stats.leads) * 100) : 0,
      }))
      .filter(sp => sp.leads > 0)
      .sort((a, b) => {
        const aVal = a[leaderboardSort.field as keyof typeof a] as number;
        const bVal = b[leaderboardSort.field as keyof typeof b] as number;
        return leaderboardSort.direction === "desc" ? bVal - aVal : aVal - bVal;
      });
  }, [filteredLeads, salespeople, leaderboardSort]);

  // Time-to-close data
  const timeToCloseData = useMemo(() => {
    const wonLeads = filteredLeads.filter(lead => lead.status === "won");
    
    // Group by month
    const monthlyData: Record<string, { month: string; avgDays: number; count: number; totalDays: number }> = {};

    wonLeads.forEach(lead => {
      const createdAt = parseISO(lead.created_at);
      const closedAt = parseISO(lead.updated_at);
      const daysToClose = differenceInDays(closedAt, createdAt);
      const monthKey = format(closedAt, "MMM yyyy");

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthKey, avgDays: 0, count: 0, totalDays: 0 };
      }

      monthlyData[monthKey].count++;
      monthlyData[monthKey].totalDays += daysToClose;
    });

    return Object.values(monthlyData)
      .map(data => ({
        ...data,
        avgDays: data.count > 0 ? Math.round(data.totalDays / data.count) : 0,
      }))
      .slice(-6); // Last 6 months
  }, [filteredLeads]);

  // Overall metrics
  const metrics = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const wonLeads = filteredLeads.filter(l => l.status === "won").length;
    const totalRevenue = filteredLeads.reduce((sum, l) => sum + (l.status === "won" ? l.paid_amount || 0 : 0), 0);
    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
    
    const wonLeadsWithDates = filteredLeads.filter(l => l.status === "won");
    const avgDaysToClose = wonLeadsWithDates.length > 0 
      ? Math.round(wonLeadsWithDates.reduce((sum, l) => sum + differenceInDays(parseISO(l.updated_at), parseISO(l.created_at)), 0) / wonLeadsWithDates.length)
      : 0;

    return { totalLeads, wonLeads, totalRevenue, conversionRate, avgDaysToClose };
  }, [filteredLeads]);

  // Sort handler
  const handleLeaderboardSort = (field: SortField) => {
    setLeaderboardSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const handleSourceSort = (field: SortField) => {
    setSourceSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const getSortIcon = (field: SortField, currentSort: { field: SortField; direction: SortDirection }) => {
    if (currentSort.field !== field) return <ArrowUpDown className="h-4 w-4" />;
    return currentSort.direction === "desc" ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("analytics", "Analytics")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {t("analyticsDescription", "Comprehensive insights into your sales pipeline")}
            </p>
          </div>
          {/* Date Range Selector */}
          <Select value={dateRange} onValueChange={(value: DateRangeOption) => setDateRange(value)}>
            <SelectTrigger className="w-[180px] bg-white border-[#E6E6E4]">
              <Calendar className="h-4 w-4 mr-2 text-[#6B6B6B]" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3months">{t("last3Months", "Last 3 Months")}</SelectItem>
              <SelectItem value="6months">{t("last6Months", "Last 6 Months")}</SelectItem>
              <SelectItem value="12months">{t("last12Months", "Last 12 Months")}</SelectItem>
              <SelectItem value="thisYear">{t("thisYear", "This Year")}</SelectItem>
              <SelectItem value="allTime">{t("allTime", "All Time")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-[#E6E6E4]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                <Target className="h-4 w-4 text-[#C6A03B]" />
              </div>
              <span className="text-sm text-[#6B6B6B]">{t("totalLeads", "Total Leads")}</span>
            </div>
            <p className="text-2xl font-bold text-[#222222]">{metrics.totalLeads}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E6E6E4]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-[#E6F7F1] flex items-center justify-center">
                <Trophy className="h-4 w-4 text-[#0C5536]" />
              </div>
              <span className="text-sm text-[#6B6B6B]">{t("dealsWon", "Deals Won")}</span>
            </div>
            <p className="text-2xl font-bold text-[#0C5536]">{metrics.wonLeads}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E6E6E4]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-[#E6F7F1] flex items-center justify-center">
                <Coins className="h-4 w-4 text-[#0C5536]" />
              </div>
              <span className="text-sm text-[#6B6B6B]">{t("totalRevenue", "Revenue")}</span>
            </div>
            <p className="text-2xl font-bold text-[#0C5536]">AED {metrics.totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E6E6E4]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-[#F3E8FF] flex items-center justify-center">
                <Percent className="h-4 w-4 text-[#7C3AED]" />
              </div>
              <span className="text-sm text-[#6B6B6B]">{t("conversionRate", "Conversion")}</span>
            </div>
            <p className="text-2xl font-bold text-[#7C3AED]">{metrics.conversionRate}%</p>
          </CardContent>
        </Card>
        <Card className="border-[#E6E6E4]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-[#FFF9E6] flex items-center justify-center">
                <Clock className="h-4 w-4 text-[#C6A03B]" />
              </div>
              <span className="text-sm text-[#6B6B6B]">{t("avgDaysToClose", "Avg Days")}</span>
            </div>
            <p className="text-2xl font-bold text-[#C6A03B]">{metrics.avgDaysToClose}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <Card className="border-[#E6E6E4]">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("conversionFunnel", "Conversion Funnel")}
              </CardTitle>
            </div>
            <CardDescription className="text-[#777777]">
              {t("funnelDescription", "Lead progression through pipeline stages")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip 
                    formatter={(value: number) => [value, "Leads"]}
                    contentStyle={{ 
                      backgroundColor: "white", 
                      border: "1px solid #E6E6E4",
                      borderRadius: "8px",
                      padding: "8px 12px",
                    }}
                  />
                  <Funnel dataKey="value" data={funnelData} isAnimationActive>
                    <LabelList 
                      position="right" 
                      fill="#555555" 
                      stroke="none" 
                      dataKey="name"
                      fontSize={12}
                    />
                    <LabelList 
                      position="center" 
                      fill="#fff" 
                      stroke="none" 
                      dataKey="value"
                      fontSize={14}
                      fontWeight={600}
                    />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Time to Close Trend */}
        <Card className="border-[#E6E6E4]">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("timeToCloseTrend", "Time to Close Trend")}
              </CardTitle>
            </div>
            <CardDescription className="text-[#777777]">
              {t("timeToCloseDescription", "Average days from lead creation to deal close")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {timeToCloseData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeToCloseData}>
                    <defs>
                      <linearGradient id="colorDays" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C6A03B" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#C6A03B" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E4" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#999999" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#999999" />
                    <Tooltip 
                      formatter={(value: number) => [`${value} days`, "Avg Time to Close"]}
                      contentStyle={{ 
                        backgroundColor: "white", 
                        border: "1px solid #E6E6E4",
                        borderRadius: "8px",
                        padding: "8px 12px",
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="avgDays" 
                      stroke="#C6A03B" 
                      fillOpacity={1} 
                      fill="url(#colorDays)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-[#6B6B6B]">
                  {t("noDataAvailable", "No data available")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Source ROI Analysis */}
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("sourceROI", "Source ROI Analysis")}
            </CardTitle>
          </div>
          <CardDescription className="text-[#777777]">
            {t("sourceROIDescription", "Performance metrics by lead source")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAF8]">
                  <TableHead className="font-semibold text-[#555555]">{t("source", "Source")}</TableHead>
                  <TableHead 
                    className="font-semibold text-[#555555] cursor-pointer hover:text-[#222222]"
                    onClick={() => handleSourceSort("leads")}
                  >
                    <div className="flex items-center gap-1">
                      {t("leads", "Leads")}
                      {getSortIcon("leads", sourceSort)}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#555555] cursor-pointer hover:text-[#222222]"
                    onClick={() => handleSourceSort("won")}
                  >
                    <div className="flex items-center gap-1">
                      {t("won", "Won")}
                      {getSortIcon("won", sourceSort)}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#555555] cursor-pointer hover:text-[#222222]"
                    onClick={() => handleSourceSort("revenue")}
                  >
                    <div className="flex items-center gap-1">
                      {t("revenue", "Revenue")}
                      {getSortIcon("revenue", sourceSort)}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#555555] cursor-pointer hover:text-[#222222]"
                    onClick={() => handleSourceSort("conversion")}
                  >
                    <div className="flex items-center gap-1">
                      {t("conversion", "Conversion")}
                      {getSortIcon("conversion", sourceSort)}
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-[#555555]">{t("performance", "Performance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourceROIData.map((source, index) => {
                  const avgConversion = sourceROIData.reduce((sum, s) => sum + s.conversion, 0) / sourceROIData.length;
                  const isTopPerformer = source.conversion > avgConversion * 1.2;
                  const isLowPerformer = source.conversion < avgConversion * 0.8;

                  return (
                    <TableRow key={source.id}>
                      <TableCell className="font-medium text-[#222222]">{source.name}</TableCell>
                      <TableCell className="text-[#555555]">{source.leads}</TableCell>
                      <TableCell className="text-[#555555]">{source.won}</TableCell>
                      <TableCell className="text-[#555555]">AED {source.revenue.toLocaleString()}</TableCell>
                      <TableCell className="text-[#555555]">{source.conversion}%</TableCell>
                      <TableCell>
                        {isTopPerformer && (
                          <Badge className="bg-[#E6F7F1] text-[#0C5536] border-0">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {t("topPerformer", "Top")}
                          </Badge>
                        )}
                        {isLowPerformer && (
                          <Badge className="bg-[#FEECEC] text-[#C0392B] border-0">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            {t("lowPerformer", "Low")}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Salesperson Leaderboard */}
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("salespersonLeaderboard", "Salesperson Leaderboard")}
            </CardTitle>
          </div>
          <CardDescription className="text-[#777777]">
            {t("leaderboardDescription", "Team performance rankings")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboardData.length > 0 ? (
            <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAF8]">
                    <TableHead className="font-semibold text-[#555555] w-12">{t("rank", "#")}</TableHead>
                    <TableHead className="font-semibold text-[#555555]">{t("salesperson", "Salesperson")}</TableHead>
                    <TableHead 
                      className="font-semibold text-[#555555] cursor-pointer hover:text-[#222222]"
                      onClick={() => handleLeaderboardSort("leads")}
                    >
                      <div className="flex items-center gap-1">
                        {t("leads", "Leads")}
                        {getSortIcon("leads", leaderboardSort)}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-[#555555] cursor-pointer hover:text-[#222222]"
                      onClick={() => handleLeaderboardSort("won")}
                    >
                      <div className="flex items-center gap-1">
                        {t("won", "Won")}
                        {getSortIcon("won", leaderboardSort)}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-[#555555] cursor-pointer hover:text-[#222222]"
                      onClick={() => handleLeaderboardSort("revenue")}
                    >
                      <div className="flex items-center gap-1">
                        {t("revenue", "Revenue")}
                        {getSortIcon("revenue", leaderboardSort)}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-[#555555] cursor-pointer hover:text-[#222222]"
                      onClick={() => handleLeaderboardSort("conversion")}
                    >
                      <div className="flex items-center gap-1">
                        {t("conversion", "Conversion")}
                        {getSortIcon("conversion", leaderboardSort)}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboardData.map((person, index) => (
                    <TableRow key={person.id}>
                      <TableCell>
                        <div className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold",
                          index === 0 ? "bg-[#FFD700] text-white" :
                          index === 1 ? "bg-[#C0C0C0] text-white" :
                          index === 2 ? "bg-[#CD7F32] text-white" :
                          "bg-[#F5F5F5] text-[#6B6B6B]"
                        )}>
                          {index + 1}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-[#222222]">{person.name}</TableCell>
                      <TableCell className="text-[#555555]">{person.leads}</TableCell>
                      <TableCell className="text-[#555555]">{person.won}</TableCell>
                      <TableCell className="text-[#555555]">AED {person.revenue.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={cn(
                          "border-0",
                          person.conversion >= 20 ? "bg-[#E6F7F1] text-[#0C5536]" :
                          person.conversion >= 10 ? "bg-[#FFF9E6] text-[#C6A03B]" :
                          "bg-[#FEECEC] text-[#C0392B]"
                        )}>
                          {person.conversion}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-[#6B6B6B]">
              <Users className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
              <p>{t("noSalespersonData", "No salesperson data available")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("legalNotice", "© 2024 Just Wills. All rights reserved.")}
        </p>
      </div>
    </div>
  );
}
