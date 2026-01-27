"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  FileSpreadsheet, 
  FileText,
  Download,
  CheckCircle2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { LeadStatus } from "./LeadStatusBadge";

interface Lead {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  notes: string | null;
  source: string | null;
  source_id: string | null;
  assigned_to: string | null;
  status: LeadStatus;
  is_paid: boolean;
  paid_at: string | null;
  paid_amount: number | null;
  paid_currency: string | null;
  created_at: string;
  updated_at: string;
  source_data?: { id: string; name: string } | null;
  assigned_user?: { user_id: string; full_name: string } | null;
}

interface ExportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  selectedIds?: Set<string>;
}

type ExportFormat = "csv" | "excel";

interface ExportField {
  id: string;
  label: string;
  getter: (lead: Lead) => string;
  default: boolean;
}

const EXPORT_FIELDS: ExportField[] = [
  { id: "full_name", label: "Full Name", getter: (l) => l.full_name, default: true },
  { id: "email", label: "Email", getter: (l) => l.email, default: true },
  { id: "phone", label: "Phone", getter: (l) => l.phone || "", default: true },
  { id: "company_name", label: "Company", getter: (l) => l.company_name || "", default: true },
  { id: "source", label: "Source", getter: (l) => l.source_data?.name || l.source || "", default: true },
  { id: "assigned_to", label: "Assigned To", getter: (l) => l.assigned_user?.full_name || "", default: true },
  { id: "status", label: "Status", getter: (l) => l.status.replace("_", " "), default: true },
  { id: "is_paid", label: "Paid", getter: (l) => l.is_paid ? "Yes" : "No", default: true },
  { id: "paid_amount", label: "Amount", getter: (l) => l.paid_amount?.toString() || "", default: false },
  { id: "paid_currency", label: "Currency", getter: (l) => l.paid_currency || "", default: false },
  { id: "notes", label: "Notes", getter: (l) => l.notes || "", default: false },
  { id: "created_at", label: "Created Date", getter: (l) => format(parseISO(l.created_at), "yyyy-MM-dd"), default: true },
  { id: "updated_at", label: "Last Updated", getter: (l) => format(parseISO(l.updated_at), "yyyy-MM-dd HH:mm"), default: false },
];

