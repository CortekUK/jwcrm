"use client";

import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { ComplianceDashboard } from "@/components/hr/reviews";

export default function AdminReviewCompliancePage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className={`flex items-center gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/hr/reviews")}
            className="text-[#6B6B6B] hover:text-[hsl(var(--jw-primary-green))] hover:bg-[rgba(198,160,59,0.1)]"
          >
            <ArrowLeft className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
          </Button>
          <div className={isRtl ? "text-right" : ""}>
            <div className={`flex items-center gap-3 mb-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <BarChart3 className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 
                className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" 
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                {t("hr:reviews.complianceDashboard")}
              </h1>
            </div>
            <p className={`text-sm text-[#777777] ${isRtl ? "mr-9" : "ml-9"}`}>
              {t("hr:reviews.trackReviewCompletion")}
            </p>
          </div>
        </div>
      </div>

      {/* Compliance Dashboard */}
      <ComplianceDashboard />

      {/* Legal Notice Footer */}
      <div className="mt-8 pt-4 border-t border-[#E6E6E4]">
        <p className="text-xs text-[#777777] text-center">
          {t("hr:legalNotice")}
        </p>
      </div>
    </div>
  );
}
