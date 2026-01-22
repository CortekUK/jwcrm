"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AddJobRoleForm } from "@/components/hr/kpis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Briefcase } from "lucide-react";

export default function NewJobRolePage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();

  const handleSuccess = () => {
    router.push("/admin/hr/job-roles");
  };

  const handleCancel = () => {
    router.back();
  };

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
            <Briefcase className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("hr:addJobRole")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AddJobRoleForm
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </CardContent>
      </Card>
    </div>
  );
}
