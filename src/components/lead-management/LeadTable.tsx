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
import { LeadStatus } from "./LeadStatusBadge";
import { 
  Pencil, 
  Trash2, 
  Eye, 
  FileText, 
  ChevronDown, 
  Send, 
  CheckCircle2, 
  History, 
  Bell, 
  Phone, 
  MessageCircle, 
  Mail, 
  Video, 
  Users, 
  Target, 
  Plus, 
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
  UserCheck,
  Receipt,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, subDays, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { LeadHealthIndicator } from "./LeadHealthIndicator";
import { ExportLeadsDialog } from "./ExportLeadsDialog";
import { usePermissions } from "@/hooks/usePermissions";

export interface Lead {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  lead_type?: "individual" | "corporate" | string;
  notes: string | null;
  source: string | null;
  source_id: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  status: LeadStatus;
  is_paid: boolean;
  paid_at: string | null;
  paid_amount: number | null;
  paid_currency: string | null;
  created_at: string;
  updated_at: string;
  last_contact_date?: string | null;
  next_action_date?: string | null;
  // Joined fields
  source_data?: { id: string; name: string } | null;
  assigned_user?: { user_id: string; full_name: string } | null;
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

export interface Salesperson {
  user_id: string;
  full_name: string;
}

type SortField = "full_name" | "email" | "source" | "assigned_to" | "created_at" | "status";
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

interface LeadTableProps {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onSendProposal: (lead: Lead) => void;
  onSendInvoice?: (lead: Lead) => void;
  onViewProposals: (lead: Lead) => void;
  onStatusChange: (leadId: string, status: LeadStatus) => void;
  onViewHistory?: (lead: Lead) => void;
  onViewSalesperson?: (salespersonId: string) => void;
  onAddCommunication?: (lead: Lead, methodId: string) => void;
  onSetReminder?: (lead: Lead) => void;
  onAddNew?: () => void;
  onBulkAssign?: (leadIds: string[], salespersonId: string) => void;
  onBulkStatusChange?: (leadIds: string[], status: LeadStatus) => void;
  onBulkDelete?: (leadIds: string[]) => void;
  communicationMethods?: CommunicationMethod[];
  availableSources?: LeadSource[];
  availableSalespeople?: Salesperson[];
  isLoading?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  // Advanced filter props
  sourceFilter?: string[];
  onSourceFilterChange?: (sources: string[]) => void;
  assignedToFilter?: string;
  onAssignedToFilterChange?: (salespersonId: string) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  paidFilter?: string;
  onPaidFilterChange?: (value: string) => void;
}

export function LeadTable({
  leads,
  onEdit,
  onDelete,
  onSendProposal,
  onSendInvoice,
  onViewProposals,
  onStatusChange,
  onViewHistory,
  onViewSalesperson,
  onAddCommunication,
  onSetReminder,
  onAddNew,
  onBulkAssign,
  onBulkStatusChange,
  onBulkDelete,
  communicationMethods = [],
  availableSources = [],
  availableSalespeople = [],
  isLoading,
  searchQuery = "",
  onSearchChange,
  statusFilter = "all",
  onStatusFilterChange,
  sourceFilter,
  onSourceFilterChange,
  assignedToFilter,
  onAssignedToFilterChange,
  dateRange,
  onDateRangeChange,
  paidFilter,
  onPaidFilterChange,
}: LeadTableProps) {
  const getMethodIcon = (iconName: string) => {
    const IconComponent = iconComponents[iconName] || Phone;
    return <IconComponent className="h-4 w-4" />;
  };
  const { t } = useTranslation("leadManagement");
  const { canPerform } = usePermissions();

  // Check if user can delete leads (head-only operation for Lead Management)
  const canDeleteLead = canPerform("lead_management", "delete_lead");

  // Local state for filters when props not provided
  const [localSourceFilter, setLocalSourceFilter] = useState<string[]>([]);
  const [localAssignedToFilter, setLocalAssignedToFilter] = useState<string>("all");
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
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  
  // Bulk action state
  const [bulkStatusValue, setBulkStatusValue] = useState<LeadStatus | "">("");
  const [bulkAssignValue, setBulkAssignValue] = useState<string>("");
  
  // Use props or local state
  const effectiveSourceFilter = sourceFilter ?? localSourceFilter;
  const effectiveAssignedToFilter = assignedToFilter ?? localAssignedToFilter;
  const effectiveDateRange = dateRange ?? localDateRange;
  const effectivePaidFilter = paidFilter ?? localPaidFilter;

  const statusOptions: { value: LeadStatus; label: string }[] = [
    { value: "not_started", label: t("notStarted") },
    { value: "contacted", label: t("contacted") },
    { value: "consultation", label: t("consultation") },
    { value: "consultation_completed", label: t("consultationCompleted", "Consultation Completed") },
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

    // Source filter
    if (effectiveSourceFilter.length > 0) {
      result = result.filter((lead) => {
        const sourceId = lead.source_id || lead.source;
        return sourceId && effectiveSourceFilter.includes(sourceId);
      });
    }

    // Assigned to filter
    if (effectiveAssignedToFilter !== "all") {
      if (effectiveAssignedToFilter === "unassigned") {
        result = result.filter((lead) => !lead.assigned_to);
      } else {
        result = result.filter((lead) => lead.assigned_to === effectiveAssignedToFilter);
      }
    }

    // Date range filter
    if (effectiveDateRange.from || effectiveDateRange.to) {
      result = result.filter((lead) => {
        const createdDate = parseISO(lead.created_at);
        if (effectiveDateRange.from && createdDate < effectiveDateRange.from) return false;
        if (effectiveDateRange.to && createdDate > effectiveDateRange.to) return false;
        return true;
      });
    }

    // Paid filter
    if (effectivePaidFilter !== "all") {
      result = result.filter((lead) => 
        effectivePaidFilter === "paid" ? lead.is_paid : !lead.is_paid
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
          case "assigned_to":
            aValue = a.assigned_user?.full_name || "";
            bValue = b.assigned_user?.full_name || "";
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
  }, [leads, effectiveSourceFilter, effectiveAssignedToFilter, effectiveDateRange, effectivePaidFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedLeads.length / pageSize);
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedLeads.slice(start, start + pageSize);
  }, [filteredAndSortedLeads, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, effectiveSourceFilter, effectiveAssignedToFilter, effectiveDateRange, effectivePaidFilter]);

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
      t("assignedTo"),
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
      lead.assigned_user?.full_name || "",
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
    link.download = `leads_${format(new Date(), "yyyy-MM-dd")}.csv`;
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

    if (onDateRangeChange) {
      onDateRangeChange({ from, to });
    } else {
      setLocalDateRange({ from, to });
    }
  };

  const clearFilters = () => {
    if (onSearchChange) onSearchChange("");
    if (onStatusFilterChange) onStatusFilterChange("all");
    if (onSourceFilterChange) onSourceFilterChange([]);
    else setLocalSourceFilter([]);
    if (onAssignedToFilterChange) onAssignedToFilterChange("all");
    else setLocalAssignedToFilter("all");
    if (onDateRangeChange) onDateRangeChange({ from: undefined, to: undefined });
    else setLocalDateRange({ from: undefined, to: undefined });
    if (onPaidFilterChange) onPaidFilterChange("all");
    else setLocalPaidFilter("all");
  };

  const toggleSourceFilter = (sourceId: string) => {
    const current = effectiveSourceFilter;
    const newSources = current.includes(sourceId)
      ? current.filter(s => s !== sourceId)
      : [...current, sourceId];
    
    if (onSourceFilterChange) {
      onSourceFilterChange(newSources);
    } else {
      setLocalSourceFilter(newSources);
    }
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all" || effectiveSourceFilter.length > 0 || effectiveAssignedToFilter !== "all" || effectiveDateRange.from || effectiveDateRange.to || effectivePaidFilter !== "all";

  // Bulk action handlers
  const handleBulkStatusChange = () => {
    if (onBulkStatusChange && bulkStatusValue && selectedIds.size > 0) {
      onBulkStatusChange(Array.from(selectedIds), bulkStatusValue as LeadStatus);
      setSelectedIds(new Set());
      setBulkStatusValue("");
    }
  };

  const handleBulkAssign = () => {
    if (onBulkAssign && bulkAssignValue && selectedIds.size > 0) {
      onBulkAssign(Array.from(selectedIds), bulkAssignValue);
      setSelectedIds(new Set());
      setBulkAssignValue("");
    }
  };

  const handleBulkDelete = () => {
    if (onBulkDelete && selectedIds.size > 0) {
      onBulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  // Header section with search, filters, and create button
  const headerSection = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        {onSearchChange && (
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#C6A03B]" />
            <Input
              placeholder={t("searchLeads")}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="ltr:pl-10 rtl:pr-10 border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
            />
          </div>
        )}

        {/* Status Filter */}
        {onStatusFilterChange && (
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
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
        )}

        {/* Source Filter */}
        {availableSources.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("border-[#E6E6E4]", effectiveSourceFilter.length > 0 && "border-[#C6A03B]")}>
                <Filter className="mr-2 h-4 w-4" />
                {t("source")}
                {effectiveSourceFilter.length > 0 && (
                  <span className="ml-1 text-xs bg-[#C6A03B] text-white rounded-full px-1.5">{effectiveSourceFilter.length}</span>
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
                      effectiveSourceFilter.includes(source.id) && "bg-[#FFF9E6]"
                    )}
                    onClick={() => toggleSourceFilter(source.id)}
                  >
                    <Checkbox checked={effectiveSourceFilter.includes(source.id)} />
                    <span className="text-sm">{source.name}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Assigned To Filter */}
        {availableSalespeople.length > 0 && (
          <Select 
            value={effectiveAssignedToFilter} 
            onValueChange={(val) => {
              if (onAssignedToFilterChange) onAssignedToFilterChange(val);
              else setLocalAssignedToFilter(val);
            }}
          >
            <SelectTrigger className={cn("w-[160px] border-[#E6E6E4]", effectiveAssignedToFilter !== "all" && "border-[#C6A03B]")}>
              <SelectValue placeholder={t("assignedTo")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allSalespeople", "All Salespeople")}</SelectItem>
              <SelectItem value="unassigned">{t("unassigned", "Unassigned")}</SelectItem>
              {availableSalespeople.map((sp) => (
                <SelectItem key={sp.user_id} value={sp.user_id}>
                  {sp.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Date Range Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal border-[#E6E6E4]", !effectiveDateRange.from && "text-muted-foreground")}>
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

        {/* Paid Filter */}
        <Select 
          value={effectivePaidFilter} 
          onValueChange={(val) => {
            if (onPaidFilterChange) onPaidFilterChange(val);
            else setLocalPaidFilter(val);
          }}
        >
          <SelectTrigger className={cn("w-[120px] border-[#E6E6E4]", effectivePaidFilter !== "all" && "border-[#C6A03B]")}>
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

        {/* Add Lead Button */}
        {onAddNew && (
          <Button
            onClick={onAddNew}
            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white ml-auto"
          >
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("createLead")}
          </Button>
        )}
      </div>

      {/* Second Row: Results count, Bulk Actions, Export */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[#6B6B6B]">
          {t("showingResults", "Showing {{start}}-{{end}} of {{total}} results", {
            start: Math.min((currentPage - 1) * pageSize + 1, filteredAndSortedLeads.length),
            end: Math.min(currentPage * pageSize, filteredAndSortedLeads.length),
            total: filteredAndSortedLeads.length,
          })}
        </div>
        <div className="flex items-center gap-2">
          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FFF9E6] rounded-lg border border-[#C6A03B]/30">
              <span className="text-sm font-medium text-[#C6A03B]">
                {selectedIds.size} {t("selected", "selected")}
              </span>
              {onBulkStatusChange && (
                <Select value={bulkStatusValue} onValueChange={(val) => setBulkStatusValue(val as LeadStatus)}>
                  <SelectTrigger className="w-[140px] h-8 text-xs border-[#C6A03B]/30">
                    <SelectValue placeholder={t("changeStatus", "Change Status")} />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {bulkStatusValue && (
                <Button size="sm" onClick={handleBulkStatusChange} className="h-8 bg-[#0C5536]">
                  {t("apply", "Apply")}
                </Button>
              )}
              {onBulkAssign && availableSalespeople.length > 0 && (
                <>
                  <Select value={bulkAssignValue} onValueChange={setBulkAssignValue}>
                    <SelectTrigger className="w-[140px] h-8 text-xs border-[#C6A03B]/30">
                      <SelectValue placeholder={t("assignTo", "Assign To")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSalespeople.map((sp) => (
                        <SelectItem key={sp.user_id} value={sp.user_id}>
                          {sp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {bulkAssignValue && (
                    <Button size="sm" onClick={handleBulkAssign} className="h-8 bg-[#2563EB]">
                      <UserCheck className="h-3 w-3 mr-1" />
                      {t("assign", "Assign")}
                    </Button>
                  )}
                </>
              )}
              {onBulkDelete && (
                <Button size="sm" variant="outline" onClick={handleBulkDelete} className="h-8 text-[#C0392B] border-[#C0392B]/30 hover:bg-[#FEECEC]">
                  <Trash2 className="h-3 w-3 mr-1" />
                  {t("delete", "Delete")}
                </Button>
              )}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(true)} className="border-[#E6E6E4]">
            <FileDown className="h-4 w-4 mr-1" />
            {t("export", "Export")}
            {selectedIds.size > 0 && ` (${selectedIds.size})`}
          </Button>
        </div>
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
              <TableHead className="font-semibold text-[#555555]">{t("assignedTo")}</TableHead>
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
            {t("createFirstLead")}
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
                    onClick={() => handleSort("assigned_to")}
                  >
                    <div className="flex items-center">
                      {t("assignedTo")}
                      {getSortIcon("assigned_to")}
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
                    <TableCell className="font-medium text-[#222222]">{lead.full_name}</TableCell>
                    <TableCell className="text-[#555555]">{lead.email}</TableCell>
                    <TableCell className="text-[#555555]">{lead.phone || "-"}</TableCell>
                    <TableCell className="text-[#555555]">{lead.source_data?.name || (lead.source ? lead.source.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "-")}</TableCell>
                    <TableCell>
                      {lead.assigned_user?.full_name ? (
                        <Badge
                          className={`bg-[#E6F0FF] text-[#2563EB] border-0 ${
                            onViewSalesperson && lead.assigned_to
                              ? "cursor-pointer hover:bg-[#DBEAFE] transition-colors"
                              : ""
                          }`}
                          onClick={() => {
                            if (onViewSalesperson && lead.assigned_to) {
                              onViewSalesperson(lead.assigned_to);
                            }
                          }}
                        >
                          {lead.assigned_user.full_name}
                        </Badge>
                      ) : (
                        <span className="text-[#999999] text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[#555555]">
                      {format(new Date(lead.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-[160px] h-9 px-3 bg-[#FAFAF8] border border-[#E6E6E4] rounded-md hover:bg-[#F5F5F3] justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${
                                  lead.status === "not_started" ? "bg-[#6B6B6B]" :
                                  lead.status === "contacted" ? "bg-[#0C5536]" :
                                  lead.status === "consultation" ? "bg-[#0369A1]" :
                                  lead.status === "consultation_completed" ? "bg-[#166534]" :
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
                              <ChevronDown className="h-4 w-4 text-[#999999]" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="min-w-[180px]">
                            {/* Status Options */}
                            <div className="px-2 py-1.5 text-xs font-semibold text-[#999999]">{t("status")}</div>
                            {statusOptions.map((option) => (
                              <DropdownMenuItem
                                key={option.value}
                                onClick={() => onStatusChange(lead.id, option.value)}
                                className="cursor-pointer text-[#555555] hover:bg-[#F5F5F3] focus:text-white"
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${
                                    option.value === "not_started" ? "bg-[#6B6B6B]" :
                                    option.value === "contacted" ? "bg-[#0C5536]" :
                                    option.value === "consultation" ? "bg-[#0369A1]" :
                                    option.value === "consultation_completed" ? "bg-[#166534]" :
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
                                <div className="px-2 py-1.5 text-xs font-semibold text-[#999999]">{t("communication")}</div>
                                {communicationMethods.map((method) => (
                                  <DropdownMenuItem
                                    key={method.id}
                                    onClick={() => onAddCommunication(lead, method.id)}
                                    className="cursor-pointer hover:bg-[#F5F5F3]"
                                  >
                                    <div className="flex items-center gap-2">
                                      {getMethodIcon(method.icon)}
                                      <span className="text-[#555555]">{method.name}</span>
                                    </div>
                                  </DropdownMenuItem>
                                ))}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {lead.is_paid && (
                          <Badge className="bg-[#E6F7F1] text-[#0C5536] border-0 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {t("paid")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {/* Health Indicator */}
                    <TableCell>
                      <LeadHealthIndicator
                        lastContactDate={lead.last_contact_date}
                        nextActionDate={lead.next_action_date}
                        createdAt={lead.created_at}
                        updatedAt={lead.updated_at}
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
                        <span className="text-[#999999] text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 border-[hsl(var(--jw-primary-green))] text-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))]/10"
                          >
                            <FileText className="h-4 w-4" />
                            {t("proposal")}
                            <ChevronDown className="h-3 w-3 ltr:ml-1 rtl:mr-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => onSendProposal(lead)} className="hover:bg-[#F5F5F3]">
                            <Send className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                            {t("sendProposal")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onSendInvoice?.(lead)} className="hover:bg-[#F5F5F3]">
                            <Receipt className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                            {t("sendInvoice")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onViewProposals(lead)} className="hover:bg-[#F5F5F3]">
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
                            className="h-8 w-8 text-[#999999] hover:text-[hsl(var(--jw-primary-green))] hover:bg-[#E6F7F1]"
                            onClick={() => onViewHistory(lead)}
                            title={t("viewHistory")}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#999999] hover:text-[#C6A03B] hover:bg-[#FFF9E6]"
                          onClick={() => onEdit(lead)}
                          title={t("editLead")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canDeleteLead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#999999] hover:text-[#C0392B] hover:bg-[#FEECEC]"
                            onClick={() => onDelete(lead)}
                            title={t("deleteLead")}
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Export Dialog */}
      <ExportLeadsDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        leads={filteredAndSortedLeads}
        selectedIds={selectedIds}
      />
    </div>
  );
}
