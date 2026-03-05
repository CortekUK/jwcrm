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
  History,
} from "lucide-react";
import { QuarterlyReviewPDFTemplate } from "@/components/hr/reviews";

type TemplateSection = {
  id: string;
  title: string;
  type: "textarea" | "readonly" | "list";
  required: boolean;
  order: number;
  isCustom?: boolean;
};

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
  custom_fields: Record<string, string> | null;
  created_at: string;
  approved_by: string | null;
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
    full_name: string;
  } | null;
  approver: {
    full_name: string;
  } | null;
};

export default function QuarterlyReviewDetailPage() {
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
  const [templateSections, setTemplateSections] = useState<TemplateSection[]>([]);
  const templateRef = useRef<HTMLDivElement>(null);

  // Load default template sections for custom field titles
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const { data } = await supabase
          .from("review_templates")
          .select("sections")
          .eq("is_default", true)
          .eq("is_active", true)
          .single();

        if (data?.sections) {
          setTemplateSections(data.sections as TemplateSection[]);
        }
      } catch {
        // If no default template, try the first active one
        try {
          const { data } = await supabase
            .from("review_templates")
            .select("sections")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (data?.sections) {
            setTemplateSections(data.sections as TemplateSection[]);
          }
        } catch {
          // No templates available
        }
      }
    };
    loadTemplate();
  }, []);

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
            reviewer:profiles!quarterly_reviews_reviewer_profile_fkey(full_name),
            approver:profiles!quarterly_reviews_approver_profile_fkey(full_name)
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
          onClick={() => router.push("/hr/reviews")}
          className="mt-4"
        >
          {t("hr:reviews.backToReviews")}
        </Button>
      </div>
    );
  }

  const reviewerName = review.reviewer?.full_name || null;
  const approverName = review.approver?.full_name || null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/hr/reviews")}
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
          {/* View History */}
          <Button
            variant="outline"
            onClick={() => router.push(`/hr/reviews?employee_id=${review.employee_id}`)}
            className="border-[#E6E6E4]"
          >
            <History className="h-4 w-4 mr-2" />
            {t("hr:reviews.viewHistory", "View History")}
          </Button>

          {review.status === "draft" && (
            <Button
              variant="outline"
              onClick={() => router.push(`/hr/reviews/${review.id}/edit`)}
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

      {/* Review Document Card */}
      <Card className="border-[#E6E6E4] dark:border-gray-700 overflow-hidden">
        {/* Green header band with employee info */}
        <div className="bg-[#0C5536] px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <User className="h-5 w-5 text-white/60" />
              <div className={isRtl ? "text-right" : ""}>
                <p className="text-xs text-white/60">{t("hr:employee")}</p>
                <p className="font-medium text-white">{review.employee?.full_name}</p>
              </div>
            </div>
            <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <Briefcase className="h-5 w-5 text-white/60" />
              <div className={isRtl ? "text-right" : ""}>
                <p className="text-xs text-white/60">{t("hr:department")}</p>
                <p className="font-medium text-white">
                  {review.employee?.department?.name || t("hr:notAssigned")}
                </p>
              </div>
            </div>
            <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <Calendar className="h-5 w-5 text-white/60" />
              <div className={isRtl ? "text-right" : ""}>
                <p className="text-xs text-white/60">{t("hr:reviews.period")}</p>
                <p className="font-medium text-white">Q{review.quarter} {review.year}</p>
              </div>
            </div>
            <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <BarChart3 className="h-5 w-5 text-[#C6A03B]" />
              <div className={isRtl ? "text-right" : ""}>
                <p className="text-xs text-white/60">{t("hr:reviews.overallScore")}</p>
                <p className="font-bold text-xl text-[#C6A03B]">
                  {review.overall_kpi_score !== null ? `${review.overall_kpi_score}%` : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Review content sections */}
        <CardContent className="p-0 divide-y divide-[#E6E6E4] dark:divide-gray-700">
          {/* Performance Summary */}
          {review.performance_summary && (
            <div className="px-6 py-5">
              <div className={`flex items-center gap-2 mb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                <CheckCircle className="h-4 w-4 text-[#0C5536]" />
                <h3 className="font-semibold text-[#222222] dark:text-gray-200">
                  {t("hr:reviews.performanceSummary")}
                </h3>
              </div>
              <p className={`text-[#222222] dark:text-gray-300 whitespace-pre-wrap leading-relaxed ${isRtl ? "text-right" : ""}`}>
                {review.performance_summary}
              </p>
            </div>
          )}

          {/* Strengths & Areas for Improvement — side by side on larger screens */}
          {(review.strengths || review.areas_for_improvement) && (
            <div className="px-6 py-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Strengths */}
                {review.strengths && (
                  <div>
                    <div className={`flex items-center gap-2 mb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                      <TrendingUp className="h-4 w-4 text-[#0C5536]" />
                      <h3 className="font-semibold text-[#0C5536]">
                        {t("hr:reviews.strengths")}
                      </h3>
                    </div>
                    <ul className={`space-y-1.5 ${isRtl ? "pr-4" : "pl-4"}`}>
                      {formatTextToList(review.strengths).map((item, index) => (
                        <li key={index} className="text-[#222222] dark:text-gray-300 list-disc">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Areas for Improvement */}
                {review.areas_for_improvement && (
                  <div>
                    <div className={`flex items-center gap-2 mb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                      <TrendingDown className="h-4 w-4 text-[#C6A03B]" />
                      <h3 className="font-semibold text-[#C6A03B]">
                        {t("hr:reviews.areasForImprovement")}
                      </h3>
                    </div>
                    <ul className={`space-y-1.5 ${isRtl ? "pr-4" : "pl-4"}`}>
                      {formatTextToList(review.areas_for_improvement).map((item, index) => (
                        <li key={index} className="text-[#222222] dark:text-gray-300 list-disc">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Goals for Next Quarter */}
          {review.goals_next_quarter && (
            <div className="px-6 py-5">
              <div className={`flex items-center gap-2 mb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                <Target className="h-4 w-4 text-[#0C5536]" />
                <h3 className="font-semibold text-[#222222] dark:text-gray-200">
                  {t("hr:reviews.goalsNextQuarter")}
                </h3>
              </div>
              <ul className={`space-y-1.5 ${isRtl ? "pr-4" : "pl-4"}`}>
                {formatTextToList(review.goals_next_quarter).map((item, index) => (
                  <li key={index} className="text-[#222222] dark:text-gray-300 list-disc">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Development Plan */}
          {review.development_plan && (
            <div className="px-6 py-5">
              <div className={`flex items-center gap-2 mb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                <Briefcase className="h-4 w-4 text-[#6B6B6B]" />
                <h3 className="font-semibold text-[#222222] dark:text-gray-200">
                  {t("hr:reviews.developmentPlan")}
                </h3>
              </div>
              <p className={`text-[#222222] dark:text-gray-300 whitespace-pre-wrap leading-relaxed ${isRtl ? "text-right" : ""}`}>
                {review.development_plan}
              </p>
            </div>
          )}

          {/* Manager Comments */}
          {review.manager_comments && (
            <div className="px-6 py-5 bg-[#FAFAF8] dark:bg-gray-800/50">
              <div className={`flex items-center gap-2 mb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                <User className="h-4 w-4 text-[#6B6B6B]" />
                <h3 className="font-semibold text-[#222222] dark:text-gray-200">
                  {t("hr:reviews.managerComments")}
                </h3>
              </div>
              <p className={`text-[#222222] dark:text-gray-300 whitespace-pre-wrap leading-relaxed italic ${isRtl ? "text-right" : ""}`}>
                {review.manager_comments}
              </p>
            </div>
          )}

          {/* Custom Fields */}
          {review.custom_fields && Object.keys(review.custom_fields).length > 0 && (() => {
            const customSections = templateSections.filter(
              (s) => s.isCustom && review.custom_fields?.[s.id]
            );
            const renderedIds = new Set(customSections.map((s) => s.id));
            const unmatchedKeys = Object.keys(review.custom_fields).filter(
              (k) => !renderedIds.has(k) && review.custom_fields![k]
            );

            return (
              <>
                {customSections
                  .sort((a, b) => a.order - b.order)
                  .map((section) => (
                    <div key={section.id} className="px-6 py-5 border-l-4 border-l-purple-400">
                      <div className={`flex items-center gap-2 mb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                        <CheckCircle className="h-4 w-4 text-purple-500" />
                        <h3 className="font-semibold text-[#222222] dark:text-gray-200">
                          {section.title}
                        </h3>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-300 text-purple-600 bg-purple-50">
                          {t("hr:reviews.customFieldLabel")}
                        </Badge>
                      </div>
                      <p className={`text-[#222222] dark:text-gray-300 whitespace-pre-wrap leading-relaxed ${isRtl ? "text-right" : ""}`}>
                        {review.custom_fields![section.id]}
                      </p>
                    </div>
                  ))}
                {unmatchedKeys.map((key) => (
                  <div key={key} className="px-6 py-5 border-l-4 border-l-purple-400">
                    <div className={`flex items-center gap-2 mb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                      <CheckCircle className="h-4 w-4 text-purple-500" />
                      <h3 className="font-semibold text-[#222222] dark:text-gray-200">
                        {key.replace(/^custom_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </h3>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-300 text-purple-600 bg-purple-50">
                        {t("hr:reviews.customFieldLabel")}
                      </Badge>
                    </div>
                    <p className={`text-[#222222] dark:text-gray-300 whitespace-pre-wrap leading-relaxed ${isRtl ? "text-right" : ""}`}>
                      {review.custom_fields![key]}
                    </p>
                  </div>
                ))}
              </>
            );
          })()}
        </CardContent>
      </Card>

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
          customFields={review.custom_fields}
          templateSections={templateSections}
        />
      </div>
    </div>
  );
}
