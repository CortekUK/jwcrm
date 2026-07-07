"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/StatusBadge";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  Download,
  FileText,
  Eye,
  ArrowUpDown,
  Filter,
  Calendar,
  X,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { WillAnswersModal } from "@/components/admin/WillAnswersModal";
import { CreateClientModal } from "@/components/admin/CreateClientModal";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDateTime } from "@/lib/format-utils";

type WillStatus = Database["public"]["Enums"]["will_status"];

interface Will {
  id: string;
  user_id: string;
  status: WillStatus;
  pdf_path: string | null;
  pdf_generated_at: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  answers: any;
  client_approval_status?: "approved" | "disapproved" | null;
  client_approval_at?: string | null;
  profile: {
    full_name: string;
    user_id: string;
  } | null;
}

const ITEMS_PER_PAGE = 20;

// Target turnaround (calendar days) for finishing a draft once submitted.
const DRAFT_SLA_DAYS = 5;

// Statuses where the will is still actively being drafted (not yet draft-ready).
const DRAFTING_STATUSES: WillStatus[] = [
  "in_progress",
  "awaiting_review",
  "under_review",
];

function getDraftAge(will: Will): {
  drafting: boolean;
  days: number;
  overdue: boolean;
} {
  const start = will.submitted_at || will.created_at;
  const startMs = new Date(start).getTime();
  const days = Math.max(0, Math.floor((Date.now() - startMs) / 86400000));
  const drafting = DRAFTING_STATUSES.includes(will.status);
  return { drafting, days, overdue: drafting && days >= DRAFT_SLA_DAYS };
}

export default function AdminWillsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>}>
      <AdminWillsContent />
    </Suspense>
  );
}

