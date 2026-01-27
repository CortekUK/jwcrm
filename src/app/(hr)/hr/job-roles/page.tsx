"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { JobRoleTable } from "@/components/hr/kpis";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Briefcase className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("hr:jobRoles")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {t("hr:jobRolesDescription")}
            </p>
          </div>
          {!loading && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[hsl(var(--jw-primary-green))]/30 bg-white">
              <Briefcase className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
              <span className="text-sm font-medium text-[hsl(var(--jw-primary-green))]">
                {jobRoles.length} {jobRoles.length === 1 ? t("hr:jobRole") : t("hr:jobRolesCount")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Card className="border-[#E6E6E4]">
        <CardContent className="p-6">
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

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("hr:legalNotice")}
        </p>
      </div>
    </div>
  );
}
