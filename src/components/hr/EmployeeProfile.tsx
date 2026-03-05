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
  Banknote,
  Building,
  FileText,
  Upload,
  AlertCircle,
  Download,
  Eye,
  History,
  ChevronDown,
  ChevronUp,
  Archive,
  CreditCard,
  FileCheck,
  Plane,
  Award,
  UserX,
  Target,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { EmployeeDocumentUpload } from "./EmployeeDocumentUpload";
import { CustomKPIList } from "./kpis/CustomKPIList";

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
  defaultTab?: "details" | "documents" | "custom-kpis";
}

export function EmployeeProfile({ employee, documents, archivedDocuments = [], onRefresh, defaultTab = "details" }: EmployeeProfileProps) {
  const { t } = useTranslation(["hr"]);
  const router = useRouter();
  // Show upload form automatically if coming from create flow (defaultTab=documents)
  const [showUpload, setShowUpload] = useState(defaultTab === "documents");
  const [showHistory, setShowHistory] = useState(false);

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
      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="bg-white border border-[#E6E6E4] p-1 h-auto rounded-lg shadow-sm">
          <TabsTrigger 
            value="details"
            className="px-6 py-2.5 text-sm font-medium rounded-md data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
          >
            {t("hr:details")}
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="px-6 py-2.5 text-sm font-medium rounded-md data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
          >
            {t("hr:documents")}
            {documents.some((d) => d.expiry_date && differenceInDays(new Date(d.expiry_date), new Date()) <= 30) && (
              <span className="ltr:ml-2 rtl:mr-2 h-5 w-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center">!</span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="custom-kpis"
            className="px-6 py-2.5 text-sm font-medium rounded-md data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
          >
            {t("hr:customKpis")}
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Info */}
            <Card className="border-[#E6E6E4] shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <div className="h-8 w-8 rounded-lg bg-[hsl(var(--jw-primary-green))]/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
                  </div>
                  {t("hr:personalInfo")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-2">
                <InfoRow icon={Mail} label={t("hr:email")} value={employee.email} />
                <div className="border-t border-[#E6E6E4]/50" />
                <InfoRow icon={Phone} label={t("hr:phone")} value={employee.phone} />
                <div className="border-t border-[#E6E6E4]/50" />
                <InfoRow
                  icon={Calendar}
                  label={t("hr:dateOfBirth")}
                  value={employee.date_of_birth ? format(new Date(employee.date_of_birth), "MMM d, yyyy") : null}
                />
              </CardContent>
            </Card>

            {/* Job Info */}
            <Card className="border-[#E6E6E4] shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <div className="h-8 w-8 rounded-lg bg-[hsl(var(--jw-primary-green))]/10 flex items-center justify-center">
                    <Briefcase className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
                  </div>
                  {t("hr:jobInfo")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-2">
                <InfoRow icon={Briefcase} label={t("hr:jobRole")} value={employee.job_role?.name} />
                <div className="border-t border-[#E6E6E4]/50" />
                <InfoRow icon={Building} label={t("hr:department")} value={employee.department?.name} />
                <div className="border-t border-[#E6E6E4]/50" />
                <InfoRow
                  icon={Calendar}
                  label={t("hr:startDate")}
                  value={format(new Date(employee.start_date), "MMM d, yyyy")}
                />
                <div className="border-t border-[#E6E6E4]/50" />
                <InfoRow
                  icon={Banknote}
                  label={t("hr:salary")}
                  value={employee.salary ? `AED ${employee.salary.toLocaleString()}` : null}
                />
              </CardContent>
            </Card>

            {/* Document Expiry Status */}
            <Card className="border-[#E6E6E4] md:col-span-2 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <div className="h-8 w-8 rounded-lg bg-[hsl(var(--jw-primary-green))]/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
                  </div>
                  {t("hr:documentExpiryStatus")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {(["passport", "employment_visa", "emirates_id", "employment_contract", "certification"] as const).map((docType) => {
                    const doc = documents.find((d) => d.document_type === docType);
                    const hasExpiry = doc?.expiry_date;
                    const daysUntil = hasExpiry ? differenceInDays(new Date(doc.expiry_date!), new Date()) : null;

                    // Document type icons
                    const docIcons: Record<string, any> = {
                      passport: Plane,
                      employment_visa: FileCheck,
                      emirates_id: CreditCard,
                      employment_contract: FileText,
                      certification: Award,
                    };
                    const DocIcon = docIcons[docType] || FileText;

                    let statusColor = "bg-[#FAFAF8] border-[#E6E6E4]";
                    let textColor = "text-[#9B9B9B]";
                    let iconBgColor = "bg-gray-100";
                    let iconColor = "text-gray-400";
                    let statusText = t("hr:notUploaded");

                    if (doc) {
                      if (!hasExpiry) {
                        statusColor = "bg-blue-50/50 border-blue-200";
                        textColor = "text-blue-600";
                        iconBgColor = "bg-blue-100";
                        iconColor = "text-blue-500";
                        statusText = t("hr:noExpiry");
                      } else if (daysUntil !== null) {
                        if (daysUntil < 0) {
                          statusColor = "bg-red-50 border-red-300";
                          textColor = "text-red-600";
                          iconBgColor = "bg-red-100";
                          iconColor = "text-red-500";
                          statusText = t("hr:expired");
                        } else if (daysUntil <= 7) {
                          statusColor = "bg-red-50/70 border-red-200";
                          textColor = "text-red-600";
                          iconBgColor = "bg-red-100";
                          iconColor = "text-red-500";
                          statusText = `${daysUntil}d`;
                        } else if (daysUntil <= 14) {
                          statusColor = "bg-orange-50/70 border-orange-200";
                          textColor = "text-orange-600";
                          iconBgColor = "bg-orange-100";
                          iconColor = "text-orange-500";
                          statusText = `${daysUntil}d`;
                        } else if (daysUntil <= 30) {
                          statusColor = "bg-yellow-50/70 border-yellow-200";
                          textColor = "text-yellow-600";
                          iconBgColor = "bg-yellow-100";
                          iconColor = "text-yellow-500";
                          statusText = `${daysUntil}d`;
                        } else {
                          statusColor = "bg-green-50/50 border-green-200";
                          textColor = "text-green-600";
                          iconBgColor = "bg-green-100";
                          iconColor = "text-green-500";
                          statusText = format(new Date(doc.expiry_date!), "MMM d, yyyy");
                        }
                      }
                    }

                    return (
                      <div
                        key={docType}
                        className={`p-4 rounded-xl border-2 ${statusColor} min-h-[100px] flex flex-col transition-all hover:shadow-sm`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`h-7 w-7 rounded-lg ${iconBgColor} flex items-center justify-center`}>
                            <DocIcon className={`h-3.5 w-3.5 ${iconColor}`} />
                          </div>
                        </div>
                        <p className="text-xs text-[#777777] mb-1 font-medium">{t(`hr:docType.${docType}`)}</p>
                        <p className={`font-semibold text-sm ${textColor}`}>
                          {doc && hasExpiry ? format(new Date(doc.expiry_date!), "MMM d, yyyy") : statusText}
                        </p>
                        {doc && hasExpiry && daysUntil !== null && daysUntil >= 0 && daysUntil <= 30 && (
                          <p className={`text-xs ${textColor} mt-1 opacity-80`}>
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
                  <CardTitle className="text-xl font-semibold text-red-600 flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
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
        <TabsContent value="documents" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Document List */}
            <Card className="border-[#E6E6E4] shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <div className="h-8 w-8 rounded-lg bg-[hsl(var(--jw-primary-green))]/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
                  </div>
                  {t("hr:uploadedDocuments")}
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => setShowUpload(!showUpload)}
                  className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
                >
                  <Upload className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                  {t("hr:upload")}
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                {documents.length === 0 ? (
                  <div className="text-center py-12 text-[#6B6B6B]">
                    <div className="h-16 w-16 rounded-full bg-[#F8F6EC] flex items-center justify-center mx-auto mb-3">
                      <FileText className="h-8 w-8 text-[#C6A03B]" />
                    </div>
                    <p className="font-medium">{t("hr:noDocuments")}</p>
                    <p className="text-sm text-[#9B9B9B] mt-1">{t("hr:uploadDocumentsToGetStarted", "Upload documents to get started")}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-[#FAFAF8] rounded-xl border border-[#E6E6E4] hover:border-[hsl(var(--jw-gold-accent))]/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-white border border-[#E6E6E4] flex items-center justify-center">
                            <FileText className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                          </div>
                          <div>
                            <p className="font-medium text-[#222222]">
                              {t(`hr:docType.${doc.document_type}`)}
                            </p>
                            <p className="text-xs text-[#777777]">
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
                            className="text-[#777777] hover:text-[#0C5536] hover:bg-[#F8F6EC]"
                            title={t("hr:viewDocument")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            className="text-[#777777] hover:text-[#0C5536] hover:bg-[#F8F6EC]"
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
              <Card className="border-[#E6E6E4] shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                    <div className="h-8 w-8 rounded-lg bg-[hsl(var(--jw-primary-green))]/10 flex items-center justify-center">
                      <Upload className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
                    </div>
                    {t("hr:uploadNewDocument")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
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
            <Card className="border-[#E6E6E4] mt-6 shadow-sm">
              <CardHeader
                className="cursor-pointer hover:bg-[#FAFAF8] transition-colors rounded-t-lg"
                onClick={() => setShowHistory(!showHistory)}
              >
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
                      <History className="h-4 w-4 text-[#777777]" />
                    </div>
                    {t("hr:documentHistory")}
                    <Badge variant="outline" className="ml-2 text-[#777777] bg-gray-50">
                      {archivedDocuments.length}
                    </Badge>
                  </span>
                  {showHistory ? (
                    <ChevronUp className="h-5 w-5 text-[#777777]" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-[#777777]" />
                  )}
                </CardTitle>
              </CardHeader>
              {showHistory && (
                <CardContent className="pt-0">
                  <p className="text-sm text-[#777777] mb-4">
                    {t("hr:documentHistoryDescription")}
                  </p>
                  <div className="space-y-3">
                    {archivedDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Archive className="h-5 w-5 text-[#9B9B9B]" />
                          </div>
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
                          <Badge variant="outline" className="text-[#9B9B9B] border-gray-300 bg-gray-50">
                            {t("hr:archived")}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            className="text-[#9B9B9B] hover:text-[#777777] hover:bg-gray-100"
                            title={t("hr:viewDocument")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            className="text-[#9B9B9B] hover:text-[#777777] hover:bg-gray-100"
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

        {/* Custom KPIs Tab */}
        <TabsContent value="custom-kpis" className="mt-6">
          <Card className="border-[#E6E6E4] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold text-[#0C5536] flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Target className="h-4 w-4 text-purple-600" />
                </div>
                {t("hr:individualGoals")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <CustomKPIList employeeId={employee.id} employeeName={employee.full_name} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper component for info rows with better visual hierarchy
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
    <div className="flex items-start gap-3 py-2.5">
      <div className="h-9 w-9 rounded-lg bg-[#F8F6EC] flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-xs text-[#777777] mb-0.5">{label}</p>
        <p className="text-[#222222] font-medium truncate">{value || "-"}</p>
      </div>
    </div>
  );
}
