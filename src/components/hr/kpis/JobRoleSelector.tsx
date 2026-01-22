"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

type JobRole = {
  id: string;
  name: string;
  department_id: string | null;
  department?: {
    name: string;
  } | null;
};

type JobRoleSelectorProps = {
  value?: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  showDepartment?: boolean;
  departmentId?: string; // Filter job roles by department
};

export function JobRoleSelector({
  value,
  onChange,
  error,
  disabled = false,
  placeholder,
  showDepartment = true,
  departmentId,
}: JobRoleSelectorProps) {
  const { t } = useTranslation(["hr"]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobRoles = async () => {
      setLoading(true);
      let query = supabase
        .from("job_roles")
        .select("id, name, department_id, department:departments(name)")
        .order("name", { ascending: true });

      // Filter by department if provided
      if (departmentId) {
        query = query.eq("department_id", departmentId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error("Error fetching job roles:", fetchError);
      } else {
        setJobRoles(data || []);
      }
      setLoading(false);
    };

    fetchJobRoles();
  }, [departmentId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 border border-[#E6E6E4] rounded-md">
        <Loader2 className="h-4 w-4 animate-spin text-[#6B6B6B]" />
        <span className="text-sm text-[#6B6B6B]">{t("common:loading")}</span>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={`border-[#E6E6E4] ${error ? "border-red-500" : ""}`}
      >
        <SelectValue placeholder={placeholder || t("hr:selectJobRole")} />
      </SelectTrigger>
      <SelectContent>
        {jobRoles.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-[#6B6B6B]">
            {departmentId ? t("hr:noJobRolesInDepartment") : t("hr:selectDepartmentFirst")}
          </div>
        ) : (
          jobRoles.map((role) => (
            <SelectItem key={role.id} value={role.id}>
              <div className="flex items-center gap-2">
                <span>{role.name}</span>
                {showDepartment && role.department?.name && (
                  <span className="text-xs text-[#6B6B6B]">
                    ({role.department.name})
                  </span>
                )}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
