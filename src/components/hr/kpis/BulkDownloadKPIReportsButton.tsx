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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Users } from "lucide-react";
import { BulkKPIReportPDFTemplate } from "./BulkKPIReportPDFTemplate";

type Employee = {
  id: string;
  full_name: string;
  job_role?: {
    id: string;
    name: string;
  } | null;
};

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

type EmployeeReport = {
  employeeName: string;
  jobRoleName: string | null;
  evaluations: KPIEvaluation[];
  overallScore: number | null;
};

type BulkDownloadKPIReportsButtonProps = {
  employees: Employee[];
  year: number;
  month: number;
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

export function BulkDownloadKPIReportsButton({
  employees,
  year,
  month,
}: BulkDownloadKPIReportsButtonProps) {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reportType, setReportType] = useState<"monthly" | "quarterly">("monthly");
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  // Template state
  const [templateData, setTemplateData] = useState<{
    employees: EmployeeReport[];
    periodLabel: string;
    isQuarterly: boolean;
  } | null>(null);
  const templateRef = useRef<HTMLDivElement>(null);

  const currentQuarter = getQuarterFromMonth(month);
  const employeesWithJobRoles = employees.filter((e) => e.job_role?.id);

  const toggleSelectAll = () => {
    if (selectedEmployees.size === employeesWithJobRoles.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(employeesWithJobRoles.map((e) => e.id)));
    }
  };

  const toggleEmployee = (id: string) => {
    const newSet = new Set(selectedEmployees);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedEmployees(newSet);
  };

  const fetchMonthlyEvaluations = async (employeeId: string, targetMonth: number): Promise<KPIEvaluation[]> => {
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

  const fetchQuarterlyEvaluations = async (employeeId: string): Promise<KPIEvaluation[]> => {
    const months = getMonthsInQuarter(currentQuarter);
    const allEvaluations: KPIEvaluation[][] = await Promise.all(
      months.map((m) => fetchMonthlyEvaluations(employeeId, m))
    );

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

    return Array.from(kpiMap.values()).map((item) => ({
      kpi: item.kpi,
      achieved_value: item.monthCount > 0 ? Math.round((item.totalAchieved / item.monthCount) * 100) / 100 : null,
      score: item.monthCount > 0 ? Math.round((item.totalScore / item.monthCount) * 100) / 100 : null,
      status: item.hasCompleted ? "completed" : "pending",
    }));
  };

  const calculateOverallScore = (evaluations: KPIEvaluation[]): number | null => {
    let weightedScore = 0;
    let totalWeight = 0;
    evaluations.forEach((evaluation) => {
      if (evaluation.score && evaluation.status === "completed") {
        weightedScore += (evaluation.score * evaluation.kpi.weighting) / 100;
        totalWeight += evaluation.kpi.weighting;
      }
    });
    return totalWeight > 0 ? Math.round(weightedScore * 100) / 100 : null;
  };

  const handleDownload = async () => {
    if (selectedEmployees.size === 0) {
      toast({
        variant: "destructive",
        description: t("hr:selectAtLeastOneEmployee"),
      });
      return;
    }

    setGenerating(true);

    try {
      const selectedList = employeesWithJobRoles.filter((e) => selectedEmployees.has(e.id));
      const employeeReports: EmployeeReport[] = [];

      // Fetch data for all selected employees
      for (const employee of selectedList) {
        const evaluations = reportType === "monthly"
          ? await fetchMonthlyEvaluations(employee.id, month)
          : await fetchQuarterlyEvaluations(employee.id);

        employeeReports.push({
          employeeName: employee.full_name,
          jobRoleName: employee.job_role?.name || null,
          evaluations,
          overallScore: calculateOverallScore(evaluations),
        });
      }

      // Build period label
      const periodLabel = reportType === "monthly"
        ? new Date(year, month - 1, 1).toLocaleString(
            i18n.language === "ar" ? "ar-EG" : "en-US",
            { month: "long" }
          ) + ` ${year}`
        : `${getQuarterLabel(currentQuarter)} ${year}`;

      // Set template data
      setTemplateData({
        employees: employeeReports,
        periodLabel,
        isQuarterly: reportType === "quarterly",
      });

      // Wait for template to render
      await new Promise((resolve) => setTimeout(resolve, 200));

      const html2pdf = (await import("html2pdf.js")).default;

      if (!templateRef.current) {
        throw new Error("Template not rendered");
      }

      const filename = reportType === "monthly"
        ? `KPI_Report_All_Employees_${periodLabel.replace(/\s+/g, "_")}.pdf`
        : `KPI_Report_All_Employees_${getQuarterLabel(currentQuarter)}_${year}.pdf`;

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
        description: t("hr:bulkReportDownloadedDesc", { count: selectedList.length }),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
      setOpen(false);
    } catch (error) {
      console.error("Error generating bulk PDF:", error);
      toast({
        variant: "destructive",
        description: t("hr:pdfDownloadError"),
      });
    } finally {
      setGenerating(false);
      setTemplateData(null);
    }
  };

  const monthName = new Date(year, month - 1, 1).toLocaleString(
    i18n.language === "ar" ? "ar-EG" : "en-US",
    { month: "long" }
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !generating && setOpen(v)}>
        <DialogTrigger asChild>
          <Button variant="outline" className="border-[#E6E6E4]">
            <Download className="h-4 w-4 mr-2" />
            {t("hr:bulkDownload")}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <Users className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              {t("hr:bulkDownloadReports")}
            </DialogTitle>
            <DialogDescription className={isRtl ? "text-right" : ""}>
              {t("hr:bulkDownloadDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Report Type Selection */}
            <div className="space-y-2">
              <Label>{t("hr:reportType")}</Label>
              <RadioGroup
                value={reportType}
                onValueChange={(v) => setReportType(v as "monthly" | "quarterly")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monthly" id="bulk-monthly" />
                  <Label htmlFor="bulk-monthly" className="cursor-pointer">
                    {t("hr:monthlyReport")} ({monthName} {year})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="quarterly" id="bulk-quarterly" />
                  <Label htmlFor="bulk-quarterly" className="cursor-pointer">
                    {t("hr:quarterlyReport")} ({getQuarterLabel(currentQuarter)} {year})
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Employee Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("hr:selectEmployees")}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="text-[#6B6B6B] hover:text-[#222222]"
                >
                  {selectedEmployees.size === employeesWithJobRoles.length
                    ? t("hr:deselectAll")
                    : t("hr:selectAll")}
                </Button>
              </div>
              <ScrollArea className="h-[200px] border border-[#E6E6E4] rounded-lg p-2">
                {employeesWithJobRoles.length === 0 ? (
                  <p className="text-center text-[#6B6B6B] py-4">
                    {t("hr:noEmployeesWithJobRoles")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {employeesWithJobRoles.map((employee) => (
                      <div
                        key={employee.id}
                        className={`flex items-center space-x-3 p-2 rounded hover:bg-[#FAFAF8] cursor-pointer ${isRtl ? "flex-row-reverse space-x-reverse" : ""}`}
                        onClick={() => toggleEmployee(employee.id)}
                      >
                        <Checkbox
                          checked={selectedEmployees.has(employee.id)}
                          onCheckedChange={() => toggleEmployee(employee.id)}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-[#222222]">{employee.full_name}</p>
                          <p className="text-xs text-[#6B6B6B]">{employee.job_role?.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <p className="text-sm text-[#6B6B6B]">
                {t("hr:selectedCount", { count: selectedEmployees.size })}
              </p>
            </div>
          </div>

          <DialogFooter className={`gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={generating}
              className="border-[#E6E6E4]"
            >
              {t("hr:cancel")}
            </Button>
            <Button
              onClick={handleDownload}
              disabled={generating || selectedEmployees.size === 0}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {generating ? t("hr:generatingPdf") : t("hr:downloadReport")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden template for PDF generation */}
      {templateData && (
        <div
          style={{
            position: "absolute",
            left: "-9999px",
            top: 0,
            width: "650px",
          }}
        >
          <BulkKPIReportPDFTemplate
            ref={templateRef}
            employees={templateData.employees}
            periodLabel={templateData.periodLabel}
            isQuarterly={templateData.isQuarterly}
            year={year}
          />
        </div>
      )}
    </>
  );
}
