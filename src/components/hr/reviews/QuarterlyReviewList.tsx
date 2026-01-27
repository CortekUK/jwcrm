"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Search, 
  MoreVertical,
  Eye,
  Edit,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  Filter,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  X,
} from "lucide-react";
import { format, isPast, parseISO, differenceInDays } from "date-fns";

type QuarterlyReview = {
  id: string;
  employee_id: string;
  reviewer_id: string;
  quarter: number;
  year: number;
  status: "draft" | "submitted" | "approved" | "complete";
  deadline_date: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  overall_kpi_score: number | null;
  created_at: string;
  employee: {
    id: string;
    full_name: string;
    job_title: string | null;
    department: {
      id: string;
      name: string;
    } | null;
  };
  reviewer: {
    email: string;
  } | null;
};

type QuarterlyReviewListProps = {
  filterStatus?: "all" | "draft" | "submitted" | "approved" | "complete" | "pending_approval";
  showMyReviewsOnly?: boolean;
  employeeId?: string;
  onDownloadPDF?: (review: QuarterlyReview) => void;
};

const quarterOptions = [
  { value: "all", label: "All Quarters" },
  { value: "1", label: "Q1" },
  { value: "2", label: "Q2" },
  { value: "3", label: "Q3" },
  { value: "4", label: "Q4" },
];

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "complete", label: "Complete" },
];

const getCurrentYear = (): number => new Date().getFullYear();

