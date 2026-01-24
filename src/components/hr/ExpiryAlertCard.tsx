"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  Info,
  FileText,
  RefreshCw,
  Mail,
  ExternalLink,
  XCircle,
  Loader2,
  Upload,
  Search,
  X,
  Filter,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { differenceInDays, format } from "date-fns";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmployeeDocumentUpload } from "./EmployeeDocumentUpload";

export interface ExpiringDocument {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email?: string;
  document_type: string;
  expiry_date: string;
  renewal_status?: string | null;
  renewal_submitted_at?: string | null;
  renewal_expected_at?: string | null;
  last_reminder_at?: string | null;
  reminder_count?: number | null;
}

interface ExpiryAlertCardProps {
  documents: ExpiringDocument[];
  onRefresh?: () => void;
}

type AlertLevel = "expired" | "critical" | "urgent" | "warning" | "advisory" | "in_progress";

function getAlertLevel(doc: ExpiringDocument): AlertLevel | null {
  // If renewal is in progress, show in separate section
  if (doc.renewal_status === "in_progress") return "in_progress";

  const daysUntilExpiry = differenceInDays(new Date(doc.expiry_date), new Date());

  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= 7) return "critical";
  if (daysUntilExpiry <= 14) return "urgent";
  if (daysUntilExpiry <= 30) return "warning";
  if (daysUntilExpiry <= 90) return "advisory";
  return null;
}

function groupByAlertLevel(documents: ExpiringDocument[]): Record<AlertLevel, ExpiringDocument[]> {
  const grouped: Record<AlertLevel, ExpiringDocument[]> = {
    expired: [],
    critical: [],
    urgent: [],
    warning: [],
    advisory: [],
    in_progress: [],
  };

  documents.forEach((doc) => {
    const level = getAlertLevel(doc);
    if (level) {
      grouped[level].push(doc);
    }
  });

  return grouped;
}

const getAlertConfig = (t: (key: string) => string): Record<
  AlertLevel,
  { icon: any; color: string; bgColor: string; borderColor: string; label: string }
> => ({
  expired: {
    icon: XCircle,
    color: "text-red-700",
    bgColor: "bg-red-100",
    borderColor: "border-red-300",
    label: t("alert.expired"),
  },
  critical: {
    icon: AlertCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    label: t("alert.days0to7"),
  },
  urgent: {
    icon: AlertTriangle,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    label: t("alert.days8to14"),
  },
  warning: {
    icon: Clock,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    label: t("alert.days15to30"),
  },
  advisory: {
    icon: Info,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    label: t("alert.days31to90"),
  },
  in_progress: {
    icon: RefreshCw,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
    label: t("alert.in_progress"),
  },
});

// Document type options for filtering
const DOCUMENT_TYPES = [
  { value: "all", labelKey: "filter.allDocuments" },
  { value: "passport", labelKey: "docType.passport" },
  { value: "employment_visa", labelKey: "docType.employment_visa" },
  { value: "emirates_id", labelKey: "docType.emirates_id" },
  { value: "work_permit", labelKey: "filter.workPermit" },
  { value: "medical_certificate", labelKey: "filter.medicalCertificate" },
];

// Sort options
const SORT_OPTIONS = [
  { value: "urgency", labelKey: "sort.urgency" },
  { value: "expiry_date", labelKey: "sort.expiryDate" },
  { value: "employee_name", labelKey: "sort.employeeName" },
  { value: "document_type", labelKey: "sort.documentType" },
];

const STORAGE_KEY = "hr_expiry_alert_filters";

// Helper function to get initial filter state from localStorage
function getInitialFilterState() {
  if (typeof window === "undefined") {
    return { documentTypeFilter: "all", sortBy: "urgency", searchQuery: "" };
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        documentTypeFilter: parsed.documentTypeFilter || "all",
        sortBy: parsed.sortBy || "urgency",
        searchQuery: parsed.searchQuery || "",
      };
    }
  } catch (e) {
    // Ignore localStorage errors
  }
  return { documentTypeFilter: "all", sortBy: "urgency", searchQuery: "" };
}

