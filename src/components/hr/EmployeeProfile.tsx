"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import {
  User,
  Briefcase,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Building,
  Edit,
  UserX,
  FileText,
  Upload,
  AlertCircle,
  Download,
  Eye,
  ClipboardList,
  Target,
  History,
  ChevronDown,
  ChevronUp,
  Archive,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { EmployeeDocumentUpload } from "./EmployeeDocumentUpload";
import { DeactivateModal } from "./DeactivateModal";

interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  job_role: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  start_date: string;
  salary: number | null;
  employment_status: string;
  termination_reason: string | null;
  last_working_day: string | null;
  created_at: string;
}

interface Document {
  id: string;
  document_type: string;
  document_name: string;
  document_path: string;
  expiry_date: string | null;
  uploaded_at: string;
  is_active?: boolean;
  archived_at?: string | null;
}

interface EmployeeProfileProps {
  employee: Employee;
  documents: Document[];
  archivedDocuments?: Document[];
  onRefresh: () => void;
  defaultTab?: "details" | "documents";
}

export function EmployeeProfile({ employee, documents, archivedDocuments = [], onRefresh, defaultTab = "details" }: EmployeeProfileProps) {
  const { t } = useTranslation(["hr"]);
  const router = useRouter();
  const [showDeactivate, setShowDeactivate] = useState(false);
  // Show upload form automatically if coming from create flow (defaultTab=documents)
  const [showUpload, setShowUpload] = useState(defaultTab === "documents");
  const [showHistory, setShowHistory] = useState(false);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-[#E6F7F1] text-[#0C5536] border-[#0C5536]/20",
      inactive: "bg-gray-100 text-gray-600 border-gray-300",
      on_leave: "bg-[#FFF9E6] text-[#C6A03B] border-[#C6A03B]/20",
      terminated: "bg-red-50 text-red-600 border-red-200",
    };

    return (
      <Badge variant="outline" className={`${styles[status] || styles.inactive} text-sm`}>
        {t(`hr:status.${status}`)}
      </Badge>
    );
  };

  const getDocumentExpiryBadge = (expiryDate: string | null) => {
    if (!expiryDate) return null;

    const daysUntil = differenceInDays(new Date(expiryDate), new Date());

    if (daysUntil < 0) {
      return <Badge className="bg-red-600 text-white">{t("hr:expired")}</Badge>;
    }
    if (daysUntil <= 7) {
      return <Badge className="bg-red-500 text-white">{daysUntil}d</Badge>;
    }
    if (daysUntil <= 14) {
      return <Badge className="bg-orange-500 text-white">{daysUntil}d</Badge>;
    }
    if (daysUntil <= 30) {
      return <Badge className="bg-yellow-500 text-white">{daysUntil}d</Badge>;
    }
    if (daysUntil <= 90) {
      return <Badge className="bg-blue-500 text-white">{daysUntil}d</Badge>;
    }
    return null;
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from("wills")
        .createSignedUrl(doc.document_path, 60);

      if (error) throw error;

      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-[hsl(var(--jw-primary-green))] flex items-center justify-center text-white text-2xl font-bold">
            {employee.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#222222]">{employee.full_name}</h1>
            <p className="text-[#6B6B6B]">{employee.job_role?.name || t("hr:noJobRole")}</p>
            {getStatusBadge(employee.employment_status)}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/hr/attendance/employee/${employee.id}`)}
            className="border-[hsl(var(--jw-primary-green))] text-[hsl(var(--jw-primary-green))]"
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            {t("hr:viewAttendance")}
          </Button>
          {employee.job_role && (
            <Button
              variant="outline"
              onClick={() => router.push(`/admin/hr/kpis/evaluations/${employee.id}`)}
              className="border-[hsl(var(--jw-gold-accent))] text-[hsl(var(--jw-gold-accent))]"
            >
              <Target className="h-4 w-4 mr-2" />
              {t("hr:viewKPIs")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/hr/employees/${employee.id}/edit`)}
            className="border-[hsl(var(--jw-primary-green))] text-[hsl(var(--jw-primary-green))]"
          >
            <Edit className="h-4 w-4 mr-2" />
            {t("hr:edit")}
          </Button>
          {employee.employment_status === "active" && (
            <Button
              variant="outline"
              onClick={() => setShowDeactivate(true)}
              className="border-red-500 text-red-500 hover:bg-red-50"
            >
              <UserX className="h-4 w-4 mr-2" />
              {t("hr:deactivate")}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="bg-[#FAFAF8] border border-[#E6E6E4]">
          <TabsTrigger value="details">{t("hr:details")}</TabsTrigger>
          <TabsTrigger value="documents">
            {t("hr:documents")}
            {documents.some((d) => d.expiry_date && differenceInDays(new Date(d.expiry_date), new Date()) <= 30) && (
              <AlertCircle className="h-4 w-4 ml-1 text-orange-500" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Info */}
            <Card className="border-[#E6E6E4]">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                  {t("hr:personalInfo")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow icon={Mail} label={t("hr:email")} value={employee.email} />
                <InfoRow icon={Phone} label={t("hr:phone")} value={employee.phone} />
                <InfoRow
                  icon={Calendar}
                  label={t("hr:dateOfBirth")}
                  value={employee.date_of_birth ? format(new Date(employee.date_of_birth), "MMM d, yyyy") : null}
                />
              </CardContent>
            </Card>

            {/* Job Info */}
            <Card className="border-[#E6E6E4]">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                  {t("hr:jobInfo")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow icon={Briefcase} label={t("hr:jobRole")} value={employee.job_role?.name} />
                <InfoRow icon={Building} label={t("hr:department")} value={employee.department?.name} />
                <InfoRow
                  icon={Calendar}
                  label={t("hr:startDate")}
                  value={format(new Date(employee.start_date), "MMM d, yyyy")}
                />
                <InfoRow
                  icon={DollarSign}
                  label={t("hr:salary")}
                  value={employee.salary ? `AED ${employee.salary.toLocaleString()}` : null}
                />
              </CardContent>
            </Card>

            {/* Document Expiry Status */}
            <Card className="border-[#E6E6E4] md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                  {t("hr:documentExpiryStatus")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(["passport", "employment_visa", "emirates_id", "employment_contract"] as const).map((docType) => {
                    const doc = documents.find((d) => d.document_type === docType);
                    const hasExpiry = doc?.expiry_date;
                    const daysUntil = hasExpiry ? differenceInDays(new Date(doc.expiry_date!), new Date()) : null;

                    let statusColor = "bg-gray-100 border-gray-200";
                    let textColor = "text-gray-500";
                    let statusText = t("hr:notUploaded");

                    if (doc) {
                      if (!hasExpiry) {
                        statusColor = "bg-blue-50 border-blue-200";
                        textColor = "text-blue-600";
                        statusText = t("hr:noExpiry");
                      } else if (daysUntil !== null) {
                        if (daysUntil < 0) {
                          statusColor = "bg-red-100 border-red-300";
                          textColor = "text-red-600";
                          statusText = t("hr:expired");
                        } else if (daysUntil <= 7) {
                          statusColor = "bg-red-50 border-red-200";
                          textColor = "text-red-600";
                          statusText = `${daysUntil}d`;
                        } else if (daysUntil <= 14) {
                          statusColor = "bg-orange-50 border-orange-200";
                          textColor = "text-orange-600";
                          statusText = `${daysUntil}d`;
                        } else if (daysUntil <= 30) {
                          statusColor = "bg-yellow-50 border-yellow-200";
                          textColor = "text-yellow-600";
                          statusText = `${daysUntil}d`;
                        } else {
                          statusColor = "bg-green-50 border-green-200";
                          textColor = "text-green-600";
                          statusText = format(new Date(doc.expiry_date!), "MMM d, yyyy");
                        }
                      }
                    }

                    return (
                      <div
                        key={docType}
                        className={`p-3 rounded-lg border ${statusColor}`}
                      >
                        <p className="text-xs text-[#6B6B6B] mb-1">{t(`hr:docType.${docType}`)}</p>
                        <p className={`font-medium ${textColor}`}>
                          {doc && hasExpiry ? format(new Date(doc.expiry_date!), "MMM d, yyyy") : statusText}
                        </p>
                        {doc && hasExpiry && daysUntil !== null && daysUntil >= 0 && daysUntil <= 30 && (
                          <p className={`text-xs ${textColor} mt-1`}>
                            {daysUntil === 0 ? t("hr:expiresToday") : `${daysUntil} ${t("hr:daysLeft")}`}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Termination Info (if terminated) */}
            {employee.employment_status === "terminated" && (
              <Card className="border-red-200 bg-red-50 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-red-600">
                    <UserX className="h-5 w-5" />
                    {t("hr:terminationInfo")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow
                    icon={Calendar}
                    label={t("hr:lastWorkingDay")}
                    value={employee.last_working_day ? format(new Date(employee.last_working_day), "MMM d, yyyy") : null}
                  />
                  <InfoRow
                    icon={FileText}
                    label={t("hr:terminationReason")}
                    value={employee.termination_reason ? t(`hr:reason.${employee.termination_reason}`) : null}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Document List */}
            <Card className="border-[#E6E6E4]">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                  {t("hr:uploadedDocuments")}
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => setShowUpload(!showUpload)}
                  className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {t("hr:upload")}
                </Button>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-[#6B6B6B]">
                    <FileText className="h-12 w-12 mx-auto mb-2 text-[#E6E6E4]" />
                    <p>{t("hr:noDocuments")}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-[#6B6B6B]" />
                          <div>
                            <p className="font-medium text-[#222222]">
                              {t(`hr:docType.${doc.document_type}`)}
                            </p>
                            <p className="text-xs text-[#6B6B6B]">
                              {doc.expiry_date
                                ? `${t("hr:expires")}: ${format(new Date(doc.expiry_date), "MMM d, yyyy")}`
                                : t("hr:noExpiry")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getDocumentExpiryBadge(doc.expiry_date)}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            className="text-[#6B6B6B] hover:text-[#0C5536] hover:bg-transparent"
                            title={t("hr:viewDocument")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            className="text-[#6B6B6B] hover:text-[#0C5536] hover:bg-transparent"
                            title={t("hr:downloadDocument")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upload Form */}
            {showUpload && (
              <Card className="border-[#E6E6E4]">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Upload className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                    {t("hr:uploadNewDocument")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <EmployeeDocumentUpload
                    employeeId={employee.id}
                    existingDocuments={documents}
                    onSuccess={() => {
                      setShowUpload(false);
                      onRefresh();
                    }}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Document History Section */}
          {archivedDocuments.length > 0 && (
            <Card className="border-[#E6E6E4] mt-6">
              <CardHeader
                className="cursor-pointer hover:bg-[#FAFAF8] transition-colors"
                onClick={() => setShowHistory(!showHistory)}
              >
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <History className="h-5 w-5 text-[#6B6B6B]" />
                    {t("hr:documentHistory")}
                    <Badge variant="outline" className="ml-2 text-[#6B6B6B]">
                      {archivedDocuments.length}
                    </Badge>
                  </span>
                  {showHistory ? (
                    <ChevronUp className="h-5 w-5 text-[#6B6B6B]" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-[#6B6B6B]" />
                  )}
                </CardTitle>
              </CardHeader>
              {showHistory && (
                <CardContent>
                  <p className="text-sm text-[#6B6B6B] mb-4">
                    {t("hr:documentHistoryDescription")}
                  </p>
                  <div className="space-y-3">
                    {archivedDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 opacity-75"
                      >
                        <div className="flex items-center gap-3">
                          <Archive className="h-5 w-5 text-[#9B9B9B]" />
                          <div>
                            <p className="font-medium text-[#555555]">
                              {t(`hr:docType.${doc.document_type}`)}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-[#9B9B9B]">
                              <span>
                                {doc.expiry_date
                                  ? `${t("hr:expired")}: ${format(new Date(doc.expiry_date), "MMM d, yyyy")}`
                                  : t("hr:noExpiry")}
                              </span>
                              <span>•</span>
                              <span>
                                {t("hr:archivedOn")}: {doc.archived_at ? format(new Date(doc.archived_at), "MMM d, yyyy") : format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[#9B9B9B] border-gray-300">
                            {t("hr:archived")}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            className="text-[#9B9B9B] hover:text-[#6B6B6B] hover:bg-transparent"
                            title={t("hr:viewDocument")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            className="text-[#9B9B9B] hover:text-[#6B6B6B] hover:bg-transparent"
                            title={t("hr:downloadDocument")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Deactivate Modal */}
      <DeactivateModal
        open={showDeactivate}
        onOpenChange={setShowDeactivate}
        employee={employee}
        onSuccess={onRefresh}
      />
    </div>
  );
}

// Helper component for info rows
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-[#6B6B6B] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#6B6B6B]">{label}</p>
        <p className="text-[#222222] truncate">{value || "-"}</p>
      </div>
    </div>
  );
}
