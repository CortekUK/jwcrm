"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Search,
  Calendar,
  Target,
  Bell,
  FileText,
  Send,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

interface NotificationLog {
  id: string;
  notification_type: string;
  recipient_email: string;
  subject: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  documents_included: unknown;
  metadata?: unknown;
  created_at?: string;
}

const NOTIFICATION_TYPES = [
  { value: "all", label: "All Types" },
  { value: "document_expiry_digest", label: "Document Expiry Digest" },
  { value: "document_threshold_alert", label: "Threshold Alert" },
  { value: "kpi_monthly_reminder", label: "KPI Monthly Reminder" },
  { value: "kpi_quarterly_report", label: "KPI Quarterly Report" },
  { value: "kpi_incomplete_reminder", label: "KPI Incomplete" },
];

const STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
];

export function EmailLogsTable() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";

  // State
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Filters
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // Stats
  const [stats, setStats] = useState({
    totalSent: 0,
    totalFailed: 0,
    totalSkipped: 0,
    successRate: 0,
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("email_notification_logs")
        .select("*", { count: "exact" });

      // Apply filters
      if (typeFilter !== "all") {
        query = query.eq("notification_type", typeFilter);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (searchTerm) {
        query = query.or(`recipient_email.ilike.%${searchTerm}%,subject.ilike.%${searchTerm}%`);
      }

      if (dateFrom) {
        query = query.gte("sent_at", `${dateFrom}T00:00:00`);
      }

      if (dateTo) {
        query = query.lte("sent_at", `${dateTo}T23:59:59`);
      }

      // Pagination and ordering
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      query = query.order("sent_at", { ascending: false }).range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching email logs:", error);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, searchTerm, dateFrom, dateTo, page]);

  const fetchStats = useCallback(async () => {
    try {
      // Get counts for each status
      const { data: sentData, count: sentCount } = await supabase
        .from("email_notification_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent");

      const { data: failedData, count: failedCount } = await supabase
        .from("email_notification_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed");

      const { data: skippedData, count: skippedCount } = await supabase
        .from("email_notification_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "skipped");

      const totalSent = sentCount || 0;
      const totalFailed = failedCount || 0;
      const totalSkipped = skippedCount || 0;
      const total = totalSent + totalFailed + totalSkipped;

      setStats({
        totalSent,
        totalFailed,
        totalSkipped,
        successRate: total > 0 ? Math.round((totalSent / total) * 100) : 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleRefresh = () => {
    fetchLogs();
    fetchStats();
  };

  const resetFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge className="bg-[#E6F7F1] text-[#0C5536] border-0">
            <CheckCircle className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            {t("hr:sent")}
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-[#FEECEC] text-[#C0392B] border-0">
            <XCircle className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            {t("hr:failed")}
          </Badge>
        );
      case "skipped":
        return (
          <Badge className="bg-[#F5F5F5] text-[#6B6B6B] border-0">
            <AlertCircle className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            {t("hr:skipped")}
          </Badge>
        );
      default:
        return <Badge variant="outline" className="border-[#E6E6E4]">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "document_expiry_digest":
        return (
          <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700">
            <FileText className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            Expiry Digest
          </Badge>
        );
      case "document_threshold_alert":
        return (
          <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-700">
            <AlertTriangle className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            Threshold
          </Badge>
        );
      case "kpi_monthly_reminder":
        return (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
            <Calendar className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            KPI Monthly
          </Badge>
        );
      case "kpi_quarterly_report":
        return (
          <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700">
            <Target className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            KPI Quarterly
          </Badge>
        );
      case "kpi_incomplete_reminder":
        return (
          <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">
            <AlertCircle className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            KPI Incomplete
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-gray-300 bg-gray-50 text-gray-700">
            <Bell className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            {type}
          </Badge>
        );
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6B6B6B]">{t("hr:totalSent", "Total Sent")}</p>
              <div className="h-10 w-10 rounded-full bg-[#E6F7F1] flex items-center justify-center">
                <Send className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#0C5536] mt-2">{stats.totalSent}</p>
          </CardContent>
        </Card>

        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6B6B6B]">{t("hr:failedEmails", "Failed")}</p>
              <div className="h-10 w-10 rounded-full bg-[#FEECEC] flex items-center justify-center">
                <XCircle className="h-5 w-5 text-[#C0392B]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#C0392B] mt-2">{stats.totalFailed}</p>
          </CardContent>
        </Card>

        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6B6B6B]">{t("hr:skippedEmails", "Skipped")}</p>
              <div className="h-10 w-10 rounded-full bg-[#F5F5F5] flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-[#6B6B6B]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#6B6B6B] mt-2">{stats.totalSkipped}</p>
          </CardContent>
        </Card>

        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6B6B6B]">{t("hr:successRate", "Success Rate")}</p>
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-[#C6A03B]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#222222] mt-2">{stats.successRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              <CardTitle className="text-lg font-semibold text-[#0C5536]">
                {t("hr:filters", "Filters")}
              </CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
            >
              {t("hr:resetFilters", "Reset Filters")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#6B6B6B]" />
              <Input
                placeholder={t("hr:searchEmailOrSubject", "Search email or subject...")}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-10 border-[#E6E6E4] focus:border-[#C6A03B]"
              />
            </div>

            {/* Type Filter */}
            <Select
              value={typeFilter}
              onValueChange={(val) => {
                setTypeFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="border-[#E6E6E4]">
                <SelectValue placeholder={t("hr:notificationType", "Type")} />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="border-[#E6E6E4]">
                <SelectValue placeholder={t("hr:status", "Status")} />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date From */}
            <DatePicker
              date={dateFrom ? new Date(dateFrom + "T00:00:00") : undefined}
              onDateChange={(date) => {
                if (date) {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, "0");
                  const day = String(date.getDate()).padStart(2, "0");
                  setDateFrom(`${year}-${month}-${day}`);
                } else {
                  setDateFrom("");
                }
                setPage(1);
              }}
              placeholder={t("hr:from", "From")}
              className="w-full"
              clearable={true}
            />

            {/* Date To */}
            <DatePicker
              date={dateTo ? new Date(dateTo + "T00:00:00") : undefined}
              onDateChange={(date) => {
                if (date) {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, "0");
                  const day = String(date.getDate()).padStart(2, "0");
                  setDateTo(`${year}-${month}-${day}`);
                } else {
                  setDateTo("");
                }
                setPage(1);
              }}
              placeholder={t("hr:to", "To")}
              className="w-full"
              clearable={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("hr:emailLogs", "Email Notification Logs")}
                </CardTitle>
              </div>
              <CardDescription className="text-sm text-[#777777] ltr:ml-7 rtl:mr-7 mt-1">
                {totalCount} {t("hr:logsFound", "logs found")}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-[#6B6B6B]">
              <Mail className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
              <p className="font-medium text-[#222222]">{t("hr:noLogsFound", "No logs found")}</p>
              <p className="text-sm mt-1">{t("hr:noLogsFoundDesc", "Try adjusting your filters")}</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FAFAF8]">
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="font-semibold text-[#222222]">{t("hr:date")}</TableHead>
                      <TableHead className="font-semibold text-[#222222]">{t("hr:type", "Type")}</TableHead>
                      <TableHead className="font-semibold text-[#222222]">{t("hr:recipient")}</TableHead>
                      <TableHead className="font-semibold text-[#222222]">{t("hr:subject")}</TableHead>
                      <TableHead className="font-semibold text-[#222222]">{t("hr:status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <Collapsible key={log.id} open={expandedRows.has(log.id)}>
                        <TableRow 
                          className="hover:bg-[#FAFAF8] cursor-pointer"
                          onClick={() => toggleRow(log.id)}
                        >
                          <TableCell className="w-8">
                            <CollapsibleTrigger asChild>
                              <button className="p-1">
                                {expandedRows.has(log.id) ? (
                                  <ChevronDown className="h-4 w-4 text-[#6B6B6B]" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-[#6B6B6B]" />
                                )}
                              </button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell className="text-sm text-[#555555]">
                            {log.sent_at ? format(new Date(log.sent_at), "MMM d, yyyy HH:mm") : "-"}
                          </TableCell>
                          <TableCell>{getTypeBadge(log.notification_type)}</TableCell>
                          <TableCell className="text-sm text-[#555555]">{log.recipient_email}</TableCell>
                          <TableCell className="text-sm text-[#555555] max-w-[200px] truncate">
                            {log.subject}
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-[#FAFAF8]">
                            <TableCell colSpan={6} className="p-4">
                              <div className="space-y-3 text-sm">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-[#6B6B6B] font-medium mb-1">{t("hr:fullSubject", "Full Subject")}:</p>
                                    <p className="text-[#222222]">{log.subject}</p>
                                  </div>
                                  {log.error_message && (
                                    <div>
                                      <p className="text-[#C0392B] font-medium mb-1">{t("hr:errorMessage", "Error Message")}:</p>
                                      <p className="text-[#C0392B] bg-[#FEECEC] p-2 rounded">{log.error_message}</p>
                                    </div>
                                  )}
                                </div>
                                {log.documents_included && Array.isArray(log.documents_included) && log.documents_included.length > 0 && (
                                  <div>
                                    <p className="text-[#6B6B6B] font-medium mb-1">{t("hr:documentsIncluded", "Documents Included")}:</p>
                                    <div className="flex flex-wrap gap-2">
                                      {(log.documents_included as string[]).map((doc, idx) => (
                                        <Badge key={idx} variant="outline" className="border-[#E6E6E4] bg-white">
                                          {doc}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {log.metadata && typeof log.metadata === "object" && (
                                  <div>
                                    <p className="text-[#6B6B6B] font-medium mb-1">{t("hr:metadata", "Metadata")}:</p>
                                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-[#6B6B6B]">
                    {t("hr:showingPage", "Showing page")} {page} {t("hr:of", "of")} {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="border-[#E6E6E4]"
                    >
                      {t("hr:previous", "Previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="border-[#E6E6E4]"
                    >
                      {t("hr:next", "Next")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
