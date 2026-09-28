"use client";

import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  COURT_IDS,
  COURT_LABELS,
  defaultCourtDescription,
  normalizeCourtOptions,
  type CourtId,
  type CourtOption,
} from "@/lib/lead-management/courtOptions";

/**
 * One row per court, ticked or not, kept as typed strings like LineItemRow so
 * a half-typed amount is not coerced to 0 while the team is still typing.
 * Unticking keeps what was typed, so ticking again does not lose it.
 */
export type CourtOptionRow = {
  court: CourtId;
  enabled: boolean;
  description: string;
  quantity: string;
  /** Always starts empty: court fees are typed per proposal, never defaulted. */
  amount: string;
};

export function emptyCourtRows(): CourtOptionRow[] {
  return COURT_IDS.map((court) => ({
    court,
    enabled: false,
    description: defaultCourtDescription(court),
    quantity: "1",
    amount: "",
  }));
}

/** proposals.court_options -> editor rows. Null/legacy -> nothing ticked. */
export function courtRowsFromOptions(raw: unknown): CourtOptionRow[] {
  const offered = new Map(normalizeCourtOptions(raw).map((o) => [o.court, o]));
  return emptyCourtRows().map((row) => {
    const o = offered.get(row.court);
    return o
      ? {
          court: row.court,
          enabled: true,
          description: o.description,
          quantity: String(o.quantity),
          amount: String(o.amount),
        }
      : row;
  });
}

/** Ticked rows -> the stored shape (amounts as numbers). */
export function parseCourtRows(rows: CourtOptionRow[]): CourtOption[] {
  return normalizeCourtOptions(
    rows
      .filter((r) => r.enabled)
      .map((r) => ({
        court: r.court,
        description: r.description,
        amount: parseFloat(r.amount) || 0,
        quantity: parseInt(r.quantity, 10),
      }))
  );
}

interface CourtOptionsEditorProps {
  rows: CourtOptionRow[];
  onChange: (rows: CourtOptionRow[]) => void;
  currency?: string;
}

/**
 * The registration-court picker on the Send Proposal dialog. One court ticked
 * is an ordinary fee line; two or three are offered to the client as
 * alternatives (see lead-management/courtOptions.ts for the rules).
 */
export function CourtOptionsEditor({ rows, onChange, currency = "AED" }: CourtOptionsEditorProps) {
  const { t } = useTranslation("leadManagement");

  const update = (court: CourtId, patch: Partial<CourtOptionRow>) =>
    onChange(rows.map((r) => (r.court === court ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      <Label className="text-base font-semibold">
        {t("registrationCourt", "Registration court (government fee)")}
      </Label>
      <p className="text-xs text-muted-foreground">
        {t(
          "registrationCourtHelp",
          "Tick one court to charge its fee as a normal line. Tick two or three to let the client choose: they are shown as alternatives and are not added to the total."
        )}
      </p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.court} className="space-y-1">
            {/* Same brand-green checkbox as the "Due upfront" tick in
                LineItemsEditor, so the two controls read as one family. */}
            <label
              className={`inline-flex items-center gap-2 ltr:pl-1 rtl:pr-1 text-sm cursor-pointer select-none ${
                row.enabled
                  ? "font-medium text-[hsl(var(--jw-primary-green))]"
                  : "text-muted-foreground"
              }`}
            >
              <Checkbox
                checked={row.enabled}
                onCheckedChange={(v) => update(row.court, { enabled: v === true })}
                className="h-3.5 w-3.5 rounded-[3px] border-[#C9C9C5] data-[state=checked]:border-[hsl(var(--jw-primary-green))] data-[state=checked]:bg-[hsl(var(--jw-primary-green))] data-[state=checked]:text-white [&_svg]:h-3 [&_svg]:w-3"
              />
              {t(`court_${row.court}`, COURT_LABELS[row.court])}
            </label>
            {row.enabled && (
              <div className="flex items-start gap-2">
                <Textarea
                  placeholder={t("courtFeeDescription", "Description")}
                  value={row.description}
                  onChange={(e) => update(row.court, { description: e.target.value })}
                  rows={1}
                  className="flex-1 min-h-[38px] resize-y border-[#E6E6E4] focus:border-[#C6A03B]"
                />
                <div className="w-16">
                  <Input
                    type="number"
                    placeholder="1"
                    value={row.quantity}
                    onChange={(e) => update(row.court, { quantity: e.target.value })}
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
                    value={row.amount}
                    onChange={(e) => update(row.court, { amount: e.target.value })}
                    className="ltr:pl-10 rtl:pr-10 border-[#E6E6E4] focus:border-[#C6A03B]"
                    min="0"
                    step="0.01"
                  />
                </div>
                {/* Keeps the inputs aligned with LineItemsEditor's rows, which
                    end in a delete button of this width. */}
                <div className="w-10 shrink-0" aria-hidden />
              </div>
            )}
          </div>
        ))}
      </div>
      {rows.filter((r) => r.enabled).length > 1 && (
        <p className="text-xs text-muted-foreground">
          {t("courtChoiceHint", "The client chooses one court on the accept page.")}
        </p>
      )}
    </div>
  );
}
