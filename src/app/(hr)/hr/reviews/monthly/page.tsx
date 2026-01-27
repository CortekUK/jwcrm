"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  CalendarDays, 
  Clock, 
  CheckCircle, 
  FileText,
  TrendingUp,
  AlertCircle,
  ArrowLeft
} from "lucide-react";
import { MonthlyReviewList } from "@/components/hr/reviews";

// Get current month/year helpers
const getCurrentMonth = () => new Date().getMonth() + 1;
const getCurrentYear = () => new Date().getFullYear();

type MonthlyStats = {
  totalReviews: number;
  pendingApproval: number;
  completedReviews: number;
  overdueReviews: number;
  completionRate: number;
};

export default function MonthlyReviewsPage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState("all");
  const [stats, setStats] = useState<MonthlyStats>({
    totalReviews: 0,
    pendingApproval: 0,
    completedReviews: 0,
    overdueReviews: 0,
    completionRate: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch monthly review statistics
  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const currentMonth = getCurrentMonth();
        const currentYear = getCurrentYear();

        // Fetch all reviews for current month
        const { data: reviews, error } = await supabase
          .from("monthly_reviews")
          .select("id, status, deadline_date")
          .eq("month", currentMonth)
          .eq("year", currentYear);

        if (error) throw error;

        const total = reviews?.length || 0;
        const pending = reviews?.filter(r => r.status === "submitted").length || 0;
        const completed = reviews?.filter(r => r.status === "complete").length || 0;
        const today = new Date().toISOString().split("T")[0];
        const overdue = reviews?.filter(r => 
          r.deadline_date && 
          r.deadline_date < today && 
          r.status !== "complete" && 
          r.status !== "approved"
        ).length || 0;

        setStats({
          totalReviews: total,
          pendingApproval: pending,
          completedReviews: completed,
          overdueReviews: overdue,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, []);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
          <div className={isRtl ? "text-right" : ""}>
            <div className={`flex items-center gap-3 mb-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/hr/reviews")}
                className="text-[#6B6B6B] hover:text-[#0C5536]"
              >
                <ArrowLeft className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
              </Button>
              <CalendarDays className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("hr:reviews.monthlyReviews", "Monthly Reviews")}
              </h1>
            </div>
            <p className={`text-sm text-[#777777] ${isRtl ? "mr-9" : "ml-9"}`}>
              {t("hr:reviews.manageMonthlyReviews", "Create and manage monthly employee performance check-ins")}
            </p>
          </div>
          
          {/* Quick badge for current month */}
          <div className={`flex items-center gap-2 px-3 py-2 bg-white border border-[#E6E6E4] rounded-md ${isRtl ? "flex-row-reverse" : ""}`}>
            <CalendarDays className="h-4 w-4 text-[#C6A03B]" />
            <span className="text-[#0C5536] font-medium text-sm">
              {t(`hr:month.${monthNames[getCurrentMonth() - 1].toLowerCase()}`)} {getCurrentYear()}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Reviews */}
        <Card className="border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all cursor-pointer"
              onClick={() => setActiveTab("all")}>
          <CardContent className="p-4">
            <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
              <p className="text-sm text-[#6B6B6B]">{t("hr:reviews.totalReviews")}</p>
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                <FileText className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2 text-[#222222]">
              {loadingStats ? "-" : stats.totalReviews}
            </p>
            <p className="text-xs text-[#777777] mt-1">{t("hr:reviews.thisMonth", "This month")}</p>
          </CardContent>
        </Card>

        {/* Pending Approval */}
        <Card className={`border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all cursor-pointer ${stats.pendingApproval > 0 ? "bg-blue-50 border-blue-200" : ""}`}
              onClick={() => setActiveTab("pending")}>
          <CardContent className="p-4">
            <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
              <p className="text-sm text-[#6B6B6B]">{t("hr:reviews.pendingApproval")}</p>
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stats.pendingApproval > 0 ? "bg-blue-100" : "bg-[rgba(198,160,59,0.15)]"}`}>
                <Clock className={`h-5 w-5 ${stats.pendingApproval > 0 ? "text-blue-600" : "text-[#0C5536]"}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold mt-2 ${stats.pendingApproval > 0 ? "text-blue-600" : "text-[#222222]"}`}>
              {loadingStats ? "-" : stats.pendingApproval}
            </p>
            <p className="text-xs text-[#777777] mt-1">{t("hr:reviews.awaitingApproval")}</p>
          </CardContent>
        </Card>

        {/* Completion Rate */}
        <Card className="border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all">
          <CardContent className="p-4">
            <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
              <p className="text-sm text-[#6B6B6B]">{t("hr:reviews.completionRate")}</p>
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2 text-[#222222]">
              {loadingStats ? "-" : `${stats.completionRate}%`}
            </p>
            <p className="text-xs text-[#777777] mt-1">{stats.completedReviews} {t("hr:reviews.completed").toLowerCase()}</p>
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card className={`border-[#E6E6E4] hover:shadow-[0_2px_8px_rgba(198,160,59,0.08)] transition-all ${stats.overdueReviews > 0 ? "bg-red-50 border-red-200" : ""}`}>
          <CardContent className="p-4">
            <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
              <p className="text-sm text-[#6B6B6B]">{t("hr:reviews.overdueReviews")}</p>
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stats.overdueReviews > 0 ? "bg-red-100" : "bg-[rgba(198,160,59,0.15)]"}`}>
                <AlertCircle className={`h-5 w-5 ${stats.overdueReviews > 0 ? "text-red-600" : "text-[#0C5536]"}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold mt-2 ${stats.overdueReviews > 0 ? "text-red-600" : "text-[#222222]"}`}>
              {loadingStats ? "-" : stats.overdueReviews}
            </p>
            <p className="text-xs text-[#777777] mt-1">{t("hr:reviews.needsAttention", "Needs attention")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
        <CardHeader className="pb-3">
          <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <Plus className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("hr:quickActions", "Quick Actions")}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 px-4 flex flex-col items-center gap-2 border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8] transition-all group"
              onClick={() => router.push("/hr/reviews/monthly/new")}
            >
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center group-hover:bg-[rgba(198,160,59,0.25)] transition-colors">
                <Plus className="h-5 w-5 text-[#0C5536]" />
              </div>
              <span className="text-sm font-medium text-[#222222]">{t("hr:reviews.createMonthlyReview", "Create Monthly Review")}</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 px-4 flex flex-col items-center gap-2 border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8] transition-all group"
              onClick={() => router.push("/hr/reviews")}
            >
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center group-hover:bg-[rgba(198,160,59,0.25)] transition-colors">
                <FileText className="h-5 w-5 text-[#0C5536]" />
              </div>
              <span className="text-sm font-medium text-[#222222]">{t("hr:reviews.quarterlyReviews")}</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 px-4 flex flex-col items-center gap-2 border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8] transition-all group"
              onClick={() => setActiveTab("pending")}
            >
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center group-hover:bg-[rgba(198,160,59,0.25)] transition-colors">
                <CheckCircle className="h-5 w-5 text-[#0C5536]" />
              </div>
              <span className="text-sm font-medium text-[#222222]">{t("hr:reviews.reviewPending", "Review Pending")}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border border-[#E6E6E4] p-1.5 rounded-xl w-full grid grid-cols-3 h-auto">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[#555555] font-medium transition-all"
          >
            <FileText className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
            {t("hr:reviews.allReviews")}
            {!loadingStats && stats.totalReviews > 0 && (
              <Badge variant="secondary" className="ml-2 bg-white/20 text-inherit">
                {stats.totalReviews}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[#555555] font-medium transition-all"
          >
            <Clock className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
            {t("hr:reviews.pendingApproval")}
            {!loadingStats && stats.pendingApproval > 0 && (
              <Badge variant="secondary" className="ml-2 bg-blue-500 text-white">
                {stats.pendingApproval}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="complete"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[#555555] font-medium transition-all"
          >
            <CheckCircle className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
            {t("hr:reviews.completed")}
            {!loadingStats && stats.completedReviews > 0 && (
              <Badge variant="secondary" className="ml-2 bg-green-500 text-white">
                {stats.completedReviews}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <MonthlyReviewList filterStatus="all" />
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <MonthlyReviewList filterStatus="pending_approval" />
        </TabsContent>

        <TabsContent value="complete" className="mt-6">
          <MonthlyReviewList filterStatus="complete" />
        </TabsContent>
      </Tabs>

      {/* Legal Notice Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("hr:legalNotice")}
        </p>
      </div>
    </div>
  );
}
