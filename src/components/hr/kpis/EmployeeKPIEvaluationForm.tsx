"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { calculateScore, monthOptions, getYearOptions, getCurrentMonth, getCurrentYear } from "@/lib/kpi-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { kpiUnitSuggestions } from "@/lib/kpi-validation";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Target, AlertCircle, CheckCircle2, Plus, Trash2, UserCircle2 } from "lucide-react";

type KPI = {
  id: string;
  name: string;
  description: string | null;
  target_value: number;
  unit: string;
  weighting: number;
  employee_id: string | null;
};

type Evaluation = {
  id?: string;
  kpi_id: string;
  achieved_value: number | null;
  score: number | null;
  notes: string | null;
  status: string | null;
};

type Employee = {
  id: string;
  full_name: string;
  job_role_id: string | null;
  job_role?: {
    id: string;
    name: string;
  } | null;
};

type EmployeeKPIEvaluationFormProps = {
  employee: Employee;
  initialYear?: number;
  initialMonth?: number;
  onPeriodChange?: (year: number, month: number) => void;
  onSuccess?: () => void;
};

export function EmployeeKPIEvaluationForm({
  employee,
  initialYear,
  initialMonth,
  onPeriodChange,
  onSuccess,
}: EmployeeKPIEvaluationFormProps) {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();
  const { user } = useAuth();

  const [selectedYear, setSelectedYear] = useState(initialYear ?? getCurrentYear());
  const [selectedMonth, setSelectedMonth] = useState(initialMonth ?? getCurrentMonth());
  const [allKpis, setAllKpis] = useState<KPI[]>([]); // Role + personal KPIs
  const [assignedKpiIds, setAssignedKpiIds] = useState<Set<string>>(new Set()); // KPIs assigned to this employee
  const [evaluations, setEvaluations] = useState<Record<string, Evaluation>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [showPersonalDialog, setShowPersonalDialog] = useState(false);
  const [personalForm, setPersonalForm] = useState({
    name: "",
    description: "",
    target_value: "",
    unit: "marks",
    weighting: "",
  });
  const [creatingPersonal, setCreatingPersonal] = useState(false);
  const [deletingPersonalId, setDeletingPersonalId] = useState<string | null>(null);

  const yearOptions = getYearOptions();

  // Fetch KPIs and existing assignments
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch role KPIs (if employee has a role) + personal KPIs for this employee.
        // Personal KPIs always show even when there's no job role.
        const filters: string[] = [];
        if (employee.job_role_id) {
          filters.push(`job_role_id.eq.${employee.job_role_id}`);
        }
        filters.push(`employee_id.eq.${employee.id}`);

        const { data: kpiData, error: kpiError } = await supabase
          .from("kpis")
          .select("id, name, description, target_value, unit, weighting, employee_id")
          .or(filters.join(","))
          .eq("is_archived", false)
          .order("name");

        if (kpiError) throw kpiError;
        setAllKpis(kpiData || []);

        // Fetch existing evaluations for this employee/year/month
        const { data: evalData, error: evalError } = await supabase
          .from("kpi_evaluations")
          .select("id, kpi_id, achieved_value, score, notes, status")
          .eq("employee_id", employee.id)
          .eq("year", selectedYear)
          .eq("month", selectedMonth);

        if (evalError) throw evalError;

        // Map evaluations by kpi_id and track assigned KPIs
        const evalMap: Record<string, Evaluation> = {};
        const assigned = new Set<string>();

        (evalData || []).forEach((evaluation) => {
          evalMap[evaluation.kpi_id] = evaluation;
          assigned.add(evaluation.kpi_id);
        });

        setEvaluations(evalMap);
        setAssignedKpiIds(assigned);
      } catch (error) {
        console.error("Error fetching KPIs:", error);
        toast({
          variant: "destructive",
          description: "Error fetching KPIs",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [employee.id, employee.job_role_id, selectedYear, selectedMonth, toast]);

  // Assign a KPI to the employee
  const handleAssignKpi = async (kpiId: string) => {
    setAssigning(kpiId);
    try {
      const { data, error } = await supabase
        .from("kpi_evaluations")
        .insert({
          employee_id: employee.id,
          kpi_id: kpiId,
          year: selectedYear,
          month: selectedMonth,
          status: "pending",
          achieved_value: null,
          score: null,
          notes: null,
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setAssignedKpiIds((prev) => new Set([...prev, kpiId]));
      setEvaluations((prev) => ({
        ...prev,
        [kpiId]: {
          id: data.id,
          kpi_id: kpiId,
          achieved_value: null,
          score: null,
          notes: null,
          status: "pending",
        },
      }));

      toast({
        description: t("hr:kpiAssigned"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
    } catch (error) {
      console.error("Error assigning KPI:", error);
      toast({
        variant: "destructive",
        description: "Error assigning KPI",
      });
    } finally {
      setAssigning(null);
    }
  };

  // Unassign a KPI from the employee
  const handleUnassignKpi = async (kpiId: string) => {
    const evaluation = evaluations[kpiId];

    // Don't allow unassigning if there's already data entered
    if (evaluation?.achieved_value !== null) {
      toast({
        variant: "destructive",
        description: t("hr:cannotUnassignWithData"),
      });
      return;
    }

    setAssigning(kpiId);
    try {
      if (evaluation?.id) {
        const { error } = await supabase
          .from("kpi_evaluations")
          .delete()
          .eq("id", evaluation.id);

        if (error) throw error;
      }

      // Update local state
      setAssignedKpiIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(kpiId);
        return newSet;
      });
      setEvaluations((prev) => {
        const newEvals = { ...prev };
        delete newEvals[kpiId];
        return newEvals;
      });

      toast({
        description: t("hr:kpiUnassigned"),
      });
    } catch (error) {
      console.error("Error unassigning KPI:", error);
      toast({
        variant: "destructive",
        description: "Error unassigning KPI",
      });
    } finally {
      setAssigning(null);
    }
  };

  const handleAchievedValueChange = (kpiId: string, value: string) => {
    const kpi = allKpis.find((k) => k.id === kpiId);
    if (!kpi) return;

    const achievedValue = value === "" ? null : Number(value);
    const score = achievedValue !== null ? calculateScore(achievedValue, kpi.target_value) : null;

    setEvaluations((prev) => ({
      ...prev,
      [kpiId]: {
        ...prev[kpiId],
        achieved_value: achievedValue,
        score,
        status: achievedValue !== null ? "completed" : "pending",
      },
    }));
  };

  const handleNotesChange = (kpiId: string, notes: string) => {
    setEvaluations((prev) => ({
      ...prev,
      [kpiId]: {
        ...prev[kpiId],
        notes: notes || null,
      },
    }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      for (const kpiId of assignedKpiIds) {
        const evaluation = evaluations[kpiId];
        if (!evaluation) continue;

        const evalData = {
          achieved_value: evaluation.achieved_value,
          score: evaluation.score,
          notes: evaluation.notes,
          status: evaluation.status,
          evaluated_by: user?.id,
          evaluated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (evaluation.id) {
          const { error } = await supabase
            .from("kpi_evaluations")
            .update(evalData)
            .eq("id", evaluation.id);
          if (error) throw error;
        }
      }

      toast({
        title: t("hr:allEvaluationsSaved"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
      onSuccess?.();
    } catch (error) {
      console.error("Error saving evaluations:", error);
      toast({
        variant: "destructive",
        description:
          error instanceof Error ? error.message : "Error saving evaluations",
      });
    } finally {
      setSaving(false);
    }
  };

  // Create a personal KPI for this employee.
  const handleCreatePersonalKpi = async () => {
    const name = personalForm.name.trim();
    const target = Number(personalForm.target_value);
    const weighting = Number(personalForm.weighting);
    if (!name || !Number.isFinite(target) || target <= 0 || !Number.isFinite(weighting) || weighting < 0) {
      toast({ variant: "destructive", description: t("hr:invalidInput") });
      return;
    }
    setCreatingPersonal(true);
    try {
      const { data, error } = await supabase
        .from("kpis")
        .insert({
          job_role_id: null,
          employee_id: employee.id,
          name,
          description: personalForm.description.trim() || null,
          target_value: target,
          unit: personalForm.unit || "marks",
          weighting,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .select("id, name, description, target_value, unit, weighting, employee_id")
        .single();
      if (error) throw error;

      setAllKpis((prev) => [...prev, data as KPI].sort((a, b) => a.name.localeCompare(b.name)));
      setShowPersonalDialog(false);
      setPersonalForm({ name: "", description: "", target_value: "", unit: "marks", weighting: "" });
      toast({
        description: t("hr:personalKpiCreated"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
    } catch (error) {
      console.error("Error creating personal KPI:", error);
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Error creating personal KPI",
      });
    } finally {
      setCreatingPersonal(false);
    }
  };

  // Delete a personal KPI (only allowed when no evaluation data exists).
  const handleDeletePersonalKpi = async (kpiId: string) => {
    const evaluation = evaluations[kpiId];
    if (evaluation?.achieved_value !== null && evaluation?.achieved_value !== undefined) {
      toast({ variant: "destructive", description: t("hr:cannotDeleteWithData") });
      return;
    }
    setDeletingPersonalId(kpiId);
    try {
      if (evaluation?.id) {
        await supabase.from("kpi_evaluations").delete().eq("id", evaluation.id);
      }
      const { error } = await supabase.from("kpis").delete().eq("id", kpiId);
      if (error) throw error;

      setAllKpis((prev) => prev.filter((k) => k.id !== kpiId));
      setAssignedKpiIds((prev) => {
        const next = new Set(prev);
        next.delete(kpiId);
        return next;
      });
      setEvaluations((prev) => {
        const next = { ...prev };
        delete next[kpiId];
        return next;
      });
      toast({ description: t("hr:personalKpiDeleted") });
    } catch (error) {
      console.error("Error deleting personal KPI:", error);
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Error deleting personal KPI",
      });
    } finally {
      setDeletingPersonalId(null);
    }
  };

  // Calculate overall weighted score (only for assigned KPIs)
  const calculateOverallScore = () => {
    let totalWeightedScore = 0;
    let totalWeighting = 0;

    assignedKpiIds.forEach((kpiId) => {
      const kpi = allKpis.find((k) => k.id === kpiId);
      const evaluation = evaluations[kpiId];
      if (kpi && evaluation && evaluation.score != null) {
        totalWeightedScore += (evaluation.score * kpi.weighting) / 100;
        totalWeighting += kpi.weighting;
      }
    });

    return totalWeighting > 0 ? Math.round(totalWeightedScore * 100) / 100 : null;
  };

  const overallScore = calculateOverallScore();
  const assignedKpis = allKpis.filter((kpi) => assignedKpiIds.has(kpi.id));
  const unassignedKpis = allKpis.filter((kpi) => !assignedKpiIds.has(kpi.id));
  const completedCount = Object.values(evaluations).filter((e) => e.status === "completed").length;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="h-10 w-32 bg-gray-100 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-100 rounded animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selection */}
      <div className={`flex flex-wrap gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
        <div className="space-y-1">
          <Label>{t("hr:selectYear")}</Label>
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => {
              const newYear = Number(v);
              setSelectedYear(newYear);
              onPeriodChange?.(newYear, selectedMonth);
            }}
          >
            <SelectTrigger className="w-[140px] border-[#E6E6E4]">
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
        </div>

        <div className="space-y-1">
          <Label>{t("hr:selectMonth")}</Label>
          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => {
              const newMonth = Number(v);
              setSelectedMonth(newMonth);
              onPeriodChange?.(selectedYear, newMonth);
            }}
          >
            <SelectTrigger className="w-[160px] border-[#E6E6E4]">
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
        </div>

        {/* Progress & Overall Score */}
        <div className="flex-1 flex items-end justify-end gap-4">
          {assignedKpis.length > 0 && (
            <div className="text-sm text-[#6B6B6B]">
              {completedCount}/{assignedKpis.length} {t("hr:completed")}
            </div>
          )}
          {overallScore !== null && (
            <Badge className={`text-lg px-4 py-1 ${
              overallScore >= 80
                ? "bg-[#E6F7F1] text-[#0C5536]"
                : overallScore >= 60
                ? "bg-[#FFF9E6] text-[#C6A03B]"
                : "bg-red-50 text-red-600"
            }`}>
              {t("hr:overallScore")}: {overallScore}%
            </Badge>
          )}
        </div>
      </div>

      {/* KPI Role Info + Add Personal KPI */}
      <div className={`flex items-center justify-between gap-3 p-3 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4] ${isRtl ? "flex-row-reverse" : ""}`}>
        <p className="text-sm text-[#6B6B6B]">
          {employee.job_role?.name
            ? t("hr:kpisForRole", { role: employee.job_role.name })
            : t("hr:employeeHasNoJobRole")}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowPersonalDialog(true)}
          className="border-[hsl(var(--jw-primary-green))] text-[hsl(var(--jw-primary-green))]"
        >
          <UserCircle2 className="h-4 w-4 mr-1" />
          {t("hr:addPersonalKpi")}
        </Button>
      </div>

      {/* No KPIs for role */}
      {allKpis.length === 0 ? (
        <div className="p-6 text-center">
          <Target className="h-12 w-12 text-[#E6E6E4] mx-auto mb-4" />
          <p className="text-[#6B6B6B]">{t("hr:noKPIsForRole")}</p>
        </div>
      ) : (
        <>
          {/* Assigned KPIs Section */}
          {assignedKpis.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-[#222222] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#0C5536]" />
                {t("hr:assignedKPIs")} ({assignedKpis.length})
              </h3>

              {assignedKpis.map((kpi) => {
                const evaluation = evaluations[kpi.id];
                const isCompleted = evaluation?.status === "completed";
                const isPersonal = kpi.employee_id !== null;

                return (
                  <Card
                    key={kpi.id}
                    className={`border-[#E6E6E4] ${isCompleted ? "bg-[#FAFAF8]" : ""}`}
                  >
                    <CardHeader className="pb-2">
                      <div className={`flex items-start justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={true}
                            onCheckedChange={() => handleUnassignKpi(kpi.id)}
                            disabled={assigning === kpi.id || evaluation?.achieved_value !== null}
                            className="mt-1"
                          />
                          <div className={isRtl ? "text-right" : ""}>
                            <CardTitle className="text-base flex items-center gap-2">
                              {isCompleted && (
                                <CheckCircle2 className="h-4 w-4 text-[#0C5536]" />
                              )}
                              {kpi.name}
                              {isPersonal && (
                                <Badge className="bg-[hsl(var(--jw-gold-accent))]/10 text-[hsl(var(--jw-gold-accent))] border-[hsl(var(--jw-gold-accent))]/30 text-xs">
                                  {t("hr:personal")}
                                </Badge>
                              )}
                            </CardTitle>
                            {kpi.description && (
                              <p className="text-sm text-[#6B6B6B] mt-1">
                                {kpi.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-[#E6E6E4]">
                            {kpi.weighting}%
                          </Badge>
                          {isPersonal && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePersonalKpi(kpi.id)}
                              disabled={deletingPersonalId === kpi.id}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                              title={t("hr:deletePersonalKpi")}
                            >
                              {deletingPersonalId === kpi.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Target */}
                        <div className="space-y-1">
                          <Label className="text-xs text-[#6B6B6B]">
                            {t("hr:monthlyTarget")}
                          </Label>
                          <div className="h-10 px-3 flex items-center bg-gray-50 rounded-md border border-[#E6E6E4]">
                            <span className="font-medium">
                              {kpi.target_value} {kpi.unit}
                            </span>
                          </div>
                        </div>

                        {/* Achieved Value */}
                        <div className="space-y-1">
                          <Label className="text-xs text-[#6B6B6B]">
                            {t("hr:achievedValue")}
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={evaluation?.achieved_value ?? ""}
                            onChange={(e) =>
                              handleAchievedValueChange(kpi.id, e.target.value)
                            }
                            placeholder={t("hr:enterAchievedValue")}
                            className="border-[#E6E6E4]"
                          />
                        </div>

                        {/* Score */}
                        <div className="space-y-1">
                          <Label className="text-xs text-[#6B6B6B]">
                            {t("hr:score")}
                          </Label>
                          <div className={`h-10 px-3 flex items-center rounded-md border ${
                            evaluation?.score != null
                              ? evaluation.score >= 80
                                ? "bg-[#E6F7F1] border-[#0C5536]/20 text-[#0C5536]"
                                : evaluation.score >= 60
                                ? "bg-[#FFF9E6] border-[#C6A03B]/20 text-[#C6A03B]"
                                : "bg-red-50 border-red-200 text-red-600"
                              : "bg-gray-50 border-[#E6E6E4]"
                          }`}>
                            <span className="font-medium">
                              {evaluation?.score != null
                                ? `${evaluation.score}%`
                                : "-"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="mt-4 space-y-1">
                        <Label className="text-xs text-[#6B6B6B]">
                          {t("hr:notes")}
                        </Label>
                        <Textarea
                          value={evaluation?.notes || ""}
                          onChange={(e) => handleNotesChange(kpi.id, e.target.value)}
                          placeholder={t("hr:optionalNotes")}
                          className="border-[#E6E6E4] min-h-[60px]"
                          dir={isRtl ? "rtl" : "ltr"}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Available KPIs to Assign */}
          {unassignedKpis.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-[#6B6B6B] flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {t("hr:availableKPIs")} ({unassignedKpis.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {unassignedKpis.map((kpi) => {
                  const isPersonal = kpi.employee_id !== null;
                  return (
                  <Card
                    key={kpi.id}
                    className="border-[#E6E6E4] border-dashed bg-gray-50/50"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={false}
                          onCheckedChange={() => handleAssignKpi(kpi.id)}
                          disabled={assigning === kpi.id}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-[#222222] flex items-center gap-2">
                              {kpi.name}
                              {isPersonal && (
                                <Badge className="bg-[hsl(var(--jw-gold-accent))]/10 text-[hsl(var(--jw-gold-accent))] border-[hsl(var(--jw-gold-accent))]/30 text-xs">
                                  {t("hr:personal")}
                                </Badge>
                              )}
                            </p>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="border-[#E6E6E4] text-xs">
                                {kpi.weighting}%
                              </Badge>
                              {isPersonal && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeletePersonalKpi(kpi.id)}
                                  disabled={deletingPersonalId === kpi.id}
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                                  title={t("hr:deletePersonalKpi")}
                                >
                                  {deletingPersonalId === kpi.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                          {kpi.description && (
                            <p className="text-xs text-[#6B6B6B] mt-1">
                              {kpi.description}
                            </p>
                          )}
                          <p className="text-xs text-[#6B6B6B] mt-2">
                            {t("hr:target")}: {kpi.target_value} {kpi.unit}
                          </p>
                        </div>
                        {assigning === kpi.id && (
                          <Loader2 className="h-4 w-4 animate-spin text-[#6B6B6B]" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* No KPIs assigned message */}
          {assignedKpis.length === 0 && unassignedKpis.length > 0 && (
            <div className="p-6 text-center border border-dashed border-[#E6E6E4] rounded-lg">
              <Target className="h-8 w-8 text-[#C6A03B] mx-auto mb-2" />
              <p className="text-[#6B6B6B]">{t("hr:noKPIsAssigned")}</p>
              <p className="text-sm text-[#6B6B6B] mt-1">{t("hr:selectKPIsToAssign")}</p>
            </div>
          )}
        </>
      )}

      {/* Save Button */}
      {assignedKpis.length > 0 && (
        <div className={`flex justify-end pt-4 ${isRtl ? "flex-row-reverse" : ""}`}>
          <Button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("hr:common.save")}
          </Button>
        </div>
      )}

      {/* Add Personal KPI dialog */}
      <Dialog open={showPersonalDialog} onOpenChange={setShowPersonalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("hr:addPersonalKpi")}</DialogTitle>
            <DialogDescription>
              {t("hr:personalKpiDescription", { name: employee.full_name })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t("hr:kpiName")} *</Label>
              <Input
                value={personalForm.name}
                onChange={(e) => setPersonalForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("hr:enterKPIName")}
                className="border-[#E6E6E4]"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("hr:kpiDescription")}</Label>
              <Textarea
                value={personalForm.description}
                onChange={(e) => setPersonalForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t("hr:enterKPIDescription")}
                className="border-[#E6E6E4] min-h-[60px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("hr:targetValue")} *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={personalForm.target_value}
                  onChange={(e) => setPersonalForm((f) => ({ ...f, target_value: e.target.value }))}
                  className="border-[#E6E6E4]"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("hr:unit")} *</Label>
                <Select
                  value={personalForm.unit}
                  onValueChange={(v) => setPersonalForm((f) => ({ ...f, unit: v }))}
                >
                  <SelectTrigger className="border-[#E6E6E4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {kpiUnitSuggestions.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t("hr:weighting")} *</Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={personalForm.weighting}
                  onChange={(e) => setPersonalForm((f) => ({ ...f, weighting: e.target.value }))}
                  className="border-[#E6E6E4] pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B]">%</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPersonalDialog(false)}
              disabled={creatingPersonal}
            >
              {t("hr:cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleCreatePersonalKpi}
              disabled={creatingPersonal}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {creatingPersonal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("hr:addKPI")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
