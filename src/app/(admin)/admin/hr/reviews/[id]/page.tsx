"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Download, 
  Edit, 
  CheckCircle, 
  User, 
  Briefcase, 
  Calendar,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Loader2,
} from "lucide-react";
import { QuarterlyReviewPDFTemplate } from "@/components/hr/reviews";

type QuarterlyReview = {
  id: string;
  employee_id: string;
  reviewer_id: string;
  quarter: number;
  year: number;
  status: "draft" | "submitted" | "approved" | "complete";
  deadline_date: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  completed_at: string | null;
  overall_kpi_score: number | null;
  performance_summary: string | null;
  strengths: string | null;
  areas_for_improvement: string | null;
  goals_next_quarter: string | null;
  development_plan: string | null;
  manager_comments: string | null;
  created_at: string;
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
  approver: {
    email: string;
  } | null;
};

export default function AdminQuarterlyReviewDetailPage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const reviewId = params.id as string;
  
  const [review, setReview] = useState<QuarterlyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  // Fetch review
  useEffect(() => {
    const fetchReview = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("quarterly_reviews")
          .select(`
            *,
            employee:employees(id, full_name, job_title, department:departments(id, name)),
            reviewer:auth.users!quarterly_reviews_reviewer_id_fkey(email),
            approver:auth.users!quarterly_reviews_approved_by_fkey(email)
          `)
          .eq("id", reviewId)
          .single();

        if (error) throw error;
        setReview(data as QuarterlyReview);
      } catch (error) {
        console.error("Error fetching review:", error);
        toast({
          variant: "destructive",
          description: t("hr:reviews.errorLoadingReview"),
        });
      } finally {
        setLoading(false);
      }
    };

    if (reviewId) {
      fetchReview();
    }
  }, [reviewId, t, toast]);

  const handleApprove = async () => {
    if (!review) return;
    
    setApproving(true);
    try {
      const { error } = await supabase
        .from("quarterly_reviews")
        .update({
          status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", review.id);

      if (error) throw error;

      setReview(prev => prev ? { 
        ...prev, 
        status: "approved", 
        approved_at: new Date().toISOString() 
      } : null);

      toast({
        title: t("hr:reviews.reviewApproved"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
    } catch (error) {
      console.error("Error approving review:", error);
      toast({
        variant: "destructive",
        description: t("hr:reviews.errorApproving"),
      });
    } finally {
      setApproving(false);
    }
  };

  const handleComplete = async () => {
    if (!review) return;
    
    setCompleting(true);
    try {
      const { error } = await supabase
        .from("quarterly_reviews")
        .update({
          status: "complete",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", review.id);

      if (error) throw error;

      setReview(prev => prev ? { 
        ...prev, 
        status: "complete", 
        completed_at: new Date().toISOString() 
      } : null);

      toast({
        title: t("hr:reviews.reviewCompleted"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
    } catch (error) {
      console.error("Error completing review:", error);
      toast({
        variant: "destructive",
        description: t("hr:reviews.errorCompleting"),
      });
    } finally {
      setCompleting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!review) return;
    
    setGeneratingPdf(true);
    try {
      // Wait for template to render
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Dynamic import of html2pdf
      const html2pdf = (await import("html2pdf.js")).default;

      if (!templateRef.current) {
        throw new Error("Template not rendered");
      }

      const filename = `Quarterly_Review_${review.employee?.full_name?.replace(/\s+/g, "_")}_Q${review.quarter}_${review.year}.pdf`;

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
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline" className="bg-gray-100 text-gray-700">{t("hr:reviews.status_draft")}</Badge>;
      case "submitted":
        return <Badge className="bg-blue-100 text-blue-700">{t("hr:reviews.status_submitted")}</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-700">{t("hr:reviews.status_approved")}</Badge>;
      case "complete":
        return <Badge className="bg-[#E6F7F1] text-[#0C5536]">{t("hr:reviews.status_complete")}</Badge>;
      default:
        return null;
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-gray-500";
    if (score >= 80) return "text-[#0C5536]";
    if (score >= 60) return "text-[#C6A03B]";
    return "text-red-600";
  };

  const formatTextToList = (text: string | null): string[] => {
    if (!text) return [];
    return text.split("\n").filter((line) => line.trim());
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="text-center py-12">
        <p className="text-[#6B6B6B] dark:text-gray-400">{t("hr:reviews.reviewNotFound")}</p>
        <Button
          variant="outline"
          onClick={() => router.push("/admin/hr/reviews")}
          className="mt-4"
        >
          {t("hr:reviews.backToReviews")}
        </Button>
      </div>
    );
  }

  const reviewerName = review.reviewer?.email?.split("@")[0] || null;
  const approverName = review.approver?.email?.split("@")[0] || null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/hr/reviews")}
            className="text-[#6B6B6B]"
          >
            <ArrowLeft className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
          </Button>
          <div className={isRtl ? "text-right" : ""}>
            <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <h1 className="text-2xl font-bold text-[#222222] dark:text-gray-100">
                {t("hr:reviews.quarterlyReview")}
              </h1>
              {getStatusBadge(review.status)}
            </div>
            <p className="text-[#6B6B6B] dark:text-gray-400 mt-1">
              Q{review.quarter} {review.year} - {review.employee?.full_name}
            </p>
          </div>
        </div>

        <div className={`flex gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
          {review.status === "draft" && (
            <Button
              variant="outline"
              onClick={() => router.push(`/admin/hr/reviews/${review.id}/edit`)}
              className="border-[#E6E6E4]"
            >
              <Edit className="h-4 w-4 mr-2" />
              {t("common:edit")}
            </Button>
          )}
          
          {review.status === "submitted" && (
            <Button
              onClick={handleApprove}
              disabled={approving}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {approving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle className="h-4 w-4 mr-2" />
              {t("hr:reviews.approve")}
            </Button>
          )}
          
          {review.status === "approved" && (
            <Button
              onClick={handleComplete}
              disabled={completing}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle className="h-4 w-4 mr-2" />
              {t("hr:reviews.markComplete")}
            </Button>
          )}
          
          {(review.status === "approved" || review.status === "complete") && (
            <Button
              onClick={handleDownloadPDF}
              disabled={generatingPdf}
              variant="outline"
              className="border-[#E6E6E4]"
            >
              {generatingPdf && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Download className="h-4 w-4 mr-2" />
              {t("hr:downloadPdf")}
            </Button>
          )}
        </div>
      </div>

      {/* Employee Info Card */}
      <Card className="border-[#E6E6E4] dark:border-gray-700">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <User className="h-5 w-5 text-[#6B6B6B]" />
              <div className={isRtl ? "text-right" : ""}>
                <p className="text-xs text-[#6B6B6B] dark:text-gray-400">{t("hr:employee")}</p>
                <p className="font-medium text-[#222222] dark:text-gray-200">{review.employee?.full_name}</p>
              </div>
            </div>
            <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <Briefcase className="h-5 w-5 text-[#6B6B6B]" />
              <div className={isRtl ? "text-right" : ""}>
                <p className="text-xs text-[#6B6B6B] dark:text-gray-400">{t("hr:department")}</p>
                <p className="font-medium text-[#222222] dark:text-gray-200">
                  {review.employee?.department?.name || t("hr:notAssigned")}
                </p>
              </div>
            </div>
            <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <Calendar className="h-5 w-5 text-[#6B6B6B]" />
              <div className={isRtl ? "text-right" : ""}>
                <p className="text-xs text-[#6B6B6B] dark:text-gray-400">{t("hr:reviews.period")}</p>
                <p className="font-medium text-[#222222] dark:text-gray-200">Q{review.quarter} {review.year}</p>
              </div>
            </div>
            <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <BarChart3 className="h-5 w-5 text-[#6B6B6B]" />
              <div className={isRtl ? "text-right" : ""}>
                <p className="text-xs text-[#6B6B6B] dark:text-gray-400">{t("hr:reviews.overallScore")}</p>
                <p className={`font-bold text-xl ${getScoreColor(review.overall_kpi_score)}`}>
                  {review.overall_kpi_score !== null ? `${review.overall_kpi_score}%` : "-"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary */}
      {review.performance_summary && (
        <Card className="border-[#E6E6E4] dark:border-gray-700">
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <CheckCircle className="h-5 w-5 text-[#0C5536]" />
              {t("hr:reviews.performanceSummary")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-[#222222] dark:text-gray-200 whitespace-pre-wrap ${isRtl ? "text-right" : ""}`}>
              {review.performance_summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Strengths */}
      {review.strengths && (
        <Card className="border-[#E6E6E4] dark:border-gray-700">
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <TrendingUp className="h-5 w-5 text-[#0C5536]" />
              {t("hr:reviews.strengths")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className={`space-y-2 ${isRtl ? "pr-4" : "pl-4"}`}>
              {formatTextToList(review.strengths).map((item, index) => (
                <li key={index} className="text-[#222222] dark:text-gray-200 list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Areas for Improvement */}
      {review.areas_for_improvement && (
        <Card className="border-[#E6E6E4] dark:border-gray-700">
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <TrendingDown className="h-5 w-5 text-[#C6A03B]" />
              {t("hr:reviews.areasForImprovement")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className={`space-y-2 ${isRtl ? "pr-4" : "pl-4"}`}>
              {formatTextToList(review.areas_for_improvement).map((item, index) => (
                <li key={index} className="text-[#222222] dark:text-gray-200 list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Goals for Next Quarter */}
      {review.goals_next_quarter && (
        <Card className="border-[#E6E6E4] dark:border-gray-700">
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <Target className="h-5 w-5 text-[#0C5536]" />
              {t("hr:reviews.goalsNextQuarter")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className={`space-y-2 ${isRtl ? "pr-4" : "pl-4"}`}>
              {formatTextToList(review.goals_next_quarter).map((item, index) => (
                <li key={index} className="text-[#222222] dark:text-gray-200 list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Development Plan */}
      {review.development_plan && (
        <Card className="border-[#E6E6E4] dark:border-gray-700">
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <Briefcase className="h-5 w-5 text-[#6B6B6B]" />
              {t("hr:reviews.developmentPlan")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-[#222222] dark:text-gray-200 whitespace-pre-wrap ${isRtl ? "text-right" : ""}`}>
              {review.development_plan}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Manager Comments */}
      {review.manager_comments && (
        <Card className="border-[#E6E6E4] dark:border-gray-700">
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <User className="h-5 w-5 text-[#6B6B6B]" />
              {t("hr:reviews.managerComments")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-[#222222] dark:text-gray-200 whitespace-pre-wrap italic ${isRtl ? "text-right" : ""}`}>
              {review.manager_comments}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Hidden PDF Template */}
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
          employeeName={review.employee?.full_name || ""}
          employeeJobTitle={review.employee?.job_title || null}
          departmentName={review.employee?.department?.name || null}
          quarter={review.quarter}
          year={review.year}
          overallScore={review.overall_kpi_score}
          performanceSummary={review.performance_summary}
          strengths={review.strengths}
          areasForImprovement={review.areas_for_improvement}
          goalsNextQuarter={review.goals_next_quarter}
          developmentPlan={review.development_plan}
          managerComments={review.manager_comments}
          reviewerName={reviewerName}
          approvedBy={approverName}
          submittedAt={review.submitted_at}
          approvedAt={review.approved_at}
        />
      </div>
    </div>
  );
}
