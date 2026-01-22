"use client";

import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, FileText } from "lucide-react";
import { KPIReportPDFTemplate } from "./KPIReportPDFTemplate";

type KPIEvaluation = {
  kpi: {
    id: string;
    name: string;
    description: string | null;
    target_value: number;
    unit: string;
    weighting: number;
  };
  achieved_value: number | null;
  score: number | null;
  status: string | null;
};

type DownloadKPIReportButtonProps = {
  employeeId: string;
  employeeName: string;
  jobRoleName: string | null;
  year: number;
  month: number;
  disabled?: boolean;
};

// Helper to get quarter from month
const getQuarterFromMonth = (month: number): number => Math.ceil(month / 3);

// Helper to get months in a quarter
const getMonthsInQuarter = (quarter: number): number[] => {
  const startMonth = (quarter - 1) * 3 + 1;
  return [startMonth, startMonth + 1, startMonth + 2];
};

// Helper to get quarter label
const getQuarterLabel = (quarter: number): string => `Q${quarter}`;

export function DownloadKPIReportButton({
  employeeId,
  employeeName,
  jobRoleName,
  year,
  month,
  disabled = false,
}: DownloadKPIReportButtonProps) {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reportType, setReportType] = useState<"monthly" | "quarterly">("monthly");
  const [generating, setGenerating] = useState(false);
  const [evaluations, setEvaluations] = useState<KPIEvaluation[]>([]);
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [templateData, setTemplateData] = useState<{
    periodLabel: string;
    periodType: "monthly" | "quarterly";
  } | null>(null);
  const templateRef = useRef<HTMLDivElement>(null);

  const currentQuarter = getQuarterFromMonth(month);

  const fetchMonthlyEvaluations = async (targetMonth: number): Promise<KPIEvaluation[]> => {
    const { data, error } = await supabase
      .from("kpi_evaluations")
      .select(`
        kpi_id,
        achieved_value,
        score,
        notes,
        status,
        kpi:kpis(id, name, description, target_value, unit, weighting)
      `)
      .eq("employee_id", employeeId)
      .eq("year", year)
      .eq("month", targetMonth);

    if (error) throw error;

    return (data || [])
      .filter((e) => e.kpi)
      .map((e) => ({
        kpi: e.kpi as KPIEvaluation["kpi"],
        achieved_value: e.achieved_value,
        score: e.score,
        status: e.status,
      }));
  };

  const fetchQuarterlyEvaluations = async (): Promise<KPIEvaluation[]> => {
    const months = getMonthsInQuarter(currentQuarter);

    // Fetch evaluations for all months in the quarter
    const allEvaluations: KPIEvaluation[][] = await Promise.all(
      months.map((m) => fetchMonthlyEvaluations(m))
    );

    // Aggregate evaluations by KPI (average the scores across months)
    const kpiMap = new Map<string, {
      kpi: KPIEvaluation["kpi"];
      totalAchieved: number;
      totalScore: number;
      monthCount: number;
      hasCompleted: boolean;
    }>();

    allEvaluations.flat().forEach((evaluation) => {
      const existing = kpiMap.get(evaluation.kpi.id);
      if (existing) {
        if (evaluation.achieved_value !== null) {
          existing.totalAchieved += evaluation.achieved_value;
          existing.monthCount++;
        }
        if (evaluation.score !== null) {
          existing.totalScore += evaluation.score;
        }
        if (evaluation.status === "completed") {
          existing.hasCompleted = true;
        }
      } else {
        kpiMap.set(evaluation.kpi.id, {
          kpi: evaluation.kpi,
          totalAchieved: evaluation.achieved_value ?? 0,
          totalScore: evaluation.score ?? 0,
          monthCount: evaluation.achieved_value !== null ? 1 : 0,
          hasCompleted: evaluation.status === "completed",
        });
      }
    });

    // Convert to aggregated evaluations
    return Array.from(kpiMap.values()).map((item) => ({
      kpi: item.kpi,
      achieved_value: item.monthCount > 0 ? Math.round((item.totalAchieved / item.monthCount) * 100) / 100 : null,
      score: item.monthCount > 0 ? Math.round((item.totalScore / item.monthCount) * 100) / 100 : null,
      status: item.hasCompleted ? "completed" : "pending",
    }));
  };

  const handleDownload = async () => {
    setGenerating(true);

    try {
      let fetchedEvaluations: KPIEvaluation[];
      let periodLabel: string;

      if (reportType === "monthly") {
        fetchedEvaluations = await fetchMonthlyEvaluations(month);
        periodLabel = new Date(year, month - 1, 1).toLocaleString(
          i18n.language === "ar" ? "ar-EG" : "en-US",
          { month: "long" }
        ) + ` ${year}`;
      } else {
        fetchedEvaluations = await fetchQuarterlyEvaluations();
        periodLabel = `${getQuarterLabel(currentQuarter)} ${year}`;
      }

      if (fetchedEvaluations.length === 0) {
        toast({
          variant: "destructive",
          description: t("hr:noKPIsAssignedForPeriod"),
        });
        setGenerating(false);
        return;
      }

      // Calculate overall weighted score
      let weightedScore = 0;
      let totalWeight = 0;

      fetchedEvaluations.forEach((evaluation) => {
        if (evaluation.score && evaluation.status === "completed") {
          weightedScore += (evaluation.score * evaluation.kpi.weighting) / 100;
          totalWeight += evaluation.kpi.weighting;
        }
      });

      const calculatedScore = totalWeight > 0 ? Math.round(weightedScore * 100) / 100 : null;

      setEvaluations(fetchedEvaluations);
      setOverallScore(calculatedScore);
      setTemplateData({ periodLabel, periodType: reportType });
      setShowTemplate(true);

      // Wait for template to render
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Dynamic import of html2pdf
      const html2pdf = (await import("html2pdf.js")).default;

      if (!templateRef.current) {
        throw new Error("Template not rendered");
      }

      const filename = reportType === "monthly"
        ? `KPI_Report_${employeeName.replace(/\s+/g, "_")}_${periodLabel.replace(/\s+/g, "_")}.pdf`
        : `KPI_Report_${employeeName.replace(/\s+/g, "_")}_${getQuarterLabel(currentQuarter)}_${year}.pdf`;

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
        description: t("hr:pdfDownloadedDesc", { name: employeeName }),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
      setOpen(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        variant: "destructive",
        description: t("hr:pdfDownloadError"),
      });
    } finally {
      setGenerating(false);
      setShowTemplate(false);
      setTemplateData(null);
    }
  };

  const monthName = new Date(year, month - 1, 1).toLocaleString(
    i18n.language === "ar" ? "ar-EG" : "en-US",
    { month: "long" }
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="border-[#E6E6E4]"
          >
            <Download className="h-4 w-4 mr-1" />
            {t("hr:downloadReport")}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <FileText className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              {t("hr:downloadKPIReport")}
            </DialogTitle>
            <DialogDescription className={isRtl ? "text-right" : ""}>
              {t("hr:selectReportType")}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Employee Info */}
            <div className="p-3 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]">
              <p className="text-sm text-[#6B6B6B]">{t("hr:employee")}:</p>
              <p className="font-medium text-[#222222]">{employeeName}</p>
              {jobRoleName && (
                <p className="text-sm text-[#6B6B6B]">{jobRoleName}</p>
              )}
            </div>

            {/* Report Type Selection */}
            <RadioGroup
              value={reportType}
              onValueChange={(v) => setReportType(v as "monthly" | "quarterly")}
              className="space-y-3"
            >
              <div className={`flex items-start space-x-3 p-3 rounded-lg border border-[#E6E6E4] hover:bg-[#FAFAF8] cursor-pointer ${isRtl ? "flex-row-reverse space-x-reverse" : ""}`}>
                <RadioGroupItem value="monthly" id="monthly" className="mt-1" />
                <Label htmlFor="monthly" className="flex-1 cursor-pointer">
                  <p className="font-medium text-[#222222]">{t("hr:monthlyReport")}</p>
                  <p className="text-sm text-[#6B6B6B]">
                    {monthName} {year}
                  </p>
                </Label>
              </div>
              <div className={`flex items-start space-x-3 p-3 rounded-lg border border-[#E6E6E4] hover:bg-[#FAFAF8] cursor-pointer ${isRtl ? "flex-row-reverse space-x-reverse" : ""}`}>
                <RadioGroupItem value="quarterly" id="quarterly" className="mt-1" />
                <Label htmlFor="quarterly" className="flex-1 cursor-pointer">
                  <p className="font-medium text-[#222222]">{t("hr:quarterlyReport")}</p>
                  <p className="text-sm text-[#6B6B6B]">
                    {getQuarterLabel(currentQuarter)} {year} ({t("hr:averageOfMonths")})
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter className={`gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-[#E6E6E4]"
            >
              {t("hr:cancel")}
            </Button>
            <Button
              onClick={handleDownload}
              disabled={generating}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {generating ? t("hr:generatingPdf") : t("hr:downloadReport")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden template for PDF generation */}
      {showTemplate && templateData && (
        <div
          style={{
            position: "absolute",
            left: "-9999px",
            top: 0,
            width: "650px",
          }}
        >
          <KPIReportPDFTemplate
            ref={templateRef}
            employeeName={employeeName}
            jobRoleName={jobRoleName}
            year={year}
            month={month}
            evaluations={evaluations}
            overallScore={overallScore}
            periodLabel={templateData.periodLabel}
            isQuarterly={templateData.periodType === "quarterly"}
          />
        </div>
      )}
    </>
  );
}
