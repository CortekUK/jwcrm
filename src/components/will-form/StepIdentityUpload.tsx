import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Camera,
  AlertCircle,
  Shield,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Answers, UserIdentityDocument } from "@/types/will-form";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { CameraModal } from "./CameraModal";
import { processImageFile, dataURLtoFile } from "@/utils/imageProcessing";
import { toast } from "@/hooks/use-toast";
import {
  isCameraSupported,
  getAvailableCameras,
  getDeviceType,
  type CameraCapabilities,
} from "@/utils/deviceDetection";
import { supabase } from "@/integrations/supabase/client";
import { createWorker } from "tesseract.js";
import { StepTitle } from "./StepTitle";
import { extractPassportNumberFromText } from "@/lib/passport-extraction";
import { extractEmiratesIdFromText, extractNameFromEmiratesIdText } from "@/lib/emirates-id-utils";
import { extractEmiratesIdWithAI, getDisplayName } from "@/lib/ai-emirates-extraction";

interface StepIdentityUploadProps {
  data: Answers["identity"];
  onChange: (data: Answers["identity"]) => void;
  onFileMetadataUpdate?: (type: "passport", metadata: any) => void;
  onFileMetadataRemove?: (type: "passport") => void;
  onNameExtracted?: (name: string) => void; // Callback to update Step 1 name field
  willId?: string;
  errors?: Record<string, string>;
}

