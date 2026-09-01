"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { companyDetails } from "@/config/company";
import type { InvoiceLineItem, LineItemStage } from "@/lib/pdf/invoiceLineItems";
import { computeInvoiceAmounts } from "@/lib/finance/invoiceAmounts";
import { formatMoney } from "@/lib/finance/outstandingBalance";

export type LineItemRow = {
  description: string;
  amount: string;
  /** Display-only multiplier for the invoice COST column ("X2"). */
  quantity: string;
  /**
   * Marks the row as payable up front. Clients typically pay the will-drafting
   * fee to start work and the court fees at the court-appointment stage, so
   * this is how the team decides what the payment link charges first — the
   * client is never asked to choose an amount.
   */
  upfront: boolean;
};

export const DEFAULT_LINE_ITEM_ROWS: LineItemRow[] = [
  // Unstaged by default: an invoice only splits into stages if someone
  // deliberately ticks a row, so nothing changes unless it is asked for.
  { description: "Will Drafting (UAE)", amount: "", quantity: "1", upfront: false },
  { description: "Court Fee", amount: "", quantity: "1", upfront: false },
];

/** The notarization wording the client used to have hardcoded on every invoice. */
export const NOTARIZATION_ROW: LineItemRow = {
  description: companyDetails.notarizationPreset.description,
  amount: "",
  quantity: String(companyDetails.notarizationPreset.quantity),
  upfront: false,
};

/**
 * Editor rows -> the stored line-item shape. Shared by all three dialogs, which
 * previously each rebuilt this mapping and could drift apart.
 */
export function parseLineItemRows(rows: LineItemRow[]): InvoiceLineItem[] {
  return rows
    .filter((r) => r.description.trim().length > 0)
    .map((r) => {
      const stage: LineItemStage = r.upfront ? "upfront" : "later";
      const qty = parseInt(r.quantity, 10);
      return {
        description: r.description.trim(),
        amount: parseFloat(r.amount) || 0,
        quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
        stage,
      };
    });
}

/** Stored line items -> editor rows, so re-opening a saved deal keeps its staging. */
export function toLineItemRows(items: InvoiceLineItem[] | null | undefined): LineItemRow[] {
  if (!items || items.length === 0) return DEFAULT_LINE_ITEM_ROWS;
  return items.map((i) => ({
    description: i.description ?? "",
    amount: i.amount != null ? String(i.amount) : "",
    quantity: String(i.quantity ?? 1),
    upfront: i.stage === "upfront",
  }));
}

interface LineItemsEditorProps {
  items: LineItemRow[];
  onChange: (items: LineItemRow[]) => void;
  label?: string;
  /** Current VAT rate (percent) as typed, so the split preview matches reality. */
  vatRate?: string;
  currency?: string;
}

/**
 * Freeform itemised-charges editor (description + quantity + amount rows),
 * shared by SendProposalDialog, SendInvoiceDialog, and GenerateInvoiceDialog so
 * all three collect the same shape of line items.
 */
export function LineItemsEditor({
  items,
  onChange,
  label,
  vatRate,
  currency = "AED",
}: LineItemsEditorProps) {
  const { t } = useTranslation("leadManagement");

  const updateItem = (
    idx: number,
    field: keyof LineItemRow,
    value: string | boolean
  ) => onChange(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  const addItem = () =>
    onChange([...items, { description: "", amount: "", quantity: "1", upfront: false }]);
  const addNotarization = () => onChange([...items, { ...NOTARIZATION_ROW }]);
  const removeItem = (idx: number) =>
    onChange(items.length > 1 ? items.filter((_, i) => i !== idx) : items);

  // Show the team the exact figures the client will be charged at each stage,
  // so nobody has to work the VAT split out by hand.
  const parsedRate = vatRate !== undefined && vatRate !== "" ? Number(vatRate) : null;
  const amounts = computeInvoiceAmounts(
    {
      amount: 0,
      line_items: parseLineItemRows(items),
      vat_rate: parsedRate !== null && Number.isFinite(parsedRate) ? parsedRate : null,
    },
    companyDetails.vatRate
  );

  return (
    <div className="space-y-2">
      <Label className="text-base font-semibold">
        {label ?? t("invoiceItems", "Invoice Items")} *
      </Label>
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-start gap-2">
              <Textarea
                placeholder={t(
                  "itemDescription",
                  "Description (e.g. Court Fee, POA, MOFA & MOJ)"
                )}
                value={it.description}
                onChange={(e) => updateItem(idx, "description", e.target.value)}
                rows={2}
                className="flex-1 min-h-[38px] resize-y border-[#E6E6E4] focus:border-[#C6A03B]"
              />
              <div className="w-16">
                <Input
                  type="number"
                  placeholder="1"
                  value={it.quantity}
                  onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                  className="border-[#E6E6E4] focus:border-[#C6A03B]"
                  min="1"
                  step="1"
                  title={t("itemQuantity", "Quantity shown in the COST column")}
                />
              </div>
              <div className="relative w-36">
                <span className="absolute ltr:left-2 rtl:right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {currency}
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
            {/* Brand green rather than the shared checkbox's near-black
                `bg-primary`, which read as a heavy black square next to the
                gold/green controls around it. */}
            <label
              className={`inline-flex items-center gap-2 ltr:pl-1 rtl:pr-1 text-xs cursor-pointer select-none ${
                it.upfront
                  ? "font-medium text-[hsl(var(--jw-primary-green))]"
                  : "text-muted-foreground"
              }`}
            >
              <Checkbox
                checked={it.upfront}
                onCheckedChange={(v) => updateItem(idx, "upfront", v === true)}
                className="h-3.5 w-3.5 rounded-[3px] border-[#C9C9C5] data-[state=checked]:border-[hsl(var(--jw-primary-green))] data-[state=checked]:bg-[hsl(var(--jw-primary-green))] data-[state=checked]:text-white [&_svg]:h-3 [&_svg]:w-3"
              />
              {t("dueUpfront", "Due upfront (payable before work starts)")}
            </label>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addNotarization}
          className="border-dashed border-[#E6E6E4] text-muted-foreground"
        >
          <Plus className="ltr:mr-1 rtl:ml-1 h-4 w-4" />
          {t("addNotarizationFee", "Add notarization fee")}
        </Button>
      </div>
      {amounts.staged && (
        <p className="text-xs text-muted-foreground">
          {t("stagedSplitSummary", "Payable now {{now}} · At court stage {{later}}", {
            now: formatMoney(amounts.upfrontTotal, currency),
            later: formatMoney(amounts.laterTotal, currency),
          })}
        </p>
      )}
    </div>
  );
}
