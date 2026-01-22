"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AddKPIForm } from "@/components/hr/kpis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Target } from "lucide-react";
import type { KPIFormData } from "@/lib/kpi-validation";

export default function EditKPIPage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const params = useParams();
  const kpiId = params?.id as string;

  const [kpi, setKPI] = useState<(KPIFormData & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchKPI = async () => {
      try {
        const { data, error } = await supabase
          .from("kpis")
          .select("id, job_role_id, name, description, target_value, unit, weighting")
          .eq("id", kpiId)
          .single();

        if (error) throw error;

        if (data) {
          setKPI({
            id: data.id,
            job_role_id: data.job_role_id,
            name: data.name,
            description: data.description || "",
            target_value: String(data.target_value),
            unit: data.unit,
            weighting: String(data.weighting),
          });
        } else {
          setNotFound(true);
        }
      } catch (error) {
        console.error("Error fetching KPI:", error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    if (kpiId) {
      fetchKPI();
    }
  }, [kpiId]);

  const handleSuccess = () => {
    router.push("/admin/hr/kpis");
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
            <Skeleton className="h-20 w-full" />
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
            <Target className="h-12 w-12 text-[#E6E6E4] mx-auto mb-4" />
            <p className="text-[#6B6B6B]">{t("hr:noKPIs")}</p>
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
          <CardTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <Target className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("hr:editKPI")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AddKPIForm
            editData={kpi!}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </CardContent>
      </Card>
    </div>
  );
}