export function ExpiryAlertCard({ documents, onRefresh }: ExpiryAlertCardProps) {
  const { t } = useTranslation(["hr"]);
  const router = useRouter();
  const { toast } = useToast();
  const alertConfig = getAlertConfig(t);

  // Filter, sort, and search state - initialized from localStorage
  const [documentTypeFilter, setDocumentTypeFilter] = useState(() => getInitialFilterState().documentTypeFilter);
  const [sortBy, setSortBy] = useState(() => getInitialFilterState().sortBy);
  const [searchQuery, setSearchQuery] = useState(() => getInitialFilterState().searchQuery);
  const [isHydrated, setIsHydrated] = useState(false);

  // Mark as hydrated after first render to avoid SSR mismatch
  useEffect(() => {
    setIsHydrated(true);
    // Re-read from localStorage after hydration to ensure we have the latest values
    const state = getInitialFilterState();
    setDocumentTypeFilter(state.documentTypeFilter);
    setSortBy(state.sortBy);
    setSearchQuery(state.searchQuery);
  }, []);

  // Persist filters to localStorage (only after hydration)
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        documentTypeFilter,
        sortBy,
        searchQuery,
      }));
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [documentTypeFilter, sortBy, searchQuery, isHydrated]);

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let result = [...documents];

    // Apply document type filter
    if (documentTypeFilter !== "all") {
      result = result.filter((doc) => doc.document_type === documentTypeFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((doc) =>
        doc.employee_name.toLowerCase().includes(query)
      );
    }

    // Apply sorting (only for non-urgency sorts, urgency uses grouping)
    if (sortBy !== "urgency") {
      result.sort((a, b) => {
        switch (sortBy) {
          case "expiry_date":
            return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
          case "employee_name":
            return a.employee_name.localeCompare(b.employee_name);
          case "document_type":
            return a.document_type.localeCompare(b.document_type);
          default:
            return 0;
        }
      });
    }

    return result;
  }, [documents, documentTypeFilter, searchQuery, sortBy]);

  const grouped = groupByAlertLevel(filteredDocuments);

  const [renewalDialogOpen, setRenewalDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ExpiringDocument | null>(null);
  const [renewalSubmittedAt, setRenewalSubmittedAt] = useState("");
  const [renewalExpectedAt, setRenewalExpectedAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  // Reminder dialog state
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderDoc, setReminderDoc] = useState<ExpiringDocument | null>(null);
  const [reminderMessage, setReminderMessage] = useState("");

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadDoc, setUploadDoc] = useState<ExpiringDocument | null>(null);

  const totalExpiring =
    grouped.expired.length +
    grouped.critical.length +
    grouped.urgent.length +
    grouped.warning.length +
    grouped.advisory.length;

  const totalDocuments = documents.length;
  const filteredCount = filteredDocuments.length;

  const handleMarkRenewalInProgress = async () => {
    if (!selectedDoc) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("employee_documents")
        .update({
          renewal_status: "in_progress",
          renewal_submitted_at: renewalSubmittedAt || null,
          renewal_expected_at: renewalExpectedAt || null,
        })
        .eq("id", selectedDoc.id);

      if (error) throw error;

      toast({
        title: "Renewal Status Updated",
        description: `${selectedDoc.document_type} marked as renewal in progress`,
      });

      setRenewalDialogOpen(false);
      setSelectedDoc(null);
      setRenewalSubmittedAt("");
      setRenewalExpectedAt("");
      onRefresh?.();
    } catch (error) {
      console.error("Error updating renewal status:", error);
      toast({
        title: "Error",
        description: "Failed to update renewal status",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkRenewalComplete = async (doc: ExpiringDocument) => {
    try {
      const { error } = await supabase
        .from("employee_documents")
        .update({
          renewal_status: "completed",
        })
        .eq("id", doc.id);

      if (error) throw error;

      toast({
        title: "Renewal Completed",
        description: `${doc.document_type} renewal marked as complete`,
      });

      onRefresh?.();
    } catch (error) {
      console.error("Error completing renewal:", error);
      toast({
        title: "Error",
        description: "Failed to complete renewal",
        variant: "destructive",
      });
    }
  };

  const handleCancelRenewal = async (doc: ExpiringDocument) => {
    try {
      const { error } = await supabase
        .from("employee_documents")
        .update({
          renewal_status: "none",
          renewal_submitted_at: null,
          renewal_expected_at: null,
        })
        .eq("id", doc.id);

      if (error) throw error;

      toast({
        title: t("hr:renewalCancelled"),
        description: t("hr:renewalCancelledDesc", { documentType: t(`hr:docType.${doc.document_type}`) }),
      });

      onRefresh?.();
    } catch (error) {
      console.error("Error cancelling renewal:", error);
      toast({
        title: "Error",
        description: "Failed to cancel renewal",
        variant: "destructive",
      });
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setDocumentTypeFilter("all");
    setSortBy("urgency");
    setSearchQuery("");
  };

  const hasActiveFilters = documentTypeFilter !== "all" || sortBy !== "urgency" || searchQuery.trim() !== "";

  // Open reminder dialog with pre-filled message
  const openReminderDialog = (doc: ExpiringDocument) => {
    const days = differenceInDays(new Date(doc.expiry_date), new Date());
    const daysText = days < 0 ? `expired ${Math.abs(days)} days ago` : `expires in ${days} days`;

    const defaultMessage = `Dear ${doc.employee_name},

Your ${doc.document_type} ${daysText} (${format(new Date(doc.expiry_date), "MMMM d, yyyy")}).

Please renew and provide a copy to HR as soon as possible.

Thank you,
HR Department`;

    setReminderDoc(doc);
    setReminderMessage(defaultMessage);
    setReminderDialogOpen(true);
  };

  // Send reminder email via API
  const handleSendReminder = async () => {
    if (!reminderDoc) return;

    setIsSendingReminder(true);
    try {
      // Get session for API auth
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const days = differenceInDays(new Date(reminderDoc.expiry_date), new Date());

      // Send email via API
      const response = await fetch("/api/hr/send-document-reminder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          employeeName: reminderDoc.employee_name,
          employeeEmail: reminderDoc.employee_email || "no-email@example.com",
          documentType: reminderDoc.document_type,
          expiryDate: format(new Date(reminderDoc.expiry_date), "MMMM d, yyyy"),
          daysRemaining: days,
          customMessage: reminderMessage,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send email");
      }

      // Update last_reminder_at and increment reminder_count
      const { error } = await supabase
        .from("employee_documents")
        .update({
          last_reminder_at: new Date().toISOString(),
          reminder_count: (reminderDoc.reminder_count || 0) + 1,
        })
        .eq("id", reminderDoc.id);

      if (error) throw error;

      toast({
        title: "Reminder Sent",
        description: `Reminder sent for ${reminderDoc.employee_name}'s ${reminderDoc.document_type}`,
      });

      setReminderDialogOpen(false);
      setReminderDoc(null);
      setReminderMessage("");
      onRefresh?.();
    } catch (error) {
      console.error("Error sending reminder:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send reminder",
        variant: "destructive",
      });
    } finally {
      setIsSendingReminder(false);
    }
  };

  // Open upload dialog
  const openUploadDialog = (doc: ExpiringDocument) => {
    setUploadDoc(doc);
    setUploadDialogOpen(true);
  };

  // Handle successful upload
  const handleUploadSuccess = () => {
    toast({
      title: "Document Renewed",
      description: `${uploadDoc?.document_type} renewed for ${uploadDoc?.employee_name}`,
    });
    setUploadDialogOpen(false);
    setUploadDoc(null);
    onRefresh?.();
  };

  const openRenewalDialog = (doc: ExpiringDocument) => {
    setSelectedDoc(doc);
    setRenewalSubmittedAt(new Date().toISOString().split("T")[0]);
    setRenewalExpectedAt("");
    setRenewalDialogOpen(true);
  };

  const getDaysText = (expiryDate: string) => {
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (days < 0) return `${Math.abs(days)} days ago`;
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `${days} days`;
  };

  if (totalExpiring === 0 && grouped.in_progress.length === 0) {
    return (
      <Card className="border-[#E6E6E4]">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <div className="h-8 w-8 rounded-lg bg-[hsl(var(--jw-gold-accent))]/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
            </div>
            {t("hr:documentAlerts")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-[#6B6B6B]">
            <Clock className="h-12 w-12 mx-auto mb-2 text-[#E6E6E4]" />
            <p>{t("hr:noExpiringDocuments")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderDocumentItem = (doc: ExpiringDocument, level: AlertLevel) => {
    const config = alertConfig[level];
    const isExpired = level === "expired";
    const isInProgress = level === "in_progress";

    return (
      <li
        key={doc.id}
        className="text-sm p-2 rounded hover:bg-white/50 border-b border-current/10 last:border-0"
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-[#333333] truncate">{doc.employee_name}</span>
              <span className="text-[#6B6B6B]">-</span>
              <span className="text-[#555555]">{t(`hr:docType.${doc.document_type}`)}</span>
              {isExpired && (
                <Badge variant="destructive" className="text-xs">
                  URGENT - Compliance Risk
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-xs ${config.color}`}>
                {isExpired ? t("hr:alert.expired") : t("hr:alert.expires")}: {format(new Date(doc.expiry_date), "MMM d, yyyy")}
              </span>
              <span className={`text-xs font-medium ${config.color}`}>({getDaysText(doc.expiry_date)})</span>
              {doc.reminder_count && doc.reminder_count > 0 && (
                <Badge variant="outline" className="text-xs h-5">
                  {doc.reminder_count} reminder{doc.reminder_count > 1 ? "s" : ""} sent
                </Badge>
              )}
            </div>
            {isInProgress && doc.renewal_expected_at && (
              <div className="text-xs text-sky-600 mt-1">
                Expected: {format(new Date(doc.renewal_expected_at), "MMM d, yyyy")}
              </div>
            )}
          </div>
          <div className="flex items-center shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => router.push(`/admin/hr/employees/${doc.employee_id}?tab=documents`)}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t("hr:viewDocuments")}
                </DropdownMenuItem>
                {!isInProgress && (
                  <>
                    <DropdownMenuItem
                      onClick={() => openUploadDialog(doc)}
                      className="text-green-600 focus:text-green-700"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {t("hr:uploadRenewed")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openReminderDialog(doc)}>
                      <Mail className="h-4 w-4 mr-2" />
                      {t("hr:sendReminder")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => openRenewalDialog(doc)}
                      className="text-sky-600 focus:text-sky-700"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {t("hr:markInProgress")}
                    </DropdownMenuItem>
                  </>
                )}
                {isInProgress && (
                  <>
                    <DropdownMenuItem
                      onClick={() => handleMarkRenewalComplete(doc)}
                      className="text-green-600 focus:text-green-700"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {t("hr:markComplete")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleCancelRenewal(doc)}
                      className="text-red-600 focus:text-red-700"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {t("hr:cancelRenewal")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </li>
    );
  };

  return (
    <>
      <Card className="border-[#E6E6E4]">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center justify-between" style={{ fontFamily: 'Playfair Display, serif' }}>
            <span className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--jw-gold-accent))]/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
              </div>
              {t("hr:documentAlerts")}
            </span>
            <div className="flex items-center gap-2">
              {grouped.in_progress.length > 0 && (
                <Badge variant="outline" className="bg-sky-50 text-sky-600 border-sky-200">
                  {grouped.in_progress.length} {t("hr:filter.inProgress")}
                </Badge>
              )}
              {totalExpiring > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                  {totalExpiring} {t("hr:expiring")}
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter, Sort, and Search Controls */}
          <div className="flex flex-col gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-wrap items-center gap-3">
              {/* Document Type Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
                  <SelectTrigger className="w-[180px] h-9 bg-white">
                    <SelectValue placeholder={t("hr:filter.allDocuments")} />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {t(`hr:${type.labelKey}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort Options */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px] h-9 bg-white">
                  <SelectValue placeholder={t("hr:sort.urgency")} />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(`hr:${option.labelKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Search Input */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t("hr:filter.searchEmployee")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-white"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="h-9">
                  <X className="h-4 w-4 mr-1" />
                  {t("hr:filter.clearFilters")}
                </Button>
              )}
            </div>

            {/* Results Count */}
            <div className="text-sm text-gray-600">
              {t("hr:filter.showingResults", { count: filteredCount, total: totalDocuments })}
            </div>
          </div>
          {/* Show expired documents first with high priority */}
          {grouped.expired.length > 0 && (
            <div className={`p-3 rounded-lg border ${alertConfig.expired.bgColor} ${alertConfig.expired.borderColor}`}>
              <div className="flex items-center gap-2 mb-2">
                <XCircle className={`h-4 w-4 ${alertConfig.expired.color}`} />
                <span className={`font-semibold ${alertConfig.expired.color}`}>
                  EXPIRED - Immediate Action Required
                </span>
                <Badge variant="outline" className={`ml-auto ${alertConfig.expired.color} border-current`}>
                  {grouped.expired.length}
                </Badge>
              </div>
              <ul className="space-y-1">{grouped.expired.map((doc) => renderDocumentItem(doc, "expired"))}</ul>
            </div>
          )}

          {/* Show other alert levels */}
          {(["critical", "urgent", "warning", "advisory"] as AlertLevel[]).map((level) => {
            const docs = grouped[level];
            if (docs.length === 0) return null;

            const config = alertConfig[level];
            const Icon = config.icon;

            return (
              <div key={level} className={`p-3 rounded-lg border ${config.bgColor} ${config.borderColor}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${config.color}`} />
                  <span className={`font-semibold ${config.color}`}>
                    {t(`hr:alert.${level}`)} ({config.label})
                  </span>
                  <Badge variant="outline" className={`ml-auto ${config.color} border-current`}>
                    {docs.length}
                  </Badge>
                </div>
                <ul className="space-y-1">
                  {docs.slice(0, 5).map((doc) => renderDocumentItem(doc, level))}
                  {docs.length > 5 && (
                    <li className="text-sm text-[#6B6B6B] pl-2 pt-1">
                      +{docs.length - 5} {t("hr:more")}
                    </li>
                  )}
                </ul>
              </div>
            );
          })}

          {/* Show documents in renewal progress */}
          {grouped.in_progress.length > 0 && (
            <div
              className={`p-3 rounded-lg border ${alertConfig.in_progress.bgColor} ${alertConfig.in_progress.borderColor}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className={`h-4 w-4 ${alertConfig.in_progress.color}`} />
                <span className={`font-semibold ${alertConfig.in_progress.color}`}>Renewal in Progress</span>
                <Badge variant="outline" className={`ml-auto ${alertConfig.in_progress.color} border-current`}>
                  {grouped.in_progress.length}
                </Badge>
              </div>
              <ul className="space-y-1">
                {grouped.in_progress.map((doc) => renderDocumentItem(doc, "in_progress"))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Renewal Dialog */}
      <Dialog open={renewalDialogOpen} onOpenChange={setRenewalDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Mark as Renewal in Progress</DialogTitle>
            <DialogDescription>
              {selectedDoc && (
                <>
                  Mark {selectedDoc.employee_name}&apos;s {t(`hr:docType.${selectedDoc.document_type}`)} as being
                  renewed.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="submitted_at">Submission Date</Label>
              <Input
                id="submitted_at"
                type="date"
                value={renewalSubmittedAt}
                onChange={(e) => setRenewalSubmittedAt(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expected_at">Expected Return Date (Optional)</Label>
              <Input
                id="expected_at"
                type="date"
                value={renewalExpectedAt}
                onChange={(e) => setRenewalExpectedAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewalDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMarkRenewalInProgress}
              disabled={isSubmitting}
              className="bg-sky-600 hover:bg-sky-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Mark in Progress
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Reminder Dialog */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Document Reminder
            </DialogTitle>
            <DialogDescription>
              {reminderDoc && (
                <>
                  Send a reminder to <span className="font-medium">{reminderDoc.employee_name}</span> about their{" "}
                  {t(`hr:docType.${reminderDoc.document_type}`)}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>To</Label>
              <div className="text-sm p-2 bg-gray-50 rounded border">
                {reminderDoc?.employee_name}
                <span className="text-[#6B6B6B] ml-2">({reminderDoc?.employee_email || "No email"})</span>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reminder_message">Message</Label>
              <Textarea
                id="reminder_message"
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReminderDialogOpen(false);
                setReminderDoc(null);
                setReminderMessage("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendReminder}
              disabled={isSendingReminder}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))]"
            >
              {isSendingReminder ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Reminder
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Renewed Document Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Renewed Document
            </DialogTitle>
            <DialogDescription>
              {uploadDoc && (
                <>
                  Upload renewed {t(`hr:docType.${uploadDoc.document_type}`)} for{" "}
                  <span className="font-medium">{uploadDoc.employee_name}</span>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {uploadDoc && (
              <EmployeeDocumentUpload
                employeeId={uploadDoc.employee_id}
                onSuccess={handleUploadSuccess}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Summary cards for dashboard stats
interface AlertSummaryCardsProps {
  documents: ExpiringDocument[];
}

export function AlertSummaryCards({ documents }: AlertSummaryCardsProps) {
  const { t } = useTranslation(["hr"]);
  const alertConfig = getAlertConfig(t);
  const grouped = groupByAlertLevel(documents);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {(["expired", "critical", "urgent", "warning", "advisory"] as AlertLevel[]).map((level) => {
        const config = alertConfig[level];
        const Icon = config.icon;
        const count = grouped[level].length;
        const hasItems = count > 0;

        return (
          <Card 
            key={level} 
            className={`transition-shadow hover:shadow-md ${
              hasItems 
                ? `${config.bgColor} ${config.borderColor}` 
                : "bg-white border-[#E6E6E4]"
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[#6B6B6B] uppercase tracking-wide">
                    {t(`hr:alert.${level}`)}
                  </p>
                  <p className={`text-2xl font-bold ${hasItems ? config.color : "text-[#222222]"}`}>
                    {count}
                  </p>
                  <p className="text-xs text-[#6B6B6B]">{config.label}</p>
                </div>
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                  hasItems ? `${config.bgColor}` : "bg-gray-50"
                }`}>
                  <Icon className={`h-4.5 w-4.5 ${hasItems ? config.color : "text-[#E6E6E4]"}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
