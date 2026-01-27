"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "react-i18next";
import { Download, Loader2, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

interface Department {
  id: string;
  name: string;
}

interface ExportLeaveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LEAVE_TYPES = [
  { id: "annual", label: "Annual Leave" },
  { id: "sick", label: "Sick Leave" },
  { id: "emergency", label: "Emergency Leave" },
  { id: "unpaid", label: "Unpaid Leave" },
];

const STATUSES = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "denied", label: "Denied" },
];

export function ExportLeaveModal({ open, onOpenChange }: ExportLeaveModalProps) {
  const { t } = useTranslation(["hr", "common"]);
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Form state
  const [reportType, setReportType] = useState<"all" | "department">("all");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [startDate, setStartDate] = useState(
    format(startOfMonth(subMonths(new Date(), 3)), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedLeaveTypes, setSelectedLeaveTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

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

  const toggleLeaveType = (typeId: string) => {
    setSelectedLeaveTypes((prev) =>
      prev.includes(typeId)
        ? prev.filter((t) => t !== typeId)
        : [...prev, typeId]
    );
  };

  const toggleStatus = (statusId: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(statusId)
        ? prev.filter((s) => s !== statusId)
        : [...prev, statusId]
    );
  };

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast({
        variant: "destructive",
        description: t("hr:pleaseSelectDateRange", "Please select a date range"),
      });
      return;
    }

    if (reportType === "department" && !departmentId) {
      toast({
        variant: "destructive",
        description: t("hr:pleaseSelectDepartment", "Please select a department"),
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

      const response = await fetch("/api/hr/leave/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reportType,
          startDate,
          endDate,
          departmentId: reportType === "department" ? departmentId : undefined,
          leaveTypes: selectedLeaveTypes.length > 0 ? selectedLeaveTypes : "all",
          statuses: selectedStatuses.length > 0 ? selectedStatuses : "all",
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
        `Leave_Report_${startDate}_to_${endDate}.xlsx`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        description: t("hr:exportSuccess", "Export completed successfully"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });

      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[hsl(var(--jw-primary-green))]">
            <FileSpreadsheet className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("hr:exportLeaveReport", "Export Leave Report")}
          </DialogTitle>
          <DialogDescription>
            {t("hr:exportLeaveDescription", "Download leave request data as an Excel file")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Report Type */}
          <div className="grid gap-2">
            <Label className="text-[#555555]">{t("hr:reportType", "Report Type")}</Label>
            <Select
              value={reportType}
              onValueChange={(v) => setReportType(v as "all" | "department")}
            >
              <SelectTrigger className="border-[#E6E6E4]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("hr:allEmployees", "All Employees")}</SelectItem>
                <SelectItem value="department">{t("hr:byDepartment", "By Department")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Department (conditional) */}
          {reportType === "department" && (
            <div className="grid gap-2">
              <Label className="text-[#555555]">{t("hr:department", "Department")}</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className="border-[#E6E6E4]">
                  <SelectValue placeholder={t("hr:selectDepartment", "Select department")} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start_date" className="text-[#555555]">
                {t("hr:startDate", "Start Date")}
              </Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end_date" className="text-[#555555]">
                {t("hr:endDate", "End Date")}
              </Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
              />
            </div>
          </div>

          {/* Leave Types */}
          <div className="grid gap-2">
            <Label className="text-[#555555]">
              {t("hr:leaveTypes", "Leave Types")}{" "}
              <span className="text-[#999999] font-normal">
                ({t("hr:leaveAllIfNone", "all if none selected")})
              </span>
            </Label>
            <div className="flex flex-wrap gap-3">
              {LEAVE_TYPES.map((type) => (
                <div key={type.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`leave-${type.id}`}
                    checked={selectedLeaveTypes.includes(type.id)}
                    onCheckedChange={() => toggleLeaveType(type.id)}
                    className="border-[#E6E6E4] data-[state=checked]:bg-[hsl(var(--jw-primary-green))] data-[state=checked]:border-[hsl(var(--jw-primary-green))]"
                  />
                  <label
                    htmlFor={`leave-${type.id}`}
                    className="text-sm text-[#555555] cursor-pointer"
                  >
                    {t(`hr:leaveType.${type.id}`, type.label)}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Statuses */}
          <div className="grid gap-2">
            <Label className="text-[#555555]">
              {t("hr:statuses", "Statuses")}{" "}
              <span className="text-[#999999] font-normal">
                ({t("hr:leaveAllIfNone", "all if none selected")})
              </span>
            </Label>
            <div className="flex flex-wrap gap-3">
              {STATUSES.map((status) => (
                <div key={status.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${status.id}`}
                    checked={selectedStatuses.includes(status.id)}
                    onCheckedChange={() => toggleStatus(status.id)}
                    className="border-[#E6E6E4] data-[state=checked]:bg-[hsl(var(--jw-primary-green))] data-[state=checked]:border-[hsl(var(--jw-primary-green))]"
                  />
                  <label
                    htmlFor={`status-${status.id}`}
                    className="text-sm text-[#555555] cursor-pointer"
                  >
                    {t(`hr:leavePage.status${status.label}`, status.label)}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#E6E6E4]"
          >
            {t("common:cancel", "Cancel")}
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting}
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
                {t("hr:exportExcel", "Export Excel")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
