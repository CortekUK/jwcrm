import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Upload,
  X,
  FileText,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { processImageFile } from "@/utils/imageProcessing";
import { toast } from "@/hooks/use-toast";
import { createWorker } from "tesseract.js";
import { extractEmiratesIdFromText } from "@/lib/emirates-id-utils";
import { supabase } from "@/integrations/supabase/client";

interface EmiratesIdUploadProps {
  emiratesIdPath?: string;
  emiratesIdNumber?: string;
  onEmiratesIdPathChange: (path: string | undefined) => void;
  onEmiratesIdNumberChange?: (number: string) => void;
  onEmiratesIdDataChange?: (data: { path?: string; number?: string }) => void;
  onFileMetadataUpdate?: (metadata: any) => void;
  willId?: string;
  uploadPath: string; // e.g., "executor-1-0-emirates"
  stepName?: string; // e.g., "Step 5: Executors"
  personName?: string; // e.g., "John Doe"
  personRole?: string; // e.g., "executor-1", "beneficiary-2"
  label?: string;
  error?: string;
}

export function EmiratesIdUpload({
  emiratesIdPath,
  emiratesIdNumber,
  onEmiratesIdPathChange,
  onEmiratesIdNumberChange,
  onEmiratesIdDataChange,
  onFileMetadataUpdate,
  willId,
  uploadPath,
  stepName,
  personName,
  personRole,
  label,
  error,
}: EmiratesIdUploadProps) {
  const { t } = useTranslation(["form"]);
  const { user } = useAuth();
  const { getSignedUrl } = useFileUpload();

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [extractedNumber, setExtractedNumber] = useState<string>("");
  const tempObjectUrlRef = useRef<string | null>(null);
  const ocrWorkerRef = useRef<any>(null);

  // Always keep the latest data to avoid stale overwrites from async handlers
  const latestDataRef = useRef({ emiratesIdPath, emiratesIdNumber });

  useEffect(() => {
    latestDataRef.current = { emiratesIdPath, emiratesIdNumber };
  }, [emiratesIdPath, emiratesIdNumber]);

  // Initialize OCR worker
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
    };
  }, []);

  // Load preview URL when component mounts or path changes
  useEffect(() => {
    const loadPreview = async () => {
      if (emiratesIdPath && !previewUrl) {
        const url = await getSignedUrl(emiratesIdPath, 3600, 'wills');
        setPreviewUrl(url);
      }
    };
    loadPreview();
  }, [emiratesIdPath, previewUrl, getSignedUrl]);

  // Set extracted number from props
  useEffect(() => {
    if (emiratesIdNumber) {
      setExtractedNumber(emiratesIdNumber);
    }
  }, [emiratesIdNumber]);

  const extractEmiratesIdNumber = async (file: File) => {
    try {
      toast({
        title: t("form:extractingEmiratesId"),
        description: t("form:extractingEmiratesIdDescription"),
      });

      const worker: any = ocrWorkerRef.current || (await createWorker("eng"));

      const {
        data: { text },
      } = await worker.recognize(file);

      const emiratesId = extractEmiratesIdFromText(text);

      if (emiratesId) {
        setExtractedNumber(emiratesId);

        // CRITICAL: Use batch update with latest data ref to avoid race conditions
        if (onEmiratesIdDataChange && latestDataRef.current.emiratesIdPath) {
          onEmiratesIdDataChange({
            path: latestDataRef.current.emiratesIdPath,
            number: emiratesId,
          });
        } else if (onEmiratesIdNumberChange) {
          onEmiratesIdNumberChange(emiratesId);
        }

        toast({
          title: t("form:emiratesIdExtracted"),
          description: t("form:emiratesIdDetected", { number: emiratesId }),
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
      console.error("Emirates ID OCR error:", error);
      toast({
        title: t("form:ocrFailed"),
        description: t("form:ocrFailedDescription"),
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!user?.id || !willId) {
      toast({
        title: t("form:uploadError"),
        description: t("form:uploadErrorDescription"),
        variant: "destructive",
      });
      return;
    }

    try {
      // Show immediate preview via object URL
      if (file.type.startsWith("image/")) {
        const objectUrl = URL.createObjectURL(file);
        tempObjectUrlRef.current = objectUrl;
        setPreviewUrl(objectUrl);
      }

      // Process image if it's an image file
      let processedFile = file;
      if (file.type.startsWith("image/")) {
        try {
          const { file: optimizedFile, thumbnail } = await processImageFile(file);
          processedFile = optimizedFile;

          if (!tempObjectUrlRef.current) {
            setPreviewUrl(thumbnail);
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
          return;
        }
      }

      // Upload to Supabase
      const path = `${user.id}/${willId}/emirates-id/${uploadPath}-${Date.now()}.jpg`;

      setUploading(true);
      setProgress(0);

      const { data, error: uploadError } = await supabase.storage
        .from('wills')
        .upload(path, processedFile, {
          cacheControl: '3600',
          upsert: false
        });

      setUploading(false);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast({
          title: t("form:uploadError"),
          description: uploadError.message,
          variant: "destructive",
        });
        return;
      }

      if (data) {
        // Get signed URL for preview
        const signedUrl = await getSignedUrl(path, 3600, 'wills');
        setPreviewUrl(signedUrl);

        if (tempObjectUrlRef.current) {
          URL.revokeObjectURL(tempObjectUrlRef.current);
          tempObjectUrlRef.current = null;
        }

        // Store metadata
        setMetadata({
          path,
          name: file.name,
          size: file.size,
          mime: file.type,
        });

        // Update parent component with path immediately
        if (onEmiratesIdDataChange) {
          onEmiratesIdDataChange({ path, number: emiratesIdNumber });
        } else {
          onEmiratesIdPathChange(path);
        }

        // Update upload_files array with step metadata
        if (onFileMetadataUpdate) {
          onFileMetadataUpdate({
            type: personRole ? `${personRole}-emirates_id` : 'emirates_id',
            path: path,
            name: file.name,
            size: file.size,
            mime: file.type,
            uploaded_at: new Date().toISOString(),
            stepName: stepName || 'Emirates ID',
            personName: personName || '',
          });
        }

        // Extract Emirates ID number in background
        if (file.type.startsWith("image/")) {
          extractEmiratesIdNumber(processedFile);
        }

        toast({
          title: t("form:uploadSuccess"),
          description: t("form:emiratesIdUploaded"),
        });
      }
    } catch (error) {
      console.error("Error uploading Emirates ID:", error);
      toast({
        title: t("form:uploadError"),
        description: t("form:failedToUploadEmiratesId"),
        variant: "destructive",
      });
    }
  };

  const handleFileRemove = () => {
    setPreviewUrl(null);
    setMetadata(null);
    setExtractedNumber("");
    onEmiratesIdPathChange(undefined);
    if (onEmiratesIdNumberChange) {
      onEmiratesIdNumberChange("");
    }

    toast({
      title: t("form:fileDeleted"),
      description: t("form:fileDeletedSuccessfully"),
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Check if file is an image - either from metadata or from path extension
  const isImage = metadata?.mime?.startsWith("image/") ||
                  emiratesIdPath?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const hasFile = !!metadata || !!previewUrl || !!emiratesIdPath;


  return (
    <div className="space-y-2">
      <div>
        <Label className="text-[15px] font-semibold text-[#121212]">
          {label || t("form:emiratesIdLabel")}
          <span className="text-[13px] font-normal text-[#6B6B6B] ml-2">
            ({t("form:optional")})
          </span>
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
        {uploading ? (
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
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".jpg,.jpeg,.png,.pdf";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleFileSelect(file);
                  };
                  input.click();
                }}
                className="flex-1 sm:flex-initial border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.08)] h-[40px]"
              >
                {t("form:chooseFile")}
              </Button>
            </div>

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
                  alt="Emirates ID preview"
                  className="w-24 h-24 object-cover rounded border"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm truncate">
                        {metadata?.name || "Emirates ID"}
                      </p>
                      {metadata?.size && (
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(metadata.size)}
                        </p>
                      )}
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
                        onClick={handleFileRemove}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

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
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) handleFileSelect(file);
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
                    <p className="font-medium text-sm">{metadata?.name || "Emirates ID"}</p>
                    {metadata?.size && (
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(metadata.size)}
                      </p>
                    )}
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
                    onClick={handleFileRemove}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Emirates ID Number Field - shown after upload */}
      {(hasFile || extractedNumber) && (
        <div className="space-y-2 mt-4">
          <Label
            htmlFor="emirates_id_number"
            className="text-[15px] font-semibold text-[#121212]"
          >
            {t("form:emiratesIdNumberLabel")}{" "}
            {extractedNumber && (
              <span className="text-[#0C5536] text-xs ml-2">
                {t("form:autoDetected")}
              </span>
            )}
          </Label>
          <p className="text-[13px] text-[#6B6B6B] mb-2">
            {extractedNumber
              ? t("form:verifyExtractedEmiratesId")
              : t("form:enterEmiratesIdManually")}
          </p>
          <Input
            id="emirates_id_number"
            type="text"
            value={extractedNumber}
            onChange={(e) => {
              setExtractedNumber(e.target.value);
              if (onEmiratesIdNumberChange) {
                onEmiratesIdNumberChange(e.target.value);
              }
            }}
            placeholder={t("form:emiratesIdNumberPlaceholder")}
            className="font-mono"
            style={{ letterSpacing: "0.05em" }}
          />
        </div>
      )}

      {error && <p className="text-destructive text-sm mt-1">{error}</p>}
    </div>
  );
}
