"use client";

import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { calculateScore } from "@/lib/kpi-validation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Target, CheckCircle2, Plus, Calendar, AlertCircle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { AddCustomKPIForm } from "./AddCustomKPIForm";

type CustomKPI = {
  id: string;
  name: string;
  description: string | null;
  target_value: number;
  unit: string;
  weighting: number;
  deadline: string | null;
};

type CustomEvaluation = {
  id?: string;
  custom_kpi_id: string;
  achieved_value: number | null;
  score: number | null;
  notes: string | null;
  status: string | null;
};

export type CustomKPIEvaluationSectionHandle = {
  save: () => Promise<void>;
  getScore: () => number | null;
  hasData: () => boolean;
};

type CustomKPIEvaluationSectionProps = {
  employeeId: string;
  employeeName: string;
  year: number;
  month: number;
};

export const CustomKPIEvaluationSection = forwardRef<
  CustomKPIEvaluationSectionHandle,
  CustomKPIEvaluationSectionProps
>(({ employeeId, employeeName, year, month }, ref) => {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();
  const { user } = useAuth();

  const [customKpis, setCustomKpis] = useState<CustomKPI[]>([]);
  const [assignedKpiIds, setAssignedKpiIds] = useState<Set<string>>(new Set());
  const [evaluations, setEvaluations] = useState<Record<string, CustomEvaluation>>({});
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch custom KPIs and evaluations
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch active custom KPIs for this employee
        const { data: kpiData, error: kpiError } = await supabase
          .from("employee_custom_kpis")
          .select("id, name, description, target_value, unit, weighting, deadline")
          .eq("employee_id", employeeId)
          .eq("is_archived", false)
          .order("name");

        if (kpiError) {
          // Table may not exist yet if migration hasn't been applied
          setCustomKpis([]);
          setLoading(false);
          return;
        }
        setCustomKpis(kpiData || []);

        // Fetch existing evaluations for this period
        const { data: evalData, error: evalError } = await supabase
          .from("custom_kpi_evaluations")
          .select("id, custom_kpi_id, achieved_value, score, notes, status")
          .eq("employee_id", employeeId)
          .eq("year", year)
          .eq("month", month);

        if (evalError) {
          // Table may not exist yet
          setEvaluations({});
          setAssignedKpiIds(new Set());
          setLoading(false);
          return;
        }

        const evalMap: Record<string, CustomEvaluation> = {};
        const assigned = new Set<string>();

        (evalData || []).forEach((evaluation) => {
          evalMap[evaluation.custom_kpi_id] = evaluation;
          assigned.add(evaluation.custom_kpi_id);
        });

        setEvaluations(evalMap);
        setAssignedKpiIds(assigned);
      } catch {
        // Silently handle - tables may not exist yet
        setCustomKpis([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [employeeId, year, month]);

  // Calculate overall custom KPI weighted score
  const calculateOverallScore = (): number | null => {
    let totalWeightedScore = 0;
    let totalWeighting = 0;

    assignedKpiIds.forEach((kpiId) => {
      const kpi = customKpis.find((k) => k.id === kpiId);
      const evaluation = evaluations[kpiId];
      if (kpi && evaluation && evaluation.score != null) {
        totalWeightedScore += (evaluation.score * kpi.weighting) / 100;
        totalWeighting += kpi.weighting;
      }
    });

    return totalWeighting > 0 ? Math.round(totalWeightedScore * 100) / 100 : null;
  };

  // Expose save and score via ref
  useImperativeHandle(ref, () => ({
    save: handleSave,
    getScore: calculateOverallScore,
    hasData: () => customKpis.length > 0,
  }));

  const handleAssignKpi = async (kpiId: string) => {
    setAssigning(kpiId);
    try {
      const { data, error } = await supabase
        .from("custom_kpi_evaluations")
        .insert({
          employee_id: employeeId,
          custom_kpi_id: kpiId,
          year,
          month,
          status: "pending",
          achieved_value: null,
          score: null,
          notes: null,
        })
        .select()
        .single();

      if (error) throw error;

      setAssignedKpiIds((prev) => new Set([...prev, kpiId]));
      setEvaluations((prev) => ({
        ...prev,
        [kpiId]: {
          id: data.id,
          custom_kpi_id: kpiId,
          achieved_value: null,
          score: null,
          notes: null,
          status: "pending",
        },
      }));
    } catch (error) {
      console.error("Error assigning custom KPI:", error);
      toast({ variant: "destructive", description: "Error assigning custom KPI" });
    } finally {
      setAssigning(null);
    }
  };

  const handleUnassignKpi = async (kpiId: string) => {
    const evaluation = evaluations[kpiId];
    if (evaluation?.achieved_value !== null) {
      toast({ variant: "destructive", description: t("hr:cannotUnassignWithData") });
      return;
    }

    setAssigning(kpiId);
    try {
      if (evaluation?.id) {
        const { error } = await supabase
          .from("custom_kpi_evaluations")
          .delete()
          .eq("id", evaluation.id);
        if (error) throw error;
      }

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
    } catch (error) {
      console.error("Error unassigning custom KPI:", error);
    } finally {
      setAssigning(null);
    }
  };

  const handleAchievedValueChange = (kpiId: string, value: string) => {
    const kpi = customKpis.find((k) => k.id === kpiId);
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

  const handleSave = async () => {
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
          .from("custom_kpi_evaluations")
          .update(evalData)
          .eq("id", evaluation.id);
        if (error) throw error;
      }
    }
  };

  const getDeadlineBadge = (deadline: string | null) => {
    if (!deadline) return null;
    const daysUntil = differenceInDays(new Date(deadline), new Date());
    if (daysUntil < 0) {
      return (
        <Badge className="bg-red-100 text-red-700 border-0 text-xs">
          <Calendar className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
          {format(new Date(deadline), "MMM d")} ({t("hr:overdue")})
        </Badge>
      );
    }
    if (daysUntil <= 7) {
      return (
        <Badge className="bg-red-50 text-red-600 border-0 text-xs">
          <Calendar className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
          {format(new Date(deadline), "MMM d")}
        </Badge>
      );
    }
    if (daysUntil <= 30) {
      return (
        <Badge className="bg-yellow-50 text-yellow-700 border-0 text-xs">
          <Calendar className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
          {format(new Date(deadline), "MMM d")}
        </Badge>
      );
    }
    return (
      <span className="text-xs text-[#6B6B6B] flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        {format(new Date(deadline), "MMM d, yyyy")}
      </span>
    );
  };

  const overallScore = calculateOverallScore();
  const assignedKpis = customKpis.filter((kpi) => assignedKpiIds.has(kpi.id));
  const unassignedKpis = customKpis.filter((kpi) => !assignedKpiIds.has(kpi.id));
  const completedCount = Object.values(evaluations).filter((e) => e.status === "completed").length;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (customKpis.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-[#222222] flex items-center gap-2">
            <Target className="h-4 w-4 text-purple-600" />
            {t("hr:individualGoals")}
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddForm(true)}
            className="border-purple-200 text-purple-600 hover:bg-purple-50"
          >
            <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
            {t("hr:addCustomKpi")}
          </Button>
        </div>
        <div className="p-6 text-center border border-dashed border-purple-200 rounded-lg bg-purple-50/30">
          <Target className="h-8 w-8 text-purple-300 mx-auto mb-2" />
          <p className="text-sm text-[#6B6B6B]">{t("hr:noCustomKpis")}</p>
        </div>

        <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                {t("hr:addCustomKpi")}
              </DialogTitle>
            </DialogHeader>
            <AddCustomKPIForm
              employeeId={employeeId}
              employeeName={employeeName}
              onSuccess={() => { setShowAddForm(false); window.location.reload(); }}
              onCancel={() => setShowAddForm(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#222222] flex items-center gap-2">
          <Target className="h-4 w-4 text-purple-600" />
          {t("hr:individualGoals")} ({customKpis.length})
        </h3>
        <div className="flex items-center gap-3">
          {assignedKpis.length > 0 && (
            <span className="text-sm text-[#6B6B6B]">
              {completedCount}/{assignedKpis.length} {t("hr:completed")}
            </span>
          )}
          {overallScore !== null && (
            <Badge className={`text-sm px-3 py-0.5 ${
              overallScore >= 80
                ? "bg-purple-100 text-purple-700"
                : overallScore >= 60
                ? "bg-[#FFF9E6] text-[#C6A03B]"
                : "bg-red-50 text-red-600"
            }`}>
              {t("hr:customScore")}: {overallScore}%
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddForm(true)}
            className="border-purple-200 text-purple-600 hover:bg-purple-50"
          >
            <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
            {t("hr:addCustomKpi")}
          </Button>
        </div>
      </div>

      {/* Assigned Custom KPIs */}
      {assignedKpis.length > 0 && (
        <div className="space-y-3">
          {assignedKpis.map((kpi) => {
            const evaluation = evaluations[kpi.id];
            const isCompleted = evaluation?.status === "completed";

            return (
              <Card key={kpi.id} className={`border-purple-200/50 ${isCompleted ? "bg-purple-50/20" : ""}`}>
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
                          {isCompleted && <CheckCircle2 className="h-4 w-4 text-purple-600" />}
                          {kpi.name}
                          <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">{t("hr:custom")}</Badge>
                        </CardTitle>
                        {kpi.description && (
                          <p className="text-sm text-[#6B6B6B] mt-1">{kpi.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getDeadlineBadge(kpi.deadline)}
                      <Badge variant="outline" className="border-purple-200 text-purple-600">
                        {kpi.weighting}%
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Target */}
                    <div className="space-y-1">
                      <Label className="text-xs text-[#6B6B6B]">{t("hr:monthlyTarget")}</Label>
                      <div className="h-10 px-3 flex items-center bg-gray-50 rounded-md border border-[#E6E6E4]">
                        <span className="font-medium">{kpi.target_value} {kpi.unit}</span>
                      </div>
                    </div>

                    {/* Achieved Value */}
                    <div className="space-y-1">
                      <Label className="text-xs text-[#6B6B6B]">{t("hr:achievedValue")}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={evaluation?.achieved_value ?? ""}
                        onChange={(e) => handleAchievedValueChange(kpi.id, e.target.value)}
                        placeholder={t("hr:enterAchievedValue")}
                        className="border-[#E6E6E4]"
                      />
                    </div>

                    {/* Score */}
                    <div className="space-y-1">
                      <Label className="text-xs text-[#6B6B6B]">{t("hr:score")}</Label>
                      <div className={`h-10 px-3 flex items-center rounded-md border ${
                        evaluation?.score != null
                          ? evaluation.score >= 80
                            ? "bg-purple-50 border-purple-200 text-purple-700"
                            : evaluation.score >= 60
                            ? "bg-[#FFF9E6] border-[#C6A03B]/20 text-[#C6A03B]"
                            : "bg-red-50 border-red-200 text-red-600"
                          : "bg-gray-50 border-[#E6E6E4]"
                      }`}>
                        <span className="font-medium">
                          {evaluation?.score != null ? `${evaluation.score}%` : "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="mt-4 space-y-1">
                    <Label className="text-xs text-[#6B6B6B]">{t("hr:notes")}</Label>
                    <Textarea
                      value={evaluation?.notes || ""}
                      onChange={(e) => handleNotesChange(kpi.id, e.target.value)}
                      placeholder={t("hr:kpiNotesPlaceholder")}
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

      {/* Unassigned Custom KPIs */}
      {unassignedKpis.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm text-[#6B6B6B] flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t("hr:availableKPIs")} ({unassignedKpis.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unassignedKpis.map((kpi) => (
              <Card key={kpi.id} className="border-purple-200/30 border-dashed bg-purple-50/10">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => handleAssignKpi(kpi.id)}
                      disabled={assigning === kpi.id}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[#222222]">{kpi.name}</p>
                          <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">{t("hr:custom")}</Badge>
                        </div>
                        <Badge variant="outline" className="border-purple-200 text-purple-600 text-xs">
                          {kpi.weighting}%
                        </Badge>
                      </div>
                      {kpi.description && (
                        <p className="text-xs text-[#6B6B6B] mt-1">{kpi.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <p className="text-xs text-[#6B6B6B]">
                          {t("hr:target")}: {kpi.target_value} {kpi.unit}
                        </p>
                        {kpi.deadline && getDeadlineBadge(kpi.deadline)}
                      </div>
                    </div>
                    {assigning === kpi.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Add Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              {t("hr:addCustomKpi")}
            </DialogTitle>
          </DialogHeader>
          <AddCustomKPIForm
            employeeId={employeeId}
            employeeName={employeeName}
            onSuccess={() => { setShowAddForm(false); window.location.reload(); }}
            onCancel={() => setShowAddForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
});

CustomKPIEvaluationSection.displayName = "CustomKPIEvaluationSection";
