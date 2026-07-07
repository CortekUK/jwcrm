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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Lead } from "./LeadTable";
import { InvoicePDFTemplate } from "./InvoicePDFTemplate";
import { Loader2, Receipt, ChevronDown, ChevronUp, FileText, User, Mail, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ItemRow = { description: string; amount: string };
const INITIAL_ITEMS: ItemRow[] = [
  { description: "Will Drafting (UAE)", amount: "" },
  { description: "Court Fee", amount: "" },
];

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const parsedItems = items
    .filter((it) => it.description.trim())
    .map((it) => ({ description: it.description.trim(), amount: parseFloat(it.amount) || 0 }));
  const total = parsedItems.reduce((s, it) => s + it.amount, 0);

  const updateItem = (idx: number, field: keyof ItemRow, value: string) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  const addItem = () => setItems((prev) => [...prev, { description: "", amount: "" }]);
  const removeItem = (idx: number) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const resetForm = () => {
    setItems(INITIAL_ITEMS);
    setDescription("");
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
          currency: "AED",
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
  const displayPrice = new Intl.NumberFormat("en-AE", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(formattedAmount);

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
          <div className="space-y-2">
            <Label className="text-base font-semibold">
              {t("invoiceItems", "Invoice Items")} *
            </Label>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder={t("itemDescription", "Description (e.g. Court Fee, POA, MOFA & MOJ)")}
                    value={it.description}
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                    className="flex-1 border-[#E6E6E4] focus:border-[#C6A03B]"
                  />
                  <div className="relative w-36">
                    <span className="absolute ltr:left-2 rtl:right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      AED
                    </span>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={it.amount}
                      onChange={(e) => updateItem(idx, "amount", e.target.value)}
                      className="ltr:pl-10 rtl:pr-10 border-[#E6E6E4] focus:border-[#C6A03B]"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(idx)}
                    disabled={items.length <= 1}
                    className="text-muted-foreground hover:text-[#C0392B]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              className="border-dashed border-[#C6A03B] text-[hsl(var(--jw-primary-green))]"
            >
              <Plus className="ltr:mr-1 rtl:ml-1 h-4 w-4" />
              {t("addItem", "Add item")}
            </Button>
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
                      currency: "AED",
                      status: "draft",
                      createdAt: new Date().toISOString(),
                      lineItems: parsedItems,
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
