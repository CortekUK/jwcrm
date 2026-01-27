"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  FileText, 
  Clock, 
  CheckCircle, 
  BarChart3, 
  User, 
  X, 
  ClipboardCheck,
  AlertCircle,
  CalendarClock,
  TrendingUp
} from "lucide-react";
import { QuarterlyReviewList, QuarterlyReviewPDFTemplate } from "@/components/hr/reviews";

type ReviewForPDF = {
  id: string;
  employee_id: string;
  quarter: number;
  year: number;
  overall_kpi_score: number | null;
  performance_summary: string | null;
  strengths: string | null;
  areas_for_improvement: string | null;
  goals_next_quarter: string | null;
  development_plan: string | null;
  manager_comments: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  employee: {
    id: string;
    full_name: string;
    job_title: string | null;
    department: {
      id: string;
      name: string;
    } | null;
  };
  reviewer: {
    email: string;
  } | null;
};

// Get current quarter helper
const getCurrentQuarter = () => Math.ceil((new Date().getMonth() + 1) / 3);
const getCurrentYear = () => new Date().getFullYear();

type ReviewStats = {
  totalReviews: number;
  pendingApproval: number;
  completedReviews: number;
  overdueReviews: number;
  completionRate: number;
};

export default function QuarterlyReviewsPage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const employeeId = searchParams.get("employee_id");
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState("all");
  const [pdfData, setPdfData] = useState<{
    review: ReviewForPDF;
    reviewerName: string | null;
    approverName: string | null;
  } | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  // Stats for the dashboard cards
  const [stats, setStats] = useState<ReviewStats>({
    totalReviews: 0,
    pendingApproval: 0,
    completedReviews: 0,
    overdueReviews: 0,
    completionRate: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch review statistics
  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const currentQuarter = getCurrentQuarter();
        const currentYear = getCurrentYear();

        // Fetch all reviews for current quarter
        const { data: reviews, error } = await supabase
          .from("quarterly_reviews")
          .select("id, status, deadline_date")
          .eq("quarter", currentQuarter)
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

  // Fetch employee name if filtering by employee
  useEffect(() => {
    const fetchEmployeeName = async () => {
      if (!employeeId) {
        setEmployeeName(null);
        return;
      }

      const { data, error } = await supabase
        .from("employees")
        .select("full_name")
        .eq("id", employeeId)
        .single();

      if (!error && data) {
        setEmployeeName(data.full_name);
      }
    };

    fetchEmployeeName();
  }, [employeeId]);

  const clearEmployeeFilter = () => {
    router.push("/hr/reviews");
  };

  const handleDownloadPDF = async (review: ReviewForPDF) => {
    setGeneratingPdf(true);
    try {
      // Fetch full review data with employee details
      const { data: reviewData, error } = await supabase
        .from("quarterly_reviews")
        .select(`
          *,
          employee:employees(id, full_name, job_title, department:departments(id, name)),
          reviewer:auth.users!quarterly_reviews_reviewer_id_fkey(email),
          approver:auth.users!quarterly_reviews_approved_by_fkey(email)
        `)
        .eq("id", review.id)
        .single();

      if (error) throw error;

      // Get reviewer and approver names (from email)
      const reviewerName = reviewData.reviewer?.email?.split("@")[0] || null;
      const approverName = reviewData.approver?.email?.split("@")[0] || null;

      setPdfData({
        review: reviewData as ReviewForPDF,
        reviewerName,
        approverName,
      });

      // Wait for template to render
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Dynamic import of html2pdf
      const html2pdf = (await import("html2pdf.js")).default;

      if (!templateRef.current) {
        throw new Error("Template not rendered");
      }

      const filename = `Quarterly_Review_${reviewData.employee?.full_name?.replace(/\s+/g, "_")}_Q${reviewData.quarter}_${reviewData.year}.pdf`;

      await html2pdf()
        .set({
          margin: 10,
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(templateRef.current)
        .save();

      toast({
        title: t("hr:pdfDownloaded"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        variant: "destructive",
        description: t("hr:pdfDownloadError"),
      });
    } finally {
      setGeneratingPdf(false);
      setPdfData(null);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
          <div className={isRtl ? "text-right" : ""}>
            <div className={`flex items-center gap-3 mb-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <ClipboardCheck className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("hr:reviews.quarterlyReviews")}
              </h1>
            </div>
            <p className={`text-sm text-[#777777] ${isRtl ? "mr-9" : "ml-9"}`}>
              {employeeId && employeeName
                ? t("hr:reviews.reviewHistoryFor", { name: employeeName, defaultValue: `Review history for ${employeeName}` })
                : t("hr:reviews.manageQuarterlyReviews")}
            </p>
          </div>
          
          {/* Quick badge for overdue if any */}
          {stats.overdueReviews > 0 && (
            <div className={`flex items-center gap-2 px-3 py-2 bg-white border border-[#E6E6E4] rounded-md ${isRtl ? "flex-row-reverse" : ""}`}>
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-600 font-medium text-sm">
                {stats.overdueReviews} {t("hr:reviews.overdue")}
              </span>
            </div>
          )}
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
            <p className="text-xs text-[#777777] mt-1">Q{getCurrentQuarter()} {getCurrentYear()}</p>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 px-4 flex flex-col items-center gap-2 border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8] transition-all group"
              onClick={() => router.push("/hr/reviews/new")}
            >
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center group-hover:bg-[rgba(198,160,59,0.25)] transition-colors">
                <Plus className="h-5 w-5 text-[#0C5536]" />
              </div>
              <span className="text-sm font-medium text-[#222222]">{t("hr:reviews.createReview")}</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 px-4 flex flex-col items-center gap-2 border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8] transition-all group"
              onClick={() => router.push("/hr/reviews/compliance")}
            >
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center group-hover:bg-[rgba(198,160,59,0.25)] transition-colors">
                <BarChart3 className="h-5 w-5 text-[#0C5536]" />
              </div>
              <span className="text-sm font-medium text-[#222222]">{t("hr:reviews.compliance")}</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 px-4 flex flex-col items-center gap-2 border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8] transition-all group"
              onClick={() => router.push("/hr/reviews/monthly")}
            >
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center group-hover:bg-[rgba(198,160,59,0.25)] transition-colors">
                <CalendarClock className="h-5 w-5 text-[#0C5536]" />
              </div>
              <span className="text-sm font-medium text-[#222222]">{t("hr:reviews.monthlyReviews", "Monthly Reviews")}</span>
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

      {/* Employee Filter Banner */}
      {employeeId && employeeName && (
        <div className="bg-[#E6F7F1] dark:bg-green-900/30 border border-[#0C5536]/20 rounded-lg p-4">
          <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <User className="h-5 w-5 text-[#0C5536]" />
              <div>
                <p className="font-medium text-[#0C5536]">
                  {t("hr:reviews.filteringByEmployee", { defaultValue: "Showing reviews for:" })}
                </p>
                <p className="text-sm text-[#0C5536]/80">{employeeName}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearEmployeeFilter}
              className="text-[#0C5536] hover:bg-[#0C5536]/10"
            >
              <X className="h-4 w-4 mr-1" />
              {t("common:clearFilter", "Clear Filter")}
            </Button>
          </div>
        </div>
      )}

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
          <QuarterlyReviewList
            filterStatus="all"
            employeeId={employeeId || undefined}
            onDownloadPDF={handleDownloadPDF}
          />
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <QuarterlyReviewList
            filterStatus="pending_approval"
            employeeId={employeeId || undefined}
            onDownloadPDF={handleDownloadPDF}
          />
        </TabsContent>

        <TabsContent value="complete" className="mt-6">
          <QuarterlyReviewList
            filterStatus="complete"
            employeeId={employeeId || undefined}
            onDownloadPDF={handleDownloadPDF}
          />
        </TabsContent>
      </Tabs>

      {/* Legal Notice Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("hr:legalNotice")}
        </p>
      </div>

      {/* Hidden PDF Template */}
      {pdfData && (
        <div
          style={{
            position: "absolute",
            left: "-9999px",
            top: 0,
            width: "700px",
          }}
        >
          <QuarterlyReviewPDFTemplate
            ref={templateRef}
            employeeName={pdfData.review.employee?.full_name || ""}
            employeeJobTitle={pdfData.review.employee?.job_title || null}
            departmentName={pdfData.review.employee?.department?.name || null}
            quarter={pdfData.review.quarter}
            year={pdfData.review.year}
            overallScore={pdfData.review.overall_kpi_score}
            performanceSummary={pdfData.review.performance_summary}
            strengths={pdfData.review.strengths}
            areasForImprovement={pdfData.review.areas_for_improvement}
            goalsNextQuarter={pdfData.review.goals_next_quarter}
            developmentPlan={pdfData.review.development_plan}
            managerComments={pdfData.review.manager_comments}
            reviewerName={pdfData.reviewerName}
            approvedBy={pdfData.approverName}
            submittedAt={pdfData.review.submitted_at}
            approvedAt={pdfData.review.approved_at}
          />
        </div>
      )}
    </div>
  );
}