export function StepIdentityUpload({
  data,
  onChange,
  onFileMetadataUpdate,
  onFileMetadataRemove,
  onNameExtracted,
  willId,
  errors = {},
}: StepIdentityUploadProps) {
  const { t } = useTranslation(["form"]);
  const { user } = useAuth();
  const { locale } = useLanguage();
  const {
    uploading,
    progress,
    uploadFile,
    deleteFile,
    getSignedUrl,
    uploadUserIdentityDocument,
    getUserDocuments,
    deleteUserDocument,
  } = useFileUpload();

  const [passportUploading, setPassportUploading] = useState(false);
  const [visaUploading, setVisaUploading] = useState(false);
  const [emiratesIdUploading, setEmiratesIdUploading] = useState(false);

  const [passportPreviewUrl, setPassportPreviewUrl] = useState<string | null>(
    null
  );
  const [visaPreviewUrl, setVisaPreviewUrl] = useState<string | null>(null);
  const [emiratesIdPreviewUrl, setEmiratesIdPreviewUrl] = useState<string | null>(null);

  // Store user_identity_documents data
  const [userDocuments, setUserDocuments] = useState<{
    passport: UserIdentityDocument | null;
    visa: UserIdentityDocument | null;
    emirates_id: UserIdentityDocument | null;
  }>({
    passport: null,
    visa: null,
    emirates_id: null,
  });

  // Track temporary object URLs to revoke them later
  const tempObjectUrlRef = useRef<string | null>(null);
  // Always keep the latest identity data to avoid stale overwrites from async handlers
  const latestIdentityRef = useRef(data);
  useEffect(() => {
    latestIdentityRef.current = data;
  }, [data]);

  // Camera capture state
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [currentCaptureType, setCurrentCaptureType] = useState<
    "passport" | "visa" | "emirates_id" | null
  >(null);
  const [cameraCapabilities, setCameraCapabilities] =
    useState<CameraCapabilities | null>(null);

  // Refs for native camera inputs
  const passportNativeCameraRef = useRef<HTMLInputElement>(null);
  const visaNativeCameraRef = useRef<HTMLInputElement>(null);
  const emiratesIdNativeCameraRef = useRef<HTMLInputElement>(null);

  // Bypass state for testing
  const [isBypassed, setIsBypassed] = useState(false);

  // OCR worker (reuse across extractions to avoid init lag)
  // Use loose typing to avoid dependency type issues from tesseract.js
  const ocrWorkerRef = useRef<any>(null);

  // Detect camera capabilities on mount
  useEffect(() => {
    const detectCamera = async () => {
      if (isCameraSupported()) {
        const capabilities = await getAvailableCameras();
        setCameraCapabilities(capabilities);
      } else {
        setCameraCapabilities({
          hasCamera: false,
          hasFrontCamera: false,
          hasBackCamera: false,
          cameraCount: 0,
          defaultFacingMode: "user",
        });
      }
    };

    detectCamera();
  }, []);

  // Initialize Tesseract worker once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const worker = await createWorker("eng");
        if (!cancelled) {
          ocrWorkerRef.current = worker;
        } else {
          await worker.terminate();
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
      // Do not terminate to keep warm between step navigations
    };
  }, []);

  // Load admin-uploaded documents on mount ONLY
  const hasLoadedAdminDocs = useRef(false);
  useEffect(() => {
    const loadAdminDocuments = async () => {
      if (!user?.id || hasLoadedAdminDocs.current) return;

      hasLoadedAdminDocs.current = true;

      try {
        const docs = await getUserDocuments(user.id);

        const passport = docs.find((d) => d.document_type === "passport");
        const visa = docs.find((d) => d.document_type === "visa");
        const emirates = docs.find((d) => d.document_type === "emirates_id");

        setUserDocuments({
          passport: passport || null,
          visa: visa || null,
          emirates_id: emirates || null,
        });

        // Load preview URLs for each document
        if (passport) {
          const url = await getSignedUrl(passport.document_path);
          setPassportPreviewUrl(url);

          // Always populate from admin docs (admin uploads take precedence)
          // Use latestIdentityRef to avoid stale closure
          const currentData = latestIdentityRef.current;
          onChange({
            ...currentData,
            passport_path: passport.document_path,
            passport_metadata: {
              path: passport.document_path,
              name: passport.document_name,
              size: passport.document_size,
              mime: passport.document_mime,
            },
            passport_number: passport.passport_number || currentData.passport_number || "",
          });
        }

        if (visa) {
          const url = await getSignedUrl(visa.document_path);
          setVisaPreviewUrl(url);
        }

        if (emirates) {
          const url = await getSignedUrl(emirates.document_path);
          setEmiratesIdPreviewUrl(url);
        }
      } catch (error) {
        console.error("Error loading admin documents:", error);
      }
    };

    loadAdminDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Load existing files on mount ONLY (don't reload on every data change)
  useEffect(() => {
    const loadExistingFiles = async () => {
      // Only load if we don't already have a preview URL and not loading from admin docs
      if (data.passport_path && !passportPreviewUrl && !userDocuments.passport) {
        const url = await getSignedUrl(data.passport_path);
        setPassportPreviewUrl(url);
      }
    };
    loadExistingFiles();
  }, [data.passport_path, getSignedUrl, passportPreviewUrl, userDocuments.passport]);

  const handleFileSelect = async (
    file: File,
    type: "passport" | "visa" | "emirates_id"
  ) => {
    if (!user?.id || !willId) {
      console.error("User or will ID not available", {
        userId: user?.id,
        willId,
      });
      toast({
        title: t("form:uploadError"),
        description: t("form:uploadErrorDescription"),
        variant: "destructive",
      });
      return;
    }

    // Clear old extracted data when uploading new document
    if (type === "emirates_id" && userDocuments.emirates_id?.id) {
      // Clear Emirates ID number and extracted name immediately in UI
      setUserDocuments((prev) => ({
        ...prev,
        emirates_id: prev.emirates_id
          ? { ...prev.emirates_id, emirates_id_number: null, extracted_name: null, arabic_name: null, english_name: null }
          : null,
      }));

      // Also clear in database immediately to prevent old data from showing
      await supabase
        .from("user_identity_documents")
        .update({
          emirates_id_number: null,
          extracted_name: null,
          arabic_name: null,
          english_name: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userDocuments.emirates_id.id);
    }

    // Set uploading state based on type
    if (type === "passport") setPassportUploading(true);
    else if (type === "visa") setVisaUploading(true);
    else if (type === "emirates_id") setEmiratesIdUploading(true);

    try {
      // Show immediate preview via object URL for snappy UX
      if (file.type.startsWith("image/")) {
        const objectUrl = URL.createObjectURL(file);
        tempObjectUrlRef.current = objectUrl;
        if (type === "passport") setPassportPreviewUrl(objectUrl);
        else if (type === "visa") setVisaPreviewUrl(objectUrl);
        else if (type === "emirates_id") setEmiratesIdPreviewUrl(objectUrl);
      }

      // Process image if it's an image file
      let processedFile = file;

      if (file.type.startsWith("image/")) {
        try {
          const { file: optimizedFile, thumbnail } = await processImageFile(
            file
          );
          processedFile = optimizedFile;

          // Prefer existing object URL for instant preview; if not available, use thumbnail
          if (!tempObjectUrlRef.current) {
            if (type === "passport") setPassportPreviewUrl(thumbnail);
            else if (type === "visa") setVisaPreviewUrl(thumbnail);
            else if (type === "emirates_id") setEmiratesIdPreviewUrl(thumbnail);
          }

          toast({
            title: t("form:imageProcessed"),
            description: t("form:imageOptimizedDescription"),
          });
        } catch (error: any) {
          toast({
            title: t("form:processingError"),
            description: error.message || t("form:processingErrorDescription"),
            variant: "destructive",
          });
          if (type === "passport") setPassportUploading(false);
          else if (type === "visa") setVisaUploading(false);
          else if (type === "emirates_id") setEmiratesIdUploading(false);
          return;
        }
      }

      // Upload to user-documents folder (syncs to user_identity_documents table)
      const metadata = await uploadUserIdentityDocument(
        processedFile,
        user.id,
        type
      );

      if (metadata) {
        // Get signed URL for preview
        const signedUrl = await getSignedUrl(metadata.path);

        // Update local state
        if (type === "passport") {
          setPassportPreviewUrl(signedUrl);
        } else if (type === "visa") {
          setVisaPreviewUrl(signedUrl);
        } else if (type === "emirates_id") {
          setEmiratesIdPreviewUrl(signedUrl);
        }

        if (tempObjectUrlRef.current) {
          URL.revokeObjectURL(tempObjectUrlRef.current);
          tempObjectUrlRef.current = null;
        }

        // Save to user_identity_documents table
        const { data: savedDoc, error: dbError } = await supabase
          .from("user_identity_documents")
          .upsert(
            {
              user_id: user.id,
              document_type: type,
              document_path: metadata.path,
              document_name: metadata.name,
              document_size: metadata.size,
              document_mime: metadata.mime,
              uploaded_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "user_id,document_type",
            }
          )
          .select()
          .single();

        if (dbError) {
          console.error("Error saving to user_identity_documents:", dbError);
        } else {
          // Update userDocuments state with the saved document
          setUserDocuments((prev) => ({
            ...prev,
            [type]: savedDoc,
          }));
        }

        // If passport, also update will data
        if (type === "passport") {
          const updatedData = {
            ...data,
            passport_path: metadata.path,
            passport_metadata: metadata,
            passport_file: null,
          };
          onChange(updatedData);

          // Extract passport number from uploaded image (run in background)
          if (file.type.startsWith("image/")) {
            extractPassportNumber(processedFile, savedDoc?.id);
          }

          // Update metadata in DB
          onFileMetadataUpdate?.(type, metadata);
        }

        // Extract Emirates ID number if type is emirates_id
        if (type === "emirates_id" && file.type.startsWith("image/")) {
          extractEmiratesIdNumber(processedFile, savedDoc?.id);
        }
      }
    } finally {
      if (type === "passport") setPassportUploading(false);
      else if (type === "visa") setVisaUploading(false);
      else if (type === "emirates_id") setEmiratesIdUploading(false);
    }
  };

  const extractPassportNumber = async (file: File, documentId?: string) => {
    try {
      toast({
        title: t("form:extractingPassportNumber"),
        description: t("form:extractingPassportDescription"),
      });

      // Use warm worker if available
      const worker: any = ocrWorkerRef.current || (await createWorker("eng"));

      // Perform OCR on the file
      const {
        data: { text },
      } = await worker.recognize(file);

      // Do not terminate the shared worker to keep it warm for subsequent uses

      // Extract passport number from text using shared utility
      const passportNumber = extractPassportNumberFromText(text);

      if (passportNumber) {
        // Update passport number without triggering a full re-render/save
        // This preserves the preview URL and upload state
        onChange({
          ...latestIdentityRef.current,
          passport_number: passportNumber,
        });

        // Also save to user_identity_documents table if documentId provided
        if (documentId) {
          await supabase
            .from("user_identity_documents")
            .update({
              passport_number: passportNumber,
              updated_at: new Date().toISOString(),
            })
            .eq("id", documentId);
        }

        // Ensure preview URL is preserved - don't let it get cleared
        if (data.passport_path && !passportPreviewUrl) {
          const url = await getSignedUrl(data.passport_path);
          setPassportPreviewUrl(url);
        }

        toast({
          title: t("form:passportNumberExtracted"),
          description: t("form:passportNumberDetected", {
            number: passportNumber,
          }),
          className:
            "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
        });
      } else {
        toast({
          title: t("form:couldNotExtract"),
          description: t("form:enterPassportManually"),
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("OCR error:", error);
      toast({
        title: t("form:ocrFailed"),
        description: t("form:enterPassportManuallyFallback"),
        variant: "destructive",
      });
    }
  };

  const extractEmiratesIdNumber = async (file: File, documentId?: string) => {
    try {
      toast({
        title: t("form:extractingEmiratesId"),
        description: t("form:extractingEmiratesIdDescription"),
      });

      // Try AI extraction first (no OCR yet)
      console.log('🤖 Attempting AI-based Emirates ID extraction...');

      // Use AI extraction - it will handle OCR fallback internally if needed
      const result = await extractEmiratesIdWithAI(file);

      console.log('📊 Extraction result:', result);

      const emiratesId = result.emiratesId;
      // Use user's language preference to determine which name to display
      const extractedName = getDisplayName(result, locale);

      if (emiratesId) {
        // Prepare update data
        const updateData: any = {
          emirates_id_number: emiratesId,
          updated_at: new Date().toISOString(),
        };

        // Add extracted name if available (prefers Arabic, falls back to English)
        if (extractedName) {
          updateData.extracted_name = extractedName;
          console.log('✅ Extracted name from Emirates ID:', extractedName);

          // Store both Arabic and English names separately for future use
          if (result.arabicName) {
            updateData.arabic_name = result.arabicName;
            console.log('   Arabic:', result.arabicName);
          }
          if (result.englishName) {
            updateData.english_name = result.englishName;
            console.log('   English:', result.englishName);
          }
        }

        // Save to user_identity_documents table if documentId provided
        if (documentId) {
          await supabase
            .from("user_identity_documents")
            .update(updateData)
            .eq("id", documentId);

          // Update local state with all extracted data
          setUserDocuments((prev) => ({
            ...prev,
            emirates_id: prev.emirates_id
              ? {
                  ...prev.emirates_id,
                  emirates_id_number: emiratesId,
                  extracted_name: extractedName || prev.emirates_id.extracted_name,
                  arabic_name: result.arabicName || prev.emirates_id.arabic_name,
                  english_name: result.englishName || prev.emirates_id.english_name,
                }
              : null,
          }));

          // Update Step 1 full_name field if name was extracted
          if (extractedName && onNameExtracted) {
            onNameExtracted(extractedName);
          }
        }

        const description = extractedName
          ? t("form:emiratesIdAndNameDetected", { number: emiratesId, name: extractedName })
          : t("form:emiratesIdDetected", { number: emiratesId });

        toast({
          title: t("form:emiratesIdExtracted"),
          description,
          className:
            "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
        });
      } else {
        toast({
          title: t("form:couldNotExtract"),
          description: t("form:enterEmiratesIdManually"),
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Emirates ID extraction error:", error);
      toast({
        title: t("form:ocrFailed"),
        description: t("form:ocrFailedDescription"),
        variant: "destructive",
      });
    }
  };

  /**
   * Handle camera capture
   */
  const handleCameraCapture = async (dataUrl: string) => {
    if (!currentCaptureType) return;

    try {
      // Convert data URL to file
      const file = dataURLtoFile(dataUrl, `capture-${Date.now()}.jpg`);

      // Process and upload the captured image
      await handleFileSelect(file, currentCaptureType);

      setCameraModalOpen(false);
      setCurrentCaptureType(null);
    } catch (error: any) {
      toast({
        title: t("form:captureFailed"),
        description: error.message || t("form:captureFailedDescription"),
        variant: "destructive",
      });
    }
  };

  /**
   * Open camera modal for capture
   */
  const openCamera = (type: "passport" | "visa" | "emirates_id") => {
    setCurrentCaptureType(type);
    setCameraModalOpen(true);
  };

  /**
   * Handle native camera input (mobile quick path)
   */
  const handleNativeCameraChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "passport" | "visa" | "emirates_id"
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file, type);
    }
  };

  const handleFileRemove = async (
    type: "passport" | "visa" | "emirates_id"
  ) => {
    const userDoc = userDocuments[type];

    if (!userDoc) return;

    try {
      // Delete from storage and database
      const success = await deleteUserDocument(userDoc.id, userDoc.document_path);

      if (success) {
        // Clear preview and form data
        if (type === "passport") {
          setPassportPreviewUrl(null);
          onChange({
            ...data,
            passport_path: undefined,
            passport_metadata: undefined,
            passport_file: null,
            passport_number: undefined,
          });
          onFileMetadataRemove?.("passport");
        } else if (type === "visa") {
          setVisaPreviewUrl(null);
        } else if (type === "emirates_id") {
          setEmiratesIdPreviewUrl(null);
          // Clear Emirates ID number and extracted name from local state
          setUserDocuments((prev) => ({
            ...prev,
            emirates_id: null,
          }));
        }

        // Update local state (for non-emirates_id types)
        if (type !== "emirates_id") {
          setUserDocuments((prev) => ({
            ...prev,
            [type]: null,
          }));
        }

        toast({
          title: t("form:fileDeleted"),
          description: t("form:fileDeletedSuccessfully"),
        });
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        title: t("form:deleteFailed"),
        description: t("form:deleteFailedDescription"),
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const FileUploadZone = ({
    type,
    label,
    metadata,
    previewUrl,
    isUploading,
    error,
    optional = false,
    uploadedByAdmin = false,
  }: {
    type: "passport" | "visa" | "emirates_id";
    label: string;
    metadata?: any;
    previewUrl: string | null;
    isUploading: boolean;
    error?: string;
    optional?: boolean;
    uploadedByAdmin?: boolean;
  }) => {
    const isImage = metadata?.mime?.startsWith("image/");
    const hasFile = !!metadata || !!previewUrl;

    return (
      <div className="space-y-2">
        <div>
          <Label className="text-[15px] font-semibold text-[#121212]">
            {label} {!optional && "*"}
            {optional && (
              <span className="text-[13px] font-normal text-[#6B6B6B] ml-2">
                ({t("form:optional")})
              </span>
            )}
            {uploadedByAdmin && hasFile && (
              <span className="text-[11px] font-normal text-[#0C5536] ml-2 inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                {t("form:uploadedByAdmin")}
              </span>
            )}
          </Label>
          <p className="text-[13px] text-[#6B6B6B] mt-1">
            {t("form:acceptedFormats")}
          </p>
        </div>
        <div
          className={cn(
            "mt-2 border-2 border-dashed rounded-lg p-8 transition-all duration-200",
            error && "border-destructive bg-destructive/5",
            !error &&
              !hasFile &&
              "border-[#C6A03B] bg-white hover:border-[#0C5536] hover:shadow-[0_1px_6px_rgba(12,85,54,0.1)]",
            hasFile && "border-[#0C5536] bg-[#F8F8F6]"
          )}
        >
          {isUploading ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Upload className="w-8 h-8 text-primary animate-pulse" />
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {t("form:uploadingLabel")}
                  </p>
                  <Progress value={progress} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {progress}%
                  </p>
                </div>
              </div>
            </div>
          ) : !hasFile ? (
            <div className="flex flex-col items-center gap-4">
              <Upload className="w-10 h-10 text-[#C6A03B]" />

              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                {/* Choose File Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".jpg,.jpeg,.png,.pdf";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleFileSelect(file, type);
                    };
                    input.click();
                  }}
                  className="flex-1 sm:flex-initial border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.08)] h-[40px]"
                >
                  {t("form:chooseFile")}
                </Button>
              </div>

              {/* Native Camera Input (Hidden, for mobile quick path) */}
              <input
                ref={
                  type === "passport"
                    ? passportNativeCameraRef
                    : type === "visa"
                    ? visaNativeCameraRef
                    : emiratesIdNativeCameraRef
                }
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={(e) => handleNativeCameraChange(e, type)}
              />

              <p className="text-[13px] text-[#6B6B6B] text-center mt-2">
                {t("form:fileFormatsHelperShort")}
              </p>

              <a
                href="mailto:info@just-wills.net?subject=Help with Identity Upload"
                className="text-[13px] text-[#0C5536] hover:underline"
              >
                {t("form:uploadTroubleHelpText")}
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {isImage && previewUrl ? (
                <div className="flex items-start gap-4">
                  <img
                    src={previewUrl}
                    alt={`${label} preview`}
                    className="w-24 h-24 object-cover rounded border"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm truncate">
                          {metadata?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(metadata?.size || 0)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(previewUrl, "_blank")}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFileRemove(type)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Replace Options */}
                    <div className="flex gap-2 mt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = ".jpg,.jpeg,.png,.pdf";
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement)
                              .files?.[0];
                            if (file) handleFileSelect(file, type);
                          };
                          input.click();
                        }}
                        className="flex-1 border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.08)] h-[40px]"
                      >
                        {t("form:replaceFile")}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{metadata?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(metadata?.size || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {previewUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(previewUrl, "_blank")}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFileRemove(type)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Replace Options */}
                  <div className="flex gap-2 mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = ".jpg,.jpeg,.png,.pdf";
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement)
                            .files?.[0];
                          if (file) handleFileSelect(file, type);
                        };
                        input.click();
                      }}
                      className="border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.08)] h-[40px]"
                    >
                      {t("form:replaceFile")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {error && <p className="text-destructive text-sm mt-1">{error}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-8 relative">
      {/* Section Header */}
      <div className="space-y-4 pb-6 border-b border-[rgba(198,160,59,0.3)]">
        <StepTitle title={t("form:identityUpload")} />
        <div className="space-y-3">
          <p className="text-[14px] text-[#333333] leading-[1.7]">
            {t("form:identityUploadDescription")}
          </p>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#0C5536] flex-shrink-0" />
            <p className="text-[13px] text-[#6B6B6B]">
              {t("form:identityDocumentsSecure")}
            </p>
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-6">
        <FileUploadZone
          type="passport"
          label={t("form:passportLabel")}
          metadata={data.passport_metadata}
          previewUrl={passportPreviewUrl}
          isUploading={passportUploading}
          error={errors.passport_file}
          uploadedByAdmin={!!userDocuments.passport}
        />

        {/* Passport Number Field - shown after passport upload */}
        {(data.passport_path || data.passport_number) && (
          <div className="space-y-2">
            <Label
              htmlFor="passport_number"
              className="text-[15px] font-semibold text-[#121212]"
            >
              {t("form:passportNumberLabel")}{" "}
              {data.passport_number && (
                <span className="text-[#0C5536] text-xs ml-2">
                  {t("form:autoDetected")}
                </span>
              )}
            </Label>
            <p className="text-[13px] text-[#6B6B6B] mb-2">
              {data.passport_number
                ? t("form:verifyExtractedPassport")
                : t("form:enterPassportManuallyLabel")}
            </p>
            <input
              id="passport_number"
              type="text"
              value={data.passport_number || ""}
              onChange={(e) =>
                onChange({
                  ...data,
                  passport_number: e.target.value.toUpperCase(),
                })
              }
              placeholder={t("form:passportNumberPlaceholder")}
              className="w-full px-4 py-2 border-2 border-[#E6E6E4] rounded-lg focus:border-[#0C5536] focus:outline-none transition-colors text-[14px] font-mono"
              style={{ letterSpacing: "0.05em" }}
            />
            {errors.passport_number && (
              <p className="text-destructive text-sm mt-1">
                {errors.passport_number}
              </p>
            )}
          </div>
        )}

        {/* Emirates ID Upload - Optional */}
        <FileUploadZone
          type="emirates_id"
          label={t("form:emiratesIdLabel")}
          metadata={
            userDocuments.emirates_id
              ? {
                  name: userDocuments.emirates_id.document_name,
                  size: userDocuments.emirates_id.document_size,
                  mime: userDocuments.emirates_id.document_mime,
                }
              : undefined
          }
          previewUrl={emiratesIdPreviewUrl}
          isUploading={emiratesIdUploading}
          optional
          uploadedByAdmin={!!userDocuments.emirates_id}
        />

        {/* Emirates ID Number Field - shown after emirates_id upload */}
        {userDocuments.emirates_id && (
          <div className="space-y-2">
            <Label
              htmlFor="emirates_id_number"
              className="text-[15px] font-semibold text-[#121212]"
            >
              {t("form:emiratesIdNumberLabel")}{" "}
              {userDocuments.emirates_id.emirates_id_number && (
                <span className="text-[#0C5536] text-xs ml-2">
                  {t("form:autoDetected")}
                </span>
              )}
            </Label>
            <p className="text-[13px] text-[#6B6B6B] mb-2">
              {userDocuments.emirates_id.emirates_id_number
                ? t("form:verifyExtractedEmiratesId")
                : t("form:enterEmiratesIdManually")}
            </p>
            <input
              id="emirates_id_number"
              type="text"
              value={userDocuments.emirates_id.emirates_id_number || ""}
              onChange={async (e) => {
                const newNumber = e.target.value;
                // Update local state
                setUserDocuments((prev) => ({
                  ...prev,
                  emirates_id: prev.emirates_id
                    ? { ...prev.emirates_id, emirates_id_number: newNumber }
                    : null,
                }));
                // Save to database
                if (userDocuments.emirates_id?.id) {
                  await supabase
                    .from("user_identity_documents")
                    .update({
                      emirates_id_number: newNumber,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", userDocuments.emirates_id.id);
                }
              }}
              placeholder={t("form:emiratesIdNumberPlaceholder")}
              className="w-full px-4 py-2 border-2 border-[#E6E6E4] rounded-lg focus:border-[#0C5536] focus:outline-none transition-colors text-[14px] font-mono"
              style={{ letterSpacing: "0.05em" }}
            />
          </div>
        )}

        {/* Extracted Name Field - shown after emirates_id upload */}
        {userDocuments.emirates_id && (
          <div className="space-y-2">
            <Label
              htmlFor="extracted_name"
              className="text-[15px] font-semibold text-[#121212]"
            >
              {t("form:extractedNameLabel")}{" "}
              {userDocuments.emirates_id.extracted_name && (
                <span className="text-[#0C5536] text-xs ml-2">
                  {t("form:autoDetected")}
                </span>
              )}
            </Label>
            <p className="text-[13px] text-[#6B6B6B] mb-2">
              {userDocuments.emirates_id.extracted_name
                ? t("form:verifyExtractedName")
                : t("form:enterNameManually")}
            </p>
            <input
              id="extracted_name"
              type="text"
              value={userDocuments.emirates_id.extracted_name || ""}
              onChange={async (e) => {
                const newName = e.target.value;
                // Update local state
                setUserDocuments((prev) => ({
                  ...prev,
                  emirates_id: prev.emirates_id
                    ? { ...prev.emirates_id, extracted_name: newName }
                    : null,
                }));
                // Save to database
                if (userDocuments.emirates_id?.id) {
                  await supabase
                    .from("user_identity_documents")
                    .update({
                      extracted_name: newName,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", userDocuments.emirates_id.id);
                }
              }}
              placeholder={t("form:extractedNamePlaceholder")}
              className="w-full px-4 py-2 border-2 border-[#E6E6E4] rounded-lg focus:border-[#0C5536] focus:outline-none transition-colors text-[14px]"
            />
          </div>
        )}

        {/* Visa Upload - Optional */}
        <FileUploadZone
          type="visa"
          label={t("form:visaLabel")}
          metadata={
            userDocuments.visa
              ? {
                  name: userDocuments.visa.document_name,
                  size: userDocuments.visa.document_size,
                  mime: userDocuments.visa.document_mime,
                }
              : undefined
          }
          previewUrl={visaPreviewUrl}
          isUploading={visaUploading}
          optional
          uploadedByAdmin={!!userDocuments.visa}
        />
      </div>

      {/* Camera Capture Modal */}
      <CameraModal
        isOpen={cameraModalOpen}
        onClose={() => {
          setCameraModalOpen(false);
          setCurrentCaptureType(null);
        }}
        onCapture={handleCameraCapture}
        title={t("form:capturePassport")}
      />
    </div>
  );
}
