"use client";

import { useState, useEffect } from "react";
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
  Edit, 
  CheckCircle, 
  User, 
  Briefcase, 
  Calendar,
  BarChart3,
  Loader2,
  Trophy,
  AlertTriangle,
  TrendingUp
} from "lucide-react";

type MonthlyReview = {
  id: string;
  employee_id: string;
  reviewer_id: string;
  month: number;
  year: number;
  status: "draft" | "submitted" | "approved" | "complete";
  deadline_date: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  completed_at: string | null;
  overall_kpi_score: number | null;
  performance_summary: string | null;
  achievements: string | null;
  challenges: string | null;
  goals_progress: string | null;
  manager_notes: string | null;
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

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function MonthlyReviewDetailPage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const [review, setReview] = useState<MonthlyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [completing, setCompleting] = useState(false);

  const reviewId = params.id as string;

  // Fetch review data
  useEffect(() => {
    const fetchReview = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("monthly_reviews")
          .select(`
            *,
            employee:employees(id, full_name, job_title, department:departments(id, name)),
            reviewer:profiles!monthly_reviews_reviewer_profile_fkey(full_name),
            approver:profiles!monthly_reviews_approver_profile_fkey(full_name)
          `)
          .eq("id", reviewId)
          .single();

        if (error) throw error;
        setReview(data as MonthlyReview);
      } catch (error) {
        console.error("Error fetching review:", error);
        toast({
          variant: "destructive",
          description: t("hr:reviews.reviewNotFound"),
        });
        router.push("/hr/reviews/monthly");
      } finally {
        setLoading(false);
      }
    };

    fetchReview();
  }, [reviewId, router, t, toast]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      const { error } = await supabase
        .from("monthly_reviews")
        .update({
          status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reviewId);

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
    setCompleting(true);
    try {
      const { error } = await supabase
        .from("monthly_reviews")
        .update({
          status: "complete",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reviewId);

      if (error) throw error;

      setReview(prev => prev ? { ...prev, status: "complete" } : null);

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

  const getMonthName = (month: number) => {
    return t(`hr:month.${monthNames[month - 1].toLowerCase()}`, monthNames[month - 1]);
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-gray-600";
    if (score >= 80) return "text-[#0C5536]";
    if (score >= 60) return "text-[#C6A03B]";
    return "text-red-600";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!review) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/hr/reviews/monthly")}
            className="text-[#6B6B6B]"
          >
            <ArrowLeft className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
          </Button>
          <div className={isRtl ? "text-right" : ""}>
            <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <h1 className="text-2xl font-bold text-[#222222] dark:text-gray-100">
                {t("hr:reviews.monthlyReview", "Monthly Review")}
              </h1>
              {getStatusBadge(review.status)}
            </div>
            <p className="text-[#6B6B6B] dark:text-gray-400 mt-1">
              {getMonthName(review.month)} {review.year} - {review.employee?.full_name}
            </p>
          </div>
        </div>

        <div className={`flex gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
          {review.status === "draft" && (
            <Button
              variant="outline"
              onClick={() => router.push(`/hr/reviews/monthly/${review.id}/edit`)}
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
        </div>
      </div>

      {/* Employee Info Card */}
      <Card className="border-[#E6E6E4] dark:border-gray-700">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Employee */}
            <div className="space-y-1">
              <p className="text-xs text-[#6B6B6B] dark:text-gray-400">{t("hr:employee")}</p>
              <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                <User className="h-4 w-4 text-[#6B6B6B]" />
                <span className="font-medium text-[#222222] dark:text-gray-200">{review.employee?.full_name}</span>
              </div>
            </div>

            {/* Department */}
            <div className="space-y-1">
              <p className="text-xs text-[#6B6B6B] dark:text-gray-400">{t("hr:department")}</p>
              <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                <Briefcase className="h-4 w-4 text-[#6B6B6B]" />
                <span className="text-[#222222] dark:text-gray-200">
                  {review.employee?.department?.name || t("hr:notAssigned")}
                </span>
              </div>
            </div>

            {/* Period */}
            <div className="space-y-1">
              <p className="text-xs text-[#6B6B6B] dark:text-gray-400">{t("hr:reviews.period")}</p>
              <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                <Calendar className="h-4 w-4 text-[#6B6B6B]" />
                <span className="text-[#222222] dark:text-gray-200">
                  {getMonthName(review.month)} {review.year}
                </span>
              </div>
            </div>

            {/* Overall Score */}
            <div className="space-y-1">
              <p className="text-xs text-[#6B6B6B] dark:text-gray-400">{t("hr:reviews.overallScore")}</p>
              <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                <BarChart3 className="h-4 w-4 text-[#C6A03B]" />
                <span className={`text-2xl font-bold ${getScoreColor(review.overall_kpi_score)}`}>
                  {review.overall_kpi_score !== null ? `${review.overall_kpi_score}%` : "-"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary */}
      {review.performance_summary && (
        <Card className="border-[#E6E6E4] dark:border-gray-700">
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 text-lg ${isRtl ? "flex-row-reverse" : ""}`}>
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

      {/* Achievements */}
      {review.achievements && (
        <Card className="border-[#E6E6E4] dark:border-gray-700">
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 text-lg ${isRtl ? "flex-row-reverse" : ""}`}>
              <Trophy className="h-5 w-5 text-[#C6A03B]" />
              {t("hr:reviews.achievements", "Achievements")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-[#222222] dark:text-gray-200 whitespace-pre-wrap ${isRtl ? "text-right" : ""}`}>
              {review.achievements}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Challenges */}
      {review.challenges && (
        <Card className="border-[#E6E6E4] dark:border-gray-700">
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 text-lg ${isRtl ? "flex-row-reverse" : ""}`}>
              <AlertTriangle className="h-5 w-5 text-[#C6A03B]" />
              {t("hr:reviews.challenges", "Challenges")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-[#222222] dark:text-gray-200 whitespace-pre-wrap ${isRtl ? "text-right" : ""}`}>
              {review.challenges}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Goals Progress */}
      {review.goals_progress && (
        <Card className="border-[#E6E6E4] dark:border-gray-700">
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 text-lg ${isRtl ? "flex-row-reverse" : ""}`}>
              <TrendingUp className="h-5 w-5 text-[#0C5536]" />
              {t("hr:reviews.goalsProgress", "Goals Progress")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-[#222222] dark:text-gray-200 whitespace-pre-wrap ${isRtl ? "text-right" : ""}`}>
              {review.goals_progress}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Manager Notes */}
      {review.manager_notes && (
        <Card className="border-[#E6E6E4] dark:border-gray-700">
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 text-lg ${isRtl ? "flex-row-reverse" : ""}`}>
              <User className="h-5 w-5 text-[#6B6B6B]" />
              {t("hr:reviews.managerNotes", "Manager Notes")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-[#222222] dark:text-gray-200 whitespace-pre-wrap italic ${isRtl ? "text-right" : ""}`}>
              {review.manager_notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
