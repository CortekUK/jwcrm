"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Send } from "lucide-react";

type SendKPIReportButtonProps = {
  employeeId: string;
  employeeName: string;
  employeeEmail: string | null;
  year: number;
  month: number;
  disabled?: boolean;
};

export function SendKPIReportButton({
  employeeId,
  employeeName,
  employeeEmail,
  year,
  month,
  disabled = false,
}: SendKPIReportButtonProps) {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!employeeEmail) {
      toast({
        variant: "destructive",
        description: "Employee has no email address",
      });
      return;
    }

    setSending(true);
    try {
      // Get the session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/hr/kpi-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          employeeId,
          year,
          month,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send report");
      }

      toast({
        title: t("hr:reportSent"),
        description: t("hr:reportSentDesc", { name: employeeName }),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
      setOpen(false);
    } catch (error) {
      console.error("Error sending report:", error);
      toast({
        variant: "destructive",
        description:
          error instanceof Error ? error.message : t("hr:failedToSendReport"),
      });
    } finally {
      setSending(false);
    }
  };

  const monthName = new Date(year, month - 1, 1).toLocaleString(
    i18n.language === "ar" ? "ar-EG" : "en-US",
    { month: "long" }
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !employeeEmail}
          className="border-[#E6E6E4]"
        >
          <Mail className="h-4 w-4 mr-1" />
          {t("hr:sendReport")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <Send className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("hr:sendKPIReport")}
          </DialogTitle>
          <DialogDescription className={isRtl ? "text-right" : ""}>
            {t("hr:sendReportToEmployee")}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <div className="p-3 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]">
            <p className="text-sm text-[#6B6B6B]">{t("hr:recipient")}:</p>
            <p className="font-medium text-[#222222]">{employeeName}</p>
            <p className="text-sm text-[#6B6B6B]">{employeeEmail || "-"}</p>
          </div>

          <div className="p-3 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]">
            <p className="text-sm text-[#6B6B6B]">{t("hr:period")}:</p>
            <p className="font-medium text-[#222222]">
              {monthName} {year}
            </p>
          </div>
        </div>

        <DialogFooter className={`gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-[#E6E6E4]"
          >
            {t("hr:cancel")}
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !employeeEmail}
            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
          >
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("hr:sendReport")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
