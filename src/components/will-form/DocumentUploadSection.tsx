import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { processImageFile } from "@/utils/imageProcessing";
import { toast } from "@/hooks/use-toast";

interface DocumentUploadSectionProps {
  documentPath?: string;
  onDocumentPathChange: (path: string | undefined) => void;
  willId?: string;
  uploadPath: string; // e.g., "beneficiary-0-poa" or "executor-1-poa"
  label?: string;
  description?: string;
  accept?: string;
  error?: string;
  required?: boolean;
}

export function DocumentUploadSection({
  documentPath,
  onDocumentPathChange,
  willId,
  uploadPath,
  label = "Document",
  description = "Upload a document",
  accept = "image/*,.jpg,.jpeg,.png,.pdf",
  error,
  required = false,
}: DocumentUploadSectionProps) {
  const { t } = useTranslation(["form"]);
  const { user } = useAuth();
  const { uploading, progress, uploadFile, deleteFile, getSignedUrl } = useFileUpload();

  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  
  // Track temporary object URLs to revoke them later
  const tempObjectUrlRef = useRef<string | null>(null);

  // Refs for file input
  const documentNativeCameraRef = useRef<HTMLInputElement>(null);

  // Generate signed URL for preview when path changes
  useEffect(() => {
    if (documentPath) {
      getSignedUrl(documentPath).then((url) => {
        if (url) setDocumentPreviewUrl(url);
      });
    } else {
      setDocumentPreviewUrl(null);
    }
  }, [documentPath, getSignedUrl]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (tempObjectUrlRef.current) {
        URL.revokeObjectURL(tempObjectUrlRef.current);
      }
    };
  }, []);

  const handleFileUpload = async (file: File, type: "poa") => {
    if (!user?.id || !willId) return;

    try {
      setDocumentUploading(true);

      // Set immediate preview for instant feedback
      if (file.type.startsWith("image/")) {
        const tempUrl = URL.createObjectURL(file);
        if (tempObjectUrlRef.current) {
          URL.revokeObjectURL(tempObjectUrlRef.current);
        }
        tempObjectUrlRef.current = tempUrl;
        setDocumentPreviewUrl(tempUrl);
      }

      // Process image if it's an image file
      let processedFile = file;
      if (file.type.startsWith("image/")) {
        try {
          const { file: optimized } = await processImageFile(file);
          processedFile = optimized;

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
          setDocumentUploading(false);
          return;
        }
      }

      const metadata = await uploadFile(processedFile, type, user.id, willId);

      if (metadata) {
        // Get signed URL for preview
        const signedUrl = await getSignedUrl(metadata.path);

        // Update local state
        setDocumentPreviewUrl(signedUrl);
        if (tempObjectUrlRef.current) {
          URL.revokeObjectURL(tempObjectUrlRef.current);
          tempObjectUrlRef.current = null;
        }

        onDocumentPathChange(metadata.path);

        toast({
          title: t("form:uploadSuccess"),
          description: t("form:documentUploaded"),
        });
      }
    } finally {
      setDocumentUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!documentPath) return;

    const success = await deleteFile(documentPath);
    if (success) {
      onDocumentPathChange(undefined);
      setDocumentPreviewUrl(null);
      if (tempObjectUrlRef.current) {
        URL.revokeObjectURL(tempObjectUrlRef.current);
        tempObjectUrlRef.current = null;
      }
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-[#121212]">
        {label} {required && <span className="text-black">*</span>}
      </Label>
      <p className="text-xs text-[#6B6B6B] leading-relaxed">
        {t("form:acceptedFormats")}
      </p>

      {documentPreviewUrl ? (
        <div className={cn(
          "border-2 rounded-lg p-4 bg-white",
          error ? "border-destructive" : "border-[#E6E6E4]"
        )}>
          <div className="flex items-start gap-4">
            <img
              src={documentPreviewUrl}
              alt="Document preview"
              className="w-24 h-24 object-cover rounded border"
            />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => documentNativeCameraRef.current?.click()}
                  className="border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.08)]"
                >
                  {t("form:replaceFile")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemove}
                  className="border-destructive text-destructive hover:bg-destructive/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  {t("form:remove")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 transition-colors",
            error
              ? "border-destructive bg-destructive/5"
              : "border-[#C6A03B] bg-white hover:bg-[rgba(198,160,59,0.02)]"
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => documentNativeCameraRef.current?.click()}
              disabled={documentUploading}
              className="border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.08)]"
            >
              {t("form:chooseFile")}
            </Button>
            <p className="text-xs text-[#6B6B6B] text-center">
              {t("form:acceptedFormats")}
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="text-destructive text-sm mt-1">{error}</p>
      )}

      <input
        ref={documentNativeCameraRef}
        type="file"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, "poa");
          e.target.value = "";
        }}
        className="hidden"
      />
    </div>
  );
}
