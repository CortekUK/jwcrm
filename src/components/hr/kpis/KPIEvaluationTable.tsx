"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { monthOptions, getYearOptions, getCurrentMonth, getCurrentYear } from "@/lib/kpi-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { Search, Target, ClipboardCheck, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { BulkDownloadKPIReportsButton } from "./BulkDownloadKPIReportsButton";

type Employee = {
  id: string;
  full_name: string;
  job_role?: {
    id: string;
    name: string;
  } | null;
};

type EvaluationSummary = {
  employee_id: string;
  employee_name: string;
  job_role_name: string | null;
  total_kpis: number;
  completed_kpis: number;
  overall_score: number | null;
};

type KPIEvaluationTableProps = {
  employees: Employee[];
  evaluationSummaries: EvaluationSummary[];
  selectedYear: number;
  selectedMonth: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onEvaluate: (employeeId: string) => void;
};

export function KPIEvaluationTable({
  employees,
  evaluationSummaries,
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
  onEvaluate,
}: KPIEvaluationTableProps) {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [jobRoleFilter, setJobRoleFilter] = useState<string>("all");
  
  // Sorting state
  type SortColumn = "name" | "job_role" | "status" | "score";
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 text-[#999999]" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 text-[#C6A03B]" /> 
      : <ArrowDown className="h-4 w-4 text-[#C6A03B]" />;
  };

  const yearOptions = getYearOptions();
  
  // Get unique job roles for filter
  const uniqueJobRoles = Array.from(
    new Map(
      employees
        .filter(emp => emp.job_role?.id && emp.job_role?.name)
        .map(emp => [emp.job_role!.id, emp.job_role!.name])
    )
  ).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  // Color palette for job role badges
  const roleColorPalette = [
    { bg: "bg-[rgba(12,85,54,0.1)]", text: "text-[#0C5536]" },       // Green
    { bg: "bg-[rgba(139,92,246,0.1)]", text: "text-[#7C3AED]" },     // Purple
    { bg: "bg-[rgba(20,184,166,0.1)]", text: "text-[#0D9488]" },     // Teal
    { bg: "bg-[rgba(234,179,8,0.1)]", text: "text-[#CA8A04]" },      // Yellow
    { bg: "bg-[rgba(59,130,246,0.1)]", text: "text-[#2563EB]" },     // Blue
    { bg: "bg-[rgba(245,158,11,0.1)]", text: "text-[#D97706]" },     // Orange
    { bg: "bg-[rgba(236,72,153,0.1)]", text: "text-[#DB2777]" },     // Pink
    { bg: "bg-[rgba(99,102,241,0.1)]", text: "text-[#4F46E5]" },     // Indigo
  ];

  // Get consistent color for a job role based on its ID
  const getJobRoleColor = (roleId: string) => {
    if (!roleId) return { bg: "bg-[#F5F5F5]", text: "text-[#6B6B6B]" };
    let hash = 0;
    for (let i = 0; i < roleId.length; i++) {
      hash = roleId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % roleColorPalette.length;
    return roleColorPalette[index];
  };

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Job role filter
    if (jobRoleFilter !== "all" && emp.job_role?.id !== jobRoleFilter) {
      return false;
    }

    if (statusFilter === "all") return matchesSearch;

    const summary = evaluationSummaries.find((s) => s.employee_id === emp.id);
    if (statusFilter === "completed") {
      return matchesSearch && summary && summary.completed_kpis === summary.total_kpis && summary.total_kpis > 0;
    }
    if (statusFilter === "pending") {
      return matchesSearch && (!summary || summary.completed_kpis < summary.total_kpis);
    }
    return matchesSearch;
  });

  // Sort employees
  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    let comparison = 0;
    const summaryA = evaluationSummaries.find((s) => s.employee_id === a.id);
    const summaryB = evaluationSummaries.find((s) => s.employee_id === b.id);
    
    switch (sortColumn) {
      case "name":
        comparison = a.full_name.localeCompare(b.full_name);
        break;
      case "job_role":
        comparison = (a.job_role?.name || "").localeCompare(b.job_role?.name || "");
        break;
      case "status":
        // Sort by completion percentage
        const completionA = summaryA && summaryA.total_kpis > 0 
          ? summaryA.completed_kpis / summaryA.total_kpis 
          : 0;
        const completionB = summaryB && summaryB.total_kpis > 0 
          ? summaryB.completed_kpis / summaryB.total_kpis 
          : 0;
        comparison = completionA - completionB;
        break;
      case "score":
        const scoreA = summaryA?.overall_score ?? -1;
        const scoreB = summaryB?.overall_score ?? -1;
        comparison = scoreA - scoreB;
        break;
    }
    
    return sortDirection === "asc" ? comparison : -comparison;
  });

  // Check if any filters are active
  const hasActiveFilters = searchQuery || statusFilter !== "all" || jobRoleFilter !== "all";

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setJobRoleFilter("all");
  };

  const getStatusBadge = (summary: EvaluationSummary | undefined) => {
    if (!summary || summary.total_kpis === 0) {
      return (
        <Badge variant="outline" className="border-gray-300 text-gray-500">
          -
        </Badge>
      );
    }

    if (summary.completed_kpis === summary.total_kpis) {
      return (
        <Badge className="bg-[#E6F7F1] text-[#0C5536]">
          {t("hr:completed")}
        </Badge>
      );
    }

    return (
      <Badge className="bg-[#FFF9E6] text-[#C6A03B]">
        {summary.completed_kpis}/{summary.total_kpis}
      </Badge>
    );
  };

  const getScoreBadge = (score: number | null) => {
    if (score === null) return "-";

    const className = score >= 80
      ? "bg-[#E6F7F1] text-[#0C5536]"
      : score >= 60
      ? "bg-[#FFF9E6] text-[#C6A03B]"
      : "bg-red-50 text-red-600";

    return <Badge className={className}>{score}%</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className={`flex flex-col md:flex-row gap-4 justify-between ${isRtl ? "md:flex-row-reverse" : ""}`}>
        <div className={`flex flex-col sm:flex-row gap-2 flex-1 ${isRtl ? "sm:flex-row-reverse" : ""}`}>
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-[#C6A03B] ${isRtl ? "right-3" : "left-3"}`} />
            <Input
              placeholder={t("hr:searchEmployees")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B] ${isRtl ? "pr-10" : "pl-10"}`}
            />
          </div>

          {/* Year */}
          <Select value={String(selectedYear)} onValueChange={(v) => onYearChange(Number(v))}>
            <SelectTrigger className="border-[#E6E6E4] w-full sm:w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year.value} value={String(year.value)}>
                  {year.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Month */}
          <Select value={String(selectedMonth)} onValueChange={(v) => onMonthChange(Number(v))}>
            <SelectTrigger className="border-[#E6E6E4] w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((month) => (
                <SelectItem key={month.value} value={String(month.value)}>
                  {t(`hr:month.${month.label.toLowerCase()}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Job Role Filter */}
          <Select value={jobRoleFilter} onValueChange={setJobRoleFilter}>
            <SelectTrigger className="border-[#E6E6E4] w-full sm:w-[160px]">
              <SelectValue placeholder={t("hr:allJobRoles")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("hr:allJobRoles")}</SelectItem>
              {uniqueJobRoles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="border-[#E6E6E4] w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("hr:allStatuses", "All Statuses")}</SelectItem>
              <SelectItem value="pending">{t("hr:pending")}</SelectItem>
              <SelectItem value="completed">{t("hr:completed")}</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-[#777777] hover:text-[#222222]"
            >
              <X className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
              {t("hr:clearFilters", "Clear")}
            </Button>
          )}
        </div>

        {/* Bulk Download Button */}
        <BulkDownloadKPIReportsButton
          employees={employees}
          year={selectedYear}
          month={selectedMonth}
        />
      </div>

      {/* Table */}
      <div className="border border-[#E6E6E4] rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#FAFAF8] hover:bg-[#FAFAF8]">
              <TableHead 
                className="font-semibold text-[#222222] cursor-pointer hover:bg-[#F0F0EE] transition-colors"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1">
                  {t("hr:employeeName")}
                  {getSortIcon("name")}
                </div>
              </TableHead>
              <TableHead 
                className="font-semibold text-[#222222] cursor-pointer hover:bg-[#F0F0EE] transition-colors"
                onClick={() => handleSort("job_role")}
              >
                <div className="flex items-center gap-1">
                  {t("hr:jobRole")}
                  {getSortIcon("job_role")}
                </div>
              </TableHead>
              <TableHead 
                className="font-semibold text-[#222222] text-center cursor-pointer hover:bg-[#F0F0EE] transition-colors"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center justify-center gap-1">
                  {t("hr:evaluationStatus")}
                  {getSortIcon("status")}
                </div>
              </TableHead>
              <TableHead 
                className="font-semibold text-[#222222] text-center cursor-pointer hover:bg-[#F0F0EE] transition-colors"
                onClick={() => handleSort("score")}
              >
                <div className="flex items-center justify-center gap-1">
                  {t("hr:overallScore")}
                  {getSortIcon("score")}
                </div>
              </TableHead>
              <TableHead className={`font-semibold text-[#222222] ${isRtl ? "text-left" : "text-right"}`}>{t("hr:actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <ClipboardCheck className="h-10 w-10 text-[#C6A03B] mx-auto mb-3" />
                  <p className="text-[#6B6B6B]">{t("hr:noEvaluations")}</p>
                  {hasActiveFilters && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-[#C6A03B] mt-2"
                    >
                      {t("hr:clearFiltersToSeeAll", "Clear filters to see all employees")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              sortedEmployees.map((employee) => {
                const summary = evaluationSummaries.find(
                  (s) => s.employee_id === employee.id
                );
                const roleColor = employee.job_role?.id 
                  ? getJobRoleColor(employee.job_role.id) 
                  : null;

                return (
                  <TableRow key={employee.id} className="hover:bg-[#FAFAF8]">
                    <TableCell>
                      <p className="font-medium text-[#222222]">
                        {employee.full_name}
                      </p>
                    </TableCell>
                    <TableCell>
                      {employee.job_role ? (
                        <Badge className={`${roleColor?.bg} ${roleColor?.text} border-0`}>
                          {employee.job_role.name}
                        </Badge>
                      ) : (
                        <span className="text-[#999999] text-sm italic">{t("hr:noJobRole")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(summary)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getScoreBadge(summary?.overall_score ?? null)}
                    </TableCell>
                    <TableCell className={isRtl ? "text-left" : "text-right"}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEvaluate(employee.id)}
                        disabled={!employee.job_role?.id}
                        className="border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
                      >
                        <ClipboardCheck className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
                        {t("hr:evaluate")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Results Count */}
      <div className="text-sm text-[#6B6B6B]">
        {t("hr:showingResults", {
          count: sortedEmployees.length,
          total: employees.length,
        })}
      </div>
    </div>
  );
}