export function ExportLeadsDialog({ 
  open, 
  onOpenChange,
  leads,
  selectedIds,
}: ExportLeadsDialogProps) {
  const { t } = useTranslation("leadManagement");

  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(EXPORT_FIELDS.filter(f => f.default).map(f => f.id))
  );
  const [exportScope, setExportScope] = useState<"all" | "selected" | "filtered">("all");

  // Calculate leads to export
  const leadsToExport = useMemo(() => {
    if (selectedIds && selectedIds.size > 0 && exportScope === "selected") {
      return leads.filter(l => selectedIds.has(l.id));
    }
    return leads;
  }, [leads, selectedIds, exportScope]);

  // Toggle field selection
  const toggleField = (fieldId: string) => {
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldId)) {
        newSet.delete(fieldId);
      } else {
        newSet.add(fieldId);
      }
      return newSet;
    });
  };

  // Select all fields
  const selectAllFields = () => {
    setSelectedFields(new Set(EXPORT_FIELDS.map(f => f.id)));
  };

  // Select default fields
  const selectDefaultFields = () => {
    setSelectedFields(new Set(EXPORT_FIELDS.filter(f => f.default).map(f => f.id)));
  };

  // Export to CSV
  const exportToCSV = () => {
    const fields = EXPORT_FIELDS.filter(f => selectedFields.has(f.id));
    const headers = fields.map(f => f.label);
    const rows = leadsToExport.map(lead => 
      fields.map(f => f.getter(lead))
    );

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `leads_${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  // Export to Excel (simple XLSX-like format using CSV with Excel-friendly encoding)
  const exportToExcel = () => {
    const fields = EXPORT_FIELDS.filter(f => selectedFields.has(f.id));
    const headers = fields.map(f => f.label);
    const rows = leadsToExport.map(lead => 
      fields.map(f => f.getter(lead))
    );

    // Create tab-separated content which Excel handles well
    const content = [
      headers.join("\t"),
      ...rows.map(row => row.map(cell => cell.replace(/\t/g, " ")).join("\t"))
    ].join("\n");

    // Add BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + content], { type: "application/vnd.ms-excel;charset=utf-8;" });
    downloadBlob(blob, `leads_${format(new Date(), "yyyy-MM-dd")}.xls`);
  };

  // Download blob
  const downloadBlob = (blob: Blob, filename: string) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    onOpenChange(false);
  };

  // Handle export
  const handleExport = () => {
    if (exportFormat === "csv") {
      exportToCSV();
    } else {
      exportToExcel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
            {t("exportLeads", "Export Leads")}
          </DialogTitle>
          <DialogDescription>
            {t("exportLeadsDescription", "Choose format and fields to export")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Scope */}
          {selectedIds && selectedIds.size > 0 && (
            <div className="space-y-3">
              <Label className="text-[#222222] font-medium">{t("exportScope", "What to export")}</Label>
              <RadioGroup value={exportScope} onValueChange={(v: "all" | "selected") => setExportScope(v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="scope-all" />
                  <Label htmlFor="scope-all" className="text-sm text-[#555555]">
                    {t("allLeads", "All leads")} ({leads.length})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="scope-selected" />
                  <Label htmlFor="scope-selected" className="text-sm text-[#555555]">
                    {t("selectedLeads", "Selected leads")} ({selectedIds.size})
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Export Format */}
          <div className="space-y-3">
            <Label className="text-[#222222] font-medium">{t("format", "Format")}</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportFormat("csv")}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                  exportFormat === "csv"
                    ? "border-[#C6A03B] bg-[#FFF9E6]"
                    : "border-[#E6E6E4] hover:border-[#C6A03B]/50"
                )}
              >
                <FileText className={cn(
                  "h-8 w-8",
                  exportFormat === "csv" ? "text-[#C6A03B]" : "text-[#6B6B6B]"
                )} />
                <span className={cn(
                  "font-medium text-sm",
                  exportFormat === "csv" ? "text-[#C6A03B]" : "text-[#555555]"
                )}>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setExportFormat("excel")}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                  exportFormat === "excel"
                    ? "border-[#0C5536] bg-[#E6F7F1]"
                    : "border-[#E6E6E4] hover:border-[#0C5536]/50"
                )}
              >
                <FileSpreadsheet className={cn(
                  "h-8 w-8",
                  exportFormat === "excel" ? "text-[#0C5536]" : "text-[#6B6B6B]"
                )} />
                <span className={cn(
                  "font-medium text-sm",
                  exportFormat === "excel" ? "text-[#0C5536]" : "text-[#555555]"
                )}>Excel</span>
              </button>
            </div>
          </div>

          {/* Field Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[#222222] font-medium">{t("fields", "Fields")}</Label>
              <div className="flex gap-2">
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={selectAllFields}
                  className="h-auto p-0 text-xs text-[#6B6B6B]"
                >
                  {t("selectAll", "Select All")}
                </Button>
                <span className="text-[#E6E6E4]">|</span>
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={selectDefaultFields}
                  className="h-auto p-0 text-xs text-[#6B6B6B]"
                >
                  {t("selectDefault", "Default")}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-1">
              {EXPORT_FIELDS.map((field) => (
                <div key={field.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={field.id}
                    checked={selectedFields.has(field.id)}
                    onCheckedChange={() => toggleField(field.id)}
                  />
                  <Label 
                    htmlFor={field.id} 
                    className="text-sm text-[#555555] cursor-pointer"
                  >
                    {field.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-lg bg-[#FAFAF8] border border-[#E6E6E4] p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B6B6B]">{t("readyToExport", "Ready to export")}</span>
              <Badge variant="outline" className="text-[#0C5536] border-[#0C5536]/30">
                {leadsToExport.length} {t("leads", "leads")} • {selectedFields.size} {t("fields", "fields")}
              </Badge>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#E6E6E4]"
          >
            {t("cancel", "Cancel")}
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedFields.size === 0}
            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            {t("export", "Export")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
