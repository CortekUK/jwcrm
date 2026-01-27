"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  FileText,
  ChevronRight,
  CalendarClock,
} from "lucide-react";
import { format, parseISO, isPast, differenceInDays, addDays } from "date-fns";

type ReviewAlert = {
  id: string;
  type: "overdue" | "pending_approval" | "upcoming_deadline";
  employee_name: string;
  department_name: string | null;
  quarter: number;
  year: number;
  deadline_date: string | null;
  days_until?: number;
  days_overdue?: number;
};

export function ReviewAlertCard() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<ReviewAlert[]>([]);
  const [stats, setStats] = useState({
    overdue: 0,
    pendingApproval: 0,
    upcomingDeadlines: 0,
  });

  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const sevenDaysFromNow = addDays(now, 7);

        // Fetch all non-complete reviews
        const { data: reviewsData, error } = await supabase
          .from("quarterly_reviews")
          .select(`
            id,
            quarter,
            year,
            status,
            deadline_date,
            employee:employees(full_name, department:departments(name))
          `)
          .in("status", ["draft", "submitted"])
          .order("deadline_date", { ascending: true });

        if (error) throw error;

        const alertsList: ReviewAlert[] = [];
        let overdueCount = 0;
        let pendingApprovalCount = 0;
        let upcomingCount = 0;

        (reviewsData || []).forEach((review) => {
          const employeeName = review.employee?.full_name || t("hr:reviews.unknown");
          const departmentName = review.employee?.department?.name || null;

          // Check for pending approval
          if (review.status === "submitted") {
            pendingApprovalCount++;
            alertsList.push({
              id: review.id,
              type: "pending_approval",
              employee_name: employeeName,
              department_name: departmentName,
              quarter: review.quarter,
              year: review.year,
              deadline_date: review.deadline_date,
            });
          }

          // Check for overdue
          if (review.deadline_date && isPast(parseISO(review.deadline_date))) {
            overdueCount++;
            const daysOverdue = differenceInDays(now, parseISO(review.deadline_date));
            alertsList.push({
              id: review.id,
              type: "overdue",
              employee_name: employeeName,
              department_name: departmentName,
              quarter: review.quarter,
              year: review.year,
              deadline_date: review.deadline_date,
              days_overdue: daysOverdue,
            });
          }
          // Check for upcoming deadlines (within 7 days)
          else if (
            review.deadline_date &&
            review.status === "draft" &&
            parseISO(review.deadline_date) <= sevenDaysFromNow
          ) {
            upcomingCount++;
            const daysUntil = differenceInDays(parseISO(review.deadline_date), now);
            alertsList.push({
              id: review.id,
              type: "upcoming_deadline",
              employee_name: employeeName,
              department_name: departmentName,
              quarter: review.quarter,
              year: review.year,
              deadline_date: review.deadline_date,
              days_until: daysUntil,
            });
          }
        });

        // Sort by priority: overdue first, then pending approval, then upcoming
        const sortedAlerts = alertsList.sort((a, b) => {
          const priority = { overdue: 0, pending_approval: 1, upcoming_deadline: 2 };
          return priority[a.type] - priority[b.type];
        });

        setAlerts(sortedAlerts.slice(0, 5)); // Show top 5 alerts
        setStats({
          overdue: overdueCount,
          pendingApproval: pendingApprovalCount,
          upcomingDeadlines: upcomingCount,
        });
      } catch (error) {
        console.error("Error fetching review alerts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [t]);

  const totalAlerts = stats.overdue + stats.pendingApproval + stats.upcomingDeadlines;

  if (loading) {
    return (
      <Card className="border-[#E6E6E4] dark:border-gray-700">
        <CardHeader className="bg-[#0C5536] text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("hr:reviews.reviewAlerts")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (totalAlerts === 0) {
    return (
      <Card className="border-[#E6E6E4] dark:border-gray-700">
        <CardHeader className="bg-[#0C5536] text-white rounded-t-lg">
          <CardTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <FileText className="h-5 w-5" />
            {t("hr:reviews.reviewAlerts")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 text-[#0C5536] mx-auto mb-3" />
            <p className="text-[#6B6B6B] dark:text-gray-400">{t("hr:reviews.noReviewAlerts")}</p>
            <p className="text-sm text-[#6B6B6B] dark:text-gray-500 mt-1">
              {t("hr:reviews.allReviewsOnTrack")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E6E6E4] dark:border-gray-700">
      <CardHeader className="bg-[#0C5536] text-white rounded-t-lg">
        <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
          <CardTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <FileText className="h-5 w-5" />
            {t("hr:reviews.reviewAlerts")}
          </CardTitle>
          <Badge className="bg-white/20 text-white">
            {totalAlerts} {t("hr:reviews.alerts")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {stats.overdue > 0 && (
            <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg text-center">
              <p className="text-lg font-bold text-red-600">{stats.overdue}</p>
              <p className="text-xs text-red-600">{t("hr:reviews.overdue")}</p>
            </div>
          )}
          {stats.pendingApproval > 0 && (
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-center">
              <p className="text-lg font-bold text-blue-600">{stats.pendingApproval}</p>
              <p className="text-xs text-blue-600">{t("hr:reviews.pendingApproval")}</p>
            </div>
          )}
          {stats.upcomingDeadlines > 0 && (
            <div className="p-2 bg-[#FFF9E6] dark:bg-yellow-900/30 rounded-lg text-center">
              <p className="text-lg font-bold text-[#C6A03B]">{stats.upcomingDeadlines}</p>
              <p className="text-xs text-[#C6A03B]">{t("hr:reviews.upcoming")}</p>
            </div>
          )}
        </div>

        {/* Alerts List */}
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={`${alert.id}-${alert.type}`}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                alert.type === "overdue"
                  ? "border-red-200 bg-red-50/50 hover:bg-red-50 dark:border-red-800 dark:bg-red-900/20 dark:hover:bg-red-900/30"
                  : alert.type === "pending_approval"
                  ? "border-blue-200 bg-blue-50/50 hover:bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
                  : "border-[#C6A03B]/30 bg-[#FFF9E6]/50 hover:bg-[#FFF9E6] dark:border-yellow-800 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30"
              }`}
              onClick={() => router.push(`/hr/reviews/${alert.id}`)}
            >
              <div className={`flex items-start gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                {alert.type === "overdue" && (
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                {alert.type === "pending_approval" && (
                  <Clock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                )}
                {alert.type === "upcoming_deadline" && (
                  <CalendarClock className="h-5 w-5 text-[#C6A03B] flex-shrink-0 mt-0.5" />
                )}
                
                <div className={`flex-1 min-w-0 ${isRtl ? "text-right" : ""}`}>
                  <p className="font-medium text-[#222222] dark:text-gray-200 truncate">
                    {alert.employee_name}
                  </p>
                  <p className="text-xs text-[#6B6B6B] dark:text-gray-400">
                    {alert.department_name && `${alert.department_name} • `}
                    Q{alert.quarter} {alert.year}
                  </p>
                </div>

                <div className={`flex-shrink-0 ${isRtl ? "text-left" : "text-right"}`}>
                  {alert.type === "overdue" && (
                    <Badge className="bg-red-100 text-red-700 text-xs">
                      {alert.days_overdue} {t("hr:reviews.daysLate")}
                    </Badge>
                  )}
                  {alert.type === "pending_approval" && (
                    <Badge className="bg-blue-100 text-blue-700 text-xs">
                      {t("hr:reviews.awaitingApproval")}
                    </Badge>
                  )}
                  {alert.type === "upcoming_deadline" && (
                    <Badge className="bg-[#FFF9E6] text-[#C6A03B] text-xs">
                      {alert.days_until === 0 
                        ? t("hr:reviews.dueToday")
                        : t("hr:reviews.dueInDays", { days: alert.days_until })
                      }
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View All Button */}
        <Button
          variant="outline"
          className="w-full mt-4 border-[#E6E6E4] dark:border-gray-600"
          onClick={() => router.push("/hr/reviews")}
        >
          {t("hr:reviews.viewAllReviews")}
          <ChevronRight className={`h-4 w-4 ${isRtl ? "mr-2 rotate-180" : "ml-2"}`} />
        </Button>
      </CardContent>
    </Card>
  );
}
