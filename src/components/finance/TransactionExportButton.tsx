"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Loader2, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FinanceTransaction } from "@/types/finance";
import { format, parseISO, subMonths, startOfMonth, endOfMonth } from "date-fns";

type DateRange = "thisMonth" | "lastMonth" | "last3Months" | "last6Months" | "thisYear" | "all";
type TransactionTypeFilter = "all" | "earning" | "expense";

export function TransactionExportButton() {
  const { t, i18n } = useTranslation(["finance", "common"]);
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("thisMonth");
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("all");
  const [includeReceipts, setIncludeReceipts] = useState(false);

  const getDateRange = (range: DateRange): { start: Date; end: Date } | null => {
    const now = new Date();
    switch (range) {
      case "thisMonth":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case "last3Months":
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case "last6Months":
        return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
      case "thisYear":
        return { start: new Date(now.getFullYear(), 0, 1), end: endOfMonth(now) };
      case "all":
        return null;
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      let query = supabase
        .from("finance_transactions")
        .select("*")
        .order("transaction_date", { ascending: false });

      // Apply date range filter
      const range = getDateRange(dateRange);
      if (range) {
        query = query
          .gte("transaction_date", format(range.start, "yyyy-MM-dd"))
          .lte("transaction_date", format(range.end, "yyyy-MM-dd"));
      }

      // Apply type filter
      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const transactions = data as FinanceTransaction[];

      if (transactions.length === 0) {
        toast({
          variant: "destructive",
          description: t("finance:noTransactionsToExport", "No transactions to export"),
        });
        return;
      }

      // Generate CSV
      const headers = [
        t("finance:date", "Date"),
        t("finance:type", "Type"),
        t("finance:category", "Category"),
        t("finance:description", "Description"),
        t("finance:reference", "Reference"),
        t("finance:amount", "Amount"),
        t("finance:currency", "Currency"),
      ];

      const rows = transactions.map((tx) => [
        format(parseISO(tx.transaction_date), "yyyy-MM-dd"),
        tx.type,
        t(`finance:categories.${tx.category}`, tx.category),
        tx.description || "",
        tx.reference_number || "",
        tx.amount.toString(),
        tx.currency,
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      // Download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transactions_${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: t("finance:exportSuccess", "Export completed"),
        description: t("finance:transactionsExported", "{{count}} transactions exported", { count: transactions.length }),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });

      setOpen(false);
    } catch (error) {
      console.error("Export error:", error);
      toast({
        variant: "destructive",
        description: t("finance:exportFailed", "Export failed"),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
        >
          <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("common:export", "Export")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <Receipt className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("finance:exportTransactions", "Export Transactions")}
          </DialogTitle>
          <DialogDescription className={isRtl ? "text-right" : ""}>
            {t("finance:exportTransactionsDesc", "Download transaction records as CSV")}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>{t("finance:dateRange", "Date Range")}</Label>
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="border-[#E6E6E4]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thisMonth">{t("finance:thisMonth", "This Month")}</SelectItem>
                <SelectItem value="lastMonth">{t("finance:lastMonth", "Last Month")}</SelectItem>
                <SelectItem value="last3Months">{t("finance:last3Months", "Last 3 Months")}</SelectItem>
                <SelectItem value="last6Months">{t("finance:last6Months", "Last 6 Months")}</SelectItem>
                <SelectItem value="thisYear">{t("finance:thisYear", "This Year")}</SelectItem>
                <SelectItem value="all">{t("finance:allTime", "All Time")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("finance:transactionType", "Transaction Type")}</Label>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TransactionTypeFilter)}>
              <SelectTrigger className="border-[#E6E6E4]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("finance:allTypes", "All Types")}</SelectItem>
                <SelectItem value="earning">{t("finance:earnings", "Earnings")}</SelectItem>
                <SelectItem value="expense">{t("finance:expenses", "Expenses")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className={`gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={exporting} className="border-[#E6E6E4]">
            {t("common:cancel", "Cancel")}
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {exporting ? t("common:exporting", "Exporting...") : t("common:export", "Export")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
