"use client";

import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ComplianceDashboard } from "@/components/hr/reviews";

export default function ReviewCompliancePage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className={`flex items-center gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/hr/reviews")}
          className="text-[#6B6B6B]"
        >
          <ArrowLeft className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
        </Button>
        <div className={isRtl ? "text-right" : ""}>
          <h1 className="text-2xl font-bold text-[#222222] dark:text-gray-100">
            {t("hr:reviews.complianceDashboard")}
          </h1>
          <p className="text-[#6B6B6B] dark:text-gray-400 mt-1">
            {t("hr:reviews.trackReviewCompletion")}
          </p>
        </div>
      </div>

      {/* Compliance Dashboard */}
      <ComplianceDashboard />
    </div>
  );
}
