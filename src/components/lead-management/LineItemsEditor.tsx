"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

export type LineItemRow = { description: string; amount: string };

export const DEFAULT_LINE_ITEM_ROWS: LineItemRow[] = [
  { description: "Will Drafting (UAE)", amount: "" },
  { description: "Court Fee", amount: "" },
];

interface LineItemsEditorProps {
  items: LineItemRow[];
  onChange: (items: LineItemRow[]) => void;
  label?: string;
}

/**
 * Freeform itemised-charges editor (description + amount rows), shared by
 * SendProposalDialog, SendInvoiceDialog, and GenerateInvoiceDialog so all
 * three collect the same shape of line items.
 */
export function LineItemsEditor({ items, onChange, label }: LineItemsEditorProps) {
  const { t } = useTranslation("leadManagement");

  const updateItem = (idx: number, field: keyof LineItemRow, value: string) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  const addItem = () => onChange([...items, { description: "", amount: "" }]);
  const removeItem = (idx: number) =>
    onChange(items.length > 1 ? items.filter((_, i) => i !== idx) : items);

  return (
    <div className="space-y-2">
      <Label className="text-base font-semibold">
        {label ?? t("invoiceItems", "Invoice Items")} *
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
  );
}
