"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "react-i18next";
import { Download, Loader2, FileSpreadsheet, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Department {
  id: string;
  name: string;
}

const EMPLOYMENT_STATUSES = [
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
  { id: "on_leave", label: "On Leave" },
  { id: "terminated", label: "Terminated" },
];

export function ExportEmployeesButton() {
  const { t } = useTranslation(["hr", "common"]);
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Form state
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["active"]);
  const [includeSalary, setIncludeSalary] = useState(false);
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");

  useEffect(() => {
    if (open) {
      fetchDepartments();
    }
  }, [open]);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");
      setDepartments(data || []);
    } catch (error) {
      console.error("Error fetching departments:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = (statusId: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(statusId)
        ? prev.filter((s) => s !== statusId)
        : [...prev, statusId]
    );
  };

  const handleExport = async () => {
    if (selectedStatuses.length === 0) {
      toast({
        variant: "destructive",
        description: t("hr:pleaseSelectStatus", "Please select at least one status"),
      });
      return;
    }

    setExporting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No authentication token");
      }

      const response = await fetch("/api/hr/employees/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          departmentIds: departmentId === "all" ? "all" : [departmentId],
          statuses: selectedStatuses,
          includeSalary,
          format,
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
      const contentDisposition = response.headers.get("Content-Disposition");
      const filename =
        contentDisposition?.match(/filename="(.+)"/)?.[1] ||
        `Employee_Roster.${format}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        description: t("hr:exportSuccess", "Export completed successfully"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });

      setOpen(false);
    } catch (error) {
      console.error("Export error:", error);
      toast({
        variant: "destructive",
        description:
          error instanceof Error ? error.message : t("hr:exportFailed", "Export failed"),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
        >
          <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("hr:export", "Export")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]">
            <FileSpreadsheet className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("hr:exportEmployees", "Export Employees")}
          </DialogTitle>
          <DialogDescription>
            {t("hr:exportEmployeesDescription", "Download employee roster as Excel or CSV")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Format Selection */}
          <div className="grid gap-2">
            <Label className="text-[#555555]">{t("hr:exportFormat", "Format")}</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={format === "xlsx" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormat("xlsx")}
                className={
                  format === "xlsx"
                    ? "bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
                    : "border-[#E6E6E4]"
                }
              >
                <FileSpreadsheet className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                Excel (.xlsx)
              </Button>
              <Button
                type="button"
                variant={format === "csv" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormat("csv")}
                className={
                  format === "csv"
                    ? "bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
                    : "border-[#E6E6E4]"
                }
              >
                <FileText className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                CSV (.csv)
              </Button>
            </div>
          </div>

          {/* Department Filter */}
          <div className="grid gap-2">
            <Label className="text-[#555555]">{t("hr:department", "Department")}</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="border-[#E6E6E4]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("hr:allDepartments", "All Departments")}</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="grid gap-2">
            <Label className="text-[#555555]">
              {t("hr:employmentStatus", "Employment Status")}
            </Label>
            <div className="flex flex-wrap gap-3">
              {EMPLOYMENT_STATUSES.map((status) => (
                <div key={status.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`emp-status-${status.id}`}
                    checked={selectedStatuses.includes(status.id)}
                    onCheckedChange={() => toggleStatus(status.id)}
                    className="border-[#E6E6E4] data-[state=checked]:bg-[hsl(var(--jw-primary-green))] data-[state=checked]:border-[hsl(var(--jw-primary-green))]"
                  />
                  <label
                    htmlFor={`emp-status-${status.id}`}
                    className="text-sm text-[#555555] cursor-pointer"
                  >
                    {t(`hr:status.${status.id}`, status.label)}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Include Salary */}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="include-salary"
              checked={includeSalary}
              onCheckedChange={(checked) => setIncludeSalary(checked === true)}
              className="border-[#E6E6E4] data-[state=checked]:bg-[hsl(var(--jw-primary-green))] data-[state=checked]:border-[hsl(var(--jw-primary-green))]"
            />
            <label
              htmlFor="include-salary"
              className="text-sm text-[#555555] cursor-pointer"
            >
              {t("hr:includeSalaryData", "Include salary information")}
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-[#E6E6E4]"
          >
            {t("common:cancel", "Cancel")}
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || selectedStatuses.length === 0}
            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
          >
            {exporting ? (
              <>
                <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                {t("hr:exporting", "Exporting...")}
              </>
            ) : (
              <>
                <Download className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                {t("hr:downloadExport", "Download")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
