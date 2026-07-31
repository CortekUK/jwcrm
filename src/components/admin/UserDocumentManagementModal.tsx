import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { X, Upload, FileText, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createWorker } from "tesseract.js";
import { extractEmiratesIdFromText, extractNameFromEmiratesIdText, formatEmiratesId, validateEmiratesIdInput } from "@/lib/emirates-id-utils";
import { extractPassportNumberFromText } from "@/lib/passport-extraction";
import { extractEmiratesIdWithAI, getDisplayName } from "@/lib/ai-emirates-extraction";
import { processImageFile } from "@/utils/imageProcessing";
import type { UserIdentityDocument } from "@/types/will-form";

interface UserDocumentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

type DocumentType = 'passport' | 'visa' | 'emirates_id';

interface DocumentState {
  document?: UserIdentityDocument;
  previewUrl?: string;
  uploading: boolean;
}

export function UserDocumentManagementModal({
  isOpen,
  onClose,
  userId,
  userName,
}: UserDocumentManagementModalProps) {
  const { t } = useTranslation(['admin', 'form', 'toast']);
  const { user } = useAuth();
  const { locale } = useLanguage();
  const {
    uploading,
    uploadUserIdentityDocument,
    getUserDocuments,
    deleteUserDocument,
    getSignedUrl,
  } = useFileUpload();

  const [documents, setDocuments] = useState<Record<DocumentType, DocumentState>>({
    passport: { uploading: false },
    visa: { uploading: false },
    emirates_id: { uploading: false },
  });

  const [passportNumber, setPassportNumber] = useState("");
  const [emiratesIdNumber, setEmiratesIdNumber] = useState("");
  const [extractedName, setExtractedName] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [docTypeToDelete, setDocTypeToDelete] = useState<DocumentType | null>(null);

  // OCR worker (reuse across extractions)
  const ocrWorkerRef = useRef<any>(null);

  // Initialize Tesseract worker
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

  // Load user documents
  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen, userId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const userDocs = await getUserDocuments(userId);

      const newDocState: Record<DocumentType, DocumentState> = {
        passport: { uploading: false },
        visa: { uploading: false },
        emirates_id: { uploading: false },
      };

      // Process each document
      for (const doc of userDocs) {
        const previewUrl = await getSignedUrl(doc.document_path);
        newDocState[doc.document_type] = {
          document: doc,
          previewUrl: previewUrl || undefined,
          uploading: false,
        };

        // Set extracted numbers and name
        if (doc.document_type === 'passport' && doc.passport_number) {
          setPassportNumber(doc.passport_number);
        }
        if (doc.document_type === 'emirates_id') {
          if (doc.emirates_id_number) {
            setEmiratesIdNumber(doc.emirates_id_number);
          }
          if ((doc as any).extracted_name) {
            setExtractedName((doc as any).extracted_name);
          }
        }
      }

      setDocuments(newDocState);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        variant: 'destructive',
        title: t('toast:error'),
        description: t('admin:errorLoadingDocuments'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, docType: DocumentType) => {
    if (!user?.id) return;

    try {
      // Clear old extracted data when uploading new document
      if (docType === 'emirates_id') {
        setEmiratesIdNumber('');
        setExtractedName('');
      }
      if (docType === 'passport') {
        setPassportNumber('');
      }

      // Set uploading state
      setDocuments(prev => ({
        ...prev,
        [docType]: { ...prev[docType], uploading: true },
      }));

      // Process image if it's an image file
      let processedFile = file;
      if (file.type.startsWith('image/')) {
        try {
          const { file: optimized } = await processImageFile(file);
          processedFile = optimized;
        } catch (error: any) {
          console.warn('Image processing failed, using original:', error);
        }
      }

      // Upload file
      const uploadResult = await uploadUserIdentityDocument(processedFile, userId, docType);

      if (!uploadResult) {
        throw new Error('Upload failed');
      }

      // Save to database
      const { data: savedDoc, error: dbError } = await supabase
        .from('user_identity_documents' as any)
        .upsert({
          user_id: userId,
          document_type: docType,
          document_path: uploadResult.path,
          document_name: uploadResult.name,
          document_size: uploadResult.size,
          document_mime: uploadResult.mime,
          uploaded_by_admin_id: user.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,document_type',
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Also add to user's active will upload_files array for admin visibility
      try {
        const { data: activeWill } = await supabase
          .from('wills')
          .select('id, upload_files')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (activeWill) {
          const currentFiles = (activeWill.upload_files as any[]) || [];
          const existingIndex = currentFiles.findIndex((f: any) => f.type === docType);

          const fileMetadata = {
            type: docType,
            path: uploadResult.path,
            name: uploadResult.name,
            size: uploadResult.size,
            mime: uploadResult.mime,
            uploaded_at: new Date().toISOString(),
          };

          let updatedFiles;
          if (existingIndex >= 0) {
            updatedFiles = [...currentFiles];
            updatedFiles[existingIndex] = fileMetadata;
          } else {
            updatedFiles = [...currentFiles, fileMetadata];
          }

          await supabase
            .from('wills')
            .update({ upload_files: updatedFiles })
            .eq('id', activeWill.id);
        }
      } catch (willError: any) {
        console.warn('Failed to update will upload_files:', willError);
        // Don't fail the entire upload if this fails
      }

      // Get preview URL
      const previewUrl = await getSignedUrl(uploadResult.path);

      // Update state
      setDocuments(prev => ({
        ...prev,
        [docType]: {
          document: savedDoc,
          previewUrl: previewUrl || undefined,
          uploading: false,
        },
      }));

      toast({
        title: t('toast:success'),
        description: t('admin:documentUploadedSuccessfully'),
        className: 'bg-[hsl(var(--jw-primary-green))] text-white',
      });

      // Extract data if applicable
      if (file.type.startsWith('image/') && savedDoc) {
        const docId = (savedDoc as any).id;
        if (docType === 'passport') {
          extractPassportNumber(processedFile, docId);
        } else if (docType === 'emirates_id') {
          extractEmiratesId(processedFile, docId);
        }
      }
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast({
        variant: 'destructive',
        title: t('toast:error'),
        description: error.message || t('admin:uploadFailed'),
      });
      setDocuments(prev => ({
        ...prev,
        [docType]: { ...prev[docType], uploading: false },
      }));
    }
  };

  const extractPassportNumber = async (file: File, documentId: string) => {
    try {
      toast({
        title: t('form:extractingPassportNumber'),
        description: t('form:extractingPassportDescription'),
      });

      const worker: any = ocrWorkerRef.current || (await createWorker("eng"));
      const { data: { text } } = await worker.recognize(file);

      console.log('Passport OCR text:', text);

      // Use the same extraction logic from StepIdentityUpload
      const extracted = extractPassportNumberFromText(text);

      if (extracted) {
        setPassportNumber(extracted);

        // Update database
        await supabase
          .from('user_identity_documents' as any)
          .update({ passport_number: extracted })
          .eq('id', documentId);

        toast({
          title: t('form:passportNumberExtracted'),
          description: t('form:passportNumberDetected', { number: extracted }),
          className: 'bg-[hsl(var(--jw-primary-green))] text-white',
        });
      } else {
        toast({
          title: t('form:couldNotExtract'),
          description: t('form:enterPassportManually'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Passport OCR error:', error);
    }
  };

  const extractEmiratesId = async (file: File, documentId: string) => {
    try {
      toast({
        title: t('admin:extractingEmiratesId'),
        description: t('admin:extractingEmiratesIdDescription'),
      });

      // Try AI extraction first (no OCR yet)
      console.log('🤖 Admin: Attempting AI-based Emirates ID extraction...');

      // Use AI extraction - it will handle OCR fallback internally if needed
      const result = await extractEmiratesIdWithAI(file);

      console.log('📊 Admin Extraction result:', result);

      const extractedId = result.emiratesId;
      // Use admin's language preference to determine which name to display
      const extractedName = getDisplayName(result, locale);

      if (extractedId) {
        setEmiratesIdNumber(extractedId);

        // Update database with ID and name (if extracted)
        const updateData: any = { emirates_id_number: extractedId };
        if (extractedName) {
          updateData.extracted_name = extractedName;
          setExtractedName(extractedName);

          // Also store Arabic and English names separately if available
          if (result.arabicName) {
            updateData.arabic_name = result.arabicName;
          }
          if (result.englishName) {
            updateData.english_name = result.englishName;
          }
        }

        await supabase
          .from('user_identity_documents' as any)
          .update(updateData)
          .eq('id', documentId);

        const description = extractedName
          ? t('admin:emiratesIdAndNameDetected', { number: extractedId, name: extractedName, defaultValue: `ID: ${extractedId}, Name: ${extractedName}` })
          : t('admin:emiratesIdDetected', { number: extractedId });

        toast({
          title: t('admin:emiratesIdExtracted'),
          description,
          className: 'bg-[hsl(var(--jw-primary-green))] text-white',
        });
      } else {
        toast({
          title: t('admin:couldNotExtractEmiratesId'),
          description: t('admin:enterEmiratesIdManually'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Emirates ID extraction error:', error);
      toast({
        title: t('admin:extractionFailed'),
        description: t('admin:extractionError'),
        variant: 'destructive',
      });
    }
  };


  const handleDelete = async (docType: DocumentType) => {
    const doc = documents[docType].document;
    if (!doc) return;

    setDocTypeToDelete(docType);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!docTypeToDelete) return;

    const doc = documents[docTypeToDelete].document;
    if (!doc) return;

    const success = await deleteUserDocument(doc.id, doc.document_path);
    if (success) {
      setDocuments(prev => ({
        ...prev,
        [docTypeToDelete]: { uploading: false },
      }));

      // Clear related state when deleting documents
      if (docTypeToDelete === 'passport') {
        setPassportNumber('');
      }
      if (docTypeToDelete === 'emirates_id') {
        setEmiratesIdNumber('');
        setExtractedName(''); // Clear extracted name
      }

      toast({
        title: t('toast:success'),
        description: t('admin:documentDeleted'),
      });
    }

    setDeleteConfirmOpen(false);
    setDocTypeToDelete(null);
  };

  const handleSaveNumber = async (docType: 'passport' | 'emirates_id', value: string) => {
    const doc = documents[docType].document;
    if (!doc) return;

    try {
      const field = docType === 'passport' ? 'passport_number' : 'emirates_id_number';

      // PostgREST returns { error } rather than throwing, so without this check
      // a rejected write still showed the green "saved" toast and the edit was
      // silently lost.
      const { error } = await supabase
        .from('user_identity_documents' as any)
        .update({ [field]: value })
        .eq('id', doc.id);

      if (error) throw error;

      toast({
        title: t('toast:success'),
        description: t('admin:numberSaved'),
      });
    } catch (error) {
      console.error('Error saving number:', error);
      toast({
        variant: 'destructive',
        title: t('toast:error'),
        description: t('admin:failedToSaveNumber'),
      });
    }
  };

  const handleSaveName = async (name: string) => {
    const doc = documents.emirates_id.document;
    if (!doc) return;

    try {
      // See handleSaveNumber — an unchecked error here silently discarded the edit.
      const { error } = await supabase
        .from('user_identity_documents' as any)
        .update({ extracted_name: name })
        .eq('id', doc.id);

      if (error) throw error;

      toast({
        title: t('toast:success'),
        description: t('admin:nameSaved', { defaultValue: 'Name saved successfully' }),
      });
    } catch (error) {
      console.error('Error saving name:', error);
      toast({
        variant: 'destructive',
        title: t('toast:error'),
        description: t('admin:failedToSaveName', { defaultValue: 'Failed to save name' }),
      });
    }
  };

  const DocumentUploadSection = ({ docType, label }: { docType: DocumentType; label: string }) => {
    const docState = documents[docType];
    const hasDocument = !!docState.document;

    return (
      <div className="space-y-3">
        <Label className="text-[15px] font-semibold text-[#121212]">{label}</Label>

        {docState.uploading ? (
          <div className="border-2 border-dashed border-[#C6A03B] rounded-lg p-6 bg-white">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[#C6A03B]" />
              <span className="text-sm text-[#6B6B6B]">{t('form:uploading')}...</span>
            </div>
          </div>
        ) : !hasDocument ? (
          <div className="border-2 border-dashed border-[#C6A03B] rounded-lg p-6 bg-white hover:border-[#0C5536] transition-colors">
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-8 w-8 text-[#C6A03B]" />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*,.pdf';
                  input.onchange = (e: any) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, docType);
                  };
                  input.click();
                }}
                className="border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.08)]"
              >
                {t('form:chooseFile')}
              </Button>
              <p className="text-xs text-[#6B6B6B] text-center">{t('form:acceptedFormats')}</p>
            </div>
          </div>
        ) : (
          <div className="border-2 border-solid border-[#0C5536] rounded-lg p-4 bg-[#F8F8F6]">
            <div className="flex items-start gap-4">
              {docState.previewUrl && docState.document?.document_mime.startsWith('image/') ? (
                <img
                  src={docState.previewUrl}
                  alt={label}
                  className="w-24 h-24 object-cover rounded border border-[#E6E6E4]"
                />
              ) : (
                <div className="w-24 h-24 flex items-center justify-center bg-white rounded border border-[#E6E6E4]">
                  <FileText className="h-10 w-10 text-[#C6A03B]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#121212] truncate mb-2">
                  {docState.document?.document_name}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {docState.previewUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(docState.previewUrl, '_blank')}
                      className="border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.08)]"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      {t('admin:view')}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*,.pdf';
                      input.onchange = (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, docType);
                      };
                      input.click();
                    }}
                    className="border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.08)]"
                  >
                    {t('form:replaceFile')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(docType)}
                    className="border-destructive text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4 mr-1" />
                    {t('form:remove')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#0C5536]">
            {t('admin:manageDocuments')}
          </DialogTitle>
          <DialogDescription className="text-sm text-[#777777]">
            {t('admin:manageDocumentsFor')} <span className="font-medium">{userName}</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#C6A03B]" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Passport */}
            <DocumentUploadSection docType="passport" label={t('admin:passportDoc')} />

            {documents.passport.document && (
              <div className="space-y-2 pl-4">
                <Label className="text-sm text-[#6B6B6B]">{t('form:passportNumberLabel')}</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value.toUpperCase())}
                    placeholder={t('form:passportNumberPlaceholder')}
                    className="flex-1 font-mono"
                  />
                  <Button
                    type="button"
                    onClick={() => handleSaveNumber('passport', passportNumber)}
                    disabled={!passportNumber}
                    className="bg-[#0C5536] hover:bg-[#0C5536]/90"
                  >
                    {t('admin:save')}
                  </Button>
                </div>
              </div>
            )}

            {/* Emirates ID */}
            <DocumentUploadSection docType="emirates_id" label={t('admin:emiratesIdDoc')} />

            {documents.emirates_id.document && (
              <div className="space-y-4 pl-4">
                <div className="space-y-2">
                  <Label className="text-sm text-[#6B6B6B]">{t('admin:emiratesIdNumber')}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={emiratesIdNumber}
                      onChange={(e) => setEmiratesIdNumber(e.target.value)}
                      placeholder="784-YYYY-XXXXXXX-X"
                      className="flex-1 font-mono"
                    />
                    <Button
                      type="button"
                      onClick={() => handleSaveNumber('emirates_id', emiratesIdNumber)}
                      disabled={!emiratesIdNumber}
                      className="bg-[#0C5536] hover:bg-[#0C5536]/90"
                    >
                      {t('admin:save')}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#6B6B6B]">{t('admin:extractedName')}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={extractedName}
                      onChange={(e) => setExtractedName(e.target.value)}
                      placeholder={t('admin:enterNameManually', { defaultValue: 'Enter name manually' })}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={() => handleSaveName(extractedName)}
                      disabled={!extractedName}
                      className="bg-[#0C5536] hover:bg-[#0C5536]/90"
                    >
                      {t('admin:save')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Visa */}
            <DocumentUploadSection docType="visa" label={t('admin:visaDoc')} />

            <div className="flex items-start gap-2 text-xs text-[#777777] bg-[#F8F8F6] p-3 rounded-md border border-[#E6E6E4]">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#C6A03B]" />
              <span>{t('admin:documentsSecureMessage')}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.08)]"
          >
            {t('admin:close')}
          </Button>
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin:confirmDeleteDocument')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin:confirmDeleteDocumentDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel onClick={() => setDeleteConfirmOpen(false)}>
              {t('admin:cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('admin:delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
