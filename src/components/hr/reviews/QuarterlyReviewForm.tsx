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
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Target, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  Save,
  SendHorizontal,
  User,
  Briefcase,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Import,
  FileText
} from "lucide-react";
import { generateReviewSummary, type ReviewSummary } from "@/lib/hr/generateReviewSummary";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

type QuarterlyReview = {
  id?: string;
  employee_id: string;
  quarter: number;
  year: number;
  status: "draft" | "submitted" | "approved" | "complete";
  deadline_date: string | null;
  overall_kpi_score: number | null;
  performance_summary: string | null;
  strengths: string | null;
  areas_for_improvement: string | null;
  goals_next_quarter: string | null;
  development_plan: string | null;
  manager_comments: string | null;
  custom_fields: Record<string, string> | null;
};

type QuarterlyReviewFormProps = {
  employee: Employee;
  reviewId?: string;
  initialQuarter?: number;
  initialYear?: number;
  onSuccess?: () => void;
};

type MonthlyReview = {
  id: string;
  month: number;
  year: number;
  status: "draft" | "submitted" | "approved" | "complete";
  overall_kpi_score: number | null;
  performance_summary: string | null;
  achievements: string | null;
  challenges: string | null;
  goals_progress: string | null;
  manager_notes: string | null;
};

type TemplateSection = {
  id: string;
  title: string;
  type: "textarea" | "readonly" | "list";
  required: boolean;
  order: number;
  isCustom?: boolean;
};

type ReviewTemplate = {
  id: string;
  name: string;
  sections: TemplateSection[];
  is_default?: boolean;
};

// Default sections if no template is loaded
const defaultSections: TemplateSection[] = [
  { id: "kpi_performance", title: "KPI Performance", type: "readonly", required: true, order: 1 },
  { id: "performance_summary", title: "Performance Summary", type: "textarea", required: true, order: 2 },
  { id: "strengths", title: "Strengths", type: "textarea", required: true, order: 3 },
  { id: "areas_for_improvement", title: "Areas for Improvement", type: "textarea", required: true, order: 4 },
  { id: "goals_next_quarter", title: "Goals for Next Quarter", type: "textarea", required: true, order: 5 },
  { id: "development_plan", title: "Development Plan", type: "textarea", required: false, order: 6 },
  { id: "manager_comments", title: "Manager Comments", type: "textarea", required: false, order: 7 },
];

// Map section IDs to icons
const sectionIcons: Record<string, React.ReactNode> = {
  kpi_performance: <BarChart3 className="h-5 w-5 text-[#C6A03B]" />,
  performance_summary: <CheckCircle2 className="h-5 w-5 text-[#0C5536]" />,
  strengths: <TrendingUp className="h-5 w-5 text-[#0C5536]" />,
  areas_for_improvement: <TrendingDown className="h-5 w-5 text-[#C6A03B]" />,
  goals_next_quarter: <Target className="h-5 w-5 text-[#0C5536]" />,
  development_plan: <Briefcase className="h-5 w-5 text-[#6B6B6B]" />,
  manager_comments: <User className="h-5 w-5 text-[#6B6B6B]" />,
};

// Map section IDs to review field keys
const sectionFieldMap: Record<string, keyof QuarterlyReview> = {
  performance_summary: "performance_summary",
  strengths: "strengths",
  areas_for_improvement: "areas_for_improvement",
  goals_next_quarter: "goals_next_quarter",
  development_plan: "development_plan",
  manager_comments: "manager_comments",
};

const quarterOptions = [
  { value: 1, label: "Q1 (Jan - Mar)" },
  { value: 2, label: "Q2 (Apr - Jun)" },
  { value: 3, label: "Q3 (Jul - Sep)" },
  { value: 4, label: "Q4 (Oct - Dec)" },
];

const getCurrentQuarter = (): number => Math.ceil((new Date().getMonth() + 1) / 3);
const getCurrentYear = (): number => new Date().getFullYear();
const getYearOptions = () => {
  const currentYear = getCurrentYear();
  return [currentYear - 1, currentYear, currentYear + 1].map(year => ({
    value: year,
    label: String(year),
  }));
};

