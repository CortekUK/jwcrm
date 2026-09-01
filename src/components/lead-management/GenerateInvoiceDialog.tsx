"use client";

import { useState, useEffect } from "react";
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
import {
  LineItemsEditor,
  DEFAULT_LINE_ITEM_ROWS,
  parseLineItemRows,
  toLineItemRows,
  type LineItemRow,
} from "./LineItemsEditor";
import { Loader2, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { computeInvoiceAmounts } from "@/lib/finance/invoiceAmounts";
import { formatMoney } from "@/lib/finance/outstandingBalance";
import { companyDetails } from "@/config/company";
import type { InvoiceLineItem } from "@/lib/pdf/invoiceLineItems";

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
  const [items, setItems] = useState<LineItemRow[]>(DEFAULT_LINE_ITEM_ROWS);
  const [currency] = useState("AED");
  const [description, setDescription] = useState("Legal services");
  // VAT is per-invoice now (some matters are zero-rated), seeded with the
  // configured company default so the common case needs no thought.
  const [vatRate, setVatRate] = useState<string>(String(companyDetails.vatRate));
  const [sendEmail, setSendEmail] = useState(true);

  // Start from what has already been agreed with this lead rather than blank
  // defaults: retyping the figures is how the "Due upfront" marks were being
  // lost between the proposal and the invoice.
  useEffect(() => {
    if (!open || !leadId) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("proposals")
          .select("line_items, vat_rate")
          .eq("lead_id", leadId)
          .not("status", "in", "(paid,cancelled)")
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        if (cancelled) return;

        const existing = data?.[0];
        if (existing) {
          setItems(toLineItemRows((existing.line_items ?? null) as InvoiceLineItem[] | null));
          setVatRate(
            existing.vat_rate != null
              ? String(existing.vat_rate)
              : String(companyDetails.vatRate)
          );
        }
      } catch (err) {
        // Never block invoicing on this — fall back to the defaults.
        console.error("Could not load the existing deal for this lead:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, leadId]);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    invoiceNumber: string;
    paymentUrl: string | null;
  } | null>(null);

  const parsedItems = parseLineItemRows(items);
  // Same helper the PDF, the email and the payment link use, so what the
  // salesperson reads here is exactly what the client will be charged.
  const amounts = computeInvoiceAmounts(
    { amount: 0, line_items: parsedItems, vat_rate: Number(vatRate) },
    companyDetails.vatRate
  );
  const total = amounts.subtotal;

  const handleGenerate = async () => {
    if (parsedItems.length === 0 || total <= 0) {
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
        body: JSON.stringify({
          amount: total,
          line_items: parsedItems,
          currency,
          description,
          vat_rate: Number(vatRate),
          sendEmail,
        }),
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
      setItems(DEFAULT_LINE_ITEM_ROWS);
      setDescription("Legal services");
      setVatRate(String(companyDetails.vatRate));
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
            <LineItemsEditor
              items={items}
              onChange={setItems}
              vatRate={vatRate}
              currency={currency}
            />
            <div className="space-y-1">
              <Label htmlFor="invoice-vat-rate">{t("vatPercent", "VAT %")}</Label>
              <Input
                id="invoice-vat-rate"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                className="w-28"
              />
            </div>
            {total > 0 && (
              <div className="space-y-1 rounded-lg border border-[#E6E6E4] bg-[#FAFAF8] p-3 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{t("subtotal", "Subtotal")}</span>
                  <span>{formatMoney(amounts.subtotal, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{amounts.vatLabel}</span>
                  <span>{formatMoney(amounts.vatAmount, currency)}</span>
                </div>
                <div className="flex items-center justify-between font-semibold">
                  <span>{t("invoiceTotal")}</span>
                  <span>{formatMoney(amounts.invoiceTotal, currency)}</span>
                </div>
              </div>
            )}
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
