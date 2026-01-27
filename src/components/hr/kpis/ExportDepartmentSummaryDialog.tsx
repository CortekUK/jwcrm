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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, FileSpreadsheet, FileText, Building2 } from "lucide-react";
import type { DepartmentSummary } from "./DepartmentKPISummary";
import { DepartmentSummaryPDFTemplate } from "./DepartmentSummaryPDFTemplate";

type ExportDepartmentSummaryDialogProps = {
  departmentSummaries: DepartmentSummary[];
  selectedYear: number;
  selectedMonth: number;
  disabled?: boolean;
};

export function ExportDepartmentSummaryDialog({
  departmentSummaries,
  selectedYear,
  selectedMonth,
  disabled = false,
}: ExportDepartmentSummaryDialogProps) {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"pdf" | "excel">("pdf");
  const [scope, setScope] = useState<"all" | string>("all");
  const [generating, setGenerating] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  const monthName = new Date(selectedYear, selectedMonth - 1, 1).toLocaleString(
    i18n.language === "ar" ? "ar-EG" : "en-US",
    { month: "long" }
  );

  const periodLabel = `${monthName} ${selectedYear}`;

  const selectedDepartment = scope !== "all" 
    ? departmentSummaries.find(d => d.department_id === scope) || null
    : null;

  const handleExport = async () => {
    setGenerating(true);

    try {
      if (format === "pdf") {
        await handlePDFExport();
      } else {
        await handleExcelExport();
      }
      setOpen(false);
    } catch (error) {
      console.error("Export error:", error);
      toast({
        variant: "destructive",
        description: t("hr:exportError", "Failed to export data"),
      });
    } finally {
      setGenerating(false);
      setShowTemplate(false);
    }
  };

  const handlePDFExport = async () => {
    setShowTemplate(true);

    // Wait for template to render
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Dynamic import of html2pdf
    const html2pdf = (await import("html2pdf.js")).default;

    if (!templateRef.current) {
      throw new Error("Template not rendered");
    }

    const filename = scope === "all"
      ? `Department_KPI_Summary_${periodLabel.replace(/\s+/g, "_")}.pdf`
      : `${selectedDepartment?.department_name.replace(/\s+/g, "_")}_KPI_Summary_${periodLabel.replace(/\s+/g, "_")}.pdf`;

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
      title: t("hr:pdfDownloaded", "PDF Downloaded"),
      description: t("hr:summaryExportedSuccessfully", "Summary exported successfully"),
      className: "bg-[hsl(var(--jw-primary-green))] text-white",
    });
  };

  const handleExcelExport = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch("/api/hr/kpis/department-summary/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        year: selectedYear,
        month: selectedMonth,
        departmentId: scope === "all" ? null : scope,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Export failed");
    }

    // Download the file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = scope === "all"
      ? `Department_KPI_Summary_${periodLabel.replace(/\s+/g, "_")}.xlsx`
      : `${selectedDepartment?.department_name.replace(/\s+/g, "_")}_KPI_Summary_${periodLabel.replace(/\s+/g, "_")}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: t("hr:excelDownloaded", "Excel Downloaded"),
      description: t("hr:summaryExportedSuccessfully", "Summary exported successfully"),
      className: "bg-[hsl(var(--jw-primary-green))] text-white",
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || departmentSummaries.length === 0}
            className="border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
          >
            <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("hr:exportSummary", "Export Summary")}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <Building2 className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              {t("hr:exportDepartmentSummary", "Export Department Summary")}
            </DialogTitle>
            <DialogDescription className={isRtl ? "text-right" : ""}>
              {t("hr:exportDepartmentSummaryDesc", "Download the KPI summary as PDF or Excel")}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {/* Period Info */}
            <div className="p-3 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]">
              <p className="text-sm text-[#6B6B6B]">{t("hr:period", "Period")}:</p>
              <p className="font-medium text-[#222222]">{periodLabel}</p>
            </div>

            {/* Format Selection */}
            <div className="space-y-3">
              <Label className="text-[#555555] font-medium">{t("hr:exportFormat", "Export Format")}</Label>
              <RadioGroup
                value={format}
                onValueChange={(v) => setFormat(v as "pdf" | "excel")}
                className="grid grid-cols-2 gap-3"
              >
                <div
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    format === "pdf"
                      ? "border-[hsl(var(--jw-primary-green))] bg-[rgba(12,85,54,0.05)]"
                      : "border-[#E6E6E4] hover:bg-[#FAFAF8]"
                  } ${isRtl ? "flex-row-reverse space-x-reverse" : ""}`}
                >
                  <RadioGroupItem value="pdf" id="pdf" className="mt-0" />
                  <Label htmlFor="pdf" className="flex-1 cursor-pointer flex items-center gap-2">
                    <FileText className="h-4 w-4 text-red-500" />
                    <span className="font-medium text-[#222222]">PDF</span>
                  </Label>
                </div>
                <div
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    format === "excel"
                      ? "border-[hsl(var(--jw-primary-green))] bg-[rgba(12,85,54,0.05)]"
                      : "border-[#E6E6E4] hover:bg-[#FAFAF8]"
                  } ${isRtl ? "flex-row-reverse space-x-reverse" : ""}`}
                >
                  <RadioGroupItem value="excel" id="excel" className="mt-0" />
                  <Label htmlFor="excel" className="flex-1 cursor-pointer flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-[#222222]">Excel</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Scope Selection */}
            <div className="space-y-3">
              <Label className="text-[#555555] font-medium">{t("hr:scope", "Scope")}</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="border-[#E6E6E4]">
                  <SelectValue placeholder={t("hr:selectDepartment", "Select department")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("hr:allDepartments", "All Departments")} ({departmentSummaries.length})
                  </SelectItem>
                  {departmentSummaries.map((dept) => (
                    <SelectItem key={dept.department_id} value={dept.department_id}>
                      {dept.department_name} ({dept.employees_with_kpis} {t("hr:employees", "employees")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className={`gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-[#E6E6E4]"
            >
              {t("hr:cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleExport}
              disabled={generating}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {generating && <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />}
              {generating 
                ? t("hr:exporting", "Exporting...") 
                : format === "pdf" 
                  ? t("hr:downloadPdf", "Download PDF")
                  : t("hr:downloadExcel", "Download Excel")
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden template for PDF generation */}
      {showTemplate && (
        <div
          style={{
            position: "absolute",
            left: "-9999px",
            top: 0,
            width: "750px",
          }}
        >
          <DepartmentSummaryPDFTemplate
            ref={templateRef}
            departmentSummaries={departmentSummaries}
            selectedDepartment={selectedDepartment}
            year={selectedYear}
            month={selectedMonth}
            periodLabel={periodLabel}
          />
        </div>
      )}
    </>
  );
}
