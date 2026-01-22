import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Paperclip, X, FileText, Lock, Loader2 } from "lucide-react";

const editRequestSchema = z.object({
  subject: z.string()
    .trim()
    .min(3, "Subject must be at least 3 characters")
    .max(100, "Subject must be less than 100 characters"),
  message: z.string()
    .trim()
    .min(10, "Please provide at least 10 characters")
    .max(2000, "Message must be less than 2000 characters"),
});

type EditRequestFormData = z.infer<typeof editRequestSchema>;

interface EditRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentName: string;
  documentType: "draft" | "final";
  willId: string;
}

export function EditRequestModal({
  open,
  onOpenChange,
  documentName,
  documentType,
  willId,
}: EditRequestModalProps) {
  const { t } = useTranslation(['portal', 'toast']);
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EditRequestFormData>({
    resolver: zodResolver(editRequestSchema),
  });

  // Auto-close modal after success
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        onOpenChange(false);
        setIsSuccess(false);
        reset();
        setSelectedFile(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, onOpenChange, reset]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      reset();
      setSelectedFile(null);
      setFileError(null);
      setIsSuccess(false);
    }
  }, [open, reset]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setFileError(t('errorFileTooLarge'));
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
    ];

    if (!allowedTypes.includes(file.type)) {
      setFileError(t('errorInvalidFileType'));
      return;
    }

    setSelectedFile(file);
    setFileError(null);
  };

  const onSubmit = async (data: EditRequestFormData) => {
    if (!user || !profile) {
      toast({
        variant: "destructive",
        title: t('toast:auth.authenticationRequired'),
        description: t('toast:editRequest.pleaseLogInToSubmit'),
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session found');
      }

      // Prepare attachment data if file is selected
      let attachmentData = undefined;
      if (selectedFile) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });

        attachmentData = {
          content: base64,
          filename: selectedFile.name,
          contentType: selectedFile.type,
        };
      }

      // Get user email
      const userEmail = user.email || '';
      const clientName = profile.full_name || 'Client';

      // Call Supabase Edge Function to send email
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-edit-request-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            willId,
            clientName,
            clientEmail: userEmail,
            subject: data.subject,
            message: data.message,
            documentName,
            documentType,
            attachment: attachmentData,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send edit request');
      }

      const result = await response.json();
      console.log('Edit request sent successfully:', result);

      setIsSuccess(true);
    } catch (error) {
      console.error('Error submitting edit request:', error);
      toast({
        variant: "destructive",
        title: t('toast:editRequest.failedToSendRequest'),
        description: error instanceof Error ? error.message : t('toast:editRequest.tryAgainOrContact'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[90%] overflow-auto bg-white border border-[#E6E6E4] rounded-[10px] shadow-[0_4px_24px_rgba(12,85,54,0.15)] p-8">
        {isSuccess ? (
          <div className="flex flex-col items-center text-center space-y-4 py-8">
            <div className="w-16 h-16 rounded-full bg-[rgba(12,85,54,0.1)] flex items-center justify-center animate-in zoom-in duration-300">
              <CheckCircle2 className="w-8 h-8 text-[#0C5536]" />
            </div>

            <h3 className="text-[18px] font-serif font-semibold text-[#121212]">
              {t('editRequestSent')}
            </h3>

            <p className="text-[14px] text-[#333333] leading-relaxed max-w-md">
              {t('editRequestDetail')}
            </p>
          </div>
        ) : (
          <>
            <DialogHeader className="space-y-3 mb-6">
              <DialogTitle className="text-[20px] font-serif font-semibold text-[#121212]">
                {t('requestEdits')}
              </DialogTitle>
              <DialogDescription className="text-[14px] text-[#555555] leading-relaxed">
                {t('requestEditsSubtext')}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Subject Field */}
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#333333]">
                  {t('subject')} *
                </Label>
                <Input
                  {...register('subject')}
                  placeholder={t('subjectPlaceholder')}
                  className="h-10 border-[#E6E6E4] focus:border-[#0C5536] focus:ring-2 focus:ring-[rgba(12,85,54,0.2)] rounded-md"
                />
                {errors.subject && (
                  <p className="text-[12px] text-destructive">{errors.subject.message}</p>
                )}
              </div>

              {/* Message Field */}
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#333333]">
                  {t('yourMessage')} *
                </Label>
                <Textarea
                  {...register('message')}
                  rows={5}
                  placeholder={t('messagePlaceholder')}
                  className="border-[#E6E6E4] focus:border-[#0C5536] focus:ring-2 focus:ring-[rgba(12,85,54,0.2)] rounded-md resize-none"
                />
                {errors.message && (
                  <p className="text-[12px] text-destructive">{errors.message.message}</p>
                )}
              </div>

              {/* Document Reference Badge */}
              <div className="flex items-center gap-2 px-3 py-2 bg-[rgba(12,85,54,0.05)] rounded-md border border-[#E6E6E4]">
                <FileText className="h-4 w-4 text-[#0C5536] flex-shrink-0" />
                <span className="text-[12px] text-[#555555]">
                  {t('regarding')}: <span className="font-semibold text-[#333333]">{documentName}</span>
                </span>
              </div>

              {/* File Upload Zone */}
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#333333]">
                  {t('attachFile')}
                </Label>
                <div className="border-2 border-dashed border-[#0C5536] rounded-md bg-[rgba(12,85,54,0.03)] p-6 text-center transition-colors hover:bg-[rgba(12,85,54,0.06)]">
                  <input
                    type="file"
                    accept=".pdf,.docx,.jpg,.jpeg,.png"
                    className="hidden"
                    id="file-upload"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Paperclip className="w-5 h-5 text-[#0C5536] mx-auto mb-2" />
                    <p className="text-[13px] text-[#333333]">
                      <span className="font-semibold text-[#0C5536]">{t('chooseFile')}</span> {t('dragAndDrop')}
                    </p>
                    <p className="text-[11px] text-[#6B6B6B] mt-1">
                      {t('fileTypes')}
                    </p>
                  </label>
                </div>

                {/* Selected File Display */}
                {selectedFile && (
                  <div className="flex items-center justify-between px-3 py-2 bg-[rgba(12,85,54,0.05)] rounded-md border border-[#E6E6E4]">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-[#0C5536]" />
                      <span className="text-[13px] text-[#333333] font-medium">{selectedFile.name}</span>
                      <span className="text-[11px] text-[#6B6B6B]">
                        ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setFileError(null);
                      }}
                      className="text-[#6B6B6B] hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {fileError && (
                  <p className="text-[12px] text-destructive">{fileError}</p>
                )}
              </div>

              {/* Security Disclaimer */}
              <div className="flex items-start gap-2 px-4 py-3 bg-[rgba(12,85,54,0.03)] rounded-md border border-[#E6E6E4] mt-4">
                <Lock className="h-3.5 w-3.5 text-[#6B6B6B] flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#6B6B6B] leading-relaxed">
                  {t('secureTransmission')}
                </p>
              </div>

              {/* Footer Buttons */}
              <DialogFooter className="flex gap-3 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  className="flex-1 bg-white border border-[#E6E6E4] text-[#333333] hover:bg-[rgba(12,85,54,0.05)] rounded-md px-5 py-3 h-auto font-medium text-[14px]"
                >
                  {t('common:cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[#0C5536] hover:bg-[#11714A] text-white rounded-md px-5 py-3 h-auto font-semibold text-[14px] shadow-[0_0_6px_rgba(198,160,59,0.3)] hover:shadow-[0_0_8px_rgba(198,160,59,0.45)] transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('sending')}
                    </>
                  ) : (
                    t('sendToLegalTeam')
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
