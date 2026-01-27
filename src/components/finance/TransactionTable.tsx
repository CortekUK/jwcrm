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
import { Checkbox } from "@/components/ui/checkbox";
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
import { 
  Pencil, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Receipt,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarIcon,
  X,
  Filter,
  FileDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, parseISO, subDays, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { toast } from "sonner";
import { FinanceTransaction, TransactionType, EXPENSE_CATEGORIES, EARNING_CATEGORIES, TransactionCategory } from "@/types/finance";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type SortField = "transaction_date" | "type" | "category" | "description" | "amount";
type SortDirection = "asc" | "desc" | null;

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface TransactionTableProps {
  transactions: FinanceTransaction[];
  isLoading?: boolean;
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onEdit: (transaction: FinanceTransaction) => void;
  onDelete: (transaction: FinanceTransaction) => void;
  onAddNew: (type: TransactionType) => void;
  // Advanced filter props
  categoryFilter?: TransactionCategory[];
  onCategoryFilterChange?: (categories: TransactionCategory[]) => void;
  amountMin?: number;
  amountMax?: number;
  onAmountMinChange?: (value: number | undefined) => void;
  onAmountMaxChange?: (value: number | undefined) => void;
}

const PAGE_SIZES = [10, 25, 50, 100];
const ALL_CATEGORIES = [...EARNING_CATEGORIES, ...EXPENSE_CATEGORIES];

export function TransactionTable({
  transactions,
  isLoading,
  typeFilter,
  onTypeFilterChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onEdit,
  onDelete,
  onAddNew,
  categoryFilter,
  onCategoryFilterChange,
  amountMin,
  amountMax,
  onAmountMinChange,
  onAmountMaxChange,
}: TransactionTableProps) {
  const { t } = useTranslation("finance");
  
  // Search and local filters
  const [searchTerm, setSearchTerm] = useState("");
  const [localCategoryFilter, setLocalCategoryFilter] = useState<TransactionCategory[]>([]);
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
  const effectiveCategoryFilter = categoryFilter ?? localCategoryFilter;
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

  const openReceipt = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("finance-receipts")
        .createSignedUrl(path, 3600); // 1 hour expiry

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error) {
      console.error("Error getting receipt URL:", error);
      toast.error(t("failedToOpenReceipt"));
    }
  };

  const getTypeBadge = (type: TransactionType) => {
    if (type === "earning") {
      return (
        <Badge className="bg-[#E6F7F1] text-[#0C5536] border-0 gap-1">
          <TrendingUp className="h-3 w-3" />
          {t("earning")}
        </Badge>
      );
    }
    return (
      <Badge className="bg-[#FEECEC] text-[#C0392B] border-0 gap-1">
        <TrendingDown className="h-3 w-3" />
        {t("expense")}
      </Badge>
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

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    let result = [...transactions];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter((tx) =>
        tx.description?.toLowerCase().includes(search) ||
        tx.reference_number?.toLowerCase().includes(search) ||
        t(`categories.${tx.category}`).toLowerCase().includes(search)
      );
    }

    // Category filter
    if (effectiveCategoryFilter.length > 0) {
      result = result.filter((tx) => effectiveCategoryFilter.includes(tx.category));
    }

    // Amount range filter
    if (effectiveAmountMin !== undefined) {
      result = result.filter((tx) => tx.amount >= effectiveAmountMin);
    }
    if (effectiveAmountMax !== undefined) {
      result = result.filter((tx) => tx.amount <= effectiveAmountMax);
    }

    // Sorting
    if (sortField && sortDirection) {
      result.sort((a, b) => {
        let aValue: string | number | null = null;
        let bValue: string | number | null = null;

        switch (sortField) {
          case "transaction_date":
            aValue = a.transaction_date;
            bValue = b.transaction_date;
            break;
          case "type":
            aValue = a.type;
            bValue = b.type;
            break;
          case "category":
            aValue = a.category;
            bValue = b.category;
            break;
          case "description":
            aValue = a.description || "";
            bValue = b.description || "";
            break;
          case "amount":
            aValue = a.amount;
            bValue = b.amount;
            break;
        }

        if (aValue === null || bValue === null) return 0;
        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [transactions, searchTerm, effectiveCategoryFilter, effectiveAmountMin, effectiveAmountMax, sortField, sortDirection, t]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedTransactions.length / pageSize);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedTransactions.slice(start, start + pageSize);
  }, [filteredAndSortedTransactions, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, startDate, endDate, effectiveCategoryFilter, effectiveAmountMin, effectiveAmountMax]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedTransactions.map(tx => tx.id)));
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
      ? filteredAndSortedTransactions.filter(tx => selectedIds.has(tx.id))
      : filteredAndSortedTransactions;

    const headers = [
      t("date"),
      t("type"),
      t("category"),
      t("description"),
      t("reference"),
      t("amount"),
      t("currency"),
    ];

    const rows = dataToExport.map(tx => [
      format(parseISO(tx.transaction_date), "yyyy-MM-dd"),
      tx.type,
      t(`categories.${tx.category}`),
      tx.description || "",
      tx.reference_number || "",
      tx.amount.toString(),
      tx.currency,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  }, [filteredAndSortedTransactions, selectedIds, t]);

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

    onStartDateChange(from ? format(from, "yyyy-MM-dd") : "");
    onEndDateChange(to ? format(to, "yyyy-MM-dd") : "");
  };

  const clearFilters = () => {
    setSearchTerm("");
    onTypeFilterChange("all");
    onStartDateChange("");
    onEndDateChange("");
    if (onCategoryFilterChange) {
      onCategoryFilterChange([]);
    } else {
      setLocalCategoryFilter([]);
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

  const toggleCategoryFilter = (category: TransactionCategory) => {
    const current = effectiveCategoryFilter;
    const newCategories = current.includes(category)
      ? current.filter(c => c !== category)
      : [...current, category];
    
    if (onCategoryFilterChange) {
      onCategoryFilterChange(newCategories);
    } else {
      setLocalCategoryFilter(newCategories);
    }
  };

  const hasActiveFilters = searchTerm || typeFilter !== "all" || startDate || endDate || effectiveCategoryFilter.length > 0 || effectiveAmountMin !== undefined || effectiveAmountMax !== undefined;

  // Get available categories based on type filter
  const availableCategories = typeFilter === "earning" 
    ? EARNING_CATEGORIES 
    : typeFilter === "expense" 
      ? EXPENSE_CATEGORIES 
      : ALL_CATEGORIES;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-36 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-36 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("category")}</TableHead>
                <TableHead>{t("description")}</TableHead>
                <TableHead>{t("reference")}</TableHead>
                <TableHead>{t("receipt")}</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead className="text-center">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-4 w-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-6 bg-gray-200 rounded animate-pulse w-20" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse w-8" /></TableCell>
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
              placeholder={t("searchTransactions", "Search transactions...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
            />
          </div>

          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={onTypeFilterChange}>
            <SelectTrigger className="w-36 border-[#E6E6E4]">
              <SelectValue placeholder={t("type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              <SelectItem value="earning">{t("earning")}</SelectItem>
              <SelectItem value="expense">{t("expense")}</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal border-[#E6E6E4]", !startDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? (
                  endDate ? (
                    <>
                      {format(parseISO(startDate), "LLL dd")} - {format(parseISO(endDate), "LLL dd")}
                    </>
                  ) : (
                    format(parseISO(startDate), "LLL dd, y")
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
                selected={{ from: startDate ? parseISO(startDate) : undefined, to: endDate ? parseISO(endDate) : undefined }}
                onSelect={(range) => {
                  onStartDateChange(range?.from ? format(range.from, "yyyy-MM-dd") : "");
                  onEndDateChange(range?.to ? format(range.to, "yyyy-MM-dd") : "");
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          {/* Category Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("border-[#E6E6E4]", effectiveCategoryFilter.length > 0 && "border-[#C6A03B]")}>
                <Filter className="mr-2 h-4 w-4" />
                {t("category")}
                {effectiveCategoryFilter.length > 0 && (
                  <span className="ml-1 text-xs bg-[#C6A03B] text-white rounded-full px-1.5">{effectiveCategoryFilter.length}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {availableCategories.map((category) => (
                  <div
                    key={category}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#FAFAF8]",
                      effectiveCategoryFilter.includes(category) && "bg-[#FFF9E6]"
                    )}
                    onClick={() => toggleCategoryFilter(category)}
                  >
                    <Checkbox checked={effectiveCategoryFilter.includes(category)} />
                    <span className="text-sm">{t(`categories.${category}`)}</span>
                  </div>
                ))}
              </div>
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

        {/* Second Row: Add buttons, Export & Summary */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-[#6B6B6B]">
            {t("showingResults", "Showing {{start}}-{{end}} of {{total}} results", {
              start: Math.min((currentPage - 1) * pageSize + 1, filteredAndSortedTransactions.length),
              end: Math.min(currentPage * pageSize, filteredAndSortedTransactions.length),
              total: filteredAndSortedTransactions.length,
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportToCSV} className="border-[#E6E6E4]">
              <FileDown className="h-4 w-4 mr-1" />
              {t("exportCSV", "Export CSV")}
              {selectedIds.size > 0 && ` (${selectedIds.size})`}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-[#0C5536]/30 text-[#0C5536] hover:bg-[#E6F7F1] hover:border-[#0C5536]"
              onClick={() => onAddNew("earning")}
            >
              <Plus className="h-4 w-4" />
              {t("addEarning")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-[#C0392B]/30 text-[#C0392B] hover:bg-[#FEECEC] hover:border-[#C0392B]"
              onClick={() => onAddNew("expense")}
            >
              <Plus className="h-4 w-4" />
              {t("addExpense")}
            </Button>
          </div>
        </div>
      </div>

      {paginatedTransactions.length === 0 ? (
        <div className="rounded-lg border border-[#E6E6E4] p-12 text-center">
          <TrendingUp className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
          <p className="font-medium text-[#222222]">{t("noTransactions")}</p>
          <p className="text-sm text-[#6B6B6B] mt-1">
            {t("addFirstTransaction")}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAF8]">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedIds.size === paginatedTransactions.length && paginatedTransactions.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#222222] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("transaction_date")}
                  >
                    <div className="flex items-center">
                      {t("date")}
                      {getSortIcon("transaction_date")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#222222] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("type")}
                  >
                    <div className="flex items-center">
                      {t("type")}
                      {getSortIcon("type")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#222222] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("category")}
                  >
                    <div className="flex items-center">
                      {t("category")}
                      {getSortIcon("category")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#222222] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("description")}
                  >
                    <div className="flex items-center">
                      {t("description")}
                      {getSortIcon("description")}
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-[#222222]">{t("reference")}</TableHead>
                  <TableHead className="font-semibold text-[#222222]">{t("receipt")}</TableHead>
                  <TableHead 
                    className="font-semibold text-[#222222] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("amount")}
                  >
                    <div className="flex items-center">
                      {t("amount")}
                      {getSortIcon("amount")}
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-[#222222] text-center">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.map((transaction) => (
                  <TableRow key={transaction.id} className="hover:bg-[#FAFAF8]">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(transaction.id)}
                        onCheckedChange={() => toggleSelect(transaction.id)}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[#555555]">
                      {format(new Date(transaction.transaction_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {getTypeBadge(transaction.type)}
                    </TableCell>
                    <TableCell className="text-[#555555]">
                      {t(`categories.${transaction.category}`)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-[#555555]">
                      {transaction.description || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-[#555555]">
                      {transaction.reference_number || "-"}
                    </TableCell>
                    <TableCell>
                      {transaction.receipt_path ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#C6A03B] hover:text-[#8B6914] hover:bg-[#FFF9E6]"
                          onClick={() => openReceipt(transaction.receipt_path!)}
                          title={t("viewReceipt")}
                        >
                          <Receipt className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-[#999999] text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className={`font-semibold ${
                      transaction.type === "earning" ? "text-[#0C5536]" : "text-[#C0392B]"
                    }`}>
                      {transaction.type === "expense" ? "-" : "+"}
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#555555] hover:text-[#C6A03B] hover:bg-[#FFF9E6]"
                          onClick={() => onEdit(transaction)}
                          title={t("edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#555555] hover:text-[#C0392B] hover:bg-[#FEECEC]"
                          onClick={() => onDelete(transaction)}
                          title={t("delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
