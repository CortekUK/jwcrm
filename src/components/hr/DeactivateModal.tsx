"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Loader2, UserX, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deactivateEmployeeSchema, DeactivateEmployeeFormData, terminationReasonOptions } from "@/lib/hr-validation";

interface Employee {
  id: string;
  full_name: string;
}

interface DeactivateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onSuccess?: () => void;
}

export function DeactivateModal({ open, onOpenChange, employee, onSuccess }: DeactivateModalProps) {
  const { toast } = useToast();
  const { t } = useTranslation(["hr", "toast"]);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<DeactivateEmployeeFormData>({
    resolver: zodResolver(deactivateEmployeeSchema),
    defaultValues: {
      termination_reason: "resignation",
      last_working_day: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  const onSubmit = async (data: DeactivateEmployeeFormData) => {
    if (!employee) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("employees")
        .update({
          employment_status: "terminated",
          termination_reason: data.termination_reason,
          last_working_day: data.last_working_day,
          updated_at: new Date().toISOString(),
        })
        .eq("id", employee.id);

      if (error) throw error;

      toast({
        title: t("toast:success"),
        description: t("hr:employeeDeactivated", { name: employee.full_name }),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });

      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error deactivating employee:", error);
      toast({
        title: t("toast:error"),
        description: error.message || t("hr:errorDeactivating"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-red-600 flex items-center gap-2">
            <UserX className="h-5 w-5" />
            {t("hr:deactivateEmployee")}
          </DialogTitle>
          <DialogDescription>
            {t("hr:deactivateDescription")}
          </DialogDescription>
        </DialogHeader>

        {/* Warning */}
        <div className="p-3 bg-[#FFF9E6] rounded-lg border border-[#C6A03B]/20 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-[#C6A03B] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#C6A03B]">
              {t("hr:deactivatingEmployee", { name: employee.full_name })}
            </p>
            <p className="text-xs text-[#6B6B6B] mt-1">
              {t("hr:recordsWillBeKept")}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          {/* Termination Reason */}
          <div className="space-y-2">
            <Label className="text-[#555555]">
              {t("hr:terminationReason")} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={watch("termination_reason")}
              onValueChange={(value: any) => setValue("termination_reason", value)}
              disabled={loading}
            >
              <SelectTrigger className="border-[#E6E6E4]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {terminationReasonOptions.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {t(`hr:reason.${reason.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Last Working Day */}
          <div className="space-y-2">
            <Label htmlFor="last_working_day" className="text-[#555555]">
              {t("hr:lastWorkingDay")} <span className="text-red-500">*</span>
            </Label>
            <DatePicker
              date={watch("last_working_day") ? new Date(watch("last_working_day") + "T00:00:00") : undefined}
              onDateChange={(date) => {
                if (date) {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, "0");
                  const day = String(date.getDate()).padStart(2, "0");
                  setValue("last_working_day", `${year}-${month}-${day}`);
                } else {
                  setValue("last_working_day", "");
                }
              }}
              placeholder={t("hr:lastWorkingDay")}
              className="w-full border-[#E6E6E4]"
              disabled={loading}
              clearable={false}
            />
            {errors.last_working_day && (
              <p className="text-[12px] text-[#C0392B]">
                {t(`hr:${errors.last_working_day.message}`)}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-[#555555]">
              {t("hr:notes")}
            </Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder={t("hr:optionalNotes")}
              className="border-[#E6E6E4] min-h-[80px]"
              disabled={loading}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="border-[#E6E6E4]"
            >
              {t("hr:cancel")}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("hr:deactivating")}
                </>
              ) : (
                <>
                  <UserX className="mr-2 h-4 w-4" />
                  {t("hr:confirmDeactivate")}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
