"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AddJobRoleForm } from "@/components/hr/kpis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Briefcase } from "lucide-react";
import type { JobRoleFormData } from "@/lib/kpi-validation";

export default function EditJobRolePage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const params = useParams();
  const roleId = params?.id as string;

  const [jobRole, setJobRole] = useState<(JobRoleFormData & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchJobRole = async () => {
      try {
        const { data, error } = await supabase
          .from("job_roles")
          .select("id, name, department_id")
          .eq("id", roleId)
          .single();

        if (error) throw error;

        if (data) {
          setJobRole({
            id: data.id,
            name: data.name,
            department_id: data.department_id || "",
          });
        } else {
          setNotFound(true);
        }
      } catch (error) {
        console.error("Error fetching job role:", error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    if (roleId) {
      fetchJobRole();
    }
  }, [roleId]);

  const handleSuccess = () => {
    router.push("/admin/hr/job-roles");
  };

  const handleCancel = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-10 w-24" />
        <Card className="border-[#E6E6E4]">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className={`text-[#6B6B6B] hover:text-[#222222] ${isRtl ? "flex-row-reverse" : ""}`}
        >
          <ArrowLeft className={`h-4 w-4 ${isRtl ? "ml-2 rotate-180" : "mr-2"}`} />
          {t("hr:back")}
        </Button>
        <Card className="border-[#E6E6E4]">
          <CardContent className="py-12 text-center">
            <Briefcase className="h-12 w-12 text-[#E6E6E4] mx-auto mb-4" />
            <p className="text-[#6B6B6B]">{t("hr:noJobRoles")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className={`text-[#6B6B6B] hover:text-[#222222] ${isRtl ? "flex-row-reverse" : ""}`}
      >
        <ArrowLeft className={`h-4 w-4 ${isRtl ? "ml-2 rotate-180" : "mr-2"}`} />
        {t("hr:back")}
      </Button>

      {/* Form Card */}
      <Card className="border-[#E6E6E4]">
        <CardHeader>
          <CardTitle className={`text-xl font-semibold text-[#0C5536] flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`} style={{ fontFamily: 'Playfair Display, serif' }}>
            <Briefcase className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("hr:editJobRole")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AddJobRoleForm
            editData={jobRole!}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </CardContent>
      </Card>
    </div>
  );
}
