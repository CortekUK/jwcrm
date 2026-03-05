"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Users,
  Target,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCurrentMonth, getCurrentYear } from "@/lib/kpi-validation";

export interface DepartmentSummary {
  department_id: string;
  department_name: string;
  total_employees: number;
  employees_with_kpis: number;
  total_kpis: number;
  completed_evaluations: number;
  pending_evaluations: number;
  average_score: number | null;
  completion_rate: number;
  job_roles: JobRoleSummary[];
}

export interface JobRoleSummary {
  job_role_id: string;
  job_role_name: string;
  employee_count: number;
  kpi_count: number;
  completed_evaluations: number;
  pending_evaluations: number;
  average_score: number | null;
  completion_rate: number;
  employees: EmployeeSummary[];
}

export interface EmployeeSummary {
  employee_id: string;
  employee_name: string;
  completed_kpis: number;
  total_kpis: number;
  overall_score: number | null;
}

interface DepartmentKPISummaryProps {
  departmentSummaries: DepartmentSummary[];
  selectedYear: number;
  selectedMonth: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onEmployeeClick?: (employeeId: string) => void;
}

export function DepartmentKPISummary({
  departmentSummaries,
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
  onEmployeeClick,
}: DepartmentKPISummaryProps) {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

  const toggleDepartment = (deptId: string) => {
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(deptId)) {
      newExpanded.delete(deptId);
    } else {
      newExpanded.add(deptId);
    }
    setExpandedDepartments(newExpanded);
  };

  const toggleRole = (roleId: string) => {
    const newExpanded = new Set(expandedRoles);
    if (newExpanded.has(roleId)) {
      newExpanded.delete(roleId);
    } else {
      newExpanded.add(roleId);
    }
    setExpandedRoles(newExpanded);
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-[#999999]";
    if (score >= 80) return "text-[#0C5536]";
    if (score >= 60) return "text-[#C6A03B]";
    return "text-[#C0392B]";
  };

  const getScoreBgColor = (score: number | null) => {
    if (score === null) return "bg-[#F5F5F5] border-[#E6E6E4]";
    if (score >= 80) return "bg-[#E6F7F1] border-[#0C5536]/20";
    if (score >= 60) return "bg-[#FFF9E6] border-[#C6A03B]/20";
    return "bg-[#FDF2F2] border-[#C0392B]/20";
  };

  const getCompletionColor = (rate: number) => {
    if (rate >= 100) return "bg-[#0C5536]";
    if (rate >= 75) return "bg-[#C6A03B]";
    if (rate >= 50) return "bg-[#D97706]";
    return "bg-[#C0392B]";
  };

  const months = [
    { value: 1, label: t("hr:month.january") },
    { value: 2, label: t("hr:month.february") },
    { value: 3, label: t("hr:month.march") },
    { value: 4, label: t("hr:month.april") },
    { value: 5, label: t("hr:month.may") },
    { value: 6, label: t("hr:month.june") },
    { value: 7, label: t("hr:month.july") },
    { value: 8, label: t("hr:month.august") },
    { value: 9, label: t("hr:month.september") },
    { value: 10, label: t("hr:month.october") },
    { value: 11, label: t("hr:month.november") },
    { value: 12, label: t("hr:month.december") },
  ];

  const years = Array.from({ length: 5 }, (_, i) => getCurrentYear() - 2 + i);

  // Calculate overall stats
  const totalEmployees = departmentSummaries.reduce((sum, d) => sum + d.employees_with_kpis, 0);
  const totalCompleted = departmentSummaries.reduce((sum, d) => sum + d.completed_evaluations, 0);
  const totalPending = departmentSummaries.reduce((sum, d) => sum + d.pending_evaluations, 0);
  const overallCompletionRate = totalEmployees > 0
    ? Math.round((totalCompleted / (totalCompleted + totalPending)) * 100) || 0
    : 0;
  const avgScores = departmentSummaries.filter(d => d.average_score !== null).map(d => d.average_score!);
  const overallAvgScore = avgScores.length > 0
    ? Math.round(avgScores.reduce((a, b) => a + b, 0) / avgScores.length * 10) / 10
    : null;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className={`flex flex-wrap gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
        <Select
          value={selectedMonth.toString()}
          onValueChange={(val) => onMonthChange(parseInt(val))}
        >
          <SelectTrigger className="w-[160px] border-[#E6E6E4]">
            <SelectValue placeholder={t("hr:selectMonth")} />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month.value} value={month.value.toString()}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedYear.toString()}
          onValueChange={(val) => onYearChange(parseInt(val))}
        >
          <SelectTrigger className="w-[120px] border-[#E6E6E4]">
            <SelectValue placeholder={t("hr:selectYear")} />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Overall Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6B6B6B]">{t("hr:departmentSummary.totalDepartments")}</p>
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                <Building2 className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#222222] mt-2">{departmentSummaries.length}</p>
          </CardContent>
        </Card>

        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6B6B6B]">{t("hr:departmentSummary.employeesWithKPIs")}</p>
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                <Users className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#222222] mt-2">{totalEmployees}</p>
          </CardContent>
        </Card>

        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6B6B6B]">{t("hr:departmentSummary.completionRate")}</p>
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#222222] mt-2">{overallCompletionRate}%</p>
            <Progress value={overallCompletionRate} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6B6B6B]">{t("hr:departmentSummary.averageScore")}</p>
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                <Target className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
            <p className={`text-2xl font-bold mt-2 ${getScoreColor(overallAvgScore)}`}>
              {overallAvgScore !== null ? `${overallAvgScore}%` : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Department Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#E6E6E4]">
          <Building2 className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
          <h3 className="text-lg font-semibold text-[hsl(var(--jw-primary-green))]">
            {t("hr:departmentSummary.departmentBreakdown")}
          </h3>
        </div>

        {departmentSummaries.length === 0 ? (
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-12 text-center">
              <Building2 className="h-10 w-10 mx-auto text-[#C6A03B] mb-3" />
              <p className="text-[#6B6B6B]">{t("hr:departmentSummary.noDepartments")}</p>
            </CardContent>
          </Card>
        ) : (
          departmentSummaries.map((dept) => (
            <Collapsible
              key={dept.department_id}
              open={expandedDepartments.has(dept.department_id)}
              onOpenChange={() => toggleDepartment(dept.department_id)}
            >
              <Card className={`border-[#E6E6E4] transition-all ${expandedDepartments.has(dept.department_id) ? "ring-1 ring-[hsl(var(--jw-gold-accent))]" : ""}`}>
                <CollapsibleTrigger asChild>
                  <CardContent className="p-4 cursor-pointer hover:bg-[#FAFAF8] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedDepartments.has(dept.department_id) ? (
                          <ChevronDown className="h-5 w-5 text-[#6B6B6B]" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-[#6B6B6B]" />
                        )}
                        <Building2 className="h-5 w-5 text-[hsl(var(--jw-primary-green))]" />
                        <div>
                          <h4 className="font-semibold text-[#222222]">{dept.department_name}</h4>
                          <p className="text-xs text-[#6B6B6B]">
                            {dept.employees_with_kpis} {t("hr:departmentSummary.employees")} • {dept.job_roles.length} {t("hr:departmentSummary.roles")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Completion Badge */}
                        <div className="flex items-center gap-2">
                          {dept.pending_evaluations > 0 ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                              <Clock className="h-3 w-3 mr-1" />
                              {dept.pending_evaluations} {t("hr:pending")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {t("hr:completed")}
                            </Badge>
                          )}
                        </div>

                        {/* Score Badge with Mini Visual Bar */}
                        <div className={`px-3 py-1.5 rounded-md border ${getScoreBgColor(dept.average_score)} min-w-[80px]`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold ${getScoreColor(dept.average_score)}`}>
                              {dept.average_score !== null ? `${dept.average_score}%` : "-"}
                            </span>
                            {dept.average_score !== null && (
                              <div className="flex gap-0.5">
                                {[20, 40, 60, 80, 100].map((threshold) => (
                                  <div
                                    key={threshold}
                                    className={`w-1 h-3 rounded-sm ${
                                      dept.average_score! >= threshold
                                        ? threshold <= 40
                                          ? "bg-red-400"
                                          : threshold <= 60
                                          ? "bg-amber-400"
                                          : threshold <= 80
                                          ? "bg-yellow-400"
                                          : "bg-green-500"
                                        : "bg-gray-200"
                                    }`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="w-28 hidden md:block">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[#6B6B6B]">{t("hr:departmentSummary.progress")}</span>
                            <span className="font-medium text-[#222222]">{dept.completion_rate}%</span>
                          </div>
                          <div className="h-2 bg-[#E6E6E4] rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${getCompletionColor(dept.completion_rate)}`}
                              style={{ width: `${dept.completion_rate}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t border-[#E6E6E4] px-4 py-3 bg-[#FAFAF8]">
                    {/* Job Roles within Department */}
                    <div className="space-y-3">
                      {dept.job_roles.map((role) => (
                        <Collapsible
                          key={role.job_role_id}
                          open={expandedRoles.has(role.job_role_id)}
                          onOpenChange={() => toggleRole(role.job_role_id)}
                        >
                          <div className={`rounded-lg border bg-white ${expandedRoles.has(role.job_role_id) ? "border-[hsl(var(--jw-gold-accent))]" : "border-[#E6E6E4]"}`}>
                            <CollapsibleTrigger asChild>
                              <div className="p-3 cursor-pointer hover:bg-gray-50 transition-colors">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {expandedRoles.has(role.job_role_id) ? (
                                      <ChevronDown className="h-4 w-4 text-[#6B6B6B]" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-[#6B6B6B]" />
                                    )}
                                    <Target className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
                                    <span className="font-medium text-sm text-[#222222]">{role.job_role_name}</span>
                                    <span className="text-xs text-[#6B6B6B]">
                                      ({role.employee_count} {t("hr:departmentSummary.employees")})
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-[#6B6B6B]">
                                      {role.completed_evaluations}/{role.completed_evaluations + role.pending_evaluations} {t("hr:completed")}
                                    </span>
                                    <span className={`text-sm font-semibold ${getScoreColor(role.average_score)}`}>
                                      {role.average_score !== null ? `${role.average_score}%` : "-"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <div className="border-t border-[#E6E6E4] p-3 bg-gray-50">
                                <div className="space-y-2">
                                  {role.employees.map((emp) => (
                                    <div
                                      key={emp.employee_id}
                                      className="flex items-center justify-between p-2 bg-white rounded border border-[#E6E6E4] hover:border-[hsl(var(--jw-gold-accent))] cursor-pointer transition-colors"
                                      onClick={() => onEmployeeClick?.(emp.employee_id)}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-[hsl(var(--jw-primary-green))]/10 flex items-center justify-center">
                                          <span className="text-xs font-semibold text-[hsl(var(--jw-primary-green))]">
                                            {(emp.employee_name || "?").split(" ").map(n => n[0]).join("").slice(0, 2)}
                                          </span>
                                        </div>
                                        <span className="text-sm text-[#222222]">{emp.employee_name}</span>
                                      </div>

                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1">
                                          {emp.completed_kpis < emp.total_kpis ? (
                                            <AlertCircle className="h-3 w-3 text-amber-500" />
                                          ) : (
                                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                                          )}
                                          <span className="text-xs text-[#6B6B6B]">
                                            {emp.completed_kpis}/{emp.total_kpis}
                                          </span>
                                        </div>
                                        <span className={`text-sm font-semibold ${getScoreColor(emp.overall_score)}`}>
                                          {emp.overall_score !== null ? `${emp.overall_score}%` : "-"}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))
        )}
      </div>
    </div>
  );
}