export function QuarterlyReviewForm({
  employee,
  reviewId,
  initialQuarter,
  initialYear,
  onSuccess,
}: QuarterlyReviewFormProps) {
  const hrBase = useHrBasePath();
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();

  const [selectedQuarter, setSelectedQuarter] = useState(initialQuarter ?? getCurrentQuarter());
  const [selectedYear, setSelectedYear] = useState(initialYear ?? getCurrentYear());
  const [review, setReview] = useState<QuarterlyReview>({
    employee_id: employee.id,
    quarter: selectedQuarter,
    year: selectedYear,
    status: "draft",
    deadline_date: null,
    overall_kpi_score: null,
    performance_summary: null,
    strengths: null,
    areas_for_improvement: null,
    goals_next_quarter: null,
    development_plan: null,
    manager_comments: null,
    custom_fields: null,
  });
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  
  const [kpiSummary, setKpiSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(!!reviewId);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [allTemplates, setAllTemplates] = useState<ReviewTemplate[]>([]);
  const [template, setTemplate] = useState<ReviewTemplate | null>(null);
  const [templateSections, setTemplateSections] = useState<TemplateSection[]>(defaultSections);
  
  // Monthly reviews reference
  const [monthlyReviews, setMonthlyReviews] = useState<MonthlyReview[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [monthlyExpanded, setMonthlyExpanded] = useState<Record<string, boolean>>({});

  const yearOptions = getYearOptions();

  // Load all active templates on mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const { data, error } = await supabase
          .from("review_templates")
          .select("id, name, sections, is_default")
          .eq("is_active", true)
          .order("is_default", { ascending: false })
          .order("name", { ascending: true });

        if (error || !data?.length) {
          setTemplateSections(defaultSections);
          return;
        }

        const templates = data.map((t) => ({
          ...t,
          sections: (t.sections as TemplateSection[]) || defaultSections,
        }));
        setAllTemplates(templates);

        const defaultTpl = templates.find((t) => t.is_default) || templates[0];
        setTemplate(defaultTpl);
        setTemplateSections(
          [...defaultTpl.sections].sort((a, b) => a.order - b.order)
        );
      } catch (error) {
        console.error("Error loading templates:", error);
        setTemplateSections(defaultSections);
      }
    };

    loadTemplates();
  }, []);

  // Load existing review if reviewId provided
  useEffect(() => {
    const loadReview = async () => {
      if (!reviewId) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("quarterly_reviews")
          .select("*")
          .eq("id", reviewId)
          .single();

        if (error) throw error;
        
        if (data) {
          setReview(data as QuarterlyReview);
          setSelectedQuarter(data.quarter);
          setSelectedYear(data.year);
          // Populate custom fields from JSONB
          if (data.custom_fields && typeof data.custom_fields === "object") {
            setCustomFields(data.custom_fields as Record<string, string>);
          }
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

  // Load KPI summary when quarter/year changes
  useEffect(() => {
    const loadKPISummary = async () => {
      try {
        const summary = await generateReviewSummary(
          employee.id,
          selectedQuarter,
          selectedYear
        );
        setKpiSummary(summary);
        
        // Auto-update overall score if we have KPI data
        if (summary.overallScore !== null) {
          setReview(prev => ({
            ...prev,
            overall_kpi_score: summary.overallScore,
          }));
        }
      } catch (error) {
        console.error("Error loading KPI summary:", error);
      }
    };

    loadKPISummary();
  }, [employee.id, selectedQuarter, selectedYear]);

  // Load monthly reviews for the selected quarter
  useEffect(() => {
    const loadMonthlyReviews = async () => {
      setLoadingMonthly(true);
      try {
        // Calculate the months in this quarter
        const startMonth = (selectedQuarter - 1) * 3 + 1;
        const endMonth = selectedQuarter * 3;

        const { data, error } = await supabase
          .from("monthly_reviews")
          .select("id, month, year, status, overall_kpi_score, performance_summary, achievements, challenges, goals_progress, manager_notes")
          .eq("employee_id", employee.id)
          .eq("year", selectedYear)
          .gte("month", startMonth)
          .lte("month", endMonth)
          .order("month", { ascending: true });

        if (error) throw error;
        setMonthlyReviews((data || []) as MonthlyReview[]);
      } catch (error) {
        console.error("Error loading monthly reviews:", error);
      } finally {
        setLoadingMonthly(false);
      }
    };

    loadMonthlyReviews();
  }, [employee.id, selectedQuarter, selectedYear]);

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const summary = await generateReviewSummary(
        employee.id,
        selectedQuarter,
        selectedYear
      );
      
      setKpiSummary(summary);
      
      // Auto-populate fields
      setReview(prev => ({
        ...prev,
        overall_kpi_score: summary.overallScore,
        performance_summary: summary.narrativeSummary,
        strengths: summary.strengths.join("\n\n"),
        areas_for_improvement: summary.improvements.join("\n\n"),
      }));

      toast({
        description: t("hr:reviews.summaryGenerated"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
    } catch (error) {
      console.error("Error generating summary:", error);
      toast({
        variant: "destructive",
        description: t("hr:reviews.errorGeneratingSummary"),
      });
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      // Build custom fields: only include non-empty values
      const customFieldsData = Object.keys(customFields).length > 0 ? customFields : {};

      const reviewData = {
        employee_id: employee.id,
        reviewer_id: user?.id,
        quarter: selectedQuarter,
        year: selectedYear,
        status: "draft" as const,
        deadline_date: review.deadline_date,
        overall_kpi_score: review.overall_kpi_score,
        performance_summary: review.performance_summary,
        strengths: review.strengths,
        areas_for_improvement: review.areas_for_improvement,
        goals_next_quarter: review.goals_next_quarter,
        development_plan: review.development_plan,
        manager_comments: review.manager_comments,
        custom_fields: customFieldsData,
        updated_at: new Date().toISOString(),
      };

      if (review.id) {
        // Update existing
        const { error } = await supabase
          .from("quarterly_reviews")
          .update(reviewData)
          .eq("id", review.id);

        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from("quarterly_reviews")
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
    // Validate required fields based on template
    const requiredSections = templateSections.filter(
      (s) => s.required && s.type !== "readonly"
    );

    for (const section of requiredSections) {
      const fieldKey = sectionFieldMap[section.id];
      if (fieldKey) {
        // Predefined field validation
        const value = review[fieldKey];
        if (!value || (typeof value === "string" && !value.trim())) {
          toast({
            variant: "destructive",
            description: t(`hr:reviews.${section.id}Required`, {
              defaultValue: `${section.title} is required`,
            }),
          });
          return;
        }
      } else if (section.isCustom) {
        // Custom field validation
        const value = customFields[section.id];
        if (!value || !value.trim()) {
          toast({
            variant: "destructive",
            description: t("hr:reviews.customFieldRequired", {
              name: section.title,
              defaultValue: `${section.title} is required`,
            }),
          });
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const customFieldsData = Object.keys(customFields).length > 0 ? customFields : {};

      const reviewData = {
        employee_id: employee.id,
        reviewer_id: user?.id,
        quarter: selectedQuarter,
        year: selectedYear,
        status: "submitted" as const,
        submitted_at: new Date().toISOString(),
        deadline_date: review.deadline_date,
        overall_kpi_score: review.overall_kpi_score,
        performance_summary: review.performance_summary,
        strengths: review.strengths,
        areas_for_improvement: review.areas_for_improvement,
        goals_next_quarter: review.goals_next_quarter,
        development_plan: review.development_plan,
        manager_comments: review.manager_comments,
        custom_fields: customFieldsData,
        updated_at: new Date().toISOString(),
      };

      if (review.id) {
        const { error } = await supabase
          .from("quarterly_reviews")
          .update(reviewData)
          .eq("id", review.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("quarterly_reviews")
          .insert(reviewData);

        if (error) throw error;
      }

      toast({
        title: t("hr:reviews.submittedForApproval"),
        description: t("hr:reviews.submittedForApprovalDesc"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
      
      router.push(`${hrBase}/reviews`);
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

  // Import content from a monthly review to the quarterly review
  const handleImportFromMonthly = (field: keyof QuarterlyReview, content: string | null) => {
    if (!content) return;
    
    setReview(prev => {
      const existingValue = prev[field] as string | null;
      // Append to existing content with a separator if there's already content
      const newValue = existingValue 
        ? `${existingValue}\n\n---\n\n${content}`
        : content;
      return { ...prev, [field]: newValue };
    });

    toast({
      description: t("hr:reviews.contentImported", "Content imported successfully"),
      className: "bg-[hsl(var(--jw-primary-green))] text-white",
    });
  };

  // Get month name helper
  const getMonthName = (month: number) => {
    const monthNames = ["January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"];
    return t(`hr:month.${monthNames[month - 1].toLowerCase()}`, monthNames[month - 1]);
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
            <User className="h-5 w-5" />
            {t("hr:reviews.quarterlyReview")}
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

            {/* Quarter Selection */}
            <div className="space-y-1">
              <Label className="text-xs text-[#6B6B6B] dark:text-gray-400">{t("hr:reviews.quarter")}</Label>
              <Select
                value={String(selectedQuarter)}
                onValueChange={(v) => setSelectedQuarter(Number(v))}
                disabled={!!review.id}
              >
                <SelectTrigger className="border-[#E6E6E4] dark:border-gray-600">
                  <Calendar className="h-4 w-4 mr-2 text-[#6B6B6B]" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quarterOptions.map((q) => (
                    <SelectItem key={q.value} value={String(q.value)}>
                      {q.label}
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

          {/* Template & Deadline Selection */}
          <div className="mt-4 pt-4 border-t border-[#E6E6E4] dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Template Selector - only for new reviews */}
              {!reviewId && allTemplates.length > 1 && (
                <div className="space-y-1">
                  <Label className="text-xs text-[#6B6B6B] dark:text-gray-400 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {t("hr:reviews.selectTemplate")}
                  </Label>
                  <Select
                    value={template?.id || ""}
                    onValueChange={(id) => {
                      const selected = allTemplates.find((t) => t.id === id);
                      if (selected) {
                        setTemplate(selected);
                        setTemplateSections(
                          [...selected.sections].sort((a, b) => a.order - b.order)
                        );
                      }
                    }}
                  >
                    <SelectTrigger className="border-[#E6E6E4] dark:border-gray-600">
                      <FileText className="h-4 w-4 mr-2 text-[#6B6B6B]" />
                      <SelectValue placeholder={t("hr:reviews.selectTemplatePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {allTemplates.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.id}>
                          {tpl.name}{tpl.is_default ? ` (${t("hr:reviews.active")})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Deadline */}
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
            <Badge className={`text-lg px-4 py-1 ${getScoreColor(review.overall_kpi_score)}`}>
              {review.overall_kpi_score !== null ? `${review.overall_kpi_score}%` : "-"}
              <span className="ml-2 text-sm font-normal">
                {getPerformanceLabel(review.overall_kpi_score)}
              </span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {kpiSummary ? (
            <div className="space-y-4">
              {/* KPI Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-[#FAFAF8] dark:bg-gray-800 rounded-lg">
                  <p className="text-xs text-[#6B6B6B] dark:text-gray-400">{t("hr:reviews.totalKPIs")}</p>
                  <p className="text-xl font-bold text-[#222222] dark:text-gray-200">
                    {kpiSummary.totalKPIs}
                  </p>
                </div>
                <div className="p-3 bg-[#FAFAF8] dark:bg-gray-800 rounded-lg">
                  <p className="text-xs text-[#6B6B6B] dark:text-gray-400">{t("hr:reviews.evaluated")}</p>
                  <p className="text-xl font-bold text-[#222222] dark:text-gray-200">
                    {kpiSummary.evaluatedKPIs}
                  </p>
                </div>
                <div className="p-3 bg-[#E6F7F1] dark:bg-green-900/30 rounded-lg">
                  <p className="text-xs text-[#0C5536] dark:text-green-400">{t("hr:reviews.exceedingTarget")}</p>
                  <p className="text-xl font-bold text-[#0C5536] dark:text-green-400">
                    {kpiSummary.kpisAboveTarget}
                  </p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
                  <p className="text-xs text-red-600 dark:text-red-400">{t("hr:reviews.belowTarget")}</p>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">
                    {kpiSummary.kpisBelowTarget}
                  </p>
                </div>
              </div>

              {/* Quarter Comparison */}
              {kpiSummary.quarterComparison && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${
                  kpiSummary.quarterComparison.includes("improved") || kpiSummary.quarterComparison.includes("Improved")
                    ? "bg-[#E6F7F1] dark:bg-green-900/30"
                    : "bg-[#FFF9E6] dark:bg-yellow-900/30"
                }`}>
                  {kpiSummary.quarterComparison.includes("improved") || kpiSummary.quarterComparison.includes("Improved") ? (
                    <TrendingUp className="h-5 w-5 text-[#0C5536] dark:text-green-400" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-[#C6A03B] dark:text-yellow-400" />
                  )}
                  <span className="text-sm font-medium">{kpiSummary.quarterComparison}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center">
              <Target className="h-12 w-12 text-[#E6E6E4] mx-auto mb-4" />
              <p className="text-[#6B6B6B] dark:text-gray-400">{t("hr:reviews.noKPIData")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Reviews Reference Section */}
      {monthlyReviews.length > 0 && (
        <Card className="border-[#E6E6E4] dark:border-gray-700 border-l-4 border-l-[#C6A03B]">
          <CardHeader className="bg-[#FFF9E6]/30">
            <CardTitle className={`flex items-center gap-2 text-lg ${isRtl ? "flex-row-reverse" : ""}`}>
              <CalendarDays className="h-5 w-5 text-[#C6A03B]" />
              {t("hr:reviews.monthlyReviewsReference", "Monthly Reviews Reference")}
              <Badge variant="outline" className="ml-2 bg-white">
                {monthlyReviews.length} {t("hr:reviews.monthsAvailable", "months available")}
              </Badge>
            </CardTitle>
            <CardDescription>
              {t("hr:reviews.monthlyReviewsReferenceDesc", "Review and import content from monthly reviews for this quarter")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loadingMonthly ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-[#C6A03B]" />
              </div>
            ) : (
              <div className="space-y-4">
                {monthlyReviews.map((monthly) => (
                  <Collapsible
                    key={monthly.id}
                    open={monthlyExpanded[monthly.id]}
                    onOpenChange={(open) => 
                      setMonthlyExpanded(prev => ({ ...prev, [monthly.id]: open }))
                    }
                  >
                    <div className="border border-[#E6E6E4] dark:border-gray-600 rounded-lg overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <button className={`w-full p-4 bg-[#FAFAF8] dark:bg-gray-800 hover:bg-[#F5F3E8] transition-colors flex items-center justify-between ${isRtl ? "flex-row-reverse text-right" : ""}`}>
                          <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                            <FileText className="h-4 w-4 text-[#6B6B6B]" />
                            <span className="font-medium text-[#222222] dark:text-gray-200">
                              {getMonthName(monthly.month)} {monthly.year}
                            </span>
                            <Badge className={
                              monthly.status === "complete" ? "bg-[#E6F7F1] text-[#0C5536]" :
                              monthly.status === "approved" ? "bg-green-100 text-green-700" :
                              monthly.status === "submitted" ? "bg-blue-100 text-blue-700" :
                              "bg-gray-100 text-gray-700"
                            }>
                              {t(`hr:reviews.status_${monthly.status}`)}
                            </Badge>
                            {monthly.overall_kpi_score && (
                              <Badge variant="outline" className={getScoreColor(monthly.overall_kpi_score)}>
                                {monthly.overall_kpi_score}%
                              </Badge>
                            )}
                          </div>
                          {monthlyExpanded[monthly.id] ? (
                            <ChevronUp className="h-4 w-4 text-[#6B6B6B]" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-[#6B6B6B]" />
                          )}
                        </button>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="p-4 space-y-4 border-t border-[#E6E6E4] dark:border-gray-600">
                          {/* Performance Summary */}
                          {monthly.performance_summary && (
                            <div className="space-y-2">
                              <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                                <span className="text-sm font-medium text-[#6B6B6B]">
                                  {t("hr:reviews.performanceSummary")}
                                </span>
                                {isEditable && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleImportFromMonthly("performance_summary", monthly.performance_summary)}
                                    className="text-[#C6A03B] hover:text-[#0C5536] hover:bg-[#FFF9E6] h-7"
                                  >
                                    <Import className="h-3 w-3 mr-1" />
                                    {t("hr:reviews.import", "Import")}
                                  </Button>
                                )}
                              </div>
                              <p className={`text-sm text-[#222222] dark:text-gray-300 bg-white dark:bg-gray-700 p-3 rounded-md ${isRtl ? "text-right" : ""}`}>
                                {monthly.performance_summary}
                              </p>
                            </div>
                          )}

                          {/* Achievements -> Strengths */}
                          {monthly.achievements && (
                            <div className="space-y-2">
                              <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                                <span className="text-sm font-medium text-[#6B6B6B]">
                                  {t("hr:reviews.achievements", "Achievements")}
                                </span>
                                {isEditable && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleImportFromMonthly("strengths", monthly.achievements)}
                                    className="text-[#C6A03B] hover:text-[#0C5536] hover:bg-[#FFF9E6] h-7"
                                  >
                                    <Import className="h-3 w-3 mr-1" />
                                    {t("hr:reviews.importToStrengths", "Import to Strengths")}
                                  </Button>
                                )}
                              </div>
                              <p className={`text-sm text-[#222222] dark:text-gray-300 bg-white dark:bg-gray-700 p-3 rounded-md whitespace-pre-wrap ${isRtl ? "text-right" : ""}`}>
                                {monthly.achievements}
                              </p>
                            </div>
                          )}

                          {/* Challenges -> Areas for Improvement */}
                          {monthly.challenges && (
                            <div className="space-y-2">
                              <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                                <span className="text-sm font-medium text-[#6B6B6B]">
                                  {t("hr:reviews.challenges", "Challenges")}
                                </span>
                                {isEditable && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleImportFromMonthly("areas_for_improvement", monthly.challenges)}
                                    className="text-[#C6A03B] hover:text-[#0C5536] hover:bg-[#FFF9E6] h-7"
                                  >
                                    <Import className="h-3 w-3 mr-1" />
                                    {t("hr:reviews.importToImprovement", "Import to Improvement")}
                                  </Button>
                                )}
                              </div>
                              <p className={`text-sm text-[#222222] dark:text-gray-300 bg-white dark:bg-gray-700 p-3 rounded-md whitespace-pre-wrap ${isRtl ? "text-right" : ""}`}>
                                {monthly.challenges}
                              </p>
                            </div>
                          )}

                          {/* Goals Progress */}
                          {monthly.goals_progress && (
                            <div className="space-y-2">
                              <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                                <span className="text-sm font-medium text-[#6B6B6B]">
                                  {t("hr:reviews.goalsProgress", "Goals Progress")}
                                </span>
                                {isEditable && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleImportFromMonthly("goals_next_quarter", monthly.goals_progress)}
                                    className="text-[#C6A03B] hover:text-[#0C5536] hover:bg-[#FFF9E6] h-7"
                                  >
                                    <Import className="h-3 w-3 mr-1" />
                                    {t("hr:reviews.importToGoals", "Import to Goals")}
                                  </Button>
                                )}
                              </div>
                              <p className={`text-sm text-[#222222] dark:text-gray-300 bg-white dark:bg-gray-700 p-3 rounded-md whitespace-pre-wrap ${isRtl ? "text-right" : ""}`}>
                                {monthly.goals_progress}
                              </p>
                            </div>
                          )}

                          {/* Manager Notes */}
                          {monthly.manager_notes && (
                            <div className="space-y-2">
                              <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                                <span className="text-sm font-medium text-[#6B6B6B]">
                                  {t("hr:reviews.managerNotes", "Manager Notes")}
                                </span>
                                {isEditable && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleImportFromMonthly("manager_comments", monthly.manager_notes)}
                                    className="text-[#C6A03B] hover:text-[#0C5536] hover:bg-[#FFF9E6] h-7"
                                  >
                                    <Import className="h-3 w-3 mr-1" />
                                    {t("hr:reviews.importToComments", "Import to Comments")}
                                  </Button>
                                )}
                              </div>
                              <p className={`text-sm text-[#222222] dark:text-gray-300 bg-white dark:bg-gray-700 p-3 rounded-md whitespace-pre-wrap italic ${isRtl ? "text-right" : ""}`}>
                                {monthly.manager_notes}
                              </p>
                            </div>
                          )}

                          {/* Empty state for monthly review without content */}
                          {!monthly.performance_summary && !monthly.achievements && !monthly.challenges && !monthly.goals_progress && !monthly.manager_notes && (
                            <p className="text-sm text-[#6B6B6B] italic text-center py-4">
                              {t("hr:reviews.noContentInMonthlyReview", "No content available in this monthly review")}
                            </p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Generate Summary Button */}
      {isEditable && (
        <div className={`flex ${isRtl ? "justify-start" : "justify-end"}`}>
          <Button
            onClick={handleGenerateSummary}
            disabled={generatingSummary}
            variant="outline"
            className="border-[#C6A03B] text-[#C6A03B] hover:bg-[#FFF9E6]"
          >
            {generatingSummary ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {t("hr:reviews.generateSummary")}
          </Button>
        </div>
      )}

      {/* Dynamic Template Sections */}
      {templateSections
        .filter((section) => section.type !== "readonly") // KPI section is handled separately above
        .map((section) => {
          const fieldKey = sectionFieldMap[section.id];
          const isCustomField = !fieldKey && section.isCustom;

          // Skip sections that are neither predefined nor custom
          if (!fieldKey && !isCustomField) return null;

          const value = isCustomField
            ? (customFields[section.id] || "")
            : (review[fieldKey!] as string | null) || "";
          const icon = sectionIcons[section.id] || <CheckCircle2 className="h-5 w-5 text-purple-500" />;

          // Get translated title, fallback to template title
          const title = isCustomField
            ? section.title
            : t(`hr:reviews.${section.id.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())}`, {
                defaultValue: section.title,
              });

          return (
            <Card key={section.id} className={`border-[#E6E6E4] dark:border-gray-700 ${isCustomField ? "border-l-4 border-l-purple-400" : ""}`}>
              <CardHeader>
                <CardTitle className={`flex items-center gap-2 text-lg ${isRtl ? "flex-row-reverse" : ""}`}>
                  {icon}
                  {title}
                  {isCustomField && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-300 text-purple-600 bg-purple-50 font-normal">
                      {t("hr:reviews.customFieldLabel")}
                    </Badge>
                  )}
                  {section.required ? (
                    <span className="text-red-500">*</span>
                  ) : (
                    <span className="text-xs text-[#6B6B6B] font-normal">({t("common:optional")})</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={value}
                  onChange={(e) => {
                    if (isCustomField) {
                      setCustomFields((prev) => ({ ...prev, [section.id]: e.target.value }));
                    } else {
                      setReview((prev) => ({ ...prev, [fieldKey!]: e.target.value }));
                    }
                  }}
                  placeholder={
                    isCustomField
                      ? `${t("common:enter", "Enter")} ${section.title.toLowerCase()}...`
                      : t(`hr:reviews.${section.id}Placeholder`, {
                          defaultValue: `Enter ${section.title.toLowerCase()}...`,
                        })
                  }
                  className={`min-h-[100px] border-[#E6E6E4] dark:border-gray-600`}
                  dir={isRtl ? "rtl" : "ltr"}
                  disabled={!isEditable}
                />
              </CardContent>
            </Card>
          );
        })}

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
