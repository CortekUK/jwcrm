"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { JobRoleTable } from "@/components/hr/kpis";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase } from "lucide-react";

type JobRole = {
  id: string;
  name: string;
  department_id: string | null;
  created_at: string | null;
  department?: {
    name: string;
  } | null;
  employee_count: number;
  kpi_count: number;
};

export default function JobRolesPage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobRoles = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch job roles with department info
      const { data: rolesData, error: rolesError } = await supabase
        .from("job_roles")
        .select("id, name, department_id, created_at, department:departments(name)")
        .order("name", { ascending: true });

      if (rolesError) throw rolesError;

      // Fetch employee counts per job role
      const { data: employeeCounts, error: empError } = await supabase
        .from("employees")
        .select("job_role_id")
        .not("job_role_id", "is", null);

      if (empError) throw empError;

      // Fetch KPI counts per job role
      const { data: kpiCounts, error: kpiError } = await supabase
        .from("kpis")
        .select("job_role_id");

      if (kpiError) throw kpiError;

      // Count employees per role
      const empCountMap: Record<string, number> = {};
      employeeCounts?.forEach((emp) => {
        if (emp.job_role_id) {
          empCountMap[emp.job_role_id] = (empCountMap[emp.job_role_id] || 0) + 1;
        }
      });

      // Count KPIs per role
      const kpiCountMap: Record<string, number> = {};
      kpiCounts?.forEach((kpi) => {
        kpiCountMap[kpi.job_role_id] = (kpiCountMap[kpi.job_role_id] || 0) + 1;
      });

      // Combine data
      const rolesWithCounts = (rolesData || []).map((role) => ({
        ...role,
        employee_count: empCountMap[role.id] || 0,
        kpi_count: kpiCountMap[role.id] || 0,
      }));

      setJobRoles(rolesWithCounts);
    } catch (error) {
      console.error("Error fetching job roles:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobRoles();
  }, [fetchJobRoles]);

  const handleAddNew = () => {
    router.push("/admin/hr/job-roles/new");
  };

  const handleEdit = (id: string) => {
    router.push(`/admin/hr/job-roles/${id}/edit`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className={isRtl ? "text-right" : ""}>
        <h1 className="text-2xl font-bold text-[#222222] flex items-center gap-2">
          <Briefcase className="h-7 w-7 text-[hsl(var(--jw-gold-accent))]" />
          {t("hr:jobRoles")}
        </h1>
        <p className="text-[#6B6B6B] mt-1">{t("hr:jobRolesDescription")}</p>
      </div>

      {/* Main Content */}
      <Card className="border-[#E6E6E4]">
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-32" />
              </div>
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <JobRoleTable
              jobRoles={jobRoles}
              onAddNew={handleAddNew}
              onEdit={handleEdit}
              onRefresh={fetchJobRoles}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
