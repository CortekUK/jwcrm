"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { History, TrendingUp, TrendingDown, Minus, CheckCircle2, AlertCircle, XCircle, RefreshCw } from "lucide-react";
import { format, subMonths } from "date-fns";

interface EmployeeKPIHistoryProps {
  employeeId: string;
  employeeName: string;
  jobRoleId: string | null;
  onPeriodSelect?: (year: number, month: number) => void;
}

interface MonthlyRecord {
  month: number;
  year: number;
  monthLabel: string;
  totalKpis: number;
  completedKpis: number;
  averageScore: number | null;
  status: "complete" | "partial" | "missing";
}

const chartConfig = {
  score: {
    label: "Score",
    color: "#0C5536",
  },
} satisfies ChartConfig;

export function EmployeeKPIHistory({
  employeeId,
  employeeName,
  jobRoleId,
  onPeriodSelect,
}: EmployeeKPIHistoryProps) {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<MonthlyRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const monthNames = [
    t("hr:month.january"),
    t("hr:month.february"),
    t("hr:month.march"),
    t("hr:month.april"),
    t("hr:month.may"),
    t("hr:month.june"),
    t("hr:month.july"),
    t("hr:month.august"),
    t("hr:month.september"),
    t("hr:month.october"),
    t("hr:month.november"),
    t("hr:month.december"),
  ];

  useEffect(() => {
    fetchHistory();
  }, [employeeId, jobRoleId]);

  const fetchHistory = async () => {
    if (!jobRoleId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get last 12 months
      const today = new Date();
      const monthsToFetch: { month: number; year: number }[] = [];
      for (let i = 0; i < 12; i++) {
        const date = subMonths(today, i);
        monthsToFetch.push({
          month: date.getMonth() + 1,
          year: date.getFullYear(),
        });
      }

      // Fetch KPIs for the job role (non-archived)
      const { data: kpis, error: kpiError } = await supabase
        .from("kpis")
        .select("id, weighting")
        .eq("job_role_id", jobRoleId)
        .eq("is_archived", false);

      if (kpiError) throw kpiError;

      const totalKpis = kpis?.length || 0;

      if (totalKpis === 0) {
        setHistory([]);
        setLoading(false);
        return;
      }

      // Fetch evaluations for this employee
      const years = [...new Set(monthsToFetch.map((m) => m.year))];
      const months = [...new Set(monthsToFetch.map((m) => m.month))];

      const { data: evaluations, error: evalError } = await supabase
        .from("kpi_evaluations")
        .select("kpi_id, month, year, achieved_value, score, status")
        .eq("employee_id", employeeId)
        .in("year", years)
        .in("month", months);

      if (evalError) throw evalError;

      // Build history records
      const records: MonthlyRecord[] = monthsToFetch.map(({ month, year }) => {
        const monthEvals = (evaluations || []).filter(
          (e) => e.month === month && e.year === year
        );
        const completedEvals = monthEvals.filter(
          (e) => e.status === "completed" && e.achieved_value !== null
        );

        // Calculate weighted average score
        let weightedScore = 0;
        let totalWeight = 0;
        completedEvals.forEach((evaluation) => {
          const kpi = kpis?.find((k) => k.id === evaluation.kpi_id);
          if (kpi && evaluation.score !== null) {
            weightedScore += evaluation.score * (kpi.weighting || 1);
            totalWeight += kpi.weighting || 1;
          }
        });

        const averageScore = totalWeight > 0 ? weightedScore / totalWeight : null;
        const completedKpis = completedEvals.length;

        let status: "complete" | "partial" | "missing" = "missing";
        if (completedKpis === totalKpis) {
          status = "complete";
        } else if (completedKpis > 0) {
          status = "partial";
        }

        return {
          month,
          year,
          monthLabel: `${monthNames[month - 1]} ${year}`,
          totalKpis,
          completedKpis,
          averageScore: averageScore !== null ? Math.round(averageScore * 10) / 10 : null,
          status,
        };
      });

      setHistory(records);
    } catch (err) {
      console.error("Error fetching KPI history:", err);
      setError("Failed to load KPI history");
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data (reverse to show oldest first)
  const chartData = useMemo(() => {
    return [...history]
      .reverse()
      .filter((r) => r.averageScore !== null)
      .map((r) => ({
        month: `${monthNames[r.month - 1].substring(0, 3)} ${r.year.toString().slice(-2)}`,
        score: r.averageScore,
      }));
  }, [history, monthNames]);

  // Calculate trend
  const trend = useMemo(() => {
    const validScores = history.filter((h) => h.averageScore !== null);
    if (validScores.length < 2) return null;

    const recent = validScores[0].averageScore!;
    const previous = validScores[1].averageScore!;
    const change = recent - previous;

    if (Math.abs(change) < 1) return { direction: "stable", change: 0 };
    return {
      direction: change > 0 ? "up" : "down",
      change: Math.abs(Math.round(change * 10) / 10),
    };
  }, [history]);

  const getStatusBadge = (status: "complete" | "partial" | "missing") => {
    switch (status) {
      case "complete":
        return (
          <Badge className="bg-[#E6F7F1] text-[#0C5536] border-0">
            <CheckCircle2 className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            {t("hr:complete", "Complete")}
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-[#FFF9E6] text-[#C6A03B] border-0">
            <AlertCircle className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            {t("hr:partial", "Partial")}
          </Badge>
        );
      case "missing":
        return (
          <Badge className="bg-[#F5F5F5] text-[#6B6B6B] border-0">
            <XCircle className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            {t("hr:missing", "Missing")}
          </Badge>
        );
    }
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.direction === "up") {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (trend.direction === "down") {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  if (loading) {
    return (
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!jobRoleId) {
    return (
      <Card className="border-[#E6E6E4]">
        <CardContent className="py-12 text-center">
          <History className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
          <p className="text-[#6B6B6B]">{t("hr:noJobRoleAssigned", "No job role assigned")}</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-[#E6E6E4]">
        <CardContent className="py-12 text-center">
          <p className="text-red-600">{error}</p>
          <Button variant="outline" onClick={fetchHistory} className="mt-4">
            <RefreshCw className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("common:retry", "Retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E6E6E4]">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-lg font-semibold text-[#0C5536]">
              {t("hr:performanceHistory", "Performance History")}
            </CardTitle>
          </div>
          {trend && (
            <div className="flex items-center gap-2 text-sm">
              {getTrendIcon()}
              <span className={trend.direction === "up" ? "text-green-600" : trend.direction === "down" ? "text-red-600" : "text-gray-500"}>
                {trend.direction === "stable" 
                  ? t("hr:stable", "Stable")
                  : `${trend.direction === "up" ? "+" : "-"}${trend.change}%`}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Trend Chart */}
        {chartData.length > 1 ? (
          <div className="h-48">
            <ChartContainer config={chartConfig}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E4" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#6B6B6B" }}
                    tickLine={false}
                    axisLine={{ stroke: "#E6E6E4" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12, fill: "#6B6B6B" }}
                    tickLine={false}
                    axisLine={{ stroke: "#E6E6E4" }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent labelKey="month" />}
                    formatter={(value: number) => [`${value}%`, "Score"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#0C5536"
                    strokeWidth={2}
                    dot={{ fill: "#0C5536", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: "#C6A03B" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-[#6B6B6B] bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]">
            <p>{t("hr:notEnoughDataForChart", "Not enough data for trend chart")}</p>
          </div>
        )}

        {/* Monthly Breakdown Table */}
        <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAF8]">
                <TableHead className="font-semibold text-[#222222]">{t("hr:historyPeriod")}</TableHead>
                <TableHead className="font-semibold text-[#222222] text-center">{t("hr:score", "Score")}</TableHead>
                <TableHead className="font-semibold text-[#222222] text-center">{t("hr:completed", "Completed")}</TableHead>
                <TableHead className="font-semibold text-[#222222]">{t("hr:evaluationStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.slice(0, 6).map((record) => (
                <TableRow
                  key={`${record.year}-${record.month}`}
                  className="hover:bg-[#FAFAF8] cursor-pointer"
                  onClick={() => onPeriodSelect?.(record.year, record.month)}
                >
                  <TableCell className="font-medium text-[#222222]">
                    {record.monthLabel}
                  </TableCell>
                  <TableCell className="text-center">
                    {record.averageScore !== null ? (
                      <span className={`font-semibold ${
                        record.averageScore >= 80 ? "text-green-600" :
                        record.averageScore >= 60 ? "text-amber-600" :
                        "text-red-600"
                      }`}>
                        {record.averageScore}%
                      </span>
                    ) : (
                      <span className="text-[#6B6B6B]">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-[#6B6B6B]">
                    {record.completedKpis}/{record.totalKpis}
                  </TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {history.length > 6 && (
          <p className="text-xs text-center text-[#6B6B6B]">
            {t("hr:showingRecentMonths", "Showing last 6 months. Click a row to view details.")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
