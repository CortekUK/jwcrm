"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface SendWarningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    name: string;
    email: string | null;
  };
  issueSummary: string;
}

const DEFAULT_MESSAGE = `We have noticed some concerning patterns in your recent attendance record.

Company policy requires a minimum 85% attendance rate. Please take steps to improve your attendance.

If you are experiencing any difficulties that affect your ability to maintain regular attendance, please schedule a meeting with HR to discuss possible accommodations.

Best regards,
HR Department`;

export function SendWarningModal({
  open,
  onOpenChange,
  employee,
  issueSummary,
}: SendWarningModalProps) {
  const { t } = useTranslation(["hr"]);
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);

  const handleSend = async () => {
    if (!message.trim()) {
      toast({
        title: t("common.error"),
        description: t("warningModal.pleaseEnterMessage"),
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: t("common.error"),
          description: t("attendancePage.notAuthenticated"),
          variant: "destructive",
        });
        return;
      }

      const response = await fetch("/api/hr/attendance/warning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          employeeId: employee.id,
          employeeName: employee.name,
          employeeEmail: employee.email || "",
          issueSummary,
          message: message.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send warning");
      }

      toast({
        title: t("warningModal.warningSent"),
        description: t("warningModal.warningSentDesc", { name: employee.name }),
      });

      onOpenChange(false);
      setMessage(DEFAULT_MESSAGE);
    } catch (error) {
      console.error("Error sending warning:", error);
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("warningModal.failedToSend"),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            {t("warningModal.title")}
          </DialogTitle>
          <DialogDescription>
            {t("warningModal.description", { name: employee.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Employee Info */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-[#6B6B6B]">{t("warningModal.employee")}</p>
            <p className="font-medium text-[#222222]">{employee.name}</p>
            <p className="text-sm text-[#6B6B6B]">{employee.email || t("warningModal.noEmailOnFile")}</p>
          </div>

          {/* Issue Summary */}
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-700 font-medium">{t("warningModal.issue")}</p>
            <p className="text-yellow-800">{issueSummary}</p>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">{t("warningModal.message")}</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="resize-none"
              placeholder={t("warningModal.enterMessage")}
            />
            <p className="text-xs text-[#6B6B6B]">
              {t("warningModal.willBeSentViaEmail")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("warningModal.sending")}
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                {t("warningModal.sendWarning")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
