"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import {
  Brain,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Clock,
  Users,
  CalendarX,
  Thermometer,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// Types
interface Insight {
  category: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  affected_employees: string[];
  recommendation: string;
  evidence: Record<string, any>;
}

interface Alert {
  type: string;
  urgency: "immediate" | "this_week" | "this_month";
  message: string;
  action_required: string;
}

interface AnalyticsResult {
  id: string;
  analysis_date: string;
  summary: string;
  insights: Insight[];
  alerts: Alert[];
  department_health: Record<string, { score: number; concerns: string[]; positive: string[] }>;
  employee_count: number;
  total_leave_requests: number;
  total_attendance_records: number;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "day_of_week_pattern":
      return CalendarX;
    case "sick_leave_pattern":
      return Thermometer;
    case "punctuality_pattern":
      return Clock;
    case "department_anomaly":
      return Users;
    case "coverage_risk":
      return AlertCircle;
    case "balance_alert":
      return TrendingUp;
    default:
      return AlertTriangle;
  }
};

const getSeverityStyles = (severity: string) => {
  switch (severity) {
    case "high":
      return {
        bg: "bg-red-50",
        border: "border-red-200",
        badge: "bg-red-100 text-red-700 border-red-200",
        icon: "text-red-600",
      };
    case "medium":
      return {
        bg: "bg-amber-50",
        border: "border-amber-200",
        badge: "bg-amber-100 text-amber-700 border-amber-200",
        icon: "text-amber-600",
      };
    case "low":
      return {
        bg: "bg-blue-50",
        border: "border-blue-200",
        badge: "bg-blue-100 text-blue-700 border-blue-200",
        icon: "text-blue-600",
      };
    default:
      return {
        bg: "bg-gray-50",
        border: "border-gray-200",
        badge: "bg-gray-100 text-gray-700 border-gray-200",
        icon: "text-gray-600",
      };
  }
};

const getUrgencyStyles = (urgency: string) => {
  switch (urgency) {
    case "immediate":
      return "bg-red-100 text-red-800 border-red-300";
    case "this_week":
      return "bg-amber-100 text-amber-800 border-amber-300";
    case "this_month":
      return "bg-blue-100 text-blue-800 border-blue-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
};

export function LeaveAnalyticsWidget() {
  const { t } = useTranslation(["hr"]);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<AnalyticsResult | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchLatestAnalytics();
  }, []);

  const fetchLatestAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from("leave_analytics_results")
        .select("*")
        .order("analysis_date", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned
        throw error;
      }

      setResult(data as AnalyticsResult | null);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("analyze-leave-patterns", {
        body: { trigger: "manual" },
      });

      if (response.error) {
        throw response.error;
      }

      toast({
        title: t("leaveAnalytics.refreshSuccess"),
        description: t("leaveAnalytics.analysisUpdated"),
      });

      // Fetch the updated results
      await fetchLatestAnalytics();
    } catch (error) {
      console.error("Error refreshing analytics:", error);
      toast({
        title: t("leaveAnalytics.refreshError"),
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  // No analytics yet
  if (!result) {
    return (
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center justify-between" style={{ fontFamily: 'Playfair Display, serif' }}>
            <span className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--jw-primary-green))]/10 flex items-center justify-center">
                <Brain className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
              </div>
              {t("leaveAnalytics.title")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-[hsl(var(--jw-primary-green))]/10 flex items-center justify-center mb-3">
              <Brain className="h-8 w-8 text-[hsl(var(--jw-primary-green))]" />
            </div>
            <p className="text-[#222222] font-medium mb-1">{t("leaveAnalytics.noAnalysis")}</p>
            <p className="text-sm text-[#6B6B6B] mb-4">{t("leaveAnalytics.clickToGenerate")}</p>
            <Button onClick={handleRefresh} disabled={refreshing} className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))]">
              {refreshing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t("leaveAnalytics.analyzing")}
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  {t("leaveAnalytics.generateInsights")}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const highSeverityCount = result.insights?.filter((i) => i.severity === "high").length || 0;
  const alertCount = result.alerts?.length || 0;
  const displayedInsights = expanded ? result.insights : result.insights?.slice(0, 3);

  return (
    <Card className="border-[#E6E6E4]">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center justify-between" style={{ fontFamily: 'Playfair Display, serif' }}>
          <span className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[hsl(var(--jw-primary-green))]/10 flex items-center justify-center">
              <Brain className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
            </div>
            {t("leaveAnalytics.title")}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6B6B6B] font-normal">
              {formatDistanceToNow(new Date(result.analysis_date), { addSuffix: true })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary */}
        <div className="p-3 rounded-lg bg-[hsl(var(--jw-primary-green))]/5 border border-[hsl(var(--jw-primary-green))]/10">
          <p className="text-sm text-[#222222]">{result.summary}</p>
        </div>

        {/* Alerts */}
        {alertCount > 0 && (
          <div className="space-y-2">
            {result.alerts.slice(0, 2).map((alert, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-lg border ${getUrgencyStyles(alert.urgency)} flex items-start gap-2`}
              >
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs opacity-80">{alert.action_required}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Insights */}
        {result.insights && result.insights.length > 0 ? (
          <div className="space-y-2">
            {displayedInsights?.map((insight, idx) => {
              const styles = getSeverityStyles(insight.severity);
              const Icon = getCategoryIcon(insight.category);

              return (
                <div key={idx} className={`p-3 rounded-lg border ${styles.bg} ${styles.border}`}>
                  <div className="flex items-start gap-2">
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${styles.icon}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={`text-xs ${styles.badge}`}>
                          {insight.severity.toUpperCase()}
                        </Badge>
                        <span className="font-medium text-sm text-[#222222] truncate">{insight.title}</span>
                      </div>
                      <p className="text-xs text-[#6B6B6B] line-clamp-2">{insight.description}</p>
                      {insight.affected_employees && insight.affected_employees.length > 0 && (
                        <p className="text-xs text-[#6B6B6B] mt-1">
                          <span className="font-medium">{t("leaveAnalytics.affected")}:</span>{" "}
                          {insight.affected_employees.slice(0, 3).join(", ")}
                          {insight.affected_employees.length > 3 && ` +${insight.affected_employees.length - 3}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Show more/less toggle */}
            {result.insights.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-[#6B6B6B] hover:text-[#222222]"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    {t("leaveAnalytics.showLess")}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    {t("leaveAnalytics.showMore", { count: result.insights.length - 3 })}
                  </>
                )}
              </Button>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-[#6B6B6B]">{t("leaveAnalytics.noPatterns")}</p>
          </div>
        )}

        {/* Stats footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[#E6E6E4] text-xs text-[#6B6B6B]">
          <span>
            {t("leaveAnalytics.analyzed")}: {result.employee_count} {t("leaveAnalytics.employees")}
          </span>
          <span>
            {result.total_leave_requests} {t("leaveAnalytics.leaveRecords")} | {result.total_attendance_records}{" "}
            {t("leaveAnalytics.attendanceRecords")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
