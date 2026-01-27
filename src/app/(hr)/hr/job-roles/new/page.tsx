"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AddJobRoleForm } from "@/components/hr/kpis";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Briefcase } from "lucide-react";

export default function NewJobRolePage() {
  const { t } = useTranslation(["hr", "common"]);
  const router = useRouter();

  const handleSuccess = () => {
    router.push("/admin/hr/job-roles");
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => router.back()}
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-white border border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8] transition-colors"
              >
                <ArrowLeft className="h-4 w-4 text-[#555555]" />
              </button>
              <Briefcase className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("hr:addJobRole")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-[4.5rem] rtl:mr-[4.5rem]">
              {t("hr:addJobRoleDescription")}
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="max-w-2xl mx-auto">
        <Card className="border-[#E6E6E4] shadow-sm">
          <CardContent className="p-6">
            <AddJobRoleForm
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("hr:legalNotice")}
        </p>
      </div>
    </div>
  );
}
