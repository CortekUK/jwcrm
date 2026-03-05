"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { customKpiSchema, type CustomKPIFormData, kpiUnitSuggestions } from "@/lib/kpi-validation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2, AlertCircle, User } from "lucide-react";

type AddCustomKPIFormProps = {
  employeeId: string;
  employeeName: string;
  editData?: CustomKPIFormData & { id: string };
  onSuccess?: (id?: string) => void;
  onCancel?: () => void;
};

export function AddCustomKPIForm({
  employeeId,
  employeeName,
  editData,
  onSuccess,
  onCancel,
}: AddCustomKPIFormProps) {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentWeighting, setCurrentWeighting] = useState(0);
  const [loadingWeighting, setLoadingWeighting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CustomKPIFormData>({
    resolver: zodResolver(customKpiSchema),
    defaultValues: editData || {
      employee_id: employeeId,
      name: "",
      description: "",
      target_value: "",
      unit: "marks",
      weighting: "",
      deadline: "",
    },
  });

  const enteredWeighting = watch("weighting");

  // Fetch current total weighting for this employee's custom KPIs
  useEffect(() => {
    const fetchCurrentWeighting = async () => {
      setLoadingWeighting(true);
      try {
        const { data, error } = await supabase
          .from("employee_custom_kpis")
          .select("weighting")
          .eq("employee_id", employeeId)
          .eq("is_archived", false);

        if (error) throw error;

        let total = (data || []).reduce((sum, kpi) => sum + (kpi.weighting || 0), 0);
        if (editData?.id) {
          total -= Number(editData.weighting) || 0;
        }
        setCurrentWeighting(total);
      } catch (error) {
        console.error("Error fetching weighting:", error);
      } finally {
        setLoadingWeighting(false);
      }
    };

    fetchCurrentWeighting();
  }, [employeeId, editData]);

  const remainingWeighting = 100 - currentWeighting;
  const newTotal = currentWeighting + (Number(enteredWeighting) || 0);
  const isWeightingValid = newTotal <= 100;

  const onSubmit = async (data: CustomKPIFormData) => {
    if (!isWeightingValid) {
      toast({
        variant: "destructive",
        description: t("hr:weightingMustTotal100"),
      });
      return;
    }

    setLoading(true);
    try {
      const kpiData = {
        employee_id: employeeId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        target_value: Number(data.target_value),
        unit: data.unit,
        weighting: Number(data.weighting),
        deadline: data.deadline || null,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      };

      if (editData?.id) {
        const { error } = await supabase
          .from("employee_custom_kpis")
          .update(kpiData)
          .eq("id", editData.id);

        if (error) throw error;

        toast({
          title: t("hr:customKpiUpdated"),
          className: "bg-[hsl(var(--jw-primary-green))] text-white",
        });
        onSuccess?.(editData.id);
      } else {
        const { data: newKPI, error } = await supabase
          .from("employee_custom_kpis")
          .insert({ ...kpiData, created_by: user?.id })
          .select("id")
          .single();

        if (error) throw error;

        toast({
          title: t("hr:customKpiAdded"),
          className: "bg-[hsl(var(--jw-primary-green))] text-white",
        });
        onSuccess?.(newKPI.id);
      }
    } catch (error) {
      console.error("Error saving custom KPI:", error);
      toast({
        variant: "destructive",
        description:
          error instanceof Error ? error.message : "Error saving custom KPI",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Employee Info (read-only header) */}
      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-purple-600" />
          <span className="text-purple-700 font-medium">{employeeName}</span>
          <span className="text-purple-500">-</span>
          <span className="text-purple-500">{t("hr:individualGoals")}</span>
        </div>
      </div>

      {/* Hidden employee_id field */}
      <input type="hidden" {...register("employee_id")} />

      {/* Weighting Info Banner */}
      <div className={`p-3 rounded-lg ${
        newTotal === 100
          ? "bg-[#E6F7F1] border border-[#0C5536]/20"
          : newTotal > 100
          ? "bg-red-50 border border-red-200"
          : "bg-[#FFF9E6] border border-[#C6A03B]/20"
      }`}>
        <div className="flex items-center gap-2 text-sm">
          {newTotal > 100 && <AlertCircle className="h-4 w-4 text-red-600" />}
          <span className={newTotal > 100 ? "text-red-600" : "text-[#6B6B6B]"}>
            {t("hr:currentWeighting")}: <strong>{currentWeighting}%</strong>
            {!editData && (
              <>
                {" "}| {t("hr:remainingWeighting")}: <strong>{remainingWeighting}%</strong>
              </>
            )}
            {enteredWeighting && (
              <>
                {" "}| {t("hr:totalWeighting")}: <strong className={newTotal > 100 ? "text-red-600" : ""}>{newTotal}%</strong>
              </>
            )}
          </span>
        </div>
      </div>

      {/* KPI Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-[#555555]">{t("hr:kpiName")} <span className="text-red-500">*</span></Label>
        <Input
          id="name"
          {...register("name")}
          placeholder={t("hr:enterKPIName")}
          className={`border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B] ${errors.name ? "border-[#C0392B]" : ""}`}
          dir={isRtl ? "rtl" : "ltr"}
        />
        {errors.name && (
          <p className="text-[12px] text-[#C0392B]">
            {t(`hr:${errors.name.message}`)}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-[#555555]">{t("hr:kpiDescription")}</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder={t("hr:enterKPIDescription")}
          className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B] min-h-[80px]"
          dir={isRtl ? "rtl" : "ltr"}
        />
      </div>

      {/* Target Value and Unit in a row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="target_value" className="text-[#555555]">{t("hr:targetValue")} <span className="text-red-500">*</span></Label>
          <Input
            id="target_value"
            type="number"
            step="0.01"
            {...register("target_value")}
            placeholder={t("hr:enterTargetValue")}
            className={`border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B] ${errors.target_value ? "border-[#C0392B]" : ""}`}
          />
          {errors.target_value && (
            <p className="text-[12px] text-[#C0392B]">
              {t(`hr:${errors.target_value.message}`)}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit" className="text-[#555555]">{t("hr:unit")} <span className="text-red-500">*</span></Label>
          <Select
            value={watch("unit")}
            onValueChange={(value) => setValue("unit", value)}
          >
            <SelectTrigger className={`border-[#E6E6E4] ${errors.unit ? "border-[#C0392B]" : ""}`}>
              <SelectValue placeholder={t("hr:selectUnit")} />
            </SelectTrigger>
            <SelectContent>
              {kpiUnitSuggestions.map((unit) => (
                <SelectItem key={unit.value} value={unit.value}>
                  {unit.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.unit && (
            <p className="text-[12px] text-[#C0392B]">
              {t(`hr:${errors.unit.message}`)}
            </p>
          )}
        </div>
      </div>

      {/* Weighting and Deadline in a row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="weighting" className="text-[#555555]">{t("hr:weighting")} <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Input
              id="weighting"
              type="number"
              min="0"
              max={editData ? 100 : remainingWeighting}
              {...register("weighting")}
              placeholder={t("hr:enterWeighting")}
              className={`border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B] ltr:pr-8 rtl:pl-8 ${errors.weighting || !isWeightingValid ? "border-[#C0392B]" : ""}`}
            />
            <span className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B]">
              %
            </span>
          </div>
          {errors.weighting && (
            <p className="text-[12px] text-[#C0392B]">
              {t(`hr:${errors.weighting.message}`)}
            </p>
          )}
          {!isWeightingValid && (
            <p className="text-[12px] text-[#C0392B]">
              {t("hr:weightingMustTotal100")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="deadline" className="text-[#555555]">{t("hr:deadline")}</Label>
          <DatePicker
            date={watch("deadline") ? new Date(watch("deadline") + "T00:00:00") : undefined}
            onDateChange={(date) => {
              if (date) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, "0");
                const day = String(date.getDate()).padStart(2, "0");
                setValue("deadline", `${year}-${month}-${day}`);
              } else {
                setValue("deadline", "");
              }
            }}
            placeholder={t("hr:selectDate")}
            className="w-full border-[#E6E6E4]"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className={`flex gap-3 pt-4 border-t border-[#E6E6E4] ${isRtl ? "flex-row-reverse" : ""}`}>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="border-[#E6E6E4] hover:bg-[#FAFAF8]"
          >
            {t("hr:cancel", "Cancel")}
          </Button>
        )}
        <Button
          type="submit"
          disabled={loading || !isWeightingValid}
          className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
        >
          {loading && <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />}
          {editData ? t("hr:saveChanges", "Save Changes") : t("hr:addCustomKpi")}
        </Button>
      </div>
    </form>
  );
}
