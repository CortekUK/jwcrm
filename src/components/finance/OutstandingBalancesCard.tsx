"use client";

// Replaces the spreadsheet the team was keeping to track who had paid a
// drafting fee but still owed court fees + VAT. An invoice stays listed here
// until the balance clears, so nothing goes quiet between the deposit and the
// court date.

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  computeOutstandingInvoices,
  formatMoney,
  type ProposalLike,
  type PaymentLike,
} from "@/lib/finance/outstandingBalance";

export function OutstandingBalancesCard() {
  const { t } = useTranslation(["finance", "common"]);

  const { data, isLoading } = useQuery({
    queryKey: ["outstanding-balances"],
    queryFn: async () => {
      const { data: proposals, error: proposalError } = await supabase
        .from("proposals")
        .select("*, lead:leads(full_name, email)")
        .not("invoiced_at", "is", null)
        .not("status", "in", "(paid,cancelled)");
      if (proposalError) throw proposalError;

      const { data: payments, error: paymentError } = await supabase
        .from("proposal_payments")
        .select("proposal_id, amount");
      if (paymentError) throw paymentError;

      return computeOutstandingInvoices(
        (proposals || []) as unknown as ProposalLike[],
        (payments || []) as unknown as PaymentLike[]
      );
    },
  });

  const totalOutstanding = (data || []).reduce((sum, i) => sum + i.balanceDue, 0);
  const currency = data?.[0]?.currency || "AED";

  return (
    <Card className="border-[#E6E6E4]">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <CardTitle
            className="text-xl font-semibold text-[#0C5536]"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            {t("finance:outstandingBalances", "Outstanding Balances")}
          </CardTitle>
          {!isLoading && (data?.length ?? 0) > 0 && (
            <div className="text-right shrink-0">
              <p className="text-[11px] uppercase tracking-wide text-[#777777]">
                {t("finance:totalOutstanding", "Total outstanding")}
              </p>
              <p className="text-lg font-semibold text-[#C6A03B]">
                {formatMoney(totalOutstanding, currency)}
              </p>
            </div>
          )}
        </div>
        <p className="text-[13px] text-[#777777]">
          {t(
            "finance:outstandingBalancesHint",
            "Invoices that still have money owed. They stay listed until the balance is cleared."
          )}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#C6A03B]" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <p className="text-[14px] font-medium text-[#0C5536]">
              {t("finance:noOutstandingBalances", "Nothing outstanding")}
            </p>
            <p className="text-[12px] text-[#777777]">
              {t("finance:noOutstandingBalancesHint", "Every issued invoice has been paid in full.")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#EAEAE8] text-left text-[#555555]">
                  <th className="py-2 pe-3 font-medium">{t("finance:client", "Client")}</th>
                  <th className="py-2 px-3 font-medium">{t("finance:invoiceNumber", "Invoice")}</th>
                  <th className="py-2 px-3 font-medium text-right">{t("finance:amount", "Total")}</th>
                  <th className="py-2 px-3 font-medium text-right">{t("finance:paid", "Paid")}</th>
                  <th className="py-2 ps-3 font-medium text-right">{t("finance:balanceDue", "Outstanding")}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((inv) => (
                  <tr key={inv.proposalId} className="border-b border-[#F3F3F1] last:border-0">
                    <td className="py-2.5 pe-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#222222]">{inv.clientName}</span>
                        {inv.partiallyPaid && (
                          <Badge className="border-0 bg-[rgba(198,160,59,0.15)] px-1.5 py-0 text-[10px] font-medium text-[#8B6914]">
                            {t("finance:partiallyPaid", "Part paid")}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[#777777]">{inv.invoiceNumber || "—"}</td>
                    <td className="py-2.5 px-3 text-right text-[#555555]">
                      {formatMoney(inv.invoiceTotal, inv.currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-green-700">
                      {formatMoney(inv.totalPaid, inv.currency)}
                    </td>
                    <td className="py-2.5 ps-3 text-right font-semibold text-[#C6A03B]">
                      {formatMoney(inv.balanceDue, inv.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#777777]">
              <AlertCircle className="h-3 w-3" />
              {t(
                "finance:outstandingBalancesFooter",
                "Totals include VAT, matching the amount shown on the client's invoice."
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
