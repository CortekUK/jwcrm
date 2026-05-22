"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface GenerateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  onSuccess?: () => void;
}

export function GenerateInvoiceDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  onSuccess,
}: GenerateInvoiceDialogProps) {
  const { t } = useTranslation("leadManagement");
  const [amount, setAmount] = useState("");
  const [currency] = useState("USD");
  const [description, setDescription] = useState("Legal services");
  const [sendEmail, setSendEmail] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    invoiceNumber: string;
    paymentUrl: string | null;
  } | null>(null);

  const handleGenerate = async () => {
    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error(t("validAmountRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error(t("notSignedIn"));
        return;
      }
      const res = await fetch(`/api/lead-management/leads/${leadId}/invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: amountNum, currency, description, sendEmail }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to generate invoice");
      }
      setLastResult({ invoiceNumber: json.invoiceNumber, paymentUrl: json.paymentUrl });
      toast.success(t("invoiceGenerated"));
      onSuccess?.();
    } catch (err) {
      console.error("invoice generation failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (next: boolean) => {
    if (submitting) return;
    if (!next) {
      // Reset on close
      setAmount("");
      setDescription("Legal services");
      setSendEmail(true);
      setLastResult(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[hsl(var(--jw-primary-green))]" />
            {t("generateInvoice")}
          </DialogTitle>
          <DialogDescription>
            {t("generateInvoiceFor", { name: leadName })}
          </DialogDescription>
        </DialogHeader>

        {lastResult ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{t("invoiceCreatedNumber")}</p>
            <p className="font-mono text-lg font-semibold">{lastResult.invoiceNumber}</p>
            {lastResult.paymentUrl && (
              <a
                href={lastResult.paymentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[hsl(var(--jw-primary-green))] hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                {t("openStripeCheckout")}
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="invoice-amount">{t("amountUSD")} *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="invoice-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="invoice-description">{t("description")}</Label>
              <Textarea
                id="invoice-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={sendEmail}
                onCheckedChange={(v) => setSendEmail(v === true)}
              />
              {t("emailInvoiceToClient")}
            </label>
          </div>
        )}

        <DialogFooter>
          {lastResult ? (
            <Button onClick={() => handleClose(false)}>{t("close")}</Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={submitting}
              >
                {t("cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={submitting}
                className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("generateInvoice")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