export function QuarterlyReviewList({
  filterStatus = "all",
  showMyReviewsOnly = false,
  employeeId,
  onDownloadPDF,
}: QuarterlyReviewListProps) {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  const [reviews, setReviews] = useState<QuarterlyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("all");
  const [selectedYear, setSelectedYear] = useState(String(getCurrentYear()));
  const [selectedStatus, setSelectedStatus] = useState(filterStatus === "pending_approval" ? "submitted" : filterStatus);
  const [approving, setApproving] = useState<string | null>(null);
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeadlineDialogOpen, setBulkDeadlineDialogOpen] = useState(false);
  const [bulkDeadlineDate, setBulkDeadlineDate] = useState<Date | undefined>(undefined);
  const [savingBulkDeadline, setSavingBulkDeadline] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const yearOptions = [
    { value: String(getCurrentYear() - 1), label: String(getCurrentYear() - 1) },
    { value: String(getCurrentYear()), label: String(getCurrentYear()) },
    { value: String(getCurrentYear() + 1), label: String(getCurrentYear() + 1) },
  ];

  // Fetch reviews
  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("quarterly_reviews")
          .select(`
            *,
            employee:employees(id, full_name, job_title, department:departments(id, name)),
            reviewer:auth.users(email)
          `)
          .order("created_at", { ascending: false });

        // Apply filters
        if (employeeId) {
          query = query.eq("employee_id", employeeId);
        }
        if (selectedYear !== "all") {
          query = query.eq("year", Number(selectedYear));
        }
        if (selectedQuarter !== "all") {
          query = query.eq("quarter", Number(selectedQuarter));
        }
        if (selectedStatus !== "all") {
          query = query.eq("status", selectedStatus);
        }
        if (showMyReviewsOnly && user?.id) {
          query = query.eq("reviewer_id", user.id);
        }

        const { data, error } = await query;

        if (error) throw error;
        setReviews((data || []) as QuarterlyReview[]);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        toast({
          variant: "destructive",
          description: t("hr:reviews.errorLoadingReviews"),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [selectedYear, selectedQuarter, selectedStatus, showMyReviewsOnly, employeeId, user?.id, t, toast]);

  // Filter by search term
  const filteredReviews = reviews.filter((review) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      review.employee?.full_name?.toLowerCase().includes(searchLower) ||
      review.employee?.job_title?.toLowerCase().includes(searchLower) ||
      review.employee?.department?.name?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredReviews.length / pageSize);
  const paginatedReviews = filteredReviews.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleApprove = async (reviewId: string) => {
    setApproving(reviewId);
    try {
      const { error } = await supabase
        .from("quarterly_reviews")
        .update({
          status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reviewId);

      if (error) throw error;

      // Update local state
      setReviews(prev => prev.map(r => 
        r.id === reviewId 
          ? { ...r, status: "approved" as const, approved_at: new Date().toISOString() }
          : r
      ));

      toast({
        title: t("hr:reviews.reviewApproved"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
    } catch (error) {
      console.error("Error approving review:", error);
      toast({
        variant: "destructive",
        description: t("hr:reviews.errorApproving"),
      });
    } finally {
      setApproving(null);
    }
  };

  const handleComplete = async (reviewId: string) => {
    setApproving(reviewId);
    try {
      const { error } = await supabase
        .from("quarterly_reviews")
        .update({
          status: "complete",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reviewId);

      if (error) throw error;

      // Update local state
      setReviews(prev => prev.map(r => 
        r.id === reviewId 
          ? { ...r, status: "complete" as const }
          : r
      ));

      toast({
        title: t("hr:reviews.reviewCompleted"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
    } catch (error) {
      console.error("Error completing review:", error);
      toast({
        variant: "destructive",
        description: t("hr:reviews.errorCompleting"),
      });
    } finally {
      setApproving(null);
    }
  };

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedReviews.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (reviewId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(reviewId);
    } else {
      newSelected.delete(reviewId);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkSetDeadline = async () => {
    if (!bulkDeadlineDate || selectedIds.size === 0) return;

    setSavingBulkDeadline(true);
    try {
      const deadlineDateStr = bulkDeadlineDate.toISOString().split("T")[0];
      const idsArray = Array.from(selectedIds);

      const { error } = await supabase
        .from("quarterly_reviews")
        .update({
          deadline_date: deadlineDateStr,
          updated_at: new Date().toISOString(),
        })
        .in("id", idsArray);

      if (error) throw error;

      // Update local state
      setReviews((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id)
            ? { ...r, deadline_date: deadlineDateStr }
            : r
        )
      );

      toast({
        title: t("hr:reviews.deadlineUpdated", "Deadline Updated"),
        description: t("hr:reviews.deadlineUpdatedCount", {
          count: selectedIds.size,
          defaultValue: `Updated deadline for ${selectedIds.size} review(s)`,
        }),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });

      // Reset selection and close dialog
      setSelectedIds(new Set());
      setBulkDeadlineDialogOpen(false);
      setBulkDeadlineDate(undefined);
    } catch (error) {
      console.error("Error setting bulk deadline:", error);
      toast({
        variant: "destructive",
        description: t("hr:reviews.errorSettingDeadline", "Error setting deadline"),
      });
    } finally {
      setSavingBulkDeadline(false);
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const isAllSelected =
    paginatedReviews.length > 0 &&
    paginatedReviews.every((r) => selectedIds.has(r.id));
  const isSomeSelected = selectedIds.size > 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
            <Edit className="h-3 w-3 mr-1" />
            {t("hr:reviews.status_draft")}
          </Badge>
        );
      case "submitted":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
            <Clock className="h-3 w-3 mr-1" />
            {t("hr:reviews.status_submitted")}
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t("hr:reviews.status_approved")}
          </Badge>
        );
      case "complete":
        return (
          <Badge className="bg-[#E6F7F1] text-[#0C5536] border-[#0C5536]/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t("hr:reviews.status_complete")}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getScoreBadge = (score: number | null) => {
    if (score === null) return <span className="text-[#6B6B6B]">-</span>;
    
    const colorClass = 
      score >= 80 ? "bg-[#E6F7F1] text-[#0C5536]" :
      score >= 60 ? "bg-[#FFF9E6] text-[#C6A03B]" :
      "bg-red-50 text-red-600";

    return (
      <Badge className={colorClass}>
        {score}%
      </Badge>
    );
  };

  const getDeadlineStatus = (deadline: string | null, status: string) => {
    if (!deadline || status === "complete" || status === "approved") return null;
    
    const deadlineDate = parseISO(deadline);
    const daysUntil = differenceInDays(deadlineDate, new Date());
    
    if (isPast(deadlineDate)) {
      return (
        <div className="flex items-center gap-1 text-red-600 text-xs">
          <AlertCircle className="h-3 w-3" />
          {t("hr:reviews.overdue")}
        </div>
      );
    }
    
    if (daysUntil <= 7) {
      return (
        <div className="flex items-center gap-1 text-[#C6A03B] text-xs">
          <Clock className="h-3 w-3" />
          {daysUntil === 0 ? t("hr:reviews.dueToday") : t("hr:reviews.dueInDays", { days: daysUntil })}
        </div>
      );
    }
    
    return null;
  };

  if (loading) {
    return (
      <Card className="border-[#E6E6E4] dark:border-gray-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#0C5536]" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E6E6E4] dark:border-gray-700">
      <CardHeader>
        <div className={`flex flex-col md:flex-row gap-4 ${isRtl ? "md:flex-row-reverse" : ""}`}>
          {/* Search */}
          <div className="relative flex-1">
            <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B6B6B] ${isRtl ? "right-3" : "left-3"}`} />
            <Input
              placeholder={t("hr:reviews.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`border-[#E6E6E4] dark:border-gray-600 ${isRtl ? "pr-10 text-right" : "pl-10"}`}
            />
          </div>

          {/* Filters */}
          <div className={`flex gap-2 flex-wrap ${isRtl ? "flex-row-reverse" : ""}`}>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px] border-[#E6E6E4] dark:border-gray-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
              <SelectTrigger className="w-[130px] border-[#E6E6E4] dark:border-gray-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {quarterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[140px] border-[#E6E6E4] dark:border-gray-600">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Bulk Action Bar */}
        {isSomeSelected && (
          <div className={`mb-4 p-3 bg-[#E6F7F1] dark:bg-green-900/30 rounded-lg flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <Badge className="bg-[#0C5536] text-white">
                {selectedIds.size} {t("hr:reviews.selected", "selected")}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="text-[#6B6B6B] hover:text-[#222222]"
              >
                <X className="h-4 w-4 mr-1" />
                {t("common:clearSelection", "Clear")}
              </Button>
            </div>
            <div className={`flex gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkDeadlineDialogOpen(true)}
                className="border-[#0C5536] text-[#0C5536] hover:bg-[#0C5536]/10"
              >
                <CalendarClock className="h-4 w-4 mr-2" />
                {t("hr:reviews.setDeadline", "Set Deadline")}
              </Button>
            </div>
          </div>
        )}

        {paginatedReviews.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-[#E6E6E4] mx-auto mb-4" />
            <p className="text-[#6B6B6B] dark:text-gray-400">{t("hr:reviews.noReviewsFound")}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#E6E6E4] dark:border-gray-700">
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label={t("hr:reviews.selectAll", "Select all")}
                      />
                    </TableHead>
                    <TableHead className={isRtl ? "text-right" : ""}>{t("hr:employee")}</TableHead>
                    <TableHead className={isRtl ? "text-right" : ""}>{t("hr:department")}</TableHead>
                    <TableHead className="text-center">{t("hr:reviews.period")}</TableHead>
                    <TableHead className="text-center">{t("hr:reviews.score")}</TableHead>
                    <TableHead className="text-center">{t("hr:reviews.status")}</TableHead>
                    <TableHead className="text-center">{t("hr:reviews.deadline")}</TableHead>
                    <TableHead className="text-center">{t("common:actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedReviews.map((review) => (
                    <TableRow key={review.id} className="border-[#E6E6E4] dark:border-gray-700">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(review.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(review.id, checked as boolean)
                          }
                          aria-label={t("hr:reviews.selectReview", "Select review")}
                        />
                      </TableCell>
                      <TableCell className={isRtl ? "text-right" : ""}>
                        <div>
                          <p className="font-medium text-[#222222] dark:text-gray-200">
                            {review.employee?.full_name}
                          </p>
                          {review.employee?.job_title && (
                            <p className="text-xs text-[#6B6B6B] dark:text-gray-400">
                              {review.employee.job_title}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={isRtl ? "text-right" : ""}>
                        {review.employee?.department?.name || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="border-[#E6E6E4]">
                          Q{review.quarter} {review.year}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {getScoreBadge(review.overall_kpi_score)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(review.status)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          {review.deadline_date ? (
                            <>
                              <span className="text-sm">
                                {format(parseISO(review.deadline_date), "MMM d, yyyy")}
                              </span>
                              {getDeadlineStatus(review.deadline_date, review.status)}
                            </>
                          ) : (
                            <span className="text-[#6B6B6B]">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRtl ? "start" : "end"}>
                            <DropdownMenuItem
                              onClick={() => router.push(`/hr/reviews/${review.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              {t("common:view")}
                            </DropdownMenuItem>
                            
                            {review.status === "draft" && (
                              <DropdownMenuItem
                                onClick={() => router.push(`/hr/reviews/${review.id}/edit`)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                {t("common:edit")}
                              </DropdownMenuItem>
                            )}
                            
                            {review.status === "submitted" && (
                              <DropdownMenuItem
                                onClick={() => handleApprove(review.id)}
                                disabled={approving === review.id}
                              >
                                {approving === review.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                )}
                                {t("hr:reviews.approve")}
                              </DropdownMenuItem>
                            )}
                            
                            {review.status === "approved" && (
                              <DropdownMenuItem
                                onClick={() => handleComplete(review.id)}
                                disabled={approving === review.id}
                              >
                                {approving === review.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                )}
                                {t("hr:reviews.markComplete")}
                              </DropdownMenuItem>
                            )}
                            
                            {(review.status === "approved" || review.status === "complete") && (
                              <DropdownMenuItem
                                onClick={() => onDownloadPDF?.(review)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                {t("hr:downloadPdf")}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={`flex items-center justify-between mt-4 pt-4 border-t border-[#E6E6E4] dark:border-gray-700 ${isRtl ? "flex-row-reverse" : ""}`}>
                <p className="text-sm text-[#6B6B6B] dark:text-gray-400">
                  {t("common:showingOf", { 
                    from: (currentPage - 1) * pageSize + 1,
                    to: Math.min(currentPage * pageSize, filteredReviews.length),
                    total: filteredReviews.length 
                  })}
                </p>
                <div className={`flex gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="border-[#E6E6E4]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = i + 1;
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={currentPage === page 
                            ? "bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))]" 
                            : "border-[#E6E6E4]"
                          }
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="border-[#E6E6E4]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Bulk Deadline Dialog */}
      <Dialog open={bulkDeadlineDialogOpen} onOpenChange={setBulkDeadlineDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <CalendarClock className="h-5 w-5 text-[#C6A03B]" />
              {t("hr:reviews.setDeadline", "Set Deadline")}
            </DialogTitle>
            <DialogDescription>
              {t("hr:reviews.bulkDeadlineDescription", {
                count: selectedIds.size,
                defaultValue: `Set a deadline for ${selectedIds.size} selected review(s)`,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium text-[#222222] dark:text-gray-200 mb-2 block">
              {t("hr:reviews.selectDeadlineDate", "Select Deadline Date")}
            </label>
            <DatePicker
              date={bulkDeadlineDate}
              onDateChange={setBulkDeadlineDate}
              placeholder={t("hr:reviews.selectDeadline", "Select deadline")}
              className="w-full"
            />
          </div>

          <DialogFooter className={isRtl ? "flex-row-reverse" : ""}>
            <Button
              variant="outline"
              onClick={() => {
                setBulkDeadlineDialogOpen(false);
                setBulkDeadlineDate(undefined);
              }}
              className="border-[#E6E6E4]"
            >
              {t("common:cancel")}
            </Button>
            <Button
              onClick={handleBulkSetDeadline}
              disabled={!bulkDeadlineDate || savingBulkDeadline}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {savingBulkDeadline && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("hr:reviews.setDeadline", "Set Deadline")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
