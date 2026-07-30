"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Target, 
  CheckCircle2, 
  Sparkles,
  Save,
  SendHorizontal,
  User,
  Briefcase,
  Calendar,
  Clock,
  Trophy,
  AlertTriangle,
  TrendingUp,
  BarChart3
} from "lucide-react";
import { useHrBasePath } from "@/hooks/useHrBasePath";

type Employee = {
  id: string;
  full_name: string;
  email: string | null;
  job_title: string | null;
  department?: {
    id: string;
    name: string;
  } | null;
  job_role?: {
    id: string;
    name: string;
  } | null;
};

type MonthlyReview = {
  id?: string;
  employee_id: string;
  month: number;
  year: number;
  status: "draft" | "submitted" | "approved" | "complete";
  deadline_date: string | null;
  overall_kpi_score: number | null;
  performance_summary: string | null;
  achievements: string | null;
  challenges: string | null;
  goals_progress: string | null;
  manager_notes: string | null;
};

type MonthlyReviewFormProps = {
  employee: Employee;
  reviewId?: string;
  initialMonth?: number;
  initialYear?: number;
  onSuccess?: () => void;
};

const monthOptions = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const getCurrentMonth = (): number => new Date().getMonth() + 1;
const getCurrentYear = (): number => new Date().getFullYear();
const getYearOptions = () => {
  const currentYear = getCurrentYear();
  return [currentYear - 1, currentYear, currentYear + 1].map(year => ({
    value: year,
    label: String(year),
  }));
};

