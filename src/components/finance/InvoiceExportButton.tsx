"use client";

import { useState } from "react";
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
import { Download, Loader2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Proposal, ProposalStatus } from "@/types/finance";
import { format, parseISO, subMonths, startOfMonth, endOfMonth } from "date-fns";

type DateRange = "thisMonth" | "lastMonth" | "last3Months" | "last6Months" | "thisYear" | "all";

export function InvoiceExportButton() {
  const { t, i18n } = useTranslation(["finance", "common"]);
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("thisMonth");
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "all">("all");

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
        .from("proposals")
        .select(`
          *,
          lead:leads(id, full_name, email, company_name)
        `)
        .order("created_at", { ascending: false });

      // Apply date range filter
      const range = getDateRange(dateRange);
      if (range) {
        query = query
          .gte("created_at", format(range.start, "yyyy-MM-dd"))
          .lte("created_at", format(range.end, "yyyy-MM-dd"));
      }

      // Apply status filter
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const invoices = data as Proposal[];

      if (invoices.length === 0) {
        toast({
          variant: "destructive",
          description: t("finance:noInvoicesToExport", "No invoices to export"),
        });
        return;
      }

      // Generate CSV
      const headers = [
        t("finance:invoiceNumber", "Invoice Number"),
        t("finance:type", "Type"),
        t("finance:client", "Client"),
        "Email",
        t("finance:company", "Company"),
        t("finance:amount", "Amount"),
        t("finance:currency", "Currency"),
        t("finance:status", "Status"),
        t("finance:sentDate", "Sent Date"),
        t("finance:paidDate", "Paid Date"),
        t("finance:createdDate", "Created Date"),
      ];

      const rows = invoices.map((inv) => [
        inv.invoice_number || "",
        inv.invoiced_at ? t("finance:invoice", "Invoice") : t("finance:proposal", "Proposal"),
        inv.lead?.full_name || "",
        inv.lead?.email || "",
        inv.lead?.company_name || "",
        inv.amount.toString(),
        inv.currency,
        inv.status,
        inv.sent_at ? format(parseISO(inv.sent_at), "yyyy-MM-dd") : "",
        inv.paid_at ? format(parseISO(inv.paid_at), "yyyy-MM-dd") : "",
        format(parseISO(inv.created_at), "yyyy-MM-dd"),
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
      link.download = `invoices_${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: t("finance:exportSuccess", "Export completed"),
        description: t("finance:invoicesExported", "{{count}} invoices exported", { count: invoices.length }),
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
            <FileText className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("finance:exportInvoices", "Export Invoices")}
          </DialogTitle>
          <DialogDescription className={isRtl ? "text-right" : ""}>
            {t("finance:exportInvoicesDesc", "Download invoice records as CSV")}
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
            <Label>{t("finance:status", "Status")}</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProposalStatus | "all")}>
              <SelectTrigger className="border-[#E6E6E4]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("finance:allStatuses", "All Statuses")}</SelectItem>
                <SelectItem value="draft">{t("finance:draft", "Draft")}</SelectItem>
                <SelectItem value="sent">{t("finance:sent", "Sent")}</SelectItem>
                <SelectItem value="paid">{t("finance:paid", "Paid")}</SelectItem>
                <SelectItem value="cancelled">{t("finance:cancelled", "Cancelled")}</SelectItem>
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
