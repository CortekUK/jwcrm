"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { kpiSchema, type KPIFormData, kpiUnitSuggestions } from "@/lib/kpi-validation";
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
import { JobRoleSelector } from "./JobRoleSelector";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";

type AddKPIFormProps = {
  editData?: KPIFormData & { id: string };
  preSelectedJobRoleId?: string;
  onSuccess?: (id?: string) => void;
  onCancel?: () => void;
};

export function AddKPIForm({
  editData,
  preSelectedJobRoleId,
  onSuccess,
  onCancel,
}: AddKPIFormProps) {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentRoleWeighting, setCurrentRoleWeighting] = useState(0);
  const [loadingWeighting, setLoadingWeighting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<KPIFormData>({
    resolver: zodResolver(kpiSchema),
    defaultValues: editData || {
      job_role_id: preSelectedJobRoleId || "",
      name: "",
      description: "",
      target_value: "",
      unit: "marks",
      weighting: "",
    },
  });

  const selectedJobRoleId = watch("job_role_id");
  const enteredWeighting = watch("weighting");

  // Fetch current total weighting for selected job role
  useEffect(() => {
    const fetchCurrentWeighting = async () => {
      if (!selectedJobRoleId) {
        setCurrentRoleWeighting(0);
        return;
      }

      setLoadingWeighting(true);
      try {
                const { data, error } = await supabase
          .from("kpis")
          .select("weighting")
          .eq("job_role_id", selectedJobRoleId);

        if (error) throw error;

        // If editing, exclude current KPI's weighting from total
        let total = (data || []).reduce((sum, kpi) => sum + (kpi.weighting || 0), 0);
        if (editData?.id) {
          const currentKPIWeighting = data?.find((k) => k.weighting === Number(editData.weighting));
          if (currentKPIWeighting) {
            total -= Number(editData.weighting);
          }
        }
        setCurrentRoleWeighting(total);
      } catch (error) {
        console.error("Error fetching weighting:", error);
      } finally {
        setLoadingWeighting(false);
      }
    };

    fetchCurrentWeighting();
  }, [selectedJobRoleId, editData]);

  const remainingWeighting = 100 - currentRoleWeighting;
  const newTotal = currentRoleWeighting + (Number(enteredWeighting) || 0);
  const isWeightingValid = newTotal <= 100;

  const onSubmit = async (data: KPIFormData) => {
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
        job_role_id: data.job_role_id,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        target_value: Number(data.target_value),
        unit: data.unit,
        weighting: Number(data.weighting),
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      };

      if (editData?.id) {
        // Update existing KPI
        const { error } = await supabase
          .from("kpis")
          .update(kpiData)
          .eq("id", editData.id);

        if (error) throw error;

        toast({
          title: t("hr:kpiUpdated"),
          className: "bg-[hsl(var(--jw-primary-green))] text-white",
        });
        onSuccess?.(editData.id);
      } else {
        // Create new KPI
        const { data: newKPI, error } = await supabase
          .from("kpis")
          .insert(kpiData)
          .select("id")
          .single();

        if (error) throw error;

        toast({
          title: t("hr:kpiCreated"),
          className: "bg-[hsl(var(--jw-primary-green))] text-white",
        });
        onSuccess?.(newKPI.id);
      }
    } catch (error) {
      console.error("Error saving KPI:", error);
      toast({
        variant: "destructive",
        description:
          error instanceof Error ? error.message : "Error saving KPI",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Job Role */}
      <div className="space-y-2">
        <Label className="text-[#555555]">{t("hr:jobRole")} <span className="text-red-500">*</span></Label>
        <JobRoleSelector
          value={selectedJobRoleId}
          onChange={(value) => setValue("job_role_id", value)}
          error={errors.job_role_id?.message}
          disabled={!!preSelectedJobRoleId}
        />
        {errors.job_role_id && (
          <p className="text-[12px] text-[#C0392B]">
            {t(`hr:${errors.job_role_id.message}`)}
          </p>
        )}
      </div>

      {/* Weighting Info Banner */}
      {selectedJobRoleId && (
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
              {t("hr:currentWeighting")}: <strong>{currentRoleWeighting}%</strong>
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
      )}

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

      {/* Weighting */}
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

      {/* Action Buttons */}
      <div className={`flex gap-3 pt-4 border-t border-[#E6E6E4] ${isRtl ? "flex-row-reverse" : ""}`}>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="border-[#E6E6E4] hover:bg-[#FAFAF8]"
          >
            {t("hr:cancel")}
          </Button>
        )}
        <Button
          type="submit"
          disabled={loading || !isWeightingValid}
          className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
        >
          {loading && <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />}
          {editData ? t("hr:saveChanges") : t("hr:addKPI")}
        </Button>
      </div>
    </form>
  );
}