export function MonthlyReviewForm({
  employee,
  reviewId,
  initialMonth,
  initialYear,
  onSuccess,
}: MonthlyReviewFormProps) {
  const hrBase = useHrBasePath();
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();

  const [selectedMonth, setSelectedMonth] = useState(initialMonth ?? getCurrentMonth());
  const [selectedYear, setSelectedYear] = useState(initialYear ?? getCurrentYear());
  const [review, setReview] = useState<MonthlyReview>({
    employee_id: employee.id,
    month: selectedMonth,
    year: selectedYear,
    status: "draft",
    deadline_date: null,
    overall_kpi_score: null,
    performance_summary: null,
    achievements: null,
    challenges: null,
    goals_progress: null,
    manager_notes: null,
  });
  
  const [kpiScore, setKpiScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(!!reviewId);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingKPI, setLoadingKPI] = useState(false);

  const yearOptions = getYearOptions();

  // Load existing review if reviewId provided
  useEffect(() => {
    const loadReview = async () => {
      if (!reviewId) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("monthly_reviews")
          .select("*")
          .eq("id", reviewId)
          .single();

        if (error) throw error;
        
        if (data) {
          setReview(data as MonthlyReview);
          setSelectedMonth(data.month);
          setSelectedYear(data.year);
        }
      } catch (error) {
        console.error("Error loading review:", error);
        toast({
          variant: "destructive",
          description: t("hr:reviews.errorLoadingReview"),
        });
      } finally {
        setLoading(false);
      }
    };

    loadReview();
  }, [reviewId, t, toast]);

  // Load KPI score for the selected month
  useEffect(() => {
    const loadKPIScore = async () => {
      setLoadingKPI(true);
      try {
        // Get employee's job role
        const { data: empData } = await supabase
          .from("employees")
          .select("job_role_id")
          .eq("id", employee.id)
          .single();

        if (!empData?.job_role_id) {
          setKpiScore(null);
          return;
        }

        // Get KPIs for this job role
        const { data: kpis } = await supabase
          .from("kpis")
          .select("id, weighting")
          .eq("job_role_id", empData.job_role_id)
          .eq("is_archived", false);

        if (!kpis || kpis.length === 0) {
          setKpiScore(null);
          return;
        }

        // Get evaluations for this month
        const { data: evaluations } = await supabase
          .from("kpi_evaluations")
          .select("kpi_id, score")
          .eq("employee_id", employee.id)
          .eq("month", selectedMonth)
          .eq("year", selectedYear)
          .not("score", "is", null);

        if (!evaluations || evaluations.length === 0) {
          setKpiScore(null);
          return;
        }

        // Calculate weighted average
        let totalWeightedScore = 0;
        let totalWeight = 0;

        for (const kpi of kpis) {
          const eval_ = evaluations.find(e => e.kpi_id === kpi.id);
          if (eval_?.score !== null && eval_?.score !== undefined) {
            totalWeightedScore += eval_.score * (kpi.weighting / 100);
            totalWeight += kpi.weighting;
          }
        }

        const overallScore = totalWeight > 0 
          ? Math.round((totalWeightedScore / totalWeight) * 100 * 100) / 100
          : null;

        setKpiScore(overallScore);
        setReview(prev => ({ ...prev, overall_kpi_score: overallScore }));
      } catch (error) {
        console.error("Error loading KPI score:", error);
      } finally {
        setLoadingKPI(false);
      }
    };

    loadKPIScore();
  }, [employee.id, selectedMonth, selectedYear]);

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const reviewData = {
        employee_id: employee.id,
        reviewer_id: user?.id,
        month: selectedMonth,
        year: selectedYear,
        status: "draft" as const,
        deadline_date: review.deadline_date,
        overall_kpi_score: review.overall_kpi_score,
        performance_summary: review.performance_summary,
        achievements: review.achievements,
        challenges: review.challenges,
        goals_progress: review.goals_progress,
        manager_notes: review.manager_notes,
        updated_at: new Date().toISOString(),
      };

      if (review.id) {
        const { error } = await supabase
          .from("monthly_reviews")
          .update(reviewData)
          .eq("id", review.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("monthly_reviews")
          .insert(reviewData)
          .select()
          .single();

        if (error) throw error;
        setReview(prev => ({ ...prev, id: data.id }));
      }

      toast({
        title: t("hr:reviews.draftSaved"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
      onSuccess?.();
    } catch (error) {
      console.error("Error saving draft:", error);
      toast({
        variant: "destructive",
        description: t("hr:reviews.errorSavingDraft"),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async () => {
    // Validate required fields
    if (!review.performance_summary?.trim()) {
      toast({
        variant: "destructive",
        description: t("hr:reviews.performanceSummaryRequired"),
      });
      return;
    }

    setSubmitting(true);
    try {
      const reviewData = {
        employee_id: employee.id,
        reviewer_id: user?.id,
        month: selectedMonth,
        year: selectedYear,
        status: "submitted" as const,
        submitted_at: new Date().toISOString(),
        deadline_date: review.deadline_date,
        overall_kpi_score: review.overall_kpi_score,
        performance_summary: review.performance_summary,
        achievements: review.achievements,
        challenges: review.challenges,
        goals_progress: review.goals_progress,
        manager_notes: review.manager_notes,
        updated_at: new Date().toISOString(),
      };

      if (review.id) {
        const { error } = await supabase
          .from("monthly_reviews")
          .update(reviewData)
          .eq("id", review.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("monthly_reviews")
          .insert(reviewData);

        if (error) throw error;
      }

      toast({
        title: t("hr:reviews.submittedForApproval"),
        description: t("hr:reviews.submittedForApprovalDesc"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
      
      router.push(`${hrBase}/reviews/monthly`);
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({
        variant: "destructive",
        description: t("hr:reviews.errorSubmitting"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "bg-gray-100 text-gray-600";
    if (score >= 80) return "bg-[#E6F7F1] text-[#0C5536]";
    if (score >= 60) return "bg-[#FFF9E6] text-[#C6A03B]";
    return "bg-red-50 text-red-600";
  };

  const getPerformanceLabel = (score: number | null) => {
    if (score === null) return t("hr:reviews.notEvaluated");
    if (score >= 80) return t("hr:reviews.excellent");
    if (score >= 60) return t("hr:reviews.good");
    return t("hr:reviews.needsImprovement");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const isEditable = !review.id || review.status === "draft";

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card className="border-[#E6E6E4] dark:border-gray-700">
        <CardHeader className="bg-[#0C5536] text-white rounded-t-lg">
          <CardTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <Calendar className="h-5 w-5" />
            {t("hr:reviews.monthlyReview", "Monthly Review")}
          </CardTitle>
          <CardDescription className="text-white/80">
            {employee.full_name}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Employee Info */}
            <div className="space-y-1">
              <Label className="text-xs text-[#6B6B6B] dark:text-gray-400">{t("hr:employee")}</Label>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-[#6B6B6B]" />
                <span className="font-medium text-[#222222] dark:text-gray-200">{employee.full_name}</span>
              </div>
            </div>

            {/* Department */}
            <div className="space-y-1">
              <Label className="text-xs text-[#6B6B6B] dark:text-gray-400">{t("hr:department")}</Label>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-[#6B6B6B]" />
                <span className="text-[#222222] dark:text-gray-200">
                  {employee.department?.name || t("hr:notAssigned")}
                </span>
              </div>
            </div>

            {/* Month Selection */}
            <div className="space-y-1">
              <Label className="text-xs text-[#6B6B6B] dark:text-gray-400">{t("hr:reviews.month", "Month")}</Label>
              <Select
                value={String(selectedMonth)}
                onValueChange={(v) => setSelectedMonth(Number(v))}
                disabled={!!review.id}
              >
                <SelectTrigger className="border-[#E6E6E4] dark:border-gray-600">
                  <Calendar className="h-4 w-4 mr-2 text-[#6B6B6B]" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {t(`hr:month.${m.label.toLowerCase()}`, m.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year Selection */}
            <div className="space-y-1">
              <Label className="text-xs text-[#6B6B6B] dark:text-gray-400">{t("hr:reviews.year")}</Label>
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(Number(v))}
                disabled={!!review.id}
              >
                <SelectTrigger className="border-[#E6E6E4] dark:border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y.value} value={String(y.value)}>
                      {y.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Deadline Selection */}
          <div className="mt-4 pt-4 border-t border-[#E6E6E4] dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-[#6B6B6B] dark:text-gray-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t("hr:reviews.deadline")}
                </Label>
                <DatePicker
                  date={review.deadline_date ? new Date(review.deadline_date) : undefined}
                  onDateChange={(date) =>
                    setReview((prev) => ({
                      ...prev,
                      deadline_date: date ? date.toISOString().split("T")[0] : null,
                    }))
                  }
                  placeholder={t("hr:reviews.selectDeadline", "Select deadline")}
                  disabled={!isEditable}
                  className="w-full border-[#E6E6E4] dark:border-gray-600"
                />
              </div>
            </div>
          </div>

          {/* Status Badge */}
          {review.id && (
            <div className="mt-4 pt-4 border-t border-[#E6E6E4] dark:border-gray-700">
              <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                <Label className="text-xs text-[#6B6B6B] dark:text-gray-400">{t("hr:reviews.status")}:</Label>
                <Badge className={
                  review.status === "draft" ? "bg-gray-100 text-gray-700" :
                  review.status === "submitted" ? "bg-blue-100 text-blue-700" :
                  review.status === "approved" ? "bg-green-100 text-green-700" :
                  "bg-[#E6F7F1] text-[#0C5536]"
                }>
                  {t(`hr:reviews.status_${review.status}`)}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Performance Summary */}
      <Card className="border-[#E6E6E4] dark:border-gray-700">
        <CardHeader>
          <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
            <CardTitle className={`flex items-center gap-2 text-lg ${isRtl ? "flex-row-reverse" : ""}`}>
              <BarChart3 className="h-5 w-5 text-[#C6A03B]" />
              {t("hr:reviews.kpiPerformance")}
            </CardTitle>
            <Badge className={`text-lg px-4 py-1 ${getScoreColor(kpiScore)}`}>
              {loadingKPI ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {kpiScore !== null ? `${kpiScore}%` : "-"}
                  <span className="ml-2 text-sm font-normal">
                    {getPerformanceLabel(kpiScore)}
                  </span>
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {kpiScore === null && !loadingKPI ? (
            <div className="p-6 text-center">
              <Target className="h-12 w-12 text-[#E6E6E4] mx-auto mb-4" />
              <p className="text-[#6B6B6B] dark:text-gray-400">{t("hr:reviews.noKPIData")}</p>
            </div>
          ) : (
            <p className="text-sm text-[#6B6B6B]">
              {t("hr:reviews.kpiScoreFromEvaluations", "KPI score calculated from this month's evaluations")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <Card className="border-[#E6E6E4] dark:border-gray-700">
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 text-lg ${isRtl ? "flex-row-reverse" : ""}`}>
            <CheckCircle2 className="h-5 w-5 text-[#0C5536]" />
            {t("hr:reviews.performanceSummary")}
            <span className="text-red-500">*</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={review.performance_summary || ""}
            onChange={(e) => setReview(prev => ({ ...prev, performance_summary: e.target.value }))}
            placeholder={t("hr:reviews.monthlyPerformancePlaceholder", "Summarize the employee's performance this month...")}
            className="min-h-[100px] border-[#E6E6E4] dark:border-gray-600"
            dir={isRtl ? "rtl" : "ltr"}
            disabled={!isEditable}
          />
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card className="border-[#E6E6E4] dark:border-gray-700">
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 text-lg ${isRtl ? "flex-row-reverse" : ""}`}>
            <Trophy className="h-5 w-5 text-[#C6A03B]" />
            {t("hr:reviews.achievements", "Achievements")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={review.achievements || ""}
            onChange={(e) => setReview(prev => ({ ...prev, achievements: e.target.value }))}
            placeholder={t("hr:reviews.achievementsPlaceholder", "List key achievements and wins this month...")}
            className="min-h-[80px] border-[#E6E6E4] dark:border-gray-600"
            dir={isRtl ? "rtl" : "ltr"}
            disabled={!isEditable}
          />
        </CardContent>
      </Card>

      {/* Challenges */}
      <Card className="border-[#E6E6E4] dark:border-gray-700">
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 text-lg ${isRtl ? "flex-row-reverse" : ""}`}>
            <AlertTriangle className="h-5 w-5 text-[#C6A03B]" />
            {t("hr:reviews.challenges", "Challenges")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={review.challenges || ""}
            onChange={(e) => setReview(prev => ({ ...prev, challenges: e.target.value }))}
            placeholder={t("hr:reviews.challengesPlaceholder", "Describe any challenges or obstacles faced...")}
            className="min-h-[80px] border-[#E6E6E4] dark:border-gray-600"
            dir={isRtl ? "rtl" : "ltr"}
            disabled={!isEditable}
          />
        </CardContent>
      </Card>

      {/* Goals Progress */}
      <Card className="border-[#E6E6E4] dark:border-gray-700">
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 text-lg ${isRtl ? "flex-row-reverse" : ""}`}>
            <TrendingUp className="h-5 w-5 text-[#0C5536]" />
            {t("hr:reviews.goalsProgress", "Goals Progress")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={review.goals_progress || ""}
            onChange={(e) => setReview(prev => ({ ...prev, goals_progress: e.target.value }))}
            placeholder={t("hr:reviews.goalsProgressPlaceholder", "Update on progress towards monthly and quarterly goals...")}
            className="min-h-[80px] border-[#E6E6E4] dark:border-gray-600"
            dir={isRtl ? "rtl" : "ltr"}
            disabled={!isEditable}
          />
        </CardContent>
      </Card>

      {/* Manager Notes */}
      <Card className="border-[#E6E6E4] dark:border-gray-700">
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 text-lg ${isRtl ? "flex-row-reverse" : ""}`}>
            <User className="h-5 w-5 text-[#6B6B6B]" />
            {t("hr:reviews.managerNotes", "Manager Notes")}
            <span className="text-xs text-[#6B6B6B] font-normal">({t("common:optional")})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={review.manager_notes || ""}
            onChange={(e) => setReview(prev => ({ ...prev, manager_notes: e.target.value }))}
            placeholder={t("hr:reviews.managerNotesPlaceholder", "Additional notes or observations...")}
            className="min-h-[60px] border-[#E6E6E4] dark:border-gray-600"
            dir={isRtl ? "rtl" : "ltr"}
            disabled={!isEditable}
          />
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {isEditable && (
        <div className={`flex gap-4 pt-4 ${isRtl ? "flex-row-reverse" : ""}`}>
          <Button
            onClick={handleSaveDraft}
            disabled={saving || submitting}
            variant="outline"
            className="border-[#E6E6E4]"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            {t("hr:reviews.saveDraft")}
          </Button>
          
          <Button
            onClick={handleSubmitForApproval}
            disabled={saving || submitting}
            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <SendHorizontal className="mr-2 h-4 w-4" />
            {t("hr:reviews.submitForApproval")}
          </Button>
        </div>
      )}
    </div>
  );
}
