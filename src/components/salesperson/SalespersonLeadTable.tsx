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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeadStatus } from "@/components/lead-management/LeadStatusBadge";
import { 
  Pencil, 
  Eye, 
  FileText, 
  ChevronDown, 
  Send, 
  CheckCircle2, 
  StickyNote, 
  History, 
  Bell, 
  Calendar as CalendarIcon2, 
  Phone, 
  MessageCircle, 
  Mail, 
  Video, 
  Users, 
  Target,
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
  Receipt,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, subDays, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { LeadHealthIndicator } from "@/components/lead-management/LeadHealthIndicator";

interface Lead {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  notes: string | null;
  source: string | null;
  source_id: string | null;
  status: LeadStatus;
  is_paid: boolean;
  paid_at: string | null;
  paid_amount: number | null;
  paid_currency: string | null;
  created_at: string;
  updated_at: string;
  // Enriched by the page, not columns on `leads`: newest logged communication
  // (or last call attempt) and earliest outstanding reminder.
  last_contact_at?: string | null;
  next_action_at?: string | null;
  source_data?: { id: string; name: string } | null;
}

export interface CommunicationMethod {
  id: string;
  name: string;
  icon: string;
  is_active: boolean;
  display_order: number;
}

export interface LeadSource {
  id: string;
  name: string;
}

type SortField = "full_name" | "email" | "source" | "created_at" | "status";
type SortDirection = "asc" | "desc" | null;

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  phone: Phone,
  "message-circle": MessageCircle,
  mail: Mail,
  video: Video,
  users: Users,
};

const PAGE_SIZES = [10, 25, 50, 100];

interface SalespersonLeadTableProps {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onSendProposal: (lead: Lead) => void;
  onSendInvoice?: (lead: Lead) => void;
  onViewProposals: (lead: Lead) => void;
  onStatusChange: (leadId: string, status: LeadStatus) => void;
  onViewHistory?: (lead: Lead) => void;
  onSetReminder?: (lead: Lead) => void;
  onSendMeetingInvite?: (lead: Lead) => void;
  onAddCommunication?: (lead: Lead, methodId: string) => void;
  communicationMethods?: CommunicationMethod[];
  availableSources?: LeadSource[];
  isLoading?: boolean;
  // Filter props
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
}

