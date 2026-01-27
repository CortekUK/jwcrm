"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AddKPIForm } from "@/components/hr/kpis";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Target, Edit3 } from "lucide-react";
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
      <div className="space-y-6 pb-12">
        {/* Hero Banner Skeleton */}
        <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
          <div className="max-w-2xl mx-auto">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="max-w-2xl mx-auto">
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-6 pb-12">
        {/* Hero Banner */}
        <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => router.back()}
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-white border border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8] transition-colors"
              >
                <ArrowLeft className={`h-4 w-4 text-[#555555] ${isRtl ? "rotate-180" : ""}`} />
              </button>
              <Target className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("hr:editKPI")}
              </h1>
            </div>
          </div>
        </div>
        <div className="max-w-2xl mx-auto">
          <Card className="border-[#E6E6E4]">
            <CardContent className="py-12 text-center">
              <Target className="h-10 w-10 text-[#C6A03B] mx-auto mb-3" />
              <p className="text-[#6B6B6B]">{t("hr:kpiNotFound")}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-white border border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8] transition-colors"
            >
              <ArrowLeft className={`h-4 w-4 text-[#555555] ${isRtl ? "rotate-180" : ""}`} />
            </button>
            <Edit3 className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
            <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("hr:editKPI")}
            </h1>
          </div>
          <p className="text-sm text-[#777777] ltr:ml-[4.5rem] rtl:mr-[4.5rem]">
            {t("hr:editKPIDescription")}
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="max-w-2xl mx-auto">
        <Card className="border-[#E6E6E4]">
          <CardContent className="p-6">
            <AddKPIForm
              editData={kpi!}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="max-w-2xl mx-auto mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("hr:legalNotice")}
        </p>
      </div>
    </div>
  );
}
