"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Download,
  FileArchive,
  Search,
  Building2,
  Users,
  X,
} from "lucide-react";
import { DocumentExportFilters } from "@/types/document-export";

type Department = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  full_name: string;
  department_id: string | null;
  department?: {
    name: string;
  } | null;
};

type BatchDocumentExportButtonProps = {
  departments?: Department[];
  employees?: Employee[];
};

export function BatchDocumentExportButton({
  departments: propDepartments,
  employees: propEmployees,
}: BatchDocumentExportButtonProps = {}) {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [exportType, setExportType] = useState<"active" | "all">("active");
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(
    new Set()
  );
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(
    new Set()
  );
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Fetch departments and employees if not provided as props
  const [departments, setDepartments] = useState<Department[]>(
    propDepartments || []
  );
  const [employees, setEmployees] = useState<Employee[]>(propEmployees || []);
  const [documentCount, setDocumentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && (!propDepartments || !propEmployees)) {
      fetchData();
    }
  }, [open, propDepartments, propEmployees]);

  useEffect(() => {
    if (open) {
      fetchDocumentCount();
    }
  }, [
    open,
    exportType,
    selectedDepartments,
    selectedEmployees,
    departments,
    employees,
  ]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch departments
      if (!propDepartments) {
        const { data: deptData } = await supabase
          .from("departments")
          .select("id, name")
          .order("name");
        setDepartments(deptData || []);
      }

      // Fetch employees
      if (!propEmployees) {
        const { data: empData } = await supabase
          .from("employees")
          .select("id, full_name, department_id, departments(name)")
          .eq("employment_status", "active")
          .order("full_name");
        setEmployees(empData || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentCount = async () => {
    try {
      let query = supabase
        .from("employee_documents")
        .select("id, employee_id, employees!inner(employment_status, department_id)", {
          count: "exact",
          head: true,
        })
        .eq("employees.employment_status", "active");

      // Apply active/all filter
      if (exportType === "active") {
        query = query.eq("is_active", true);
      }

      // Apply department filter
      if (selectedDepartments.size > 0) {
        query = query.in(
          "employees.department_id",
          Array.from(selectedDepartments)
        );
      }

      // Apply employee filter
      if (selectedEmployees.size > 0) {
        query = query.in("employee_id", Array.from(selectedEmployees));
      }

      const { count } = await query;
      setDocumentCount(count);
    } catch (error) {
      console.error("Error fetching document count:", error);
      setDocumentCount(null);
    }
  };

  const toggleDepartment = (id: string) => {
    const newSet = new Set(selectedDepartments);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedDepartments(newSet);
  };

  const toggleSelectAllDepartments = () => {
    if (selectedDepartments.size === departments.length) {
      setSelectedDepartments(new Set());
    } else {
      setSelectedDepartments(new Set(departments.map((d) => d.id)));
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

  const toggleSelectAllEmployees = () => {
    if (selectedEmployees.size === filteredEmployees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(filteredEmployees.map((e) => e.id)));
    }
  };

  // Filter employees based on search and selected departments
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.full_name
      .toLowerCase()
      .includes(employeeSearch.toLowerCase());
    const matchesDepartment =
      selectedDepartments.size === 0 ||
      (emp.department_id && selectedDepartments.has(emp.department_id));
    return matchesSearch && matchesDepartment;
  });

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(10);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      setExportProgress(20);

      const filters: DocumentExportFilters = {
        includeExpired: exportType === "all",
        departmentIds:
          selectedDepartments.size > 0
            ? Array.from(selectedDepartments)
            : "all",
        employeeIds:
          selectedEmployees.size > 0 ? Array.from(selectedEmployees) : "all",
      };

      setExportProgress(30);

      const response = await fetch("/api/hr/documents/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ filters }),
      });

      setExportProgress(70);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Export failed");
      }

      setExportProgress(90);

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Get filename from response headers or generate one
      const contentDisposition = response.headers.get("content-disposition");
      let filename = "employee_documents.zip";
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

      setExportProgress(100);

      toast({
        title: t("hr:documentExport.success"),
        description: t("hr:documentExport.successDesc"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });

      setOpen(false);
      resetFilters();
    } catch (error) {
      console.error("Export error:", error);
      toast({
        variant: "destructive",
        title: t("hr:documentExport.error"),
        description:
          error instanceof Error
            ? error.message
            : t("hr:documentExport.errorDesc"),
      });
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  const resetFilters = () => {
    setExportType("active");
    setSelectedDepartments(new Set());
    setSelectedEmployees(new Set());
    setEmployeeSearch("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!exporting) {
          setOpen(v);
          if (!v) resetFilters();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="border-[#E6E6E4]">
          <FileArchive className="h-4 w-4 mr-2" />
          {t("hr:documentExport.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}
          >
            <FileArchive className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("hr:documentExport.title")}
          </DialogTitle>
          <DialogDescription className={isRtl ? "text-right" : ""}>
            {t("hr:documentExport.description")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#6B6B6B]" />
          </div>
        ) : (
          <div className="py-4 space-y-6">
            {/* Export Type Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                {t("hr:documentExport.exportType")}
              </Label>
              <RadioGroup
                value={exportType}
                onValueChange={(v) => setExportType(v as "active" | "all")}
                className="space-y-2"
              >
                <div
                  className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-[#FAFAF8] ${
                    exportType === "active"
                      ? "border-[hsl(var(--jw-primary-green))] bg-[#FAFAF8]"
                      : "border-[#E6E6E4]"
                  } ${isRtl ? "flex-row-reverse space-x-reverse" : ""}`}
                  onClick={() => setExportType("active")}
                >
                  <RadioGroupItem value="active" id="export-active" />
                  <div className="flex-1">
                    <Label
                      htmlFor="export-active"
                      className="cursor-pointer font-medium"
                    >
                      {t("hr:documentExport.activeOnly")}
                    </Label>
                    <p className="text-xs text-[#6B6B6B] mt-1">
                      {t("hr:documentExport.activeOnlyDesc")}
                    </p>
                  </div>
                </div>
                <div
                  className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-[#FAFAF8] ${
                    exportType === "all"
                      ? "border-[hsl(var(--jw-primary-green))] bg-[#FAFAF8]"
                      : "border-[#E6E6E4]"
                  } ${isRtl ? "flex-row-reverse space-x-reverse" : ""}`}
                  onClick={() => setExportType("all")}
                >
                  <RadioGroupItem value="all" id="export-all" />
                  <div className="flex-1">
                    <Label
                      htmlFor="export-all"
                      className="cursor-pointer font-medium"
                    >
                      {t("hr:documentExport.allDocuments")}
                    </Label>
                    <p className="text-xs text-[#6B6B6B] mt-1">
                      {t("hr:documentExport.allDocumentsDesc")}
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Department Filter */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {t("hr:documentExport.filterByDepartment")}
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectAllDepartments}
                  className="text-[#6B6B6B] hover:text-[#222222] h-auto py-1"
                >
                  {selectedDepartments.size === departments.length
                    ? t("hr:deselectAll")
                    : t("hr:selectAll")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {departments.map((dept) => (
                  <Badge
                    key={dept.id}
                    variant={
                      selectedDepartments.has(dept.id) ? "default" : "outline"
                    }
                    className={`cursor-pointer transition-colors ${
                      selectedDepartments.has(dept.id)
                        ? "bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))]"
                        : "hover:bg-[#FAFAF8]"
                    }`}
                    onClick={() => toggleDepartment(dept.id)}
                  >
                    {dept.name}
                    {selectedDepartments.has(dept.id) && (
                      <X className="h-3 w-3 ml-1" />
                    )}
                  </Badge>
                ))}
              </div>
              {selectedDepartments.size > 0 && (
                <p className="text-xs text-[#6B6B6B]">
                  {t("hr:documentExport.departmentsSelected", {
                    count: selectedDepartments.size,
                  })}
                </p>
              )}
              {selectedDepartments.size === 0 && (
                <p className="text-xs text-[#6B6B6B]">
                  {t("hr:documentExport.allDepartmentsIncluded")}
                </p>
              )}
            </div>

            {/* Employee Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t("hr:documentExport.filterByEmployee")}
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectAllEmployees}
                  className="text-[#6B6B6B] hover:text-[#222222] h-auto py-1"
                >
                  {selectedEmployees.size === filteredEmployees.length
                    ? t("hr:deselectAll")
                    : t("hr:selectAll")}
                </Button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B6B6B]" />
                <Input
                  placeholder={t("hr:documentExport.searchEmployees")}
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-[180px] border border-[#E6E6E4] rounded-lg p-2">
                {filteredEmployees.length === 0 ? (
                  <p className="text-center text-[#6B6B6B] py-4">
                    {t("hr:documentExport.noEmployeesFound")}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {filteredEmployees.map((employee) => (
                      <div
                        key={employee.id}
                        className={`flex items-center space-x-3 p-2 rounded hover:bg-[#FAFAF8] cursor-pointer ${
                          isRtl ? "flex-row-reverse space-x-reverse" : ""
                        }`}
                        onClick={() => toggleEmployee(employee.id)}
                      >
                        <Checkbox
                          checked={selectedEmployees.has(employee.id)}
                          onCheckedChange={() => toggleEmployee(employee.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[#222222] truncate">
                            {employee.full_name}
                          </p>
                          <p className="text-xs text-[#6B6B6B] truncate">
                            {(employee.department as any)?.name ||
                              t("hr:documentExport.noDepartment")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {selectedEmployees.size > 0 ? (
                <p className="text-xs text-[#6B6B6B]">
                  {t("hr:documentExport.employeesSelected", {
                    count: selectedEmployees.size,
                  })}
                </p>
              ) : (
                <p className="text-xs text-[#6B6B6B]">
                  {t("hr:documentExport.allEmployeesIncluded")}
                </p>
              )}
            </div>

            {/* Document Count Preview */}
            <div className="bg-[#FAFAF8] border border-[#E6E6E4] rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {t("hr:documentExport.documentsToExport")}
                </span>
                <span className="text-lg font-bold text-[hsl(var(--jw-primary-green))]">
                  {documentCount !== null ? documentCount : "..."}
                </span>
              </div>
              {documentCount === 0 && (
                <p className="text-xs text-amber-600 mt-2">
                  {t("hr:documentExport.noDocumentsMatch")}
                </p>
              )}
            </div>

            {/* Export Progress */}
            {exporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{t("hr:documentExport.exporting")}</span>
                  <span>{exportProgress}%</span>
                </div>
                <Progress value={exportProgress} className="h-2" />
              </div>
            )}
          </div>
        )}

        <DialogFooter className={`gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={exporting}
            className="border-[#E6E6E4]"
          >
            {t("hr:cancel")}
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || documentCount === 0 || loading}
            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {exporting
              ? t("hr:documentExport.exporting")
              : t("hr:documentExport.downloadZip")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