function AdminWillsContent() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation(['admin', 'common', 'toast']);
  const { locale } = useLanguage();
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [selectedWill, setSelectedWill] = useState<Will | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createClientModalOpen, setCreateClientModalOpen] = useState(false);

  // Get user filter from URL using searchParams
  const userIdFilter = searchParams.get('user') || undefined;
  const urlFilter = searchParams.get('filter') || undefined;

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFromFilter, setDateFromFilter] = useState<Date | undefined>();
  const [dateToFilter, setDateToFilter] = useState<Date | undefined>();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Sorting
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch all wills with user profiles (only submitted wills)
  const { data: allWills, isLoading } = useQuery({
    queryKey: ['admin-wills', userIdFilter],
    queryFn: async () => {
      let query = supabase
        .from('wills')
        .select('*')
        .not('submitted_at', 'is', null);

      if (userIdFilter) {
        query = query.eq('user_id', userIdFilter);
      }

      const { data: willsData, error: willsError } = await query
        .order('created_at', { ascending: sortOrder === "asc" });

      if (willsError) throw willsError;

      const userIds = willsData.map(w => w.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profilesMap = new Map(profilesData.map(p => [p.user_id, p]));

      return willsData.map(will => ({
        ...will,
        profile: profilesMap.get(will.user_id) || null,
      })) as Will[];
    },
  });

  // Apply filters
  const filteredWills = allWills?.filter((will) => {
    if (urlFilter === 'client_review') {
      if (!will.client_approval_status ||
          (will.client_approval_status !== 'approved' && will.client_approval_status !== 'disapproved')) {
        return false;
      }
    }

    if (statusFilter !== "all" && will.status !== statusFilter) return false;

    if (dateFromFilter) {
      const willDate = new Date(will.created_at);
      if (willDate < dateFromFilter) return false;
    }

    if (dateToFilter) {
      const willDate = new Date(will.created_at);
      const toDate = new Date(dateToFilter);
      toDate.setHours(23, 59, 59, 999);
      if (willDate > toDate) return false;
    }

    return true;
  });

  // Pagination
  const totalPages = Math.ceil((filteredWills?.length || 0) / ITEMS_PER_PAGE);
  const paginatedWills = filteredWills?.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Update will status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ willId, newStatus }: { willId: string; newStatus: WillStatus }) => {
      if (!user) throw new Error("User not authenticated");

      const will = allWills?.find(w => w.id === willId);
      if (!will) throw new Error("Will not found");

      const { error: eventError } = await supabase
        .from("will_status_events")
        .insert({
          will_id: willId,
          previous_status: will.status,
          new_status: newStatus,
          actor_user_id: user.id,
          notes: null,
        });

      if (eventError) throw eventError;

      const { error } = await supabase
        .from('wills')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', willId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-wills'] });
      toast({
        title: t('toast:admin.statusUpdated'),
        description: t('toast:admin.willStatusUpdated'),
      });
    },
    onError: (error) => {
      console.error('Update status error:', error);
      toast({
        title: t('toast:error'),
        description: t('toast:admin.statusUpdateError'),
        variant: "destructive",
      });
    },
  });

  const downloadPdf = async (will: Will) => {
    if (!will.pdf_path) return;

    setDownloadingPdf(will.id);
    try {
      const { data, error } = await supabase.storage
        .from('wills')
        .createSignedUrl(will.pdf_path, 3600);

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: t('toast:error'),
        description: t('toast:admin.failedToDownloadPdf'),
        variant: "destructive",
      });
    } finally {
      setDownloadingPdf(null);
    }
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setDateFromFilter(undefined);
    setDateToFilter(undefined);
    setCurrentPage(1);
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    setCurrentPage(1);
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Header */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 mb-6 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {userIdFilter ? (
                  <>
                    {allWills?.[0]?.profile?.full_name || 'User'}'s Wills
                  </>
                ) : (
                  t('admin:allWills')
                )}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {userIdFilter ? (
                urlFilter === 'client_review' ? (
                  `Viewing client reviews for ${allWills?.[0]?.profile?.full_name || 'this user'}`
                ) : (
                  `Viewing wills for ${allWills?.[0]?.profile?.full_name || 'this user'}`
                )
              ) : urlFilter === 'client_review' ? (
                'Viewing all client reviews and approvals'
              ) : (
                t('admin:manageTrackSubmissions')
              )}
            </p>
          </div>
          {urlFilter === 'client_review' && !userIdFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                router.push('/admin/wills');
              }}
              className="border-[#C6A03B] text-[#C6A03B] hover:bg-[#C6A03B] hover:text-white"
            >
              <X className="ltr:mr-1 rtl:ml-1 h-4 w-4" />
              Clear Review Filter
            </Button>
          )}
        </div>
      </div>

      {/* Filters Card */}
      <Card className="border-[#E6E6E4] shadow-sm sticky top-0 z-10 bg-white">
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Filter className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
                {t('admin:statusLabel')}
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="rounded-md border-[#E6E6E4] focus:ring-[hsl(var(--jw-gold-accent))] focus:ring-2">
                  <SelectValue placeholder={t('admin:allStatuses')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin:allStatuses')}</SelectItem>
                  <SelectItem value="in_progress">{t('admin:in_progress')}</SelectItem>
                  <SelectItem value="awaiting_review">{t('admin:awaiting_review')}</SelectItem>
                  <SelectItem value="generating_pdf">{t('admin:generating_pdf')}</SelectItem>
                  <SelectItem value="draft_generated_internal">{t('admin:draft_generated_internal')}</SelectItem>
                  <SelectItem value="released_to_client">{t('admin:released_to_client')}</SelectItem>
                  <SelectItem value="finalized">{t('admin:finalized')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
                {t('admin:fromDateLabel')}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal rounded-md border-[#E6E6E4] focus:ring-[hsl(var(--jw-gold-accent))] focus:ring-2",
                      !dateFromFilter && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                    {dateFromFilter ? format(dateFromFilter, "PPP") : <span>{t('admin:pickDate')}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dateFromFilter}
                    onSelect={setDateFromFilter}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
                {t('admin:toDateLabel')}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal rounded-md border-[#E6E6E4] focus:ring-[hsl(var(--jw-gold-accent))] focus:ring-2",
                      !dateToFilter && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                    {dateToFilter ? format(dateToFilter, "PPP") : <span>{t('admin:pickDate')}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dateToFilter}
                    onSelect={setDateToFilter}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button
              variant="outline"
              onClick={clearFilters}
              className="rounded-md border-[hsl(var(--jw-primary-green))] text-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))] hover:text-white transition-all duration-150 font-medium focus:ring-2 focus:ring-[hsl(var(--jw-gold-accent))]"
            >
              <X className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t('admin:resetFilters')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Wills Table Card */}
      <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
        <CardHeader className="border-b border-[#E6E6E4]">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-[hsl(var(--jw-primary-green))]">
                {t('admin:allWillsTitle')} ({filteredWills?.length || 0})
              </CardTitle>
              <CardDescription className="text-sm text-[#777777]">
                {t('admin:clientSubmissionsDescription')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!paginatedWills || paginatedWills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center mx-auto max-w-md">
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-[hsl(var(--jw-primary-green))]/10 bg-[#FDFBF4] mb-6">
                <FileText className="h-10 w-10 text-[hsl(var(--jw-gold-accent))]" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t('admin:noWillsFound')}
              </h3>
              <p className="text-sm text-[#555555] max-w-md">
                {statusFilter !== "all" || dateFromFilter || dateToFilter
                  ? t('admin:adjustFiltersMessage')
                  : t('admin:updatesWillAppear')}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FAFAF8] hover:bg-[#FAFAF8] border-b border-[hsl(var(--jw-gold-accent))]/25">
                      <TableHead className="font-medium ltr:text-left rtl:text-right text-sm text-[hsl(var(--jw-primary-green))]">{t('admin:clientColumn')}</TableHead>
                      <TableHead className="border-s ltr:text-left rtl:text-right border-[#EAEAE8]">
                        <Button
                          variant="ghost"
                          onClick={toggleSortOrder}
                          className="font-medium border-none hover:bg-transparent hover:text-[hsl(var(--jw-primary-green))] text-sm text-[hsl(var(--jw-primary-green))] px-0 gap-1"
                        >
                          {t('admin:createdAtColumn')}
                          <ArrowUpDown className="h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="font-medium text-sm ltr:text-left rtl:text-right text-[hsl(var(--jw-primary-green))] border-s border-[#EAEAE8]">{t('admin:draftAgeColumn', 'Draft Age')}</TableHead>
                      <TableHead className="font-medium text-sm ltr:text-left rtl:text-right text-[hsl(var(--jw-primary-green))] border-s border-[#EAEAE8]">{t('admin:statusColumn')}</TableHead>
                      <TableHead className="ltr:text-left rtl:text-right font-medium text-sm text-[hsl(var(--jw-primary-green))] border-s border-[#EAEAE8]">{t('admin:pdfColumn')}</TableHead>
                      <TableHead className="ltr:text-left rtl:text-right font-medium text-sm text-[hsl(var(--jw-primary-green))] border-s border-[#EAEAE8]">{t('admin:actionsColumn')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedWills.map((will) => (
                      <TableRow
                        key={will.id}
                        className="border-b border-[#EAEAE8]"
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-[hsl(var(--jw-gold-accent))]">
                              <AvatarFallback className="bg-[hsl(var(--jw-primary-green))]/10 text-[hsl(var(--jw-primary-green))] text-sm font-semibold">
                                {getInitials(will.profile?.full_name || null)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground">
                              {will.profile?.full_name || t('admin:unknownUser')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-[#777777] border-s border-[#EAEAE8]">
                          {formatDateTime(will.created_at, locale)}
                        </TableCell>
                        <TableCell className="border-s border-[#EAEAE8]">
                          {(() => {
                            const age = getDraftAge(will);
                            if (!age.drafting) {
                              return (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                                  <CheckCircle className="h-3 w-3" />
                                  {t('admin:draftDoneBadge', 'Drafted')}
                                </span>
                              );
                            }
                            return (
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded w-fit ${
                                  age.overdue
                                    ? 'bg-red-100 text-red-700'
                                    : age.days >= DRAFT_SLA_DAYS - 2
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-green-100 text-green-700'
                                }`}
                                title={t('admin:draftSlaHint', { defaultValue: 'Target: {{sla}} days', sla: DRAFT_SLA_DAYS })}
                              >
                                <Clock className="h-3 w-3" />
                                {t('admin:daysOpen', { defaultValue: '{{count}}d / {{sla}}d', count: age.days, sla: DRAFT_SLA_DAYS })}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="border-s border-[#EAEAE8]">
                          <div className="flex flex-col gap-2">
                            <StatusBadge status={will.status} />
                            {will.status === 'draft_released' && will.client_approval_status && (
                              <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded w-fit ${
                                will.client_approval_status === 'approved'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {will.client_approval_status === 'approved' ? (
                                  <>
                                    <CheckCircle className="h-3 w-3" />
                                    <span>{t('admin:approvedBadge')}</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-3 w-3" />
                                    <span>{t('admin:changesReqBadge')}</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="border-s border-[#EAEAE8]">
                          {will.pdf_path ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadPdf(will);
                              }}
                              disabled={downloadingPdf === will.id}
                              className="rounded-md hover:text-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))]/10"
                            >
                              {downloadingPdf === will.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--jw-primary-green))]" />
                              ) : (
                                <>
                                  <Download className="ltr:mr-2 rtl:ml-2 h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
                                  <span className="text-sm">{t('admin:downloadButton')}</span>
                                </>
                              )}
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-[#777777]">
                              <FileText className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]/60" />
                              <span className="text-xs">{t('admin:notGenerated')}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="border-s border-[#EAEAE8]">
                          <div className="flex items-center ltr:justify-end rtl:justify-start gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/admin/wills/${will.id}`);
                              }}
                              className="text-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))]"
                            >
                              <Eye className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                              {t('admin:viewDetails')}
                            </Button>
                            <div onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={will.status}
                                onValueChange={(value) =>
                                  updateStatusMutation.mutate({
                                    willId: will.id,
                                    newStatus: value as WillStatus
                                  })
                                }
                                disabled={updateStatusMutation.isPending}
                              >
                              <SelectTrigger className="w-[160px] rounded-md border-[#E6E6E4]">
                                <SelectValue />
                              </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="in_progress">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#9E9E9E]" />
                      {t('admin:inProgressStatus')}
                    </span>
                  </SelectItem>
                  <SelectItem value="awaiting_review">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#C6A03B]" />
                      {t('admin:awaitingReviewStatus')}
                    </span>
                  </SelectItem>
                  <SelectItem value="under_review">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#557A95]" />
                      {t('admin:underReviewStatus')}
                    </span>
                  </SelectItem>
                  <SelectItem value="draft_ready">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#0C5536]" />
                      {t('admin:draftReadyStatus')}
                    </span>
                  </SelectItem>
                  <SelectItem value="draft_released">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#128277]" />
                      {t('admin:draftReleasedStatus')}
                    </span>
                  </SelectItem>
                  <SelectItem value="finalized">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#083D29]" />
                      {t('admin:finalizedStatus')}
                    </span>
                  </SelectItem>
                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 px-6 pb-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-[hsl(var(--jw-primary-green))]/10 hover:text-[hsl(var(--jw-primary-green))]"}
                        />
                      </PaginationItem>

                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let page;
                        if (totalPages <= 5) {
                          page = i + 1;
                        } else if (currentPage <= 3) {
                          page = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          page = totalPages - 4 + i;
                        } else {
                          page = currentPage - 2 + i;
                        }
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className={currentPage === page
                                ? "cursor-pointer bg-[hsl(var(--jw-primary-green))] text-white hover:bg-[hsl(var(--jw-primary-green))]/90"
                                : "cursor-pointer hover:bg-[hsl(var(--jw-primary-green))]/10 hover:text-[hsl(var(--jw-primary-green))]"
                              }
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-[hsl(var(--jw-primary-green))]/10 hover:text-[hsl(var(--jw-primary-green))]"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Legal Footer */}
      <div className="text-center py-4">
        <p className="text-xs text-[#777777]">
          {t('admin:legalFooter')}
        </p>
      </div>

      {/* View Answers Modal */}
      {selectedWill && (
        <WillAnswersModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          answers={selectedWill.answers}
          clientName={selectedWill.profile?.full_name || t('admin:unknownUser')}
        />
      )}

      {/* Create Client Modal */}
      <CreateClientModal
        open={createClientModalOpen}
        onOpenChange={setCreateClientModalOpen}
      />
    </div>
  );
}
