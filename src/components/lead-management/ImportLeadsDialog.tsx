"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Upload, 
  FileSpreadsheet, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  X,
  Download,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface CSVRow {
  [key: string]: string;
}

interface ColumnMapping {
  csvColumn: string;
  leadField: string;
}

interface ImportResult {
  success: number;
  failed: number;
  duplicates: number;
  errors: { row: number; error: string }[];
}

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete";

const LEAD_FIELDS = [
  { value: "full_name", label: "Full Name", required: true },
  { value: "email", label: "Email", required: true },
  { value: "phone", label: "Phone", required: false },
  { value: "company_name", label: "Company", required: false },
  { value: "notes", label: "Notes", required: false },
  { value: "skip", label: "Skip this column", required: false },
];

export function ImportLeadsDialog({ 
  open, 
  onOpenChange,
  onSuccess 
}: ImportLeadsDialogProps) {
  const { t } = useTranslation("leadManagement");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Reset state
  const resetState = useCallback(() => {
    setStep("upload");
    setSelectedFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMappings([]);
    setSkipDuplicates(true);
    setIsProcessing(false);
    setImportProgress(0);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Parse CSV file
  const parseCSV = useCallback((text: string): { headers: string[]; rows: CSVRow[] } => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }

    // Parse header
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    
    // Parse rows
    const rows: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row: CSVRow = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        rows.push(row);
      }
    }

    return { headers, rows };
  }, []);

  // Parse a single CSV line (handles quoted values)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  };

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error(t("invalidFileFormat", "Please select a CSV file"));
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);
      
      if (headers.length === 0 || rows.length === 0) {
        toast.error(t("emptyFile", "The file appears to be empty or invalid"));
        return;
      }

      setCsvHeaders(headers);
      setCsvData(rows);

      // Auto-detect column mappings
      const autoMappings: ColumnMapping[] = headers.map(header => {
        const normalizedHeader = header.toLowerCase().replace(/[_\s-]/g, "");
        let mappedField = "skip";

        if (normalizedHeader.includes("name") || normalizedHeader.includes("fullname")) {
          mappedField = "full_name";
        } else if (normalizedHeader.includes("email")) {
          mappedField = "email";
        } else if (normalizedHeader.includes("phone") || normalizedHeader.includes("mobile") || normalizedHeader.includes("tel")) {
          mappedField = "phone";
        } else if (normalizedHeader.includes("company") || normalizedHeader.includes("organization") || normalizedHeader.includes("org")) {
          mappedField = "company_name";
        } else if (normalizedHeader.includes("note") || normalizedHeader.includes("comment")) {
          mappedField = "notes";
        }

        return { csvColumn: header, leadField: mappedField };
      });

      setColumnMappings(autoMappings);
      setStep("mapping");
    };
    reader.readAsText(file);
  }, [parseCSV, t]);

  // Handle drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Update column mapping
  const updateMapping = (csvColumn: string, leadField: string) => {
    setColumnMappings(prev => 
      prev.map(m => m.csvColumn === csvColumn ? { ...m, leadField } : m)
    );
  };

  // Check if mappings are valid
  const isMappingValid = useMemo(() => {
    const requiredFields = LEAD_FIELDS.filter(f => f.required).map(f => f.value);
    const mappedFields = columnMappings.map(m => m.leadField);
    return requiredFields.every(f => mappedFields.includes(f));
  }, [columnMappings]);

  // Preview data with mappings applied
  const previewData = useMemo(() => {
    return csvData.slice(0, 5).map(row => {
      const lead: Record<string, string> = {};
      columnMappings.forEach(mapping => {
        if (mapping.leadField !== "skip") {
          lead[mapping.leadField] = row[mapping.csvColumn] || "";
        }
      });
      return lead;
    });
  }, [csvData, columnMappings]);

  // Import leads
  const handleImport = async () => {
    setIsProcessing(true);
    setStep("importing");
    setImportProgress(0);

    const result: ImportResult = {
      success: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
    };

    const totalRows = csvData.length;

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const lead: Record<string, string> = {};
      
      columnMappings.forEach(mapping => {
        if (mapping.leadField !== "skip") {
          lead[mapping.leadField] = row[mapping.csvColumn] || "";
        }
      });

      // Validate required fields
      if (!lead.full_name || !lead.email) {
        result.failed++;
        result.errors.push({ 
          row: i + 2, // +2 because row 1 is header and arrays are 0-indexed
          error: t("missingRequiredFields", "Missing required fields") 
        });
        continue;
      }

      // Check for duplicate
      if (skipDuplicates) {
        const { data: existing } = await supabase
          .from("leads")
          .select("id")
          .eq("email", lead.email)
          .single();

        if (existing) {
          result.duplicates++;
          continue;
        }
      }

      // Insert lead
      try {
        const { error } = await supabase
          .from("leads")
          .insert({
            full_name: lead.full_name,
            email: lead.email,
            phone: lead.phone || null,
            company_name: lead.company_name || null,
            notes: lead.notes || null,
            status: "not_started",
          });

        if (error) {
          result.failed++;
          result.errors.push({ row: i + 2, error: error.message });
        } else {
          result.success++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push({ row: i + 2, error: "Unknown error" });
      }

      setImportProgress(Math.round(((i + 1) / totalRows) * 100));
    }

    setImportResult(result);
    setStep("complete");
    setIsProcessing(false);

    if (result.success > 0) {
      onSuccess();
    }
  };

  // Download sample CSV
  const downloadSampleCSV = () => {
    const sampleData = [
      ["Full Name", "Email", "Phone", "Company", "Notes"],
      ["John Smith", "john@example.com", "+44 1234 567890", "Smith & Co", "Interested in will writing"],
      ["Jane Doe", "jane@example.com", "+44 9876 543210", "Doe Ltd", "Referred by existing client"],
    ];

    const csvContent = sampleData.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "leads_sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case "upload":
        return (
          <div className="space-y-4">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                dragActive 
                  ? "border-[#C6A03B] bg-[#FFF9E6]" 
                  : "border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
              <p className="font-medium text-[#222222] mb-1">
                {t("dragAndDropCSV", "Drag and drop a CSV file")}
              </p>
              <p className="text-sm text-[#6B6B6B] mb-4">
                {t("or", "or")}
              </p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="border-[#E6E6E4]"
              >
                <Upload className="h-4 w-4 mr-2" />
                {t("browseFiles", "Browse Files")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
            </div>
            <div className="flex items-center justify-center">
              <Button variant="link" onClick={downloadSampleCSV} className="text-[#6B6B6B]">
                <Download className="h-4 w-4 mr-1" />
                {t("downloadSampleCSV", "Download sample CSV")}
              </Button>
            </div>
          </div>
        );

      case "mapping":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#E6E6E4] bg-[#FAFAF8] p-3 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-[#C6A03B]" />
                <span className="font-medium text-[#222222]">{selectedFile?.name}</span>
                <Badge variant="outline" className="ml-auto">
                  {csvData.length} {t("rows", "rows")}
                </Badge>
              </div>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {columnMappings.map((mapping, index) => (
                <div key={mapping.csvColumn} className="flex items-center gap-3">
                  <div className="flex-1 p-2 rounded bg-[#FAFAF8] border border-[#E6E6E4]">
                    <p className="text-sm font-medium text-[#222222]">{mapping.csvColumn}</p>
                    <p className="text-xs text-[#6B6B6B] truncate">
                      {csvData[0]?.[mapping.csvColumn] || "-"}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[#999999] flex-shrink-0" />
                  <Select 
                    value={mapping.leadField} 
                    onValueChange={(value) => updateMapping(mapping.csvColumn, value)}
                  >
                    <SelectTrigger className="flex-1 border-[#E6E6E4]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_FIELDS.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {!isMappingValid && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[#FFF7ED] border border-[#D97706]/20 text-[#D97706]">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{t("mapRequiredFields", "Please map Full Name and Email columns")}</span>
              </div>
            )}
          </div>
        );

      case "preview":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Checkbox 
                id="skipDuplicates" 
                checked={skipDuplicates}
                onCheckedChange={(checked) => setSkipDuplicates(checked as boolean)}
              />
              <Label htmlFor="skipDuplicates" className="text-sm text-[#555555]">
                {t("skipDuplicates", "Skip duplicate emails")}
              </Label>
            </div>

            <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAF8]">
                    <TableHead className="font-semibold text-[#555555]">{t("name", "Name")}</TableHead>
                    <TableHead className="font-semibold text-[#555555]">{t("email", "Email")}</TableHead>
                    <TableHead className="font-semibold text-[#555555]">{t("phone", "Phone")}</TableHead>
                    <TableHead className="font-semibold text-[#555555]">{t("company", "Company")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((lead, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{lead.full_name}</TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell>{lead.phone || "-"}</TableCell>
                      <TableCell>{lead.company_name || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-[#6B6B6B] text-center">
              {t("showingPreview", "Showing preview of first {{count}} rows", { count: previewData.length })} 
              {" • "}
              {t("totalRows", "Total: {{count}} rows", { count: csvData.length })}
            </p>
          </div>
        );

      case "importing":
        return (
          <div className="space-y-6 py-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-[hsl(var(--jw-primary-green))]" />
            <div>
              <p className="font-medium text-[#222222] mb-2">{t("importing", "Importing leads...")}</p>
              <Progress value={importProgress} className="h-2 max-w-xs mx-auto" />
              <p className="text-sm text-[#6B6B6B] mt-2">{importProgress}%</p>
            </div>
          </div>
        );

      case "complete":
        return (
          <div className="space-y-6 py-4">
            <div className="text-center">
              {importResult && importResult.success > 0 ? (
                <CheckCircle2 className="h-12 w-12 mx-auto text-[#0C5536] mb-3" />
              ) : (
                <XCircle className="h-12 w-12 mx-auto text-[#C0392B] mb-3" />
              )}
              <p className="font-medium text-[#222222] text-lg mb-1">
                {t("importComplete", "Import Complete")}
              </p>
            </div>

            {importResult && (
              <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                <div className="text-center p-3 rounded-lg bg-[#E6F7F1]">
                  <p className="text-2xl font-bold text-[#0C5536]">{importResult.success}</p>
                  <p className="text-xs text-[#0C5536]">{t("imported", "Imported")}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-[#FFF9E6]">
                  <p className="text-2xl font-bold text-[#C6A03B]">{importResult.duplicates}</p>
                  <p className="text-xs text-[#C6A03B]">{t("duplicates", "Duplicates")}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-[#FEECEC]">
                  <p className="text-2xl font-bold text-[#C0392B]">{importResult.failed}</p>
                  <p className="text-xs text-[#C0392B]">{t("failed", "Failed")}</p>
                </div>
              </div>
            )}

            {importResult && importResult.errors.length > 0 && (
              <div className="max-h-[150px] overflow-y-auto rounded-lg border border-[#E6E6E4] p-3">
                <p className="text-xs font-medium text-[#555555] mb-2">{t("errors", "Errors:")}</p>
                {importResult.errors.slice(0, 10).map((error, index) => (
                  <p key={index} className="text-xs text-[#C0392B]">
                    Row {error.row}: {error.error}
                  </p>
                ))}
                {importResult.errors.length > 10 && (
                  <p className="text-xs text-[#6B6B6B] mt-2">
                    {t("andMoreErrors", "...and {{count}} more errors", { count: importResult.errors.length - 10 })}
                  </p>
                )}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetState();
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
            {t("importLeads", "Import Leads")}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && t("uploadCSVDescription", "Upload a CSV file to import leads")}
            {step === "mapping" && t("mapColumnsDescription", "Map your CSV columns to lead fields")}
            {step === "preview" && t("previewDescription", "Review your data before importing")}
            {step === "importing" && t("pleaseWait", "Please wait while we import your leads")}
            {step === "complete" && t("importCompleteDescription", "Your import has been processed")}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {renderStepContent()}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#E6E6E4]"
            >
              {t("cancel", "Cancel")}
            </Button>
          )}

          {step === "mapping" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("upload")}
                className="border-[#E6E6E4]"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("back", "Back")}
              </Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={!isMappingValid}
                className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
              >
                {t("next", "Next")}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("mapping")}
                className="border-[#E6E6E4]"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("back", "Back")}
              </Button>
              <Button
                onClick={handleImport}
                className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
              >
                <Upload className="h-4 w-4 mr-2" />
                {t("importLeads", "Import {{count}} Leads", { count: csvData.length })}
              </Button>
            </>
          )}

          {step === "complete" && (
            <Button
              onClick={() => {
                onOpenChange(false);
                resetState();
              }}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {t("done", "Done")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
