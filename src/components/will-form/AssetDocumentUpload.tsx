import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Loader2, FileText, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import type { AssetDocument } from "@/types/will-form";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface AssetDocumentUploadProps {
  assetId: string;
  willId: string;
  documents: AssetDocument[];
  onDocumentsChange: (documents: AssetDocument[]) => void;
}

const DOCUMENT_TYPES = [
  { value: 'deed', label: 'Title Deed' },
  { value: 'logbook', label: 'Logbook' },
  { value: 'statement', label: 'Bank Statement' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' },
] as const;

export function AssetDocumentUpload({
  assetId,
  willId,
  documents = [],
  onDocumentsChange,
}: AssetDocumentUploadProps) {
  const { t } = useTranslation(["form", "toast"]);
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<AssetDocument['type']>('deed');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: t("toast:upload.invalidFileType"),
        description: t("toast:upload.pleaseUploadPDFOrImage"),
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t("toast:upload.fileTooLarge"),
        description: t("toast:upload.fileMustBeLessThan10MB"),
        variant: "destructive",
      });
      return;
    }

    await uploadDocument(file);
  };

  const uploadDocument = async (file: File) => {
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
      const filePath = `${user.id}/asset-documents/${willId}/${assetId}/doc_${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('will-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Create document metadata
      const newDocument: AssetDocument = {
        type: selectedType,
        path: filePath,
        name: file.name,
        size: file.size,
        mime: file.type,
        uploaded_at: new Date().toISOString(),
      };

      // Add to documents array
      onDocumentsChange([...documents, newDocument]);

      toast({
        title: t("toast:upload.documentUploaded"),
        description: t("toast:upload.fileUploadedSuccess", { name: file.name }),
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast({
        title: t("toast:upload.uploadFailed"),
        description: error.message || t("toast:upload.failedToUploadDocument"),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (doc: AssetDocument) => {
    try {
      // Delete from storage
      const { error } = await supabase.storage
        .from('will-documents')
        .remove([doc.path]);

      if (error) throw error;

      // Remove from documents array
      onDocumentsChange(documents.filter(d => d.path !== doc.path));

      toast({
        title: t("toast:upload.documentRemoved"),
        description: t("toast:upload.fileRemoved", { name: doc.name }),
      });
    } catch (error: any) {
      console.error('Error removing document:', error);
      toast({
        title: t("toast:upload.removeFailed"),
        description: error.message || t("toast:upload.failedToRemoveDocument"),
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-3">
      <Label>{t("assetDocumentsLabel")} ({t("optional")})</Label>

      {/* Upload Section */}
      <div className="border-2 border-dashed border-border rounded-lg p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label htmlFor="document-type" className="text-xs">{t("form:documentType")}</Label>
              <Select value={selectedType} onValueChange={(value: any) => setSelectedType(value)}>
                <SelectTrigger id="document-type" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs opacity-0">{t("form:upload")}</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
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
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("form:uploading")}...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {t("form:upload")}
                  </>
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("form:uploadDeedsHelper")}
          </p>
        </div>
      </div>

      {/* Documents List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
            >
              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {DOCUMENT_TYPES.find(t => t.value === doc.type)?.label} • {formatFileSize(doc.size)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => window.open(getPublicUrl(doc.path), '_blank')}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleRemove(doc)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
