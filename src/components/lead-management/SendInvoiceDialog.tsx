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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Lead } from "./LeadTable";
import { InvoicePDFTemplate } from "./InvoicePDFTemplate";
import {
  LineItemsEditor,
  DEFAULT_LINE_ITEM_ROWS,
  parseLineItemRows,
  toLineItemRows,
  type LineItemRow,
} from "./LineItemsEditor";
import { Loader2, Receipt, ChevronDown, ChevronUp, FileText, User, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { computeInvoiceAmounts } from "@/lib/finance/invoiceAmounts";
import type { InvoiceLineItem } from "@/lib/pdf/invoiceLineItems";
import { companyDetails } from "@/config/company";

type ItemRow = LineItemRow;
const INITIAL_ITEMS: ItemRow[] = DEFAULT_LINE_ITEM_ROWS;
const CURRENCY = "AED";

interface SendInvoiceDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SendInvoiceDialog({
  lead,
  open,
  onOpenChange,
  onSuccess,
}: SendInvoiceDialogProps) {
  const { t } = useTranslation("leadManagement");
  const [items, setItems] = useState<ItemRow[]>(INITIAL_ITEMS);
  const [description, setDescription] = useState<string>("");
  // VAT is per-invoice now (some matters are zero-rated), seeded with the
  // configured company default so the common case needs no thought.
  const [vatRate, setVatRate] = useState<string>(String(companyDetails.vatRate));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);

  // Load whatever has already been agreed with this lead.
  //
  // This dialog used to open on blank default rows, so invoicing a lead whose
  // proposal was already sent meant retyping the figures — and retyping them
  // silently dropped the "Due upfront" marks, which is how an invoice that
  // should have billed the drafting fee ended up billing the whole amount.
  useEffect(() => {
    if (!open || !lead) return;
    let cancelled = false;

    (async () => {
      setIsLoadingExisting(true);
      try {
        const { data, error } = await supabase
          .from("proposals")
          .select("line_items, vat_rate")
          .eq("lead_id", lead.id)
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
        } else {
          setItems(DEFAULT_LINE_ITEM_ROWS);
          setVatRate(String(companyDetails.vatRate));
        }
      } catch (err) {
        // A failed lookup must not block invoicing — fall back to the defaults.
        console.error("Could not load the existing deal for this lead:", err);
      } finally {
        if (!cancelled) setIsLoadingExisting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, lead]);

  const parsedItems = parseLineItemRows(items);
  // Same helper the PDF, the email and the payment link use, so the preview
  // below and the totals cannot drift from what the client is charged.
  const amounts = computeInvoiceAmounts(
    { amount: 0, line_items: parsedItems, vat_rate: Number(vatRate) },
    companyDetails.vatRate
  );
  const total = amounts.subtotal;

  const resetForm = () => {
    setItems(INITIAL_ITEMS);
    setDescription("");
    setVatRate(String(companyDetails.vatRate));
    setShowPreview(false);
  };

  const handleSubmit = async () => {
    if (!lead) return;

    if (parsedItems.length === 0 || total <= 0) {
      toast.error(t("validAmountRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const response = await fetch("/api/lead-management/send-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          leadId: lead.id,
          amount: total,
          line_items: parsedItems,
          currency: CURRENCY,
          vat_rate: Number(vatRate),
          description: description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send invoice");
      }

      toast.success(t("invoiceSentSuccess"));
      onOpenChange(false);
      onSuccess();
      resetForm();
    } catch (error) {
      console.error("Error sending invoice:", error);
      toast.error(error instanceof Error ? error.message : t("failedToSendInvoice"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const formattedAmount = total;
  // The summary shows what the client owes, VAT included — the subtotal alone
  // was reading lower than the figure on the PDF they receive.
  const displayPrice = new Intl.NumberFormat("en-AE", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amounts.invoiceTotal);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#C6A03B]" />
            <span className="text-[hsl(var(--jw-primary-green))]">
              {t("sendInvoice")}
            </span>
          </DialogTitle>
          <DialogDescription>
            {t("sendInvoiceDescription", { name: lead?.full_name ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Client Information (Read-only) */}
          <div className="p-4 bg-[#FAFAF8] border border-[#E6E6E4] rounded-lg space-y-3">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("clientInformation")}
            </Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{lead?.full_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{lead?.email}</span>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <LineItemsEditor
            items={items}
            onChange={setItems}
            vatRate={vatRate}
            currency={CURRENCY}
          />

          {/* VAT rate — editable per invoice */}
          <div className="space-y-2">
            <Label htmlFor="invoice-vat-rate">{t("vatPercent", "VAT %")}</Label>
            <Input
              id="invoice-vat-rate"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              className="w-28 border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-[#C6A03B]/20"
            />
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <Label htmlFor="invoice-description">
              {t("invoiceDescription")}
            </Label>
            <Textarea
              id="invoice-description"
              placeholder={t("invoiceDescriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px] border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-[#C6A03B]/20"
            />
            <p className="text-xs text-muted-foreground">
              {t("invoiceDescriptionDefault")}
            </p>
          </div>

          {/* Invoice Preview (Collapsible) */}
          <Collapsible open={showPreview} onOpenChange={setShowPreview}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-between p-3 h-auto border border-[#E6E6E4] rounded-lg text-[#222222] hover:bg-[#FAFAF8] hover:text-[#222222]"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#C6A03B]" />
                  <span className="text-sm font-medium">
                    {t("previewInvoice")}
                  </span>
                </div>
                {showPreview ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="border border-[#E6E6E4] rounded-lg bg-white max-h-[300px] overflow-y-auto">
                {lead && (
                  <InvoicePDFTemplate
                    data={{
                      invoiceNumber: "INV-PREVIEW",
                      clientName: lead.full_name,
                      clientEmail: lead.email,
                      clientPhone: lead.phone,
                      clientCompany: lead.company_name,
                      amount: formattedAmount,
                      currency: CURRENCY,
                      status: "draft",
                      createdAt: new Date().toISOString(),
                      lineItems: parsedItems,
                      vatRate: Number(vatRate),
                      // Nothing can have been paid against an invoice that has
                      // not been sent yet, so the BALANCE row shows the total.
                      amountPaid: 0,
                    }}
                  />
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Summary */}
          {formattedAmount > 0 && (
            <div className="p-4 bg-[#F0FDF4] border border-[#22C55E]/20 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#166534]">
                  {t("invoiceTotal")}
                </span>
                <span className="text-lg font-bold text-[#166534]">
                  AED {displayPrice}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 border-t border-[#E6E6E4] pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="border-[#E6E6E4] hover:bg-[#F5F5F3]"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || total <= 0}
            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
          >
            {isSubmitting ? (
              <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Receipt className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
            )}
            {t("sendInvoice")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
