import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface AssetPhotoUploadProps {
  assetId: string;
  willId: string;
  photoPath?: string;
  onPhotoChange: (path: string | undefined) => void;
}

export function AssetPhotoUpload({
  assetId,
  willId,
  photoPath,
  onPhotoChange,
}: AssetPhotoUploadProps) {
  const { t } = useTranslation(["form", "toast"]);
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(photoPath);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update preview URL when photoPath prop changes
  useEffect(() => {
    if (photoPath) {
      const { data: { publicUrl } } = supabase.storage
        .from('will-documents')
        .getPublicUrl(photoPath);
      setPreviewUrl(publicUrl);
    } else {
      setPreviewUrl(undefined);
    }
  }, [photoPath]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: t("toast:upload.invalidFileType"),
        description: t("toast:upload.pleaseUploadImage"),
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t("toast:upload.fileTooLarge"),
        description: t("toast:upload.imageMustBeLessThan10MB"),
        variant: "destructive",
      });
      return;
    }

    await uploadPhoto(file);
  };

  const uploadPhoto = async (file: File) => {
    if (!user?.id) {
      toast({
        title: t("toast:auth.authenticationRequired"),
        description: t("toast:auth.pleaseLogInToUpload"),
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Create unique file path with user ID as first folder (for RLS policy)
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/asset-photos/${willId}/${assetId}/photo_${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError, data } = await supabase.storage
        .from('will-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('will-documents')
        .getPublicUrl(filePath);

      setPreviewUrl(publicUrl);
      onPhotoChange(filePath);

      toast({
        title: t("toast:upload.photoUploaded"),
        description: t("toast:upload.assetPhotoUploadedSuccess"),
      });
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast({
        title: t("toast:upload.uploadFailed"),
        description: error.message || t("toast:upload.failedToUploadPhoto"),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (!photoPath) return;

    try {
      // Delete from storage
      const { error } = await supabase.storage
        .from('will-documents')
        .remove([photoPath]);

      if (error) throw error;

      setPreviewUrl(undefined);
      onPhotoChange(undefined);

      toast({
        title: t("toast:upload.photoRemoved"),
        description: t("toast:upload.assetPhotoRemoved"),
      });
    } catch (error: any) {
      console.error('Error removing photo:', error);
      toast({
        title: t("toast:upload.removeFailed"),
        description: error.message || t("toast:upload.failedToRemovePhoto"),
        variant: "destructive",
      });
    }
  };

  const getPublicUrl = (path: string) => {
    const { data: { publicUrl } } = supabase.storage
      .from('will-documents')
      .getPublicUrl(path);
    return publicUrl;
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[15px] font-semibold text-[#121212]">
          {t("assetPhotoLabel")}{" "}
          <span className="text-[13px] font-normal text-[#6B6B6B] ml-2">
            ({t("optional")})
          </span>
        </Label>
        <p className="text-[13px] text-[#6B6B6B] mt-1">
          {t("form:jpgPngUpTo10MB")}
        </p>
      </div>

      {previewUrl || photoPath ? (
        <div className={cn(
          "border-2 border-dashed rounded-lg p-8 transition-all duration-200",
          "border-[#0C5536] bg-[#F8F8F6]"
        )}>
          <div className="space-y-3">
            <div className="flex items-start gap-4">
              <img
                src={previewUrl || (photoPath ? getPublicUrl(photoPath) : '')}
                alt="Asset"
                className="w-24 h-24 object-cover rounded border"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      {t("form:assetPhotoUploaded")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemove}
                      disabled={uploading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Replace Options */}
                <div className="flex gap-2 mt-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={uploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1 border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.08)] h-[40px]"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t("form:uploading")}...
                      </>
                    ) : (
                      t("form:replaceFile")
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={cn(
          "border-2 border-dashed rounded-lg p-8 transition-all duration-200",
          "border-[#C6A03B] bg-white hover:border-[#0C5536] hover:shadow-[0_1px_6px_rgba(12,85,54,0.1)]"
        )}>
          <div className="flex flex-col items-center gap-4">
            <Upload className="w-10 h-10 text-[#C6A03B]" />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.08)] h-[40px]"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("form:uploading")}...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("form:chooseFile")}
                </>
              )}
            </Button>

            <p className="text-[13px] text-[#6B6B6B] text-center mt-2">
              {t("form:jpgPngUpTo10MB")}
            </p>

            <a
              href="mailto:info@just-wills.net?subject=Help with Asset Photo Upload"
              className="text-[13px] text-[#0C5536] hover:underline"
            >
              {t("form:uploadTroubleHelpText")}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
