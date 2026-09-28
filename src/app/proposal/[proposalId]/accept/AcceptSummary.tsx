// The figures box on the accept page.
//
// Shared by the server page (a proposal with nothing to choose) and the client
// form (a proposal whose totals follow the court being picked), so the two can
// never show the same proposal in two different layouts. No hooks and no
// "use client": it renders the same on either side.

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

type Props = {
  invoiceNumber: string;
  clientName: string;
  currency: string;
  /** Chosen (or being chosen) registration court; the row is omitted when null. */
  courtLabel: string | null;
  /**
   * The figures to show — resolved through the shared amounts helper by the
   * caller, never recomputed here. Null while a court still has to be picked:
   * without one there is no total, and showing the fixed part alone would read
   * as the price.
   */
  totals: {
    invoiceTotal: number;
    staged: boolean;
    upfrontTotal: number;
    laterTotal: number;
  } | null;
};

export function AcceptSummary({ invoiceNumber, clientName, currency, courtLabel, totals }: Props) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 divide-y divide-border mb-8">
      <div className="flex items-center justify-between px-5 py-3.5">
        <span className="text-sm text-muted-foreground">Reference</span>
        <span className="text-sm font-medium text-foreground">{invoiceNumber}</span>
      </div>
      <div className="flex items-center justify-between px-5 py-3.5">
        <span className="text-sm text-muted-foreground">Prepared for</span>
        <span className="text-sm font-medium text-foreground">{clientName}</span>
      </div>
      {courtLabel && (
        <div className="flex items-center justify-between px-5 py-3.5">
          <span className="text-sm text-muted-foreground">Registration court</span>
          <span className="text-sm font-medium text-foreground">{courtLabel}</span>
        </div>
      )}
      <div className="flex items-center justify-between px-5 py-3.5">
        <span className="text-sm text-muted-foreground">Total (incl. VAT)</span>
        {totals ? (
          <span className="text-sm font-semibold text-foreground">
            {formatCurrency(totals.invoiceTotal, currency)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground italic">Choose a court above</span>
        )}
      </div>
      {/* Only meaningful on a staged proposal: on a flat one the "payable
          now" figure is just the total again. */}
      {totals && totals.staged && totals.laterTotal > 0 && (
        <div className="px-5 py-3.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Payable now to begin drafting</span>
            <span className="text-sm font-semibold text-[#0C5536]">
              {formatCurrency(totals.upfrontTotal, currency)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            The remaining {formatCurrency(totals.laterTotal, currency)} is payable at the court
            appointment stage.
          </p>
        </div>
      )}
    </div>
  );
}
