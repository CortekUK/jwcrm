"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Filter, Target } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  ResponsiveContainer,
  Legend,
  FunnelChart,
  Funnel as RechartsFunnel,
  LabelList,
  Tooltip,
  ComposedChart,
} from "recharts";
import { LeadStatus } from "./LeadStatusBadge";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO, differenceInDays } from "date-fns";

interface Lead {
  id: string;
  status: LeadStatus;
  source: string | null;
  source_id: string | null;
  source_data?: { id: string; name: string } | null;
  is_paid: boolean;
  paid_amount: number | null;
  paid_currency: string | null;
  created_at: string;
  updated_at?: string;
}

type DateRangeOption = "3months" | "6months" | "12months" | "thisYear";

interface ChartClickAction {
  type: "month" | "source" | "status";
  value: string;
  month?: Date;
  sourceId?: string;
  status?: LeadStatus;
}

interface SalesAnalyticsChartsProps {
  leads: Lead[];
  isLoading?: boolean;
  onChartClick?: (action: ChartClickAction) => void;
}

const STATUS_COLORS: Record<LeadStatus, string> = {
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

const barChartConfig = {
  won: {
    label: "Won",
    color: "#22c55e",
  },
  lost: {
    label: "Lost",
    color: "#ef4444",
  },
} satisfies ChartConfig;

const revenueChartConfig = {
  revenue: {
    label: "Revenue",
    color: "#0C5536",
  },
} satisfies ChartConfig;

const pieChartConfig = {
  amount: {
    label: "Count",
  },
} satisfies ChartConfig;

export function SalesAnalyticsCharts({
  leads,
  isLoading,
  onChartClick,
}: SalesAnalyticsChartsProps) {
  const { t } = useTranslation("leadManagement");
  const [dateRange, setDateRange] = useState<DateRangeOption>("6months");

  // Get number of months based on date range option
  const getMonthCount = () => {
    switch (dateRange) {
      case "3months": return 3;
      case "6months": return 6;
      case "12months": return 12;
      case "thisYear": return new Date().getMonth() + 1;
      default: return 6;
    }
  };

  // Monthly performance data (Won vs Lost)
  const monthlyPerformanceData = useMemo(() => {
    const months = [];
    const now = new Date();
    const monthCount = getMonthCount();

    for (let i = monthCount - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, "MMM");

      const monthLeads = leads.filter((lead) => {
        try {
          const createdDate = parseISO(lead.created_at);
          return isWithinInterval(createdDate, { start: monthStart, end: monthEnd });
        } catch {
          return false;
        }
      });

      const won = monthLeads.filter((l) => l.status === "won").length;
      const lost = monthLeads.filter((l) => l.status === "lost").length;

      months.push({
        month: monthLabel,
        monthDate: monthStart,
        won,
        lost,
        total: monthLeads.length,
      });
    }

    return months;
  }, [leads, dateRange]);

  // Revenue by month
  const revenueByMonthData = useMemo(() => {
    const months = [];
    const now = new Date();
    const monthCount = getMonthCount();

    for (let i = monthCount - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, "MMM");

      const monthRevenue = leads
        .filter((lead) => {
          if (!lead.is_paid || !lead.paid_amount) return false;
          try {
            const createdDate = parseISO(lead.created_at);
            return isWithinInterval(createdDate, { start: monthStart, end: monthEnd });
          } catch {
            return false;
          }
        })
        .reduce((sum, lead) => sum + (lead.paid_amount || 0), 0);

      months.push({
        month: monthLabel,
        monthDate: monthStart,
        revenue: monthRevenue,
      });
    }

    return months;
  }, [leads, dateRange]);

  // Conversion rate trend
  const conversionTrendData = useMemo(() => {
    const months = [];
    const now = new Date();
    const monthCount = getMonthCount();

    for (let i = monthCount - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, "MMM");

      const monthLeads = leads.filter((lead) => {
        try {
          const createdDate = parseISO(lead.created_at);
          return isWithinInterval(createdDate, { start: monthStart, end: monthEnd });
        } catch {
          return false;
        }
      });

      const won = monthLeads.filter((l) => l.status === "won").length;
      const total = monthLeads.length;
      const rate = total > 0 ? (won / total) * 100 : 0;

      months.push({
        month: monthLabel,
        rate: Number(rate.toFixed(1)),
      });
    }

    return months;
  }, [leads, dateRange]);

  // Lead sources breakdown
  const sourceBreakdownData = useMemo(() => {
    const sourceCounts: Record<string, { name: string; count: number; sourceId: string }> = {};

    leads.forEach((lead) => {
      const sourceName = lead.source_data?.name || lead.source || "Unknown";
      const sourceId = lead.source_id || lead.source || "unknown";
      
      if (!sourceCounts[sourceId]) {
        sourceCounts[sourceId] = { name: sourceName, count: 0, sourceId };
      }
      sourceCounts[sourceId].count++;
    });

    return Object.values(sourceCounts)
      .sort((a, b) => b.count - a.count)
      .map((item, index) => ({
        ...item,
        fill: SOURCE_COLORS[index % SOURCE_COLORS.length],
      }));
  }, [leads]);

  // Pipeline funnel data
  const pipelineFunnelData = useMemo(() => {
    const statusOrder: LeadStatus[] = [
      "not_started",
      "contacted",
      "consultation",
      "meeting",
      "qualified",
      "negotiation",
      "pending",
      "won",
    ];

    return statusOrder.map((status) => {
      const count = leads.filter((l) => l.status === status).length;
      return {
        status,
        name: t(status.replace("_", "")),
        value: count,
        fill: STATUS_COLORS[status],
      };
    }).filter(item => item.value > 0);
  }, [leads, t]);

  // Status distribution pie chart
  const statusDistributionData = useMemo(() => {
    const statusCounts: Record<LeadStatus, number> = {
      not_started: 0,
      contacted: 0,
      consultation: 0,
      meeting: 0,
      hold: 0,
      qualified: 0,
      negotiation: 0,
      pending: 0,
      won: 0,
      lost: 0,
    };

    leads.forEach((lead) => {
      statusCounts[lead.status]++;
    });

    return Object.entries(statusCounts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status: status as LeadStatus,
        name: t(status.replace("_", "")),
        value: count,
        fill: STATUS_COLORS[status as LeadStatus],
      }));
  }, [leads, t]);

  // Lead velocity data (created vs closed)
  const leadVelocityData = useMemo(() => {
    const months = [];
    const now = new Date();
    const monthCount = getMonthCount();

    for (let i = monthCount - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, "MMM");

      const createdInMonth = leads.filter((lead) => {
        try {
          const createdDate = parseISO(lead.created_at);
          return isWithinInterval(createdDate, { start: monthStart, end: monthEnd });
        } catch {
          return false;
        }
      }).length;

      const closedInMonth = leads.filter((lead) => {
        if (lead.status !== "won" && lead.status !== "lost") return false;
        try {
          const updatedDate = lead.updated_at ? parseISO(lead.updated_at) : parseISO(lead.created_at);
          return isWithinInterval(updatedDate, { start: monthStart, end: monthEnd });
        } catch {
          return false;
        }
      }).length;

      months.push({
        month: monthLabel,
        monthDate: monthStart,
        created: createdInMonth,
        closed: closedInMonth,
        net: createdInMonth - closedInMonth,
      });
    }

    return months;
  }, [leads, dateRange]);

  // Enhanced funnel data with percentages
  const enhancedFunnelData = useMemo(() => {
    const statusOrder: LeadStatus[] = [
      "not_started",
      "contacted",
      "consultation",
      "meeting",
      "qualified",
      "negotiation",
      "pending",
      "won",
    ];

    const total = leads.length;
    let cumulative = total;

    return statusOrder.map((status, index) => {
      const count = leads.filter((l) => l.status === status).length;
      // For funnel, show leads that are at this stage or beyond
      const stagesFromHere = statusOrder.slice(index);
      const atOrBeyond = leads.filter(l => stagesFromHere.includes(l.status)).length;
      const percentage = total > 0 ? Math.round((atOrBeyond / total) * 100) : 0;
      
      return {
        status,
        name: t(status.replace("_", "")),
        value: atOrBeyond,
        percentage,
        fill: STATUS_COLORS[status],
      };
    });
  }, [leads, t]);

  // Handle chart clicks
  const handleBarClick = (data: { month: string; monthDate: Date }) => {
    if (onChartClick) {
      onChartClick({
        type: "month",
        value: data.month,
        month: data.monthDate,
      });
    }
  };

  const handleSourcePieClick = (data: { sourceId: string }) => {
    if (onChartClick) {
      onChartClick({
        type: "source",
        value: data.sourceId,
        sourceId: data.sourceId,
      });
    }
  };

  const handleStatusPieClick = (data: { status: LeadStatus }) => {
    if (onChartClick) {
      onChartClick({
        type: "status",
        value: data.status,
        status: data.status,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className={`border-[#E6E6E4] ${i === 0 ? "md:col-span-2" : ""}`}>
            <CardHeader>
              <div className="h-6 bg-[#E6E6E4] rounded animate-pulse w-1/3" />
            </CardHeader>
            <CardContent>
              <div className="h-[300px] bg-[#FAFAF8] rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <Card className="border-[#E6E6E4]">
        <CardContent className="p-12 text-center">
          <Target className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
          <p className="font-medium text-[#222222]">{t("noLeadsForAnalytics", "No leads data available")}</p>
          <p className="text-sm text-[#6B6B6B] mt-1">
            {t("addLeadsToSeeAnalytics", "Add leads to see analytics and charts")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Monthly Performance Bar Chart */}
      <Card className="md:col-span-2 border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("monthlyPerformance", "Monthly Performance")}
              </CardTitle>
            </div>
            <Select value={dateRange} onValueChange={(val) => setDateRange(val as DateRangeOption)}>
              <SelectTrigger className="w-[160px] border-[#E6E6E4]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3months">{t("last3Months", "Last 3 months")}</SelectItem>
                <SelectItem value="6months">{t("last6Months", "Last 6 months")}</SelectItem>
                <SelectItem value="12months">{t("last12Months", "Last 12 months")}</SelectItem>
                <SelectItem value="thisYear">{t("thisYear", "This year")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {onChartClick && (
            <p className="text-xs text-[#6B6B6B] mt-1">{t("clickBarToFilter", "Click on a bar to filter leads by month")}</p>
          )}
        </CardHeader>
        <CardContent>
          <ChartContainer config={barChartConfig} className="h-[300px] w-full">
            <BarChart 
              data={monthlyPerformanceData}
              onClick={(data) => {
                if (data?.activePayload?.[0]?.payload) {
                  handleBarClick(data.activePayload[0].payload);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6E6E4" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#555555' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#555555' }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Bar
                dataKey="won"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
                name={t("won")}
                cursor={onChartClick ? "pointer" : undefined}
              />
              <Bar
                dataKey="lost"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                name={t("lost")}
                cursor={onChartClick ? "pointer" : undefined}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Revenue by Month */}
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("revenueByMonth", "Revenue by Month")}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={revenueChartConfig} className="h-[300px] w-full">
            <BarChart data={revenueByMonthData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6E6E4" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#555555' }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} tick={{ fill: '#555555' }} />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value) => [`AED ${Number(value).toLocaleString()}`, ""]}
              />
              <Bar
                dataKey="revenue"
                fill="#0C5536"
                radius={[4, 4, 0, 0]}
                name={t("revenue", "Revenue")}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Conversion Rate Trend */}
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("conversionTrend", "Conversion Rate Trend")}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={pieChartConfig} className="h-[300px] w-full">
            <LineChart data={conversionTrendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6E6E4" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#555555' }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} tick={{ fill: '#555555' }} />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value) => [`${value}%`, t("conversionRate")]}
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#0C5536"
                strokeWidth={2}
                dot={{ fill: "#0C5536", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: "#C6A03B" }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Lead Sources Pie Chart */}
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("leadsBySource", "Leads by Source")}
            </CardTitle>
          </div>
          {onChartClick && sourceBreakdownData.length > 0 && (
            <p className="text-xs text-[#6B6B6B] mt-1">{t("clickSliceToFilter", "Click on a slice to filter")}</p>
          )}
        </CardHeader>
        <CardContent>
          {sourceBreakdownData.length === 0 ? (
            <div className="h-[300px] flex flex-col items-center justify-center">
              <PieChartIcon className="h-10 w-10 mb-3 text-[#C6A03B]" />
              <p className="font-medium text-[#222222]">{t("noSourceData", "No source data")}</p>
            </div>
          ) : (
            <ChartContainer config={pieChartConfig} className="h-[300px] w-full">
              <PieChart>
                <Pie
                  data={sourceBreakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="name"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                  onClick={(data) => handleSourcePieClick(data)}
                  cursor={onChartClick ? "pointer" : undefined}
                >
                  {sourceBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Status Distribution Pie Chart */}
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("statusDistribution", "Status Distribution")}
            </CardTitle>
          </div>
          {onChartClick && statusDistributionData.length > 0 && (
            <p className="text-xs text-[#6B6B6B] mt-1">{t("clickSliceToFilterByStatus", "Click on a slice to filter by status")}</p>
          )}
        </CardHeader>
        <CardContent>
          <ChartContainer config={pieChartConfig} className="h-[300px] w-full">
            <PieChart>
              <Pie
                data={statusDistributionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
                onClick={(data) => handleStatusPieClick(data)}
                cursor={onChartClick ? "pointer" : undefined}
              >
                {statusDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Lead Velocity Chart */}
      <Card className="md:col-span-2 border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("leadVelocity", "Lead Velocity")}
            </CardTitle>
          </div>
          <p className="text-xs text-[#6B6B6B] mt-1">
            {t("leadVelocityDescription", "Leads created vs closed over time")}
          </p>
        </CardHeader>
        <CardContent>
          <ChartContainer config={barChartConfig} className="h-[300px] w-full">
            <ComposedChart data={leadVelocityData}>
              <defs>
                <linearGradient id="createdGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0C5536" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#0C5536" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="closedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C6A03B" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#C6A03B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6E6E4" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#555555' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#555555' }} />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: "white", 
                  border: "1px solid #E6E6E4",
                  borderRadius: "8px",
                  padding: "8px 12px",
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="created"
                fill="url(#createdGradient)"
                stroke="#0C5536"
                strokeWidth={2}
                name={t("created", "Created")}
              />
              <Area
                type="monotone"
                dataKey="closed"
                fill="url(#closedGradient)"
                stroke="#C6A03B"
                strokeWidth={2}
                name={t("closed", "Closed")}
              />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Conversion Funnel */}
      <Card className="md:col-span-2 border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("conversionFunnel", "Conversion Funnel")}
            </CardTitle>
          </div>
          <p className="text-xs text-[#6B6B6B] mt-1">
            {t("funnelDescription", "Lead progression through pipeline stages")}
          </p>
        </CardHeader>
        <CardContent>
          {enhancedFunnelData.length === 0 || enhancedFunnelData.every(d => d.value === 0) ? (
            <div className="h-[300px] flex flex-col items-center justify-center">
              <Filter className="h-10 w-10 mb-3 text-[#C6A03B]" />
              <p className="font-medium text-[#222222]">{t("noFunnelData", "No funnel data")}</p>
            </div>
          ) : (
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip 
                    formatter={(value: number, name: string, props: any) => [
                      `${value} leads (${props.payload.percentage}%)`,
                      props.payload.name
                    ]}
                    contentStyle={{ 
                      backgroundColor: "white", 
                      border: "1px solid #E6E6E4",
                      borderRadius: "8px",
                      padding: "8px 12px",
                    }}
                  />
                  <RechartsFunnel
                    dataKey="value"
                    data={enhancedFunnelData}
                    isAnimationActive
                  >
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
                    {enhancedFunnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </RechartsFunnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
