"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Edit, Loader2, FileText, AlertCircle, Upload, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AddEmployeeForm, EmployeeDocumentUpload } from "@/components/hr";
import { EmployeeFormData } from "@/lib/hr-validation";
import { format, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface Document {
  id: string;
  document_type: string;
  document_name: string;
  document_path: string;
  expiry_date: string | null;
  uploaded_at: string;
}

export default function EditEmployeePage() {
  const { t } = useTranslation(["hr"]);
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<(EmployeeFormData & { id: string; full_name: string }) | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);

  const employeeId = params.id as string;

  useEffect(() => {
    if (employeeId) {
      fetchData();
    }
  }, [employeeId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empResult, docsResult] = await Promise.all([
        supabase.from("employees").select("*").eq("id", employeeId).single(),
        supabase
          .from("employee_documents")
          .select("id, document_type, document_name, document_path, expiry_date, uploaded_at")
          .eq("employee_id", employeeId)
          .eq("is_active", true) // Only fetch active documents
          .order("document_type"),
      ]);

      if (empResult.error) throw empResult.error;

      if (empResult.data) {
        setEmployee({
          id: empResult.data.id,
          full_name: empResult.data.full_name,
          email: empResult.data.email || "",
          phone: empResult.data.phone || "",
          date_of_birth: empResult.data.date_of_birth || "",
          job_role_id: empResult.data.job_role_id || "",
          department_id: empResult.data.department_id || "",
          start_date: empResult.data.start_date,
          salary: empResult.data.salary?.toString() || "",
          employment_status: empResult.data.employment_status || "active",
        });
      }

      if (docsResult.data) {
        setDocuments(docsResult.data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
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

  const hasExpiringDocs = documents.some(
    (d) => d.expiry_date && differenceInDays(new Date(d.expiry_date), new Date()) <= 30
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 text-center">
        <p className="text-[#6B6B6B]">{t("hr:employeeNotFound")}</p>
        <Button
          variant="outline"
          onClick={() => router.push("/admin/hr/employees")}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("hr:backToEmployees")}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-4 text-[#6B6B6B] hover:text-[#222222] hover:bg-transparent"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t("hr:back")}
      </Button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-12 w-12 rounded-full bg-[hsl(var(--jw-primary-green))] flex items-center justify-center text-white text-xl font-bold">
          {employee.full_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#222222]">{employee.full_name}</h1>
          <p className="text-sm text-[#6B6B6B]">{t("hr:editEmployee")}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="bg-[#FAFAF8] border border-[#E6E6E4]">
          <TabsTrigger value="details">{t("hr:details")}</TabsTrigger>
          <TabsTrigger value="documents">
            {t("hr:documents")}
            {hasExpiringDocs && (
              <AlertCircle className="h-4 w-4 ml-1 text-orange-500" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-4">
          <Card className="border-[#E6E6E4]">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Edit className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                {t("hr:personalInfo")} & {t("hr:jobInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AddEmployeeForm
                editData={employee}
                onSuccess={() => router.push(`/admin/hr/employees/${employeeId}`)}
                onCancel={() => router.back()}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Document List */}
            <Card className="border-[#E6E6E4]">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                  {t("hr:uploadedDocuments")}
                </CardTitle>
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

            {/* Upload Form - Always visible */}
            <Card className="border-[#E6E6E4]">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                  {t("hr:uploadNewDocument")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EmployeeDocumentUpload
                  employeeId={employeeId}
                  existingDocuments={documents}
                  onSuccess={fetchData}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
