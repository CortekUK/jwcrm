"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { BatchDocumentExportButton } from "@/components/hr/documents/BatchDocumentExportButton";

interface Document {
  id: string;
  employee_id: string;
  employee_name: string;
  department_name: string | null;
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
};

export default function DocumentsPage() {
  const { t, i18n } = useTranslation(["hr"]);
  const isRtl = i18n.language === "ar";

  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<DocumentStats>({
    total: 0,
    active: 0,
    expiringSoon: 0,
    expired: 0,
  });
  const [typeStats, setTypeStats] = useState<DocumentTypeCount[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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
        .eq("employees.employment_status", "active")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;

      const formattedDocs: Document[] = (data || []).map((doc: any) => ({
        id: doc.id,
        employee_id: doc.employee_id,
        employee_name: doc.employees?.full_name || "Unknown",
        department_name: doc.employees?.departments?.name || null,
        document_type: doc.document_type,
        document_name: doc.document_name,
        document_path: doc.document_path,
        expiry_date: doc.expiry_date,
        is_active: doc.is_active,
        archived_at: doc.archived_at,
        uploaded_at: doc.uploaded_at,
      }));

      setDocuments(formattedDocs);

      // Calculate stats
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const activeDocs = formattedDocs.filter((d) => d.is_active);
      const expiredDocs = activeDocs.filter(
        (d) => d.expiry_date && new Date(d.expiry_date) < today
      );
      const expiringSoonDocs = activeDocs.filter(
        (d) =>
          d.expiry_date &&
          new Date(d.expiry_date) >= today &&
          new Date(d.expiry_date) <= thirtyDaysFromNow
      );

      setStats({
        total: formattedDocs.length,
        active: activeDocs.length,
        expiringSoon: expiringSoonDocs.length,
        expired: expiredDocs.length,
      });

      // Calculate type stats
      const typeCounts: Record<string, number> = {};
      activeDocs.forEach((doc) => {
        typeCounts[doc.document_type] = (typeCounts[doc.document_type] || 0) + 1;
      });
      setTypeStats(
        Object.entries(typeCounts).map(([type, count]) => ({ type, count }))
      );
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
    if (daysUntilExpiry <= 30) return "expiring";
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

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
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
      (statusFilter === "expired" &&
        (docStatus === "expired" || docStatus === "expiring"));

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#222222]">
            {t("hr:documentsPage.title")}
          </h1>
          <p className="text-[#6B6B6B]">{t("hr:documentsPage.description")}</p>
        </div>
        <BatchDocumentExportButton />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B6B]">
                  {t("hr:documentsPage.totalDocuments")}
                </p>
                <p className="text-2xl font-bold text-[#222222]">
                  {stats.total}
                </p>
              </div>
              <FileText className="h-8 w-8 text-[#6B6B6B]" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B6B]">
                  {t("hr:documentsPage.activeDocuments")}
                </p>
                <p className="text-2xl font-bold text-[hsl(var(--jw-primary-green))]">
                  {stats.active}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-[hsl(var(--jw-primary-green))]" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-[#E6E6E4] ${stats.expiringSoon > 0 ? "bg-amber-50 border-amber-200" : ""}`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B6B]">
                  {t("hr:documentsPage.expiringDocuments")}
                </p>
                <p
                  className={`text-2xl font-bold ${stats.expiringSoon > 0 ? "text-amber-600" : "text-[#222222]"}`}
                >
                  {stats.expiringSoon}
                </p>
              </div>
              <Clock
                className={`h-8 w-8 ${stats.expiringSoon > 0 ? "text-amber-500" : "text-[#6B6B6B]"}`}
              />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-[#E6E6E4] ${stats.expired > 0 ? "bg-red-50 border-red-200" : ""}`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B6B]">
                  {t("hr:documentsPage.expiredDocuments")}
                </p>
                <p
                  className={`text-2xl font-bold ${stats.expired > 0 ? "text-red-600" : "text-[#222222]"}`}
                >
                  {stats.expired}
                </p>
              </div>
              <AlertTriangle
                className={`h-8 w-8 ${stats.expired > 0 ? "text-red-500" : "text-[#6B6B6B]"}`}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents by Type */}
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t("hr:documentsPage.byType")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {typeStats.map((item) => (
              <div
                key={item.type}
                className="flex items-center gap-2 px-3 py-2 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]"
              >
                <FileText className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
                <span className="text-sm font-medium">
                  {t(`hr:docType.${item.type}`) ||
                    DOCUMENT_TYPE_LABELS[item.type] ||
                    item.type}
                </span>
                <Badge variant="secondary">{item.count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg">
              {t("hr:documentsPage.documentsList")}
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B6B6B]" />
                <Input
                  placeholder={t("hr:documentsPage.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-[250px]"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
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
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
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
                  <SelectItem value="expired">
                    {t("hr:documentsPage.expired")}
                  </SelectItem>
                  <SelectItem value="archived">
                    {t("hr:documentsPage.archived")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-[#E6E6E4] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAF8]">
                  <TableHead>{t("hr:documentsPage.employee")}</TableHead>
                  <TableHead>{t("hr:documentsPage.documentType")}</TableHead>
                  <TableHead>{t("hr:documentsPage.uploadedAt")}</TableHead>
                  <TableHead>{t("hr:documentsPage.expiryDate")}</TableHead>
                  <TableHead>{t("hr:documentsPage.status")}</TableHead>
                  <TableHead className="text-right">
                    {t("hr:actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-[#6B6B6B]"
                    >
                      {t("hr:documentsPage.noDocumentsFound")}
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
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {t(`hr:docType.${doc.document_type}`) ||
                          DOCUMENT_TYPE_LABELS[doc.document_type] ||
                          doc.document_type}
                      </TableCell>
                      <TableCell>
                        {doc.uploaded_at
                          ? new Date(doc.uploaded_at).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
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
                          className="text-[hsl(var(--jw-primary-green))] hover:text-[hsl(var(--jw-hover-green))]"
                        >
                          <Eye className="h-4 w-4 mr-1" />
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
            <p className="text-sm text-[#6B6B6B] mt-2 text-center">
              {t("hr:showingResults", {
                count: 50,
                total: filteredDocuments.length,
              })}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
