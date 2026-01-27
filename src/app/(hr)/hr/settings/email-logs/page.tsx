"use client";

import { useTranslation } from "react-i18next";
import { Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { EmailLogsTable } from "@/components/hr/settings/EmailLogsTable";

export default function EmailLogsPage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/hr/settings">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[rgba(198,160,59,0.15)]">
                  <ArrowLeft className={`h-5 w-5 text-[#6B6B6B] ${isRtl ? "rotate-180" : ""}`} />
                </Button>
              </Link>
              <Mail className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("hr:emailDeliveryLogs", "Email Delivery Logs")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-[72px] rtl:mr-[72px]">
              {t("hr:emailDeliveryLogsDesc", "Monitor all notification emails sent from the system")}
            </p>
          </div>
        </div>
      </div>

      {/* Email Logs Table */}
      <EmailLogsTable />

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("hr:legalNotice")}
        </p>
      </div>
    </div>
  );
}
