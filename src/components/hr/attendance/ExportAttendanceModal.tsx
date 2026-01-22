"use client";

import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FileSpreadsheet, Loader2, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ExportReportType,
  ExportIncludeOptions,
  DEFAULT_INCLUDE_OPTIONS,
} from "@/types/attendance-export";
import { useTranslation } from "react-i18next";

interface ExportAttendanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "individual" | "main";
  preselectedEmployee?: { id: string; name: string };
  defaultDateRange?: { from: Date; to: Date };
}

interface Employee {
  id: string;
  full_name: string;
}

interface Department {
  id: string;
  name: string;
}

export function ExportAttendanceModal({
  open,
  onOpenChange,
  mode,
  preselectedEmployee,
  defaultDateRange,
}: ExportAttendanceModalProps) {
  const { t } = useTranslation("hr");
  const { toast } = useToast();

  // State
  const [exporting, setExporting] = useState(false);
  const [reportType, setReportType] = useState<ExportReportType>(
    mode === "individual" ? "individual" : "all"
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    preselectedEmployee?.id || ""
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [fromDate, setFromDate] = useState<Date>(
    defaultDateRange?.from || subDays(new Date(), 30)
  );
  const [toDate, setToDate] = useState<Date>(
    defaultDateRange?.to || new Date()
  );
  const [includeOptions, setIncludeOptions] = useState<ExportIncludeOptions>(
    DEFAULT_INCLUDE_OPTIONS
  );

  // Data for dropdowns
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Calendar popover state (for mobile)
  const [fromCalendarOpen, setFromCalendarOpen] = useState(false);
  const [toCalendarOpen, setToCalendarOpen] = useState(false);

  // Fetch employees and departments
  useEffect(() => {
    if (open && mode === "main") {
      fetchDropdownData();
    }
  }, [open, mode]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      if (mode === "individual" && preselectedEmployee) {
        setReportType("individual");
        setSelectedEmployeeId(preselectedEmployee.id);
      } else {
        setReportType("all");
      }
      if (defaultDateRange) {
        setFromDate(defaultDateRange.from);
        setToDate(defaultDateRange.to);
      }
    }
  }, [open, mode, preselectedEmployee, defaultDateRange]);

  const fetchDropdownData = async () => {
    setLoadingData(true);
    try {
      // Fetch employees
      const { data: empData } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("employment_status", "active")
        .order("full_name");

      if (empData) {
        setEmployees(empData);
      }

      // Fetch departments
      const { data: deptData } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");

      if (deptData) {
        setDepartments(deptData);
      }
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleIncludeChange = (key: keyof ExportIncludeOptions) => {
    setIncludeOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExport = async () => {
    // Validate
    if (reportType === "individual" && !selectedEmployeeId) {
      toast({
        title: t("export.error", "Error"),
        description: t("export.selectEmployee", "Please select an employee"),
        variant: "destructive",
      });
      return;
    }

    if (reportType === "department" && !selectedDepartmentId) {
      toast({
        title: t("export.error", "Error"),
        description: t("export.selectDepartment", "Please select a department"),
        variant: "destructive",
      });
      return;
    }

    if (fromDate > toDate) {
      toast({
        title: t("export.error", "Error"),
        description: t("export.invalidDateRange", "Start date must be before end date"),
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: t("export.error", "Error"),
          description: t("export.notAuthenticated", "Not authenticated"),
          variant: "destructive",
        });
        return;
      }

      const response = await fetch("/api/hr/attendance/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          reportType,
          employeeId: reportType === "individual" ? selectedEmployeeId : undefined,
          departmentId: reportType === "department" ? selectedDepartmentId : undefined,
          startDate: format(fromDate, "yyyy-MM-dd"),
          endDate: format(toDate, "yyyy-MM-dd"),
          includeOptions,
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

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "attendance_export.xlsx";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: t("export.success", "Export Successful"),
        description: t("export.downloadStarted", "Your report is downloading"),
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: t("export.error", "Error"),
        description: error instanceof Error ? error.message : t("export.failed", "Failed to export"),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[hsl(var(--jw-primary-green))]" />
            {t("export.title", "Export Attendance Report")}
          </DialogTitle>
          <DialogDescription>
            {t("export.description", "Configure your attendance report export options")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Report Type */}
          {mode === "main" && (
            <div className="space-y-3">
              <Label>{t("export.reportType", "Report Type")}</Label>
              <RadioGroup
                value={reportType}
                onValueChange={(value) => setReportType(value as ExportReportType)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="font-normal cursor-pointer">
                    {t("export.allEmployees", "All Employees")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="individual" id="individual" />
                  <Label htmlFor="individual" className="font-normal cursor-pointer">
                    {t("export.individual", "Individual Employee")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="department" id="department" />
                  <Label htmlFor="department" className="font-normal cursor-pointer">
                    {t("export.byDepartment", "By Department")}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Employee Selection (for individual type) */}
          {reportType === "individual" && mode === "main" && (
            <div className="space-y-2">
              <Label>{t("export.selectEmployee", "Select Employee")}</Label>
              <Select
                value={selectedEmployeeId}
                onValueChange={setSelectedEmployeeId}
                disabled={loadingData}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("export.chooseEmployee", "Choose an employee...")} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Department Selection (for department type) */}
          {reportType === "department" && (
            <div className="space-y-2">
              <Label>{t("export.selectDepartmentLabel", "Select Department")}</Label>
              <Select
                value={selectedDepartmentId}
                onValueChange={setSelectedDepartmentId}
                disabled={loadingData}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("export.chooseDepartment", "Choose a department...")} />
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
          <div className="space-y-3">
            <Label>{t("export.period", "Period")}</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* From Date */}
              <div className="space-y-1">
                <Label className="text-xs text-[#6B6B6B]">{t("export.from", "From")}</Label>
                <Popover open={fromCalendarOpen} onOpenChange={setFromCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !fromDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fromDate ? format(fromDate, "dd/MM/yyyy") : t("selectDate", "Select date")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 max-w-[calc(100vw-2rem)]"
                    align="start"
                    side="bottom"
                    sideOffset={4}
                  >
                    <Calendar
                      mode="single"
                      selected={fromDate}
                      onSelect={(date) => {
                        if (date) {
                          setFromDate(date);
                          setFromCalendarOpen(false);
                        }
                      }}
                      disabled={(date) => date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* To Date */}
              <div className="space-y-1">
                <Label className="text-xs text-[#6B6B6B]">{t("export.to", "To")}</Label>
                <Popover open={toCalendarOpen} onOpenChange={setToCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !toDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {toDate ? format(toDate, "dd/MM/yyyy") : t("selectDate", "Select date")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 max-w-[calc(100vw-2rem)]"
                    align="start"
                    side="bottom"
                    sideOffset={4}
                  >
                    <Calendar
                      mode="single"
                      selected={toDate}
                      onSelect={(date) => {
                        if (date) {
                          setToDate(date);
                          setToCalendarOpen(false);
                        }
                      }}
                      disabled={(date) => date > new Date() || date < fromDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Include Options */}
          <div className="space-y-3">
            <Label>{t("export.include", "Include")}</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="summaryStats"
                  checked={includeOptions.summaryStats}
                  onCheckedChange={() => handleIncludeChange("summaryStats")}
                />
                <Label htmlFor="summaryStats" className="font-normal cursor-pointer">
                  {t("export.summaryStats", "Summary statistics")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dailyBreakdown"
                  checked={includeOptions.dailyBreakdown}
                  onCheckedChange={() => handleIncludeChange("dailyBreakdown")}
                />
                <Label htmlFor="dailyBreakdown" className="font-normal cursor-pointer">
                  {t("export.dailyBreakdown", "Daily breakdown")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="lateArrivals"
                  checked={includeOptions.lateArrivals}
                  onCheckedChange={() => handleIncludeChange("lateArrivals")}
                />
                <Label htmlFor="lateArrivals" className="font-normal cursor-pointer">
                  {t("export.lateArrivals", "Late arrivals with times")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="leaveDays"
                  checked={includeOptions.leaveDays}
                  onCheckedChange={() => handleIncludeChange("leaveDays")}
                />
                <Label htmlFor="leaveDays" className="font-normal cursor-pointer">
                  {t("export.leaveDays", "Leave days")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="warnings"
                  checked={includeOptions.warnings}
                  onCheckedChange={() => handleIncludeChange("warnings")}
                />
                <Label htmlFor="warnings" className="font-normal cursor-pointer">
                  {t("export.warnings", "Warnings issued")}
                </Label>
              </div>
            </div>
          </div>

          {/* Preselected Employee Info (for individual mode) */}
          {mode === "individual" && preselectedEmployee && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-[#6B6B6B]">{t("export.exportingFor", "Exporting for")}</p>
              <p className="font-medium text-[#222222]">{preselectedEmployee.name}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={exporting}
            className="w-full sm:w-auto"
          >
            {t("cancel", "Cancel")}
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="w-full sm:w-auto bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))]/90 text-white"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("export.generating", "Generating...")}
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {t("export.generate", "Generate Report")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
