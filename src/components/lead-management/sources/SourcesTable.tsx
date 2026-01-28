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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Pencil, 
  Trash2, 
  Megaphone, 
  Plus, 
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  FileDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";

export interface LeadSource {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  salespeople: { user_id: string; full_name: string }[];
  salespeople_count: number;
}

type SortField = "name" | "salespeople_count" | "is_active" | "created_at";
type SortDirection = "asc" | "desc" | null;

const PAGE_SIZES = [10, 25, 50, 100];

interface SourcesTableProps {
  sources: LeadSource[];
  onEdit: (source: LeadSource) => void;
  onDelete: (source: LeadSource) => void;
  onAddNew?: () => void;
  isLoading?: boolean;
}

export function SourcesTable({
  sources,
  onEdit,
  onDelete,
  onAddNew,
  isLoading,
}: SourcesTableProps) {
  const { t } = useTranslation("leadManagement");
  const { canPerform } = usePermissions();

  // Check if user can delete sources (head-only operation for Lead Management)
  const canDeleteSource = canPerform("lead_management", "delete_source");

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  // Filter and sort sources
  const filteredAndSortedSources = useMemo(() => {
    let result = [...sources];

    // Search filter
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      result = result.filter((source) =>
        source.name.toLowerCase().includes(search) ||
        source.description?.toLowerCase().includes(search)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((source) => 
        statusFilter === "active" ? source.is_active : !source.is_active
      );
    }

    // Sorting
    if (sortField && sortDirection) {
      result.sort((a, b) => {
        let aValue: string | number | boolean | null = null;
        let bValue: string | number | boolean | null = null;

        switch (sortField) {
          case "name":
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case "salespeople_count":
            aValue = a.salespeople_count;
            bValue = b.salespeople_count;
            break;
          case "is_active":
            aValue = a.is_active ? 1 : 0;
            bValue = b.is_active ? 1 : 0;
            break;
          case "created_at":
            aValue = a.created_at;
            bValue = b.created_at;
            break;
        }

        if (aValue === null || bValue === null) return 0;
        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [sources, searchQuery, statusFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedSources.length / pageSize);
  const paginatedSources = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedSources.slice(start, start + pageSize);
  }, [filteredAndSortedSources, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedSources.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedSources.map(s => s.id)));
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
      ? filteredAndSortedSources.filter(s => selectedIds.has(s.id))
      : filteredAndSortedSources;

    const headers = [
      t("sourceName"),
      t("description"),
      t("assignedSalespeople"),
      t("status"),
      t("created"),
    ];

    const rows = dataToExport.map(source => [
      source.name,
      source.description || "",
      source.salespeople.map(sp => sp.full_name).join("; "),
      source.is_active ? "Active" : "Inactive",
      format(parseISO(source.created_at), "yyyy-MM-dd"),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `lead_sources_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  }, [filteredAndSortedSources, selectedIds, t]);

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all";

  // Header section with search, filters, and create button
  const headerSection = (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#C6A03B]" />
          <Input
            placeholder={t("searchSources", "Search sources...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ltr:pl-10 rtl:pr-10 border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={cn("w-[140px] border-[#E6E6E4]", statusFilter !== "all" && "border-[#C6A03B]")}>
            <SelectValue placeholder={t("status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses", "All")}</SelectItem>
            <SelectItem value="active">{t("active")}</SelectItem>
            <SelectItem value="inactive">{t("inactive")}</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[#C0392B]">
            <X className="h-4 w-4 mr-1" />
            {t("clearFilters", "Clear")}
          </Button>
        )}

        {/* Add Source Button */}
        {onAddNew && (
          <Button
            onClick={onAddNew}
            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white ml-auto"
          >
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("createSource")}
          </Button>
        )}
      </div>

      {/* Second Row: Results count and Export */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[#6B6B6B]">
          {t("showingResults", "Showing {{start}}-{{end}} of {{total}} results", {
            start: Math.min((currentPage - 1) * pageSize + 1, filteredAndSortedSources.length),
            end: Math.min(currentPage * pageSize, filteredAndSortedSources.length),
            total: filteredAndSortedSources.length,
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
              <TableHead className="font-semibold text-[#555555]">{t("sourceName")}</TableHead>
              <TableHead className="font-semibold text-[#555555]">{t("description")}</TableHead>
              <TableHead className="font-semibold text-[#555555]">{t("assignedSalespeople")}</TableHead>
              <TableHead className="font-semibold text-[#555555]">{t("status")}</TableHead>
              <TableHead className="font-semibold text-[#555555]">{t("created")}</TableHead>
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
                <TableCell><div className="h-6 bg-[#E6E6E4] rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 bg-[#E6E6E4] rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-8 bg-[#E6E6E4] rounded animate-pulse" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="space-y-4">
        {headerSection}
        <div className="rounded-lg border border-[#E6E6E4] p-12 text-center">
          <Megaphone className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
          <p className="font-medium text-[#222222]">{t("noSources")}</p>
          <p className="text-sm text-[#6B6B6B] mt-1">
            {t("createFirstSource")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {headerSection}
      
      {paginatedSources.length === 0 ? (
        <div className="rounded-lg border border-[#E6E6E4] p-12 text-center">
          <Megaphone className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
          <p className="font-medium text-[#222222]">{t("noMatchingSources", "No matching sources")}</p>
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
                      checked={selectedIds.size === paginatedSources.length && paginatedSources.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#555555] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center">
                      {t("sourceName")}
                      {getSortIcon("name")}
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-[#555555]">{t("description")}</TableHead>
                  <TableHead 
                    className="font-semibold text-[#555555] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("salespeople_count")}
                  >
                    <div className="flex items-center">
                      {t("assignedSalespeople")}
                      {getSortIcon("salespeople_count")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold text-[#555555] cursor-pointer hover:bg-[#F0F0EE]"
                    onClick={() => handleSort("is_active")}
                  >
                    <div className="flex items-center">
                      {t("status")}
                      {getSortIcon("is_active")}
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
                  <TableHead className="font-semibold text-[#555555] text-center">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSources.map((source) => (
                  <TableRow key={source.id} className="transition-colors hover:bg-[#FDFBF4]" style={{ borderBottom: '1px solid #EAEAE8' }}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(source.id)}
                        onCheckedChange={() => toggleSelect(source.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-[#222222]">{source.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-[#555555]">
                      {source.description || "-"}
                    </TableCell>
                    <TableCell>
                      {source.salespeople_count > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {source.salespeople.slice(0, 2).map((sp) => (
                            <Badge key={sp.user_id} className="text-xs bg-[#E6F0FF] text-[#2563EB] border-0">
                              {sp.full_name}
                            </Badge>
                          ))}
                          {source.salespeople_count > 2 && (
                            <Badge className="text-xs bg-[#F5F5F5] text-[#6B6B6B] border-0">
                              +{source.salespeople_count - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#999999] text-sm">
                          {t("noSalespersonAssigned")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={source.is_active 
                          ? "bg-[#E6F7F1] text-[#0C5536] border-0" 
                          : "bg-[#F5F5F5] text-[#6B6B6B] border-0"
                        }
                      >
                        {source.is_active ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[#555555]">
                      {format(new Date(source.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#999999] hover:text-[#C6A03B] hover:bg-[#FFF9E6]"
                          onClick={() => onEdit(source)}
                          title={t("editSource")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canDeleteSource && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#999999] hover:text-[#C0392B] hover:bg-[#FEECEC]"
                            onClick={() => onDelete(source)}
                            title={t("deleteSource")}
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
    </div>
  );
}
