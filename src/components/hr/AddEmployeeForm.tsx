"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Loader2, User, Briefcase, CalendarIcon, DollarSign, FileText, Upload, X, Sparkles, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { employeeSchema, EmployeeFormData, employmentStatusOptions } from "@/lib/hr-validation";
import { JobRoleSelector } from "@/components/hr/kpis/JobRoleSelector";
import { extractDocumentWithAI, getExtractedDataForStorage, DocumentType } from "@/lib/ai-document-extraction";
import { cn } from "@/lib/utils";

interface Department {
  id: string;
  name: string;
}

interface DocumentUpload {
  file: File | null;
  preview: string | null;
  expiryDate: Date | undefined;
  extracting: boolean;
  extracted: boolean;
  extractedData: Record<string, unknown> | null;
}

const MANDATORY_DOCS: DocumentType[] = ["passport", "employment_visa", "emirates_id"];

interface AddEmployeeFormProps {
  onSuccess?: (employeeId?: string) => void;
  onCancel?: () => void;
  editData?: EmployeeFormData & { id: string };
}

export function AddEmployeeForm({ onSuccess, onCancel, editData }: AddEmployeeFormProps) {
  const { toast } = useToast();
  const { t } = useTranslation(["hr", "toast"]);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [dobDate, setDobDate] = useState<Date | undefined>(
    editData?.date_of_birth ? new Date(editData.date_of_birth) : undefined
  );
  const [startDate, setStartDate] = useState<Date | undefined>(
    editData?.start_date ? new Date(editData.start_date) : undefined
  );

  // Document uploads state
  const [documents, setDocuments] = useState<Record<DocumentType, DocumentUpload>>({
    passport: { file: null, preview: null, expiryDate: undefined, extracting: false, extracted: false, extractedData: null },
    employment_visa: { file: null, preview: null, expiryDate: undefined, extracting: false, extracted: false, extractedData: null },
    emirates_id: { file: null, preview: null, expiryDate: undefined, extracting: false, extracted: false, extractedData: null },
    employment_contract: { file: null, preview: null, expiryDate: undefined, extracting: false, extracted: false, extractedData: null },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: editData || {
      full_name: "",
      email: "",
      phone: "",
      date_of_birth: "",
      job_role_id: "",
      department_id: "",
      start_date: "",
      salary: "",
      employment_status: "active",
    },
  });

  // Fetch departments for dropdown
  useEffect(() => {
    const fetchDepartments = async () => {
      const { data } = await supabase.from("departments").select("id, name").order("name");
      if (data) setDepartments(data);
    };
    fetchDepartments();
  }, []);

  // Sync date picker values with form
  useEffect(() => {
    if (dobDate) {
      setValue("date_of_birth", format(dobDate, "yyyy-MM-dd"));
    }
  }, [dobDate, setValue]);

  useEffect(() => {
    if (startDate) {
      setValue("start_date", format(startDate, "yyyy-MM-dd"));
    }
  }, [startDate, setValue]);

  // Handle file drop for a specific document type
  const handleFileDrop = async (docType: DocumentType, file: File) => {
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setDocuments(prev => ({
        ...prev,
        [docType]: {
          ...prev[docType],
          file,
          preview: reader.result as string,
        }
      }));
    };
    reader.readAsDataURL(file);

    // Extract data with AI
    setDocuments(prev => ({
      ...prev,
      [docType]: { ...prev[docType], extracting: true, extracted: false }
    }));

    try {
      const result = await extractDocumentWithAI(file, docType);

      if (result.extractionMethod === "ai" && result.expiryDate) {
        const parsedDate = new Date(result.expiryDate);
        if (!isNaN(parsedDate.getTime())) {
          setDocuments(prev => ({
            ...prev,
            [docType]: {
              ...prev[docType],
              expiryDate: parsedDate,
              extracted: true,
              extractedData: getExtractedDataForStorage(result),
              extracting: false,
            }
          }));
          return;
        }
      }

      setDocuments(prev => ({
        ...prev,
        [docType]: { ...prev[docType], extracting: false }
      }));
    } catch (error) {
      console.error("Extraction error:", error);
      setDocuments(prev => ({
        ...prev,
        [docType]: { ...prev[docType], extracting: false }
      }));
    }
  };

  const clearDocument = (docType: DocumentType) => {
    setDocuments(prev => ({
      ...prev,
      [docType]: { file: null, preview: null, expiryDate: undefined, extracting: false, extracted: false, extractedData: null }
    }));
  };

  const setDocumentExpiry = (docType: DocumentType, date: Date | undefined) => {
    setDocuments(prev => ({
      ...prev,
      [docType]: { ...prev[docType], expiryDate: date, extracted: false }
    }));
  };

  // Check if all mandatory documents are uploaded with expiry dates
  const areMandatoryDocsComplete = () => {
    return MANDATORY_DOCS.every(docType =>
      documents[docType].file && documents[docType].expiryDate
    );
  };

  const onSubmit = async (data: EmployeeFormData) => {
    // For new employees, check mandatory documents
    if (!editData) {
      if (!areMandatoryDocsComplete()) {
        toast({
          title: t("toast:validationError"),
          description: t("hr:mandatoryDocsRequired"),
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const employeeData = {
        full_name: data.full_name,
        email: data.email || null,
        phone: data.phone || null,
        date_of_birth: data.date_of_birth || null,
        job_role_id: data.job_role_id || null,
        department_id: data.department_id || null,
        start_date: data.start_date,
        salary: data.salary ? parseFloat(data.salary) : null,
        employment_status: data.employment_status,
        updated_at: new Date().toISOString(),
      };

      let employeeId: string;

      if (editData?.id) {
        // Update existing employee
        const { error } = await supabase
          .from("employees")
          .update(employeeData)
          .eq("id", editData.id);

        if (error) throw error;
        employeeId = editData.id;

        toast({
          title: t("toast:success"),
          description: t("hr:employeeUpdated"),
          className: "bg-[hsl(var(--jw-primary-green))] text-white",
        });
      } else {
        // Create new employee
        const { data: newEmployee, error } = await supabase
          .from("employees")
          .insert({
            ...employeeData,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (error) throw error;
        employeeId = newEmployee.id;

        // Upload documents for new employee
        for (const docType of [...MANDATORY_DOCS, "employment_contract" as DocumentType]) {
          const doc = documents[docType];
          if (doc.file) {
            const fileExt = doc.file.name.split(".").pop();
            const fileName = `${employeeId}/${docType}-${Date.now()}.${fileExt}`;
            const filePath = `employee-documents/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from("wills")
              .upload(filePath, doc.file, { cacheControl: "3600", upsert: true });

            if (uploadError) {
              console.error(`Error uploading ${docType}:`, uploadError);
              continue;
            }

            await supabase.from("employee_documents").insert({
              employee_id: employeeId,
              document_type: docType,
              document_path: filePath,
              document_name: doc.file.name,
              document_size: doc.file.size,
              document_mime: doc.file.type,
              expiry_date: doc.expiryDate ? format(doc.expiryDate, "yyyy-MM-dd") : null,
              extracted_data: doc.extractedData || {},
              uploaded_by: user.id,
              uploaded_at: new Date().toISOString(),
            });
          }
        }

        toast({
          title: t("toast:success"),
          description: t("hr:employeeCreated"),
          className: "bg-[hsl(var(--jw-primary-green))] text-white",
        });
      }

      onSuccess?.(employeeId);
    } catch (error: any) {
      console.error("Error saving employee:", error);
      toast({
        title: t("toast:error"),
        description: error.message || t("hr:errorSavingEmployee"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Document upload component
  const DocumentUploadField = ({ docType, mandatory = false }: { docType: DocumentType; mandatory?: boolean }) => {
    const doc = documents[docType];

    const onDrop = useCallback((acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) handleFileDrop(docType, file);
    }, [docType]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      accept: { "image/*": [".png", ".jpg", ".jpeg"], "application/pdf": [".pdf"] },
      maxFiles: 1,
      maxSize: 10 * 1024 * 1024,
      disabled: loading,
    });

    return (
      <div className="space-y-2">
        <Label className="text-[#555555] flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {t(`hr:docType.${docType}`)}
          {mandatory && <span className="text-red-500">*</span>}
        </Label>

        {!doc.file ? (
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
              isDragActive
                ? "border-[hsl(var(--jw-primary-green))] bg-[#E6F7F1]"
                : "border-[#E6E6E4] hover:border-[hsl(var(--jw-gold-accent))]",
              mandatory && !doc.file && "border-red-200 bg-red-50/30"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-6 w-6 mx-auto mb-2 text-[#6B6B6B]" />
            <p className="text-sm text-[#6B6B6B]">{t("hr:dragDropOrClick")}</p>
          </div>
        ) : (
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                {doc.preview && doc.file.type.startsWith("image/") ? (
                  <img src={doc.preview} alt="Preview" className="w-12 h-12 rounded object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded bg-[#FAFAF8] flex items-center justify-center">
                    <FileText className="h-6 w-6 text-[#6B6B6B]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file.name}</p>
                  {doc.extracting && (
                    <p className="text-xs text-[hsl(var(--jw-primary-green))] flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t("hr:extractingData")}
                    </p>
                  )}
                  {doc.extracted && (
                    <p className="text-xs text-[hsl(var(--jw-primary-green))] flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {t("hr:dataExtracted")}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => clearDocument(docType)}
                  disabled={loading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expiry Date */}
        {doc.file && (
          <div className="space-y-1">
            <Label className="text-xs text-[#555555] flex items-center gap-1">
              {t("hr:expiryDate")}
              {mandatory && <span className="text-red-500">*</span>}
              {doc.extracted && doc.expiryDate && (
                <span className="text-[hsl(var(--jw-primary-green))] flex items-center gap-1 ml-1">
                  <Sparkles className="h-3 w-3" />
                  {t("hr:aiExtracted")}
                </span>
              )}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  className={cn(
                    "w-full justify-start text-left font-normal text-sm h-9 border-[#E6E6E4]",
                    !doc.expiryDate && "text-muted-foreground",
                    mandatory && !doc.expiryDate && "border-red-300"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {doc.expiryDate ? format(doc.expiryDate, "PPP") : t("hr:selectDate")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={doc.expiryDate}
                  onSelect={(date) => setDocumentExpiry(docType, date)}
                  captionLayout="dropdown"
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Personal Information Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[#222222] flex items-center gap-2">
          <User className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
          {t("hr:personalInfo")}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="full_name" className="text-[#555555]">
              {t("hr:fullName")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="full_name"
              {...register("full_name")}
              placeholder={t("hr:enterFullName")}
              className="border-[#E6E6E4]"
              disabled={loading}
            />
            {errors.full_name && (
              <p className="text-[12px] text-[#C0392B]">{t(`hr:${errors.full_name.message}`)}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#555555]">
              {t("hr:email")}
            </Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder={t("hr:enterEmail")}
              className="border-[#E6E6E4]"
              disabled={loading}
            />
            {errors.email && (
              <p className="text-[12px] text-[#C0392B]">{t(`hr:${errors.email.message}`)}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-[#555555]">
              {t("hr:phone")}
            </Label>
            <Input
              id="phone"
              {...register("phone")}
              placeholder={t("hr:enterPhone")}
              className="border-[#E6E6E4]"
              disabled={loading}
            />
          </div>

          {/* Date of Birth */}
          <div className="space-y-2">
            <Label className="text-[#555555]">{t("hr:dateOfBirth")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  className={cn(
                    "w-full justify-start text-left font-normal border-[#E6E6E4]",
                    !dobDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dobDate ? format(dobDate, "PPP") : t("hr:selectDate")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dobDate}
                  onSelect={setDobDate}
                  disabled={(date) => date > new Date()}
                  captionLayout="dropdown"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Job Information Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[#222222] flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
          {t("hr:jobInfo")}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Department - Select first */}
          <div className="space-y-2">
            <Label className="text-[#555555]">{t("hr:department")}</Label>
            <Select
              value={watch("department_id") || ""}
              onValueChange={(value) => {
                setValue("department_id", value);
                // Reset job role when department changes
                setValue("job_role_id", "");
              }}
              disabled={loading}
            >
              <SelectTrigger className="border-[#E6E6E4]">
                <SelectValue placeholder={t("hr:selectDepartment")} />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Job Role - Filtered by department */}
          <div className="space-y-2">
            <Label className="text-[#555555]">
              {t("hr:jobRole")}
            </Label>
            <JobRoleSelector
              value={watch("job_role_id") || ""}
              onChange={(value) => setValue("job_role_id", value)}
              disabled={loading || !watch("department_id")}
              departmentId={watch("department_id") || undefined}
              showDepartment={false}
            />
            {!watch("department_id") && (
              <p className="text-xs text-[#6B6B6B]">{t("hr:selectDepartmentFirst")}</p>
            )}
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label className="text-[#555555]">
              {t("hr:startDate")} <span className="text-red-500">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  className={cn(
                    "w-full justify-start text-left font-normal border-[#E6E6E4]",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : t("hr:selectDate")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  captionLayout="dropdown"
                />
              </PopoverContent>
            </Popover>
            {errors.start_date && (
              <p className="text-[12px] text-[#C0392B]">{t(`hr:${errors.start_date.message}`)}</p>
            )}
          </div>

          {/* Salary */}
          <div className="space-y-2">
            <Label htmlFor="salary" className="text-[#555555] flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              {t("hr:salary")}
            </Label>
            <Input
              id="salary"
              type="number"
              step="0.01"
              {...register("salary")}
              placeholder={t("hr:enterSalary")}
              className="border-[#E6E6E4]"
              disabled={loading}
            />
          </div>

          {/* Employment Status */}
          <div className="space-y-2">
            <Label className="text-[#555555]">{t("hr:employmentStatus")}</Label>
            <Select
              value={watch("employment_status")}
              onValueChange={(value: any) => setValue("employment_status", value)}
              disabled={loading}
            >
              <SelectTrigger className="border-[#E6E6E4]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {employmentStatusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {t(`hr:status.${status.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Documents Section - Only for new employees */}
      {!editData && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[#222222] flex items-center gap-2">
            <FileText className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("hr:requiredDocuments")}
          </h3>

          {/* Info Note */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-700">{t("hr:mandatoryDocsNote")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DocumentUploadField docType="passport" mandatory />
            <DocumentUploadField docType="employment_visa" mandatory />
            <DocumentUploadField docType="emirates_id" mandatory />
          </div>

          {/* Optional Contract */}
          <div className="pt-2">
            <h4 className="text-sm font-medium text-[#555555] mb-3">{t("hr:optionalDocument")}</h4>
            <div className="max-w-sm">
              <DocumentUploadField docType="employment_contract" />
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 pt-4 border-t border-[#E6E6E4]">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="border-[#E6E6E4]"
          >
            {t("hr:cancel")}
          </Button>
        )}
        <Button
          type="submit"
          disabled={loading || (!editData && !areMandatoryDocsComplete())}
          className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("hr:saving")}
            </>
          ) : editData ? (
            t("hr:updateEmployee")
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              {t("hr:addEmployee")}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
