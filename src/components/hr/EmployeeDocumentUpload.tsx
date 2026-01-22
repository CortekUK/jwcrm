"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { format, parse } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Loader2, Upload, FileText, CalendarIcon, Sparkles, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractDocumentWithAI, getExtractedDataForStorage, DocumentType } from "@/lib/ai-document-extraction";
import { documentTypeOptions } from "@/lib/hr-validation";
import { cn } from "@/lib/utils";

interface EmployeeDocumentUploadProps {
  employeeId: string;
  onSuccess?: () => void;
  existingDocuments?: Array<{ document_type: string }>;
}

export function EmployeeDocumentUpload({
  employeeId,
  onSuccess,
  existingDocuments = [],
}: EmployeeDocumentUploadProps) {
  const { toast } = useToast();
  const { t } = useTranslation(["hr", "toast"]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType | "">("");
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);
  const [isExpiryExtracted, setIsExpiryExtracted] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<Record<string, unknown> | null>(null);

  // All document types available - allow re-upload for expired/updated documents
  const availableDocTypes = documentTypeOptions;

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setSelectedFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Auto-extract if document type is selected
      if (documentType) {
        await extractFromDocument(file, documentType);
      }
    },
    [documentType]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const extractFromDocument = async (file: File, docType: DocumentType) => {
    setExtracting(true);
    setExtractedData(null);
    setIsExpiryExtracted(false);

    try {
      const result = await extractDocumentWithAI(file, docType);

      if (result.extractionMethod === "ai") {
        setExtractedData(getExtractedDataForStorage(result));

        // Auto-fill expiry date if extracted
        if (result.expiryDate) {
          // Parse the date string (format: YYYY-MM-DD)
          const parsedDate = new Date(result.expiryDate);
          if (!isNaN(parsedDate.getTime())) {
            setExpiryDate(parsedDate);
            setIsExpiryExtracted(true);
          }
        }

        toast({
          title: t("hr:aiExtractionSuccess"),
          description: t("hr:dataExtractedFromDocument"),
          className: "bg-[hsl(var(--jw-primary-green))] text-white",
        });
      } else {
        toast({
          title: t("hr:aiExtractionFailed"),
          description: t("hr:pleaseEnterManually"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Extraction error:", error);
    } finally {
      setExtracting(false);
    }
  };

  const handleDocumentTypeChange = async (value: DocumentType) => {
    setDocumentType(value);

    // If file already selected, extract data
    if (selectedFile) {
      await extractFromDocument(selectedFile, value);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !documentType) {
      toast({
        title: t("toast:validationError"),
        description: t("hr:selectDocumentAndType"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file to storage
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${employeeId}/${documentType}-${Date.now()}.${fileExt}`;
      const filePath = `employee-documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("wills")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Deactivate any existing active document of the same type (preserve history)
      const { error: deactivateError } = await supabase
        .from("employee_documents")
        .update({
          is_active: false,
          archived_at: new Date().toISOString(),
        })
        .eq("employee_id", employeeId)
        .eq("document_type", documentType)
        .eq("is_active", true);

      if (deactivateError) {
        console.error("Error deactivating old document:", deactivateError);
        // Continue anyway - the insert will fail if there's a constraint violation
      }

      // Insert new document as active
      const { error: dbError } = await supabase.from("employee_documents").insert({
        employee_id: employeeId,
        document_type: documentType,
        document_path: filePath,
        document_name: selectedFile.name,
        document_size: selectedFile.size,
        document_mime: selectedFile.type,
        expiry_date: expiryDate ? format(expiryDate, "yyyy-MM-dd") : null,
        extracted_data: extractedData || {},
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString(),
        is_active: true,
      });

      if (dbError) throw dbError;

      toast({
        title: t("toast:success"),
        description: t("hr:documentUploaded"),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });

      // Reset form
      setSelectedFile(null);
      setPreview(null);
      setDocumentType("");
      setExpiryDate(undefined);
      setIsExpiryExtracted(false);
      setExtractedData(null);

      onSuccess?.();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: t("toast:error"),
        description: error.message || t("hr:uploadFailed"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    setExtractedData(null);
    setExpiryDate(undefined);
    setIsExpiryExtracted(false);
  };

  return (
    <div className="space-y-4">
      {/* Document Type Selection */}
      <div className="space-y-2">
        <Label className="text-[#555555]">
          {t("hr:documentType")} <span className="text-red-500">*</span>
        </Label>
        <Select value={documentType} onValueChange={handleDocumentTypeChange} disabled={loading}>
          <SelectTrigger className="border-[#E6E6E4]">
            <SelectValue placeholder={t("hr:selectDocumentType")} />
          </SelectTrigger>
          <SelectContent>
            {availableDocTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {t(`hr:docType.${type.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {existingDocuments.some((doc) => doc.document_type === documentType) && (
          <p className="text-sm text-[hsl(var(--jw-gold-accent))]">{t("hr:documentWillBeReplaced")}</p>
        )}
      </div>

      {/* File Upload Area */}
      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-[hsl(var(--jw-primary-green))] bg-[#E6F7F1]"
              : "border-[#E6E6E4] hover:border-[hsl(var(--jw-gold-accent))]"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 mx-auto mb-4 text-[#6B6B6B]" />
          <p className="text-[#555555] mb-1">
            {isDragActive ? t("hr:dropFileHere") : t("hr:dragDropOrClick")}
          </p>
          <p className="text-sm text-[#6B6B6B]">{t("hr:supportedFormats")}</p>
        </div>
      ) : (
        <Card className="border-[#E6E6E4]">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              {/* Preview */}
              {preview && (
                <div className="w-24 h-24 rounded-lg overflow-hidden border border-[#E6E6E4] flex-shrink-0">
                  {selectedFile.type.startsWith("image/") ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#FAFAF8]">
                      <FileText className="h-8 w-8 text-[#6B6B6B]" />
                    </div>
                  )}
                </div>
              )}

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#222222] truncate">{selectedFile.name}</p>
                <p className="text-sm text-[#6B6B6B]">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>

                {/* Extraction Status */}
                {extracting && (
                  <div className="flex items-center gap-2 mt-2 text-[hsl(var(--jw-primary-green))]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">{t("hr:extractingData")}</span>
                  </div>
                )}

                {extractedData && (
                  <div className="flex items-center gap-2 mt-2 text-[hsl(var(--jw-primary-green))]">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm">{t("hr:dataExtracted")}</span>
                  </div>
                )}
              </div>

              {/* Remove Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                disabled={loading}
                className="text-[#6B6B6B] hover:text-red-600 hover:bg-transparent"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expiry Date - Shows prominently after AI extraction */}
      <div className="space-y-2">
        <Label className="text-[#555555] flex items-center gap-2">
          <CalendarIcon className="h-4 w-4" />
          {t("hr:expiryDate")}
          {isExpiryExtracted && expiryDate && (
            <span className="text-xs text-[hsl(var(--jw-primary-green))] flex items-center gap-1 bg-[#E6F7F1] px-2 py-0.5 rounded-full">
              <Sparkles className="h-3 w-3" />
              {t("hr:aiExtracted")}
            </span>
          )}
        </Label>

        {/* Helper text */}
        <p className="text-[13px] text-[#6B6B6B]">
          {isExpiryExtracted
            ? t("hr:verifyExtractedExpiry")
            : t("hr:selectExpiryDate")}
        </p>

        {/* Calendar picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={loading}
              className={cn(
                "w-full justify-start text-left font-normal border-[#E6E6E4]",
                !expiryDate && "text-muted-foreground",
                isExpiryExtracted && expiryDate && "border-[hsl(var(--jw-primary-green))] bg-[#E6F7F1]/30"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {expiryDate ? format(expiryDate, "PPP") : t("hr:selectDate")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={expiryDate}
              onSelect={(date) => {
                setExpiryDate(date);
                if (isExpiryExtracted && date !== expiryDate) {
                  setIsExpiryExtracted(false); // User modified, no longer AI-extracted
                }
              }}
              captionLayout="dropdown"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Upload Button */}
      <Button
        onClick={handleUpload}
        disabled={loading || !selectedFile || !documentType}
        className="w-full bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("hr:uploading")}
          </>
        ) : (
          <>
            <Check className="mr-2 h-4 w-4" />
            {t("hr:uploadDocument")}
          </>
        )}
      </Button>
    </div>
  );
}
