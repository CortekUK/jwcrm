import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Camera, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { CameraModal } from "./CameraModal";
import { processImageFile, dataURLtoFile } from "@/utils/imageProcessing";
import { toast } from "@/hooks/use-toast";
import { isCameraSupported } from "@/utils/deviceDetection";

interface EmiratesIdUploadSectionProps {
  emiratesIdPath?: string;
  onEmiratesIdPathChange: (path: string | undefined) => void;
  willId?: string;
  uploadPath: string; // e.g., "executor-1-0-emirates"
  label?: string;
  error?: string;
}

export function EmiratesIdUploadSection({
  emiratesIdPath,
  onEmiratesIdPathChange,
  willId,
  uploadPath,
  label,
  error,
}: EmiratesIdUploadSectionProps) {
  const { t } = useTranslation(["form"]);
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);

  const { uploadFile, uploading } = useFileUpload();

  // Check camera support on mount
  useState(() => {
    const checkCamera = async () => {
      const supported = await isCameraSupported();
      setCameraSupported(supported);
    };
    checkCamera();
  });

  const handleFileSelect = async (file: File) => {
    if (!willId || !user) {
      toast({
        title: t("form:uploadError"),
        description: t("form:pleaseWaitForWillIdAndAuth"),
        variant: "destructive",
      });
      return;
    }

    try {
      // Process image (compress, etc.)
      const processedResult = await processImageFile(file);
      const processedFile = processedResult.file || processedResult;

      // Upload to Supabase - using uploadFile with correct signature
      const result = await uploadFile(processedFile as File, 'poa', user.id, willId);

      if (result?.path) {
        onEmiratesIdPathChange(result.path);
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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleCameraCapture = async (dataUrl: string) => {
    const file = dataURLtoFile(dataUrl, "emirates-id.jpg");
    await handleFileSelect(file);
    setShowCamera(false);
  };

  const handleRemove = () => {
    onEmiratesIdPathChange(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-sm font-medium">
          {label} <span className="text-muted-foreground">({t("form:optional")})</span>
        </Label>
      )}

      <div className="flex flex-col gap-2">
        {/* Preview or Upload Buttons */}
        {emiratesIdPath ? (
          <div className="relative">
            <img
              src={emiratesIdPath}
              alt="Emirates ID"
              className="w-full max-w-md h-auto rounded-lg border"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !willId}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? t("form:uploading") : t("form:uploadFile")}
            </Button>

            {cameraSupported && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCamera(true)}
                disabled={uploading || !willId}
              >
                <Camera className="h-4 w-4 mr-2" />
                {t("form:takePhoto")}
              </Button>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {showCamera && (
        <CameraModal
          isOpen={showCamera}
          onClose={() => setShowCamera(false)}
          onCapture={handleCameraCapture}
        />
      )}
    </div>
  );
}
