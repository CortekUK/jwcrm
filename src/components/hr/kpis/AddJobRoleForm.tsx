"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { jobRoleSchema, type JobRoleFormData } from "@/lib/kpi-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type Department = {
  id: string;
  name: string;
};

type AddJobRoleFormProps = {
  editData?: JobRoleFormData & { id: string };
  onSuccess?: (id?: string) => void;
  onCancel?: () => void;
};

export function AddJobRoleForm({
  editData,
  onSuccess,
  onCancel,
}: AddJobRoleFormProps) {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<JobRoleFormData>({
    resolver: zodResolver(jobRoleSchema),
    defaultValues: editData || {
      name: "",
      department_id: "",
    },
  });

  const selectedDepartmentId = watch("department_id");

  useEffect(() => {
    const fetchDepartments = async () => {
            const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching departments:", error);
      } else {
        setDepartments(data || []);
      }
      setLoadingDepartments(false);
    };

    fetchDepartments();
  }, []);

  const onSubmit = async (data: JobRoleFormData) => {
    setLoading(true);
    try {
      
      const jobRoleData = {
        name: data.name.trim(),
        department_id: data.department_id || null,
      };

      if (editData?.id) {
        // Update existing job role
        const { error } = await supabase
          .from("job_roles")
          .update(jobRoleData)
          .eq("id", editData.id);

        if (error) throw error;

        toast({
          title: t("hr:jobRoleUpdated"),
          className: "bg-[hsl(var(--jw-primary-green))] text-white",
        });
        onSuccess?.(editData.id);
      } else {
        // Create new job role
        const { data: newRole, error } = await supabase
          .from("job_roles")
          .insert(jobRoleData)
          .select("id")
          .single();

        if (error) throw error;

        toast({
          title: t("hr:jobRoleCreated"),
          className: "bg-[hsl(var(--jw-primary-green))] text-white",
        });
        onSuccess?.(newRole.id);
      }
    } catch (error) {
      console.error("Error saving job role:", error);
      toast({
        variant: "destructive",
        description:
          error instanceof Error ? error.message : "Error saving job role",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Role Name */}
      <div className="space-y-2">
        <Label htmlFor="name">{t("hr:jobRoleName")} *</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder={t("hr:enterJobRoleName")}
          className={`border-[#E6E6E4] ${errors.name ? "border-red-500" : ""}`}
          dir={isRtl ? "rtl" : "ltr"}
        />
        {errors.name && (
          <p className="text-sm text-red-500">
            {t(`hr:${errors.name.message}`)}
          </p>
        )}
      </div>

      {/* Department */}
      <div className="space-y-2">
        <Label htmlFor="department_id">{t("hr:department")}</Label>
        {loadingDepartments ? (
          <div className="flex items-center gap-2 h-10 px-3 border border-[#E6E6E4] rounded-md">
            <Loader2 className="h-4 w-4 animate-spin text-[#6B6B6B]" />
            <span className="text-sm text-[#6B6B6B]">{t("common:loading")}</span>
          </div>
        ) : (
          <Select
            value={selectedDepartmentId}
            onValueChange={(value) => setValue("department_id", value)}
          >
            <SelectTrigger className="border-[#E6E6E4]">
              <SelectValue placeholder={t("hr:selectDepartment")} />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Action Buttons */}
      <div className={`flex gap-3 pt-4 ${isRtl ? "flex-row-reverse" : ""}`}>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="border-[#E6E6E4]"
          >
            {t("hr:cancel")}
          </Button>
        )}
        <Button
          type="submit"
          disabled={loading}
          className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editData ? t("hr:updateEmployee") : t("hr:addJobRole")}
        </Button>
      </div>
    </form>
  );
}