export function SalespersonLeadTable({
  leads,
  onEdit,
  onSendProposal,
  onSendInvoice,
  onViewProposals,
  onStatusChange,
  onViewHistory,
  onSetReminder,
  onSendMeetingInvite,
  onAddCommunication,
  communicationMethods = [],
  availableSources = [],
  isLoading,
  searchQuery = "",
  onSearchChange,
  statusFilter = "all",
  onStatusFilterChange,
}: SalespersonLeadTableProps) {
  const getMethodIcon = (iconName: string) => {
    const IconComponent = iconComponents[iconName] || Phone;
    return <IconComponent className="h-4 w-4" />;
  };
  const { t } = useTranslation("leadManagement");
  
  // Local state for filters
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [localStatusFilter, setLocalStatusFilter] = useState("all");
  const [localSourceFilter, setLocalSourceFilter] = useState<string[]>([]);
  const [localDateRange, setLocalDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [localPaidFilter, setLocalPaidFilter] = useState<string>("all");
  
  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Use props or local state
  const effectiveSearchQuery = searchQuery || localSearchQuery;
  const effectiveStatusFilter = statusFilter || localStatusFilter;

  const statusOptions: { value: LeadStatus; label: string }[] = [
    { value: "not_started", label: t("notStarted") },
    { value: "contacted", label: t("contacted") },
    { value: "consultation", label: t("consultation") },
    { value: "meeting", label: t("meeting") },
    { value: "hold", label: t("hold") },
    { value: "qualified", label: t("qualified") },
    { value: "negotiation", label: t("negotiation") },
    { value: "pending", label: t("pending") },
    { value: "won", label: t("won") },
    { value: "lost", label: t("lost") },
    { value: "unreachable", label: t("unreachable") },
  ];

  const filterStatusOptions = [
    { value: "all", label: t("allStatuses") },
    ...statusOptions,
  ];

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

  // Filter and sort leads
  const filteredAndSortedLeads = useMemo(() => {
    let result = [...leads];

    // Search filter
    if (effectiveSearchQuery) {
      const search = effectiveSearchQuery.toLowerCase();
      result = result.filter((lead) =>
        lead.full_name.toLowerCase().includes(search) ||
        lead.email.toLowerCase().includes(search) ||
        lead.company_name?.toLowerCase().includes(search) ||
        lead.phone?.includes(search)
      );
    }

    // Status filter
    if (effectiveStatusFilter !== "all") {
      result = result.filter((lead) => lead.status === effectiveStatusFilter);
    }

    // Source filter
    if (localSourceFilter.length > 0) {
      result = result.filter((lead) => {
        const sourceId = lead.source_id || lead.source;
        return sourceId && localSourceFilter.includes(sourceId);
      });
    }

    // Date range filter
    if (localDateRange.from || localDateRange.to) {
      result = result.filter((lead) => {
        const createdDate = parseISO(lead.created_at);
        if (localDateRange.from && createdDate < localDateRange.from) return false;
        if (localDateRange.to && createdDate > localDateRange.to) return false;
        return true;
      });
    }

    // Paid filter
    if (localPaidFilter !== "all") {
      result = result.filter((lead) => 
        localPaidFilter === "paid" ? lead.is_paid : !lead.is_paid
      );
    }

    // Sorting
    if (sortField && sortDirection) {
      result.sort((a, b) => {
        let aValue: string | number | null = null;
        let bValue: string | number | null = null;

        switch (sortField) {
          case "full_name":
            aValue = a.full_name.toLowerCase();
            bValue = b.full_name.toLowerCase();
            break;
          case "email":
            aValue = a.email.toLowerCase();
            bValue = b.email.toLowerCase();
            break;
          case "source":
            aValue = a.source_data?.name || a.source || "";
            bValue = b.source_data?.name || b.source || "";
            break;
          case "created_at":
            aValue = a.created_at;
            bValue = b.created_at;
            break;
          case "status":
            aValue = a.status;
            bValue = b.status;
            break;
        }

        if (aValue === null || bValue === null) return 0;
        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [leads, effectiveSearchQuery, effectiveStatusFilter, localSourceFilter, localDateRange, localPaidFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedLeads.length / pageSize);
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedLeads.slice(start, start + pageSize);
  }, [filteredAndSortedLeads, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [effectiveSearchQuery, effectiveStatusFilter, localSourceFilter, localDateRange, localPaidFilter]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedLeads.map(l => l.id)));
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
      ? filteredAndSortedLeads.filter(l => selectedIds.has(l.id))
      : filteredAndSortedLeads;

    const headers = [
      t("name"),
      t("email"),
      t("phone"),
      t("company"),
      t("source"),
      t("status"),
      t("paid"),
      t("created"),
    ];

    const rows = dataToExport.map(lead => [
      lead.full_name,
      lead.email,
      lead.phone || "",
      lead.company_name || "",
      lead.source_data?.name || lead.source || "",
      lead.status,
      lead.is_paid ? "Yes" : "No",
      format(parseISO(lead.created_at), "yyyy-MM-dd"),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `my_leads_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  }, [filteredAndSortedLeads, selectedIds, t]);

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

    setLocalDateRange({ from, to });
  };

  const clearFilters = () => {
    if (onSearchChange) onSearchChange("");
    else setLocalSearchQuery("");
    if (onStatusFilterChange) onStatusFilterChange("all");
    else setLocalStatusFilter("all");
    setLocalSourceFilter([]);
    setLocalDateRange({ from: undefined, to: undefined });
    setLocalPaidFilter("all");
  };

  const toggleSourceFilter = (sourceId: string) => {
    const newSources = localSourceFilter.includes(sourceId)
      ? localSourceFilter.filter(s => s !== sourceId)
      : [...localSourceFilter, sourceId];
    setLocalSourceFilter(newSources);
  };

  const hasActiveFilters = effectiveSearchQuery || effectiveStatusFilter !== "all" || localSourceFilter.length > 0 || localDateRange.from || localDateRange.to || localPaidFilter !== "all";

  // Header section
  const headerSection = (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#C6A03B]" />
          <Input
            placeholder={t("searchLeads")}
            value={effectiveSearchQuery}
            onChange={(e) => {
              if (onSearchChange) onSearchChange(e.target.value);
              else setLocalSearchQuery(e.target.value);
            }}
            className="ltr:pl-10 rtl:pr-10 border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
          />
        </div>

        {/* Status Filter */}
        <Select 
          value={effectiveStatusFilter} 
          onValueChange={(val) => {
            if (onStatusFilterChange) onStatusFilterChange(val);
            else setLocalStatusFilter(val);
          }}
        >
          <SelectTrigger className="w-[160px] border-[#E6E6E4]">
            <SelectValue placeholder={t("filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            {filterStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Source Filter */}
        {availableSources.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("border-[#E6E6E4]", localSourceFilter.length > 0 && "border-[#C6A03B]")}>
                <Filter className="mr-2 h-4 w-4" />
                {t("source")}
                {localSourceFilter.length > 0 && (
                  <span className="ml-1 text-xs bg-[#C6A03B] text-white rounded-full px-1.5">{localSourceFilter.length}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {availableSources.map((source) => (
                  <div
                    key={source.id}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#FAFAF8]",
                      localSourceFilter.includes(source.id) && "bg-[#FFF9E6]"
                    )}
                    onClick={() => toggleSourceFilter(source.id)}
                  >
                    <Checkbox checked={localSourceFilter.includes(source.id)} />
                    <span className="text-sm">{source.name}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Date Range Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal border-[#E6E6E4]", !localDateRange.from && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {localDateRange.from ? (
                localDateRange.to ? (
                  <>
                    {format(localDateRange.from, "LLL dd")} - {format(localDateRange.to, "LLL dd")}
                  </>
                ) : (
                  format(localDateRange.from, "LLL dd, y")
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
              selected={{ from: localDateRange.from, to: localDateRange.to }}
              onSelect={(range) => setLocalDateRange({ from: range?.from, to: range?.to })}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Paid Filter */}
        <Select value={localPaidFilter} onValueChange={setLocalPaidFilter}>
          <SelectTrigger className={cn("w-[120px] border-[#E6E6E4]", localPaidFilter !== "all" && "border-[#C6A03B]")}>
            <SelectValue placeholder={t("paidStatus", "Payment")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all", "All")}</SelectItem>
            <SelectItem value="paid">{t("paid", "Paid")}</SelectItem>
            <SelectItem value="unpaid">{t("unpaid", "Unpaid")}</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[#C0392B]">
            <X className="h-4 w-4 mr-1" />
            {t("clearFilters", "Clear")}
          </Button>
        )}
      </div>

      {/* Second Row: Results count and Export */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[#6B6B6B]">
          {t("showingResults", "Showing {{start}}-{{end}} of {{total}} results", {
            start: Math.min((currentPage - 1) * pageSize + 1, filteredAndSortedLeads.length),
            end: Math.min(currentPage * pageSize, filteredAndSortedLeads.length),
            total: filteredAndSortedLeads.length,
          })}
        </div>
        <Button variant="outline" size="sm" onClick={exportToCSV} className="border-[#E6E6E4]">
          <FileDown className="h-4 w-4 mr-1" />
          {t("exportCSV", "Export CSV")}
          {selectedIds.size > 0 && ` (${selectedIds.size})`}
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {headerSection}
        <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAF8]" style={{ borderBottom: '1px solid #EAEAE8' }}>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="font-semibold text-[#555555]">{t("name")}</TableHead>
                <TableHead className="font-semibold text-[#555555]">{t("email")}</TableHead>
                <TableHead className="font-semibold text-[#555555]">{t("phone")}</TableHead>
                <TableHead className="font-semibold text-[#555555]">{t("source")}</TableHead>
                <TableHead className="font-semibold text-[#555555]">{t("created")}</TableHead>
                <TableHead className="font-semibold text-[#555555]">{t("status")}</TableHead>
                <TableHead className="font-semibold text-[#555555]">{t("health", "Health")}</TableHead>
                <TableHead className="font-semibold text-[#555555]">{t("reminder")}</TableHead>
                <TableHead className="font-semibold text-[#555555]">{t("proposal")}</TableHead>
                <TableHead className="font-semibold text-[#555555] text-center">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i} style={{ borderBottom: '1px solid #EAEAE8' }}>
                  <TableCell><div className="h-4 w-4 bg-[#E6E6E4] rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-[#E6E6E4] rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-[#E6E6E4] rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-[#E6E6E4] rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-[#E6E6E4] rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-[#E6E6E4] rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-6 bg-[#E6E6E4] rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-6 bg-[#E6E6E4] rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-8 bg-[#E6E6E4] rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-8 bg-[#E6E6E4] rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-8 bg-[#E6E6E4] rounded animate-pulse" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="space-y-4">
        {headerSection}
        <div className="rounded-lg border border-[#E6E6E4] p-12 text-center">
          <Target className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
          <p className="font-medium text-[#222222]">{t("noLeads")}</p>
          <p className="text-sm text-[#6B6B6B] mt-1">
            {t("leadsWillAppear", "Leads will appear here when they are assigned to you.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {headerSection}
      
      {paginatedLeads.length === 0 ? (
        <div className="rounded-lg border border-[#E6E6E4] p-12 text-center">
          <Target className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
          <p className="font-medium text-[#222222]">{t("noMatchingLeads", "No matching leads")}</p>
          <p className="text-sm text-[#6B6B6B] mt-1">
            {t("tryDifferentFilters", "Try adjusting your filters")}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAF8]" style={{ borderBottom: '1px solid #EAEAE8' }}>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedIds.size === paginatedLeads.length && paginatedLeads.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#555555] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("full_name")}
                  >
                    <div className="flex items-center">
                      {t("name")}
                      {getSortIcon("full_name")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#555555] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("email")}
                  >
                    <div className="flex items-center">
                      {t("email")}
                      {getSortIcon("email")}
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-[#555555]">{t("phone")}</TableHead>
                  <TableHead 
                    className="font-semibold text-[#555555] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("source")}
                  >
                    <div className="flex items-center">
                      {t("source")}
                      {getSortIcon("source")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#555555] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("created_at")}
                  >
                    <div className="flex items-center">
                      {t("created")}
                      {getSortIcon("created_at")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#555555] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center">
                      {t("status")}
                      {getSortIcon("status")}
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-[#555555]">{t("health", "Health")}</TableHead>
                  <TableHead className="font-semibold text-[#555555]">{t("reminder")}</TableHead>
                  <TableHead className="font-semibold text-[#555555]">{t("proposal")}</TableHead>
                  <TableHead className="font-semibold text-[#555555] text-center">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.map((lead) => (
                  <TableRow key={lead.id} className="transition-colors hover:bg-[#FDFBF4]" style={{ borderBottom: '1px solid #EAEAE8' }}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(lead.id)}
                        onCheckedChange={() => toggleSelect(lead.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{lead.full_name}</TableCell>
                    <TableCell>{lead.email}</TableCell>
                    <TableCell>{lead.phone || "-"}</TableCell>
                    <TableCell>{lead.source_data?.name || (lead.source ? lead.source.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "-")}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(lead.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-[160px] h-9 px-3 bg-[#FAFAF8] border border-[#E6E6E4] rounded-md hover:bg-[#FDFBF4] justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${
                                  lead.status === "not_started" ? "bg-[#6B6B6B]" :
                                  lead.status === "contacted" ? "bg-[#0C5536]" :
                                  lead.status === "consultation" ? "bg-[#0369A1]" :
                                  lead.status === "meeting" ? "bg-[#2563EB]" :
                                  lead.status === "hold" ? "bg-[#D97706]" :
                                  lead.status === "qualified" ? "bg-[#7C3AED]" :
                                  lead.status === "negotiation" ? "bg-[#4F46E5]" :
                                  lead.status === "pending" ? "bg-[#C6A03B]" :
                                  lead.status === "won" ? "bg-[#0C5536]" :
                                  "bg-[#C0392B]"
                                }`} />
                                <span className="text-sm text-[#555555]">
                                  {statusOptions.find(s => s.value === lead.status)?.label}
                                </span>
                              </div>
                              <ChevronDown className="h-4 w-4 text-[#777777]" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="min-w-[180px]">
                            {/* Status Options */}
                            <div className="px-2 py-1.5 text-xs font-semibold text-[#777777]">{t("status")}</div>
                            {statusOptions.map((option) => (
                              <DropdownMenuItem
                                key={option.value}
                                onClick={() => onStatusChange(lead.id, option.value)}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${
                                    option.value === "not_started" ? "bg-[#6B6B6B]" :
                                    option.value === "contacted" ? "bg-[#0C5536]" :
                                    option.value === "consultation" ? "bg-[#0369A1]" :
                                    option.value === "meeting" ? "bg-[#2563EB]" :
                                    option.value === "hold" ? "bg-[#D97706]" :
                                    option.value === "qualified" ? "bg-[#7C3AED]" :
                                    option.value === "negotiation" ? "bg-[#4F46E5]" :
                                    option.value === "pending" ? "bg-[#C6A03B]" :
                                    option.value === "won" ? "bg-[#0C5536]" :
                                    "bg-[#C0392B]"
                                  }`} />
                                  <span>{option.label}</span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                            {/* Communication Methods */}
                            {onAddCommunication && communicationMethods.length > 0 && (
                              <>
                                <div className="my-1 border-t border-[#E6E6E4]" />
                                <div className="px-2 py-1.5 text-xs font-semibold text-[#777777]">{t("communication")}</div>
                                {communicationMethods.map((method) => (
                                  <DropdownMenuItem
                                    key={method.id}
                                    onClick={() => onAddCommunication(lead, method.id)}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2">
                                      {getMethodIcon(method.icon)}
                                      <span>{method.name}</span>
                                    </div>
                                  </DropdownMenuItem>
                                ))}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {lead.is_paid && (
                          <Badge
                            variant="outline"
                            className="bg-[#E6F7F1] text-[#0C5536] border-0 gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {t("paid")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {/* Health Indicator */}
                    <TableCell>
                      <LeadHealthIndicator
                        lastContactDate={lead.last_contact_at}
                        nextActionDate={lead.next_action_at}
                        createdAt={lead.created_at}
                        status={lead.status}
                        compact
                      />
                    </TableCell>
                    {/* Set Reminder Button */}
                    <TableCell>
                      {onSetReminder ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSetReminder(lead)}
                          className="gap-1 border-[#C6A03B] text-[#C6A03B] hover:bg-[#FFF9E6]"
                        >
                          <Bell className="h-4 w-4" />
                          {t("setReminder")}
                        </Button>
                      ) : (
                        <span className="text-[#6B6B6B] text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 border-[#0C5536] text-[#0C5536] hover:bg-[#0C5536]/10"
                          >
                            <FileText className="h-4 w-4" />
                            {t("proposal")}
                            <ChevronDown className="h-3 w-3 ltr:ml-1 rtl:mr-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => onSendProposal(lead)}>
                            <Send className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                            {t("sendProposal")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onSendInvoice?.(lead)}>
                            <Receipt className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                            {t("sendInvoice")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onViewProposals(lead)}>
                            <Eye className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                            {t("view")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-0">
                        {onViewHistory && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#777777] hover:text-[hsl(var(--jw-primary-green))] hover:bg-[#E6F7F1]"
                            onClick={() => onViewHistory(lead)}
                            title={t("viewHistory")}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        )}
                        {onSendMeetingInvite && lead.email && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#777777] hover:text-[#C6A03B] hover:bg-[#FFF9E6]"
                            onClick={() => onSendMeetingInvite(lead)}
                            title={t("sendMeetingInvite")}
                          >
                            <CalendarIcon2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#777777] hover:text-[#C6A03B] hover:bg-[#FFF9E6]"
                          onClick={() => onEdit(lead)}
                          title={t("editLead")}
                        >
                          <StickyNote className="h-4 w-4" />
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
