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
import { Search, Target, ClipboardCheck } from "lucide-react";
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

  const yearOptions = getYearOptions();

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.full_name.toLowerCase().includes(searchQuery.toLowerCase());

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
            <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B6B6B] ${isRtl ? "right-3" : "left-3"}`} />
            <Input
              placeholder={t("hr:filterByEmployee")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`border-[#E6E6E4] ${isRtl ? "pr-10" : "pl-10"}`}
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

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="border-[#E6E6E4] w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("hr:allEmployees")}</SelectItem>
              <SelectItem value="pending">{t("hr:pending")}</SelectItem>
              <SelectItem value="completed">{t("hr:completed")}</SelectItem>
            </SelectContent>
          </Select>
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
            <TableRow className="bg-[#FAFAF8]">
              <TableHead>{t("hr:name")}</TableHead>
              <TableHead>{t("hr:jobRoles")}</TableHead>
              <TableHead className="text-center">{t("hr:status")}</TableHead>
              <TableHead className="text-center">{t("hr:overallScore")}</TableHead>
              <TableHead className={isRtl ? "text-left" : "text-right"}>{t("hr:actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Target className="h-12 w-12 text-[#E6E6E4] mx-auto mb-2" />
                  <p className="text-[#6B6B6B]">{t("hr:noEvaluations")}</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((employee) => {
                const summary = evaluationSummaries.find(
                  (s) => s.employee_id === employee.id
                );

                return (
                  <TableRow key={employee.id} className="hover:bg-[#FAFAF8]">
                    <TableCell>
                      <p className="font-medium text-[#222222]">
                        {employee.full_name}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="text-[#6B6B6B]">
                        {employee.job_role?.name || t("hr:noJobRole")}
                      </span>
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
                        className="border-[#E6E6E4]"
                      >
                        <ClipboardCheck className="h-4 w-4 mr-1" />
                        {t("hr:evaluateKPIs")}
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
          count: filteredEmployees.length,
          total: employees.length,
        })}
      </div>
    </div>
  );
}
