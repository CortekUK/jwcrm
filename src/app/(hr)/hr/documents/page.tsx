"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Search,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Archive,
  Clock,
  FolderOpen,
} from "lucide-react";
import { BatchDocumentExportButton } from "@/components/hr/documents/BatchDocumentExportButton";

interface Document {
  id: string;
  employee_id: string;
  employee_name: string;
  department_name: string | null;
  employment_status: string | null;
  document_type: string;
  document_name: string;
  document_path: string;
  expiry_date: string | null;
  is_active: boolean;
  archived_at: string | null;
  uploaded_at: string | null;
}

interface DocumentStats {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
}

interface DocumentTypeCount {
  type: string;
  count: number;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  passport: "Passport",
  employment_visa: "Employment Visa",
  emirates_id: "Emirates ID",
  employment_contract: "Employment Contract",
  certification: "Certification",
};

const EMPLOYMENT_STATUSES = ["active", "inactive", "on_leave", "terminated"];

export default function DocumentsPage() {
  const { t, i18n } = useTranslation(["hr"]);
  const isRtl = i18n.language === "ar";
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);

  // Filters - initialize from URL params
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get("type") || "all");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") || "all");
  // Employment status of the document owner. Defaults to "active" (the previous
  // hard-coded scope) but is now visible and changeable instead of silent.
  const [employmentStatusFilter, setEmploymentStatusFilter] = useState(
    () => searchParams?.get("employmentStatus") || "active"
  );

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("employee_documents")
        .select(
          `
          id,
          employee_id,
          document_type,
          document_name,
          document_path,
          expiry_date,
          is_active,
          archived_at,
          uploaded_at,
          employees!inner (
            full_name,
            employment_status,
            departments (name)
          )
        `
        )
        .order("uploaded_at", { ascending: false });

      if (error) throw error;

      const formattedDocs: Document[] = (data || []).map((doc: any) => ({
        id: doc.id,
        employee_id: doc.employee_id,
        employee_name: doc.employees?.full_name || "Unknown",
        department_name: doc.employees?.departments?.name || null,
        employment_status: doc.employees?.employment_status || null,
        document_type: doc.document_type,
        document_name: doc.document_name,
        document_path: doc.document_path,
        expiry_date: doc.expiry_date,
        is_active: doc.is_active,
        archived_at: doc.archived_at,
        uploaded_at: doc.uploaded_at,
      }));

      setDocuments(formattedDocs);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDocumentStatus = (doc: Document) => {
    if (!doc.is_active) return "archived";
    if (!doc.expiry_date) return "active";

    const today = new Date();
    const expiryDate = new Date(doc.expiry_date);

    if (expiryDate < today) return "expired";

    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    // Match HR dashboard threshold of 90 days
    if (daysUntilExpiry <= 90) return "expiring";
    return "active";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "expired":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {t("hr:documentsPage.expired")}
          </Badge>
        );
      case "expiring":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500 text-amber-600"
          >
            <Clock className="h-3 w-3" />
            {t("hr:documentsPage.expiringDocuments")}
          </Badge>
        );
      case "archived":
        return (
          <Badge variant="secondary" className="gap-1">
            <Archive className="h-3 w-3" />
            {t("hr:documentsPage.archived")}
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="gap-1 border-green-500 text-green-600"
          >
            <CheckCircle2 className="h-3 w-3" />
            {t("hr:documentsPage.active")}
          </Badge>
        );
    }
  };

  const handleViewDocument = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from("wills")
        .createSignedUrl(doc.document_path, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error) {
      console.error("Error viewing document:", error);
    }
  };

  // Documents currently in scope, i.e. after the employment status filter.
  // Stats and type counts are derived from this so they can never disagree
  // with the scope the user has chosen.
  const scopedDocuments = useMemo(
    () =>
      employmentStatusFilter === "all"
        ? documents
        : documents.filter((d) => d.employment_status === employmentStatusFilter),
    [documents, employmentStatusFilter]
  );

  // Calculate stats - use 90 days to match HR dashboard threshold
  const stats: DocumentStats = useMemo(() => {
    const today = new Date();
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

    const activeDocs = scopedDocuments.filter((d) => d.is_active);
    const expiredDocs = activeDocs.filter(
      (d) => d.expiry_date && new Date(d.expiry_date) < today
    );
    const expiringSoonDocs = activeDocs.filter(
      (d) =>
        d.expiry_date &&
        new Date(d.expiry_date) >= today &&
        new Date(d.expiry_date) <= ninetyDaysFromNow
    );

    return {
      total: scopedDocuments.length,
      active: activeDocs.length,
      expiringSoon: expiringSoonDocs.length,
      expired: expiredDocs.length,
    };
  }, [scopedDocuments]);

  // Calculate type stats
  const typeStats: DocumentTypeCount[] = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    scopedDocuments
      .filter((d) => d.is_active)
      .forEach((doc) => {
        typeCounts[doc.document_type] = (typeCounts[doc.document_type] || 0) + 1;
      });
    return Object.entries(typeCounts).map(([type, count]) => ({ type, count }));
  }, [scopedDocuments]);

  // Filter documents
  const filteredDocuments = scopedDocuments.filter((doc) => {
    const matchesSearch =
      doc.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.document_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      typeFilter === "all" || doc.document_type === typeFilter;

    const docStatus = getDocumentStatus(doc);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && docStatus === "active") ||
      (statusFilter === "archived" && docStatus === "archived") ||
      (statusFilter === "expired" && docStatus === "expired") ||
      (statusFilter === "expiring" && docStatus === "expiring");

    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FolderOpen className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("hr:documentsPage.title")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {t("hr:documentsPage.description")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[hsl(var(--jw-primary-green))]/30 bg-white">
              <FileText className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
              <span className="text-sm font-medium text-[hsl(var(--jw-primary-green))]">
                {stats.total} {t("hr:documentsPage.documents")}
              </span>
            </div>
            <BatchDocumentExportButton />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6B6B6B]">
                {t("hr:documentsPage.totalDocuments")}
              </p>
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                <FileText className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#222222] mt-2">
              {stats.total}
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6B6B6B]">
                {t("hr:documentsPage.activeDocuments")}
              </p>
              <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-[#0C5536]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#222222] mt-2">
              {stats.active}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-[#E6E6E4] ${stats.expiringSoon > 0 ? "bg-amber-50/50 border-amber-200" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6B6B6B]">
                {t("hr:documentsPage.expiringDocuments")}
              </p>
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stats.expiringSoon > 0 ? "bg-amber-100" : "bg-[rgba(198,160,59,0.15)]"}`}>
                <Clock className={`h-5 w-5 ${stats.expiringSoon > 0 ? "text-amber-600" : "text-[#0C5536]"}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold mt-2 ${stats.expiringSoon > 0 ? "text-amber-600" : "text-[#222222]"}`}>
              {stats.expiringSoon}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-[#E6E6E4] ${stats.expired > 0 ? "bg-red-50/50 border-red-200" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6B6B6B]">
                {t("hr:documentsPage.expiredDocuments")}
              </p>
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stats.expired > 0 ? "bg-red-100" : "bg-[rgba(198,160,59,0.15)]"}`}>
                <AlertTriangle className={`h-5 w-5 ${stats.expired > 0 ? "text-red-600" : "text-[#0C5536]"}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold mt-2 ${stats.expired > 0 ? "text-red-600" : "text-[#222222]"}`}>
              {stats.expired}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Documents by Type */}
      {typeStats.length > 0 && (
        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              <h3 className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>{t("hr:documentsPage.byType")}</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              {typeStats.map((item) => (
                <div
                  key={item.type}
                  className="flex items-center gap-2 px-3 py-2 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4] hover:border-[#C6A03B] transition-colors"
                >
                  <span className="text-sm font-medium text-[#222222]">
                    {t(`hr:docType.${item.type}`) ||
                      DOCUMENT_TYPE_LABELS[item.type] ||
                      item.type}
                  </span>
                  <Badge variant="secondary" className="bg-[rgba(198,160,59,0.15)] text-[#0C5536] hover:bg-[rgba(198,160,59,0.25)]">
                    {item.count}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents Table */}
      <Card className="border-[#E6E6E4]">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              <h3 className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("hr:documentsPage.documentsList")}
              </h3>
            </div>
            {/* flex-wrap + min-w-0: this row carries four controls (search, type,
                status, employment status). Flex items default to min-width:auto,
                so the fixed sm:w-[…] widths do not shrink and the row pushed the
                whole page into horizontal overflow on a narrow window. */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 min-w-0">
              <div className="relative min-w-0">
                <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#C6A03B]" />
                <Input
                  placeholder={t("hr:documentsPage.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ltr:pl-9 rtl:pr-9 w-full sm:w-[250px] border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px] border-[#E6E6E4]">
                  <SelectValue placeholder={t("hr:documentsPage.allTypes")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("hr:documentsPage.allTypes")}
                  </SelectItem>
                  <SelectItem value="passport">
                    {t("hr:docType.passport")}
                  </SelectItem>
                  <SelectItem value="employment_visa">
                    {t("hr:docType.employment_visa")}
                  </SelectItem>
                  <SelectItem value="emirates_id">
                    {t("hr:docType.emirates_id")}
                  </SelectItem>
                  <SelectItem value="employment_contract">
                    {t("hr:docType.employment_contract")}
                  </SelectItem>
                  <SelectItem value="certification">
                    {t("hr:docType.certification")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px] border-[#E6E6E4]">
                  <SelectValue
                    placeholder={t("hr:documentsPage.allStatuses")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("hr:documentsPage.allStatuses")}
                  </SelectItem>
                  <SelectItem value="active">
                    {t("hr:documentsPage.active")}
                  </SelectItem>
                  <SelectItem value="expiring">
                    {t("hr:documentsPage.expiringSoon")}
                  </SelectItem>
                  <SelectItem value="expired">
                    {t("hr:documentsPage.expired")}
                  </SelectItem>
                  <SelectItem value="archived">
                    {t("hr:documentsPage.archived")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={employmentStatusFilter}
                onValueChange={setEmploymentStatusFilter}
              >
                <SelectTrigger className="w-full sm:w-[180px] border-[#E6E6E4]">
                  <SelectValue placeholder={t("hr:employmentStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("hr:documentsPage.allEmployees", "All Employees")}
                  </SelectItem>
                  {EMPLOYMENT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`hr:status.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAF8] hover:bg-[#FAFAF8]">
                  <TableHead className="font-semibold text-[#222222]">{t("hr:documentsPage.employee")}</TableHead>
                  <TableHead className="font-semibold text-[#222222]">{t("hr:documentsPage.documentType")}</TableHead>
                  <TableHead className="font-semibold text-[#222222]">{t("hr:documentsPage.uploadedAt")}</TableHead>
                  <TableHead className="font-semibold text-[#222222]">{t("hr:documentsPage.expiryDate")}</TableHead>
                  <TableHead className="font-semibold text-[#222222]">{t("hr:documentsPage.status")}</TableHead>
                  <TableHead className="font-semibold text-[#222222] text-right">
                    {t("hr:actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-12"
                    >
                      <FolderOpen className="h-10 w-10 text-[#C6A03B] mx-auto mb-3" />
                      <p className="text-[#6B6B6B]">{t("hr:documentsPage.noDocumentsFound")}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocuments.slice(0, 50).map((doc) => (
                    <TableRow key={doc.id} className="hover:bg-[#FAFAF8]">
                      <TableCell>
                        <div>
                          <p className="font-medium text-[#222222]">
                            {doc.employee_name}
                          </p>
                          <p className="text-xs text-[#6B6B6B]">
                            {doc.department_name || t("hr:documentsPage.noDepartment")}
                            {doc.employment_status &&
                              doc.employment_status !== "active" &&
                              ` · ${t(`hr:status.${doc.employment_status}`)}`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-[#555555]">
                        {t(`hr:docType.${doc.document_type}`) ||
                          DOCUMENT_TYPE_LABELS[doc.document_type] ||
                          doc.document_type}
                      </TableCell>
                      <TableCell className="text-[#555555]">
                        {doc.uploaded_at
                          ? new Date(doc.uploaded_at).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell className="text-[#555555]">
                        {doc.expiry_date
                          ? new Date(doc.expiry_date).toLocaleDateString()
                          : t("hr:noExpiry")}
                      </TableCell>
                      <TableCell>{getStatusBadge(getDocumentStatus(doc))}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDocument(doc)}
                          className="text-[hsl(var(--jw-primary-green))] hover:text-[hsl(var(--jw-hover-green))] hover:bg-[rgba(198,160,59,0.1)]"
                        >
                          <Eye className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                          {t("hr:documentsPage.viewDocument")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filteredDocuments.length > 50 && (
            <p className="text-sm text-[#6B6B6B] mt-3 text-center">
              {t("hr:showingResults", {
                count: 50,
                total: filteredDocuments.length,
              })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("hr:legalNotice")}
        </p>
      </div>
    </div>
  );
}
