"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Eye, 
  Download, 
  ExternalLink, 
  Search, 
  FileText, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  CalendarIcon,
  X,
  Filter,
  FileDown,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, differenceInDays, parseISO, subDays, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { Proposal, ProposalStatus } from "@/types/finance";
import { cn } from "@/lib/utils";

type SortField = "invoice_number" | "client" | "amount" | "status" | "sent_at" | "paid_at";
type SortDirection = "asc" | "desc" | null;

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface InvoiceTableProps {
  proposals: Proposal[];
  isLoading?: boolean;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onViewProposal?: (proposal: Proposal) => void;
  onDownloadInvoice?: (proposal: Proposal) => void;
  // Advanced filter props
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  amountMin?: number;
  amountMax?: number;
  onAmountMinChange?: (value: number | undefined) => void;
  onAmountMaxChange?: (value: number | undefined) => void;
}

const PAGE_SIZES = [10, 25, 50, 100];

export function InvoiceTable({
  proposals,
  isLoading,
  statusFilter,
  onStatusFilterChange,
  onViewProposal,
  onDownloadInvoice,
  dateRange,
  onDateRangeChange,
  amountMin,
  amountMax,
  onAmountMinChange,
  onAmountMaxChange,
}: InvoiceTableProps) {
  const { t } = useTranslation("finance");
  
  // Search and local filters
  const [searchTerm, setSearchTerm] = useState("");
  const [localDateRange, setLocalDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [localAmountMin, setLocalAmountMin] = useState<number | undefined>();
  const [localAmountMax, setLocalAmountMax] = useState<number | undefined>();
  
  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Use props or local state
  const effectiveDateRange = dateRange ?? localDateRange;
  const effectiveAmountMin = amountMin ?? localAmountMin;
  const effectiveAmountMax = amountMax ?? localAmountMax;

  const formatCurrency = (amount: number, currency: string = "AED") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Check if invoice is overdue (sent but not paid, and sent more than 30 days ago)
  const isOverdue = (proposal: Proposal): boolean => {
    if (proposal.status !== "sent" || !proposal.sent_at) return false;
    const sentDate = parseISO(proposal.sent_at);
    const daysSinceSent = differenceInDays(new Date(), sentDate);
    return daysSinceSent > 30;
  };

  const getDaysOverdue = (proposal: Proposal): number => {
    if (!proposal.sent_at) return 0;
    const sentDate = parseISO(proposal.sent_at);
    return differenceInDays(new Date(), sentDate) - 30;
  };

  const getStatusBadge = (status: ProposalStatus, proposal: Proposal) => {
    const styles: Record<ProposalStatus, string> = {
      draft: "bg-[#F5F5F5] text-[#6B6B6B] border-0",
      sent: "bg-[#E6F0FF] text-[#2563EB] border-0",
      paid: "bg-[#E6F7F1] text-[#0C5536] border-0",
      cancelled: "bg-[#FEECEC] text-[#C0392B] border-0",
    };

    const overdue = isOverdue(proposal);

    return (
      <div className="flex items-center gap-1.5">
        <Badge className={cn(styles[status], overdue && "bg-[#FEF3C7] text-[#B45309]")}>
          {t(`status.${status}`)}
        </Badge>
        {overdue && (
          <Badge className="bg-[#FEF3C7] text-[#B45309] border-0 text-xs gap-0.5">
            <AlertTriangle className="h-3 w-3" />
            {getDaysOverdue(proposal)}d
          </Badge>
        )}
      </div>
    );
  };

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    if (sortDirection === "asc") return <ArrowUp className="h-4 w-4 ml-1" />;
    return <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Filter and sort proposals
  const filteredAndSortedProposals = useMemo(() => {
    let result = [...proposals];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter((p) =>
        p.invoice_number?.toLowerCase().includes(search) ||
        p.lead?.full_name?.toLowerCase().includes(search) ||
        p.lead?.email?.toLowerCase().includes(search)
      );
    }

    // Date range filter
    if (effectiveDateRange.from || effectiveDateRange.to) {
      result = result.filter((p) => {
        if (!p.sent_at) return false;
        const sentDate = parseISO(p.sent_at);
        if (effectiveDateRange.from && sentDate < effectiveDateRange.from) return false;
        if (effectiveDateRange.to && sentDate > effectiveDateRange.to) return false;
        return true;
      });
    }

    // Amount range filter
    if (effectiveAmountMin !== undefined) {
      result = result.filter((p) => p.amount >= effectiveAmountMin);
    }
    if (effectiveAmountMax !== undefined) {
      result = result.filter((p) => p.amount <= effectiveAmountMax);
    }

    // Sorting
    if (sortField && sortDirection) {
      result.sort((a, b) => {
        let aValue: string | number | null = null;
        let bValue: string | number | null = null;

        switch (sortField) {
          case "invoice_number":
            aValue = a.invoice_number || "";
            bValue = b.invoice_number || "";
            break;
          case "client":
            aValue = a.lead?.full_name || "";
            bValue = b.lead?.full_name || "";
            break;
          case "amount":
            aValue = a.amount;
            bValue = b.amount;
            break;
          case "status":
            aValue = a.status;
            bValue = b.status;
            break;
          case "sent_at":
            aValue = a.sent_at || "";
            bValue = b.sent_at || "";
            break;
          case "paid_at":
            aValue = a.paid_at || "";
            bValue = b.paid_at || "";
            break;
        }

        if (aValue === null || bValue === null) return 0;
        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [proposals, searchTerm, effectiveDateRange, effectiveAmountMin, effectiveAmountMax, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedProposals.length / pageSize);
  const paginatedProposals = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedProposals.slice(start, start + pageSize);
  }, [filteredAndSortedProposals, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, effectiveDateRange, effectiveAmountMin, effectiveAmountMax]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedProposals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedProposals.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Export functions
  const exportToCSV = useCallback(() => {
    const dataToExport = selectedIds.size > 0 
      ? filteredAndSortedProposals.filter(p => selectedIds.has(p.id))
      : filteredAndSortedProposals;

    const headers = [
      t("invoiceNumber"),
      t("client"),
      "Email",
      t("amount"),
      t("currency"),
      t("status"),
      t("sentDate"),
      t("paidDate"),
    ];

    const rows = dataToExport.map(p => [
      p.invoice_number || "",
      p.lead?.full_name || "",
      p.lead?.email || "",
      p.amount.toString(),
      p.currency,
      p.status,
      p.sent_at ? format(parseISO(p.sent_at), "yyyy-MM-dd") : "",
      p.paid_at ? format(parseISO(p.paid_at), "yyyy-MM-dd") : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `invoices_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  }, [filteredAndSortedProposals, selectedIds, t]);

  // Date preset handlers
  const applyDatePreset = (preset: string) => {
    const today = new Date();
    let from: Date | undefined;
    let to: Date | undefined;

    switch (preset) {
      case "today":
        from = to = today;
        break;
      case "week":
        from = subDays(today, 7);
        to = today;
        break;
      case "month":
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case "quarter":
        from = startOfQuarter(today);
        to = endOfQuarter(today);
        break;
      case "year":
        from = startOfYear(today);
        to = endOfYear(today);
        break;
      case "lastMonth":
        const lastMonth = subMonths(today, 1);
        from = startOfMonth(lastMonth);
        to = endOfMonth(lastMonth);
        break;
      default:
        from = to = undefined;
    }

    if (onDateRangeChange) {
      onDateRangeChange({ from, to });
    } else {
      setLocalDateRange({ from, to });
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    onStatusFilterChange("all");
    if (onDateRangeChange) {
      onDateRangeChange({ from: undefined, to: undefined });
    } else {
      setLocalDateRange({ from: undefined, to: undefined });
    }
    if (onAmountMinChange) {
      onAmountMinChange(undefined);
    } else {
      setLocalAmountMin(undefined);
    }
    if (onAmountMaxChange) {
      onAmountMaxChange(undefined);
    } else {
      setLocalAmountMax(undefined);
    }
  };

  const hasActiveFilters = searchTerm || statusFilter !== "all" || effectiveDateRange.from || effectiveDateRange.to || effectiveAmountMin !== undefined || effectiveAmountMax !== undefined;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <div className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>{t("invoiceNumber")}</TableHead>
                <TableHead>{t("client")}</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("sentDate")}</TableHead>
                <TableHead>{t("paidDate")}</TableHead>
                <TableHead className="text-center">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-4 w-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-6 bg-gray-200 rounded animate-pulse w-20" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-8 bg-gray-200 rounded animate-pulse" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#C6A03B]" />
            <Input
              placeholder={t("searchInvoices", "Search invoices...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-36 border-[#E6E6E4]">
              <SelectValue placeholder={t("filterByStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatuses")}</SelectItem>
              <SelectItem value="draft">{t("status.draft")}</SelectItem>
              <SelectItem value="sent">{t("status.sent")}</SelectItem>
              <SelectItem value="paid">{t("status.paid")}</SelectItem>
              <SelectItem value="cancelled">{t("status.cancelled")}</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal border-[#E6E6E4]", !effectiveDateRange.from && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {effectiveDateRange.from ? (
                  effectiveDateRange.to ? (
                    <>
                      {format(effectiveDateRange.from, "LLL dd")} - {format(effectiveDateRange.to, "LLL dd")}
                    </>
                  ) : (
                    format(effectiveDateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>{t("dateRange", "Date range")}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-2 border-b">
                <div className="flex flex-wrap gap-1">
                  {["today", "week", "month", "quarter", "year", "lastMonth"].map((preset) => (
                    <Button
                      key={preset}
                      variant="ghost"
                      size="sm"
                      onClick={() => applyDatePreset(preset)}
                      className="text-xs"
                    >
                      {t(`datePreset.${preset}`, preset)}
                    </Button>
                  ))}
                </div>
              </div>
              <Calendar
                initialFocus
                mode="range"
                selected={{ from: effectiveDateRange.from, to: effectiveDateRange.to }}
                onSelect={(range) => {
                  if (onDateRangeChange) {
                    onDateRangeChange({ from: range?.from, to: range?.to });
                  } else {
                    setLocalDateRange({ from: range?.from, to: range?.to });
                  }
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          {/* Amount Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("border-[#E6E6E4]", (effectiveAmountMin !== undefined || effectiveAmountMax !== undefined) && "border-[#C6A03B]")}>
                <Filter className="mr-2 h-4 w-4" />
                {t("amount")}
                {(effectiveAmountMin !== undefined || effectiveAmountMax !== undefined) && (
                  <span className="ml-1 text-xs text-[#C6A03B]">●</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">{t("minAmount", "Min Amount")}</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={effectiveAmountMin ?? ""}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      if (onAmountMinChange) onAmountMinChange(val);
                      else setLocalAmountMin(val);
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("maxAmount", "Max Amount")}</label>
                  <Input
                    type="number"
                    placeholder="999999"
                    value={effectiveAmountMax ?? ""}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      if (onAmountMaxChange) onAmountMaxChange(val);
                      else setLocalAmountMax(val);
                    }}
                    className="mt-1"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[#C0392B]">
              <X className="h-4 w-4 mr-1" />
              {t("clearFilters", "Clear")}
            </Button>
          )}
        </div>

        {/* Export & Bulk Actions */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-[#6B6B6B]">
            {t("showingResults", "Showing {{start}}-{{end}} of {{total}} results", {
              start: Math.min((currentPage - 1) * pageSize + 1, filteredAndSortedProposals.length),
              end: Math.min(currentPage * pageSize, filteredAndSortedProposals.length),
              total: filteredAndSortedProposals.length,
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportToCSV} className="border-[#E6E6E4]">
              <FileDown className="h-4 w-4 mr-1" />
              {t("exportCSV", "Export CSV")}
              {selectedIds.size > 0 && ` (${selectedIds.size})`}
            </Button>
          </div>
        </div>
      </div>

      {paginatedProposals.length === 0 ? (
        <div className="rounded-lg border border-[#E6E6E4] p-12 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
          <p className="font-medium text-[#222222]">{t("noInvoices")}</p>
          <p className="text-sm text-[#6B6B6B] mt-1">{t("noInvoicesDesc", "No invoices match your criteria")}</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAF8]">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedIds.size === paginatedProposals.length && paginatedProposals.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#222222] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("invoice_number")}
                  >
                    <div className="flex items-center">
                      {t("invoiceNumber")}
                      {getSortIcon("invoice_number")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#222222] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("client")}
                  >
                    <div className="flex items-center">
                      {t("client")}
                      {getSortIcon("client")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#222222] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("amount")}
                  >
                    <div className="flex items-center">
                      {t("amount")}
                      {getSortIcon("amount")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#222222] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center">
                      {t("status")}
                      {getSortIcon("status")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#222222] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("sent_at")}
                  >
                    <div className="flex items-center">
                      {t("sentDate")}
                      {getSortIcon("sent_at")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#222222] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("paid_at")}
                  >
                    <div className="flex items-center">
                      {t("paidDate")}
                      {getSortIcon("paid_at")}
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-[#222222] text-center">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProposals.map((proposal) => (
                  <TableRow 
                    key={proposal.id} 
                    className={cn(
                      "hover:bg-[#FAFAF8]",
                      isOverdue(proposal) && "bg-[#FFFBEB]"
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(proposal.id)}
                        onCheckedChange={() => toggleSelect(proposal.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm text-[#555555]">
                      {proposal.invoice_number || "-"}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-[#222222]">{proposal.lead?.full_name || "-"}</div>
                        <div className="text-sm text-[#6B6B6B]">
                          {proposal.lead?.email || "-"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-[#222222]">
                      {formatCurrency(proposal.amount, proposal.currency)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(proposal.status, proposal)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[#555555]">
                      {proposal.sent_at
                        ? format(new Date(proposal.sent_at), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[#555555]">
                      {proposal.paid_at
                        ? format(new Date(proposal.paid_at), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {onViewProposal && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#555555] hover:text-[#0C5536] hover:bg-[#E6F7F1]"
                            onClick={() => onViewProposal(proposal)}
                            title={t("viewProposal")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {onDownloadInvoice && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#555555] hover:text-[#C6A03B] hover:bg-[#FFF9E6]"
                            onClick={() => onDownloadInvoice(proposal)}
                            title={t("downloadInvoice")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {proposal.stripe_payment_link && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#555555] hover:text-[#2563EB] hover:bg-[#E6F0FF]"
                            asChild
                            title={t("paymentLink")}
                          >
                            <a
                              href={proposal.stripe_payment_link}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#6B6B6B]">{t("rowsPerPage", "Rows per page")}:</span>
              <Select value={pageSize.toString()} onValueChange={(val) => { setPageSize(Number(val)); setCurrentPage(1); }}>
                <SelectTrigger className="w-[70px] h-8 border-[#E6E6E4]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-[#E6E6E4]"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-[#555555]">
                {t("pageOf", "Page {{current}} of {{total}}", { current: currentPage, total: totalPages || 1 })}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-[#E6E6E4]"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
