"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Lock, FileText, FolderOpen, Briefcase, Upload, Paperclip, X, Mail, Loader2, Clock } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { toast } from "sonner";

const supportSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(100),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000)
});

type SupportFormData = z.infer<typeof supportSchema>;

export default function ClientSupport() {
  const { profile } = useAuth();
  const { t } = useTranslation(['portal', 'common']);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<SupportFormData>({
    resolver: zodResolver(supportSchema),
    defaultValues: {
      name: profile?.full_name || "",
      email: "",
      subject: "",
      message: ""
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setFileError(t('portal:errorFileTooLarge'));
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ];

    if (!allowedTypes.includes(file.type)) {
      setFileError(t('portal:errorInvalidFileType'));
      return;
    }

    setSelectedFile(file);
    setFileError(null);
  };

  const onSubmit = async (data: SupportFormData) => {
    try {
      let attachmentData = null;
      if (selectedFile) {
        const fileBuffer = await selectedFile.arrayBuffer();
        const base64Content = btoa(
          new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        attachmentData = {
          content: base64Content,
          filename: selectedFile.name,
          contentType: selectedFile.type,
        };
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-support-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          subject: data.subject,
          message: data.message,
          attachment: attachmentData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error sending support email:', errorData);
        toast.error('Failed to send support request. Please try again.');
        return;
      }

      setIsSubmitted(true);
      reset();
      setSelectedFile(null);
      setFileError(null);

      setTimeout(() => setIsSubmitted(false), 5000);

    } catch (error) {
      console.error('Error submitting support request:', error);
      toast.error('An unexpected error occurred. Please try again.');
    }
  };

  if (isSubmitted) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title={t('portal:supportPageTitle')}
          subtitle={t('portal:supportPageSubtitle')}
        />

        <Card className="bg-white rounded-[10px] border border-[#E6E6E4] shadow-[0_4px_12px_rgba(12,85,54,0.1)]">
          <CardContent className="pt-16 pb-16">
            <div className="flex flex-col items-center text-center space-y-6 max-w-lg mx-auto">
              <div className="relative">
                <div className="w-[80px] h-[80px] rounded-full bg-[rgba(12,85,54,0.1)] flex items-center justify-center animate-scale-in">
                  <CheckCircle2 className="w-10 h-10 text-[#0C5536]" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-[#0C5536] opacity-20 animate-ping" />
              </div>

              <h2 className="text-[1.25rem] font-semibold text-[#0C5536]">
                {t('portal:successHeader')}
              </h2>

              <p className="text-[15px] text-[#333333] leading-[1.6]">
                {t('portal:successSubtitle')}
              </p>

              <div className="flex items-center gap-2 px-4 py-2.5 bg-[rgba(12,85,54,0.05)] rounded-lg border border-[#E6E6E4]">
                <Mail className="h-4 w-4 text-[#0C5536]" />
                <span className="text-[13px] text-[#555555]">
                  {t('portal:checkEmailResponse')}
                </span>
              </div>

              <Button
                onClick={() => setIsSubmitted(false)}
                className="mt-4 bg-[#0C5536] hover:bg-[#11714A] text-white rounded-md px-8 py-3 h-auto shadow-[0_0_6px_rgba(198,160,59,0.3)] hover:shadow-[0_0_8px_rgba(198,160,59,0.45)] transition-all font-semibold text-[15px]"
              >
                {t('portal:sendAnotherMessage')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('portal:supportPageTitle')}
        subtitle={t('portal:supportPageSubtitle')}
      >
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-[rgba(198,160,59,0.08)] rounded-full border border-[rgba(198,160,59,0.2)]">
          <Clock className="h-3.5 w-3.5 text-[#C6A03B]" />
          <span className="text-[0.8rem] text-[#C6A03B] font-semibold">
            {t('portal:typicalResponseTime')}
          </span>
        </div>
      </PageHeader>

      {/* Contact Options Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Card className="bg-white border border-[#E6E6E4] rounded-[10px] shadow-[0_1px_4px_rgba(12,85,54,0.05)] hover:bg-[rgba(12,85,54,0.05)] transition-colors cursor-pointer p-5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-[rgba(198,160,59,0.15)] to-[rgba(198,160,59,0.05)] flex items-center justify-center border border-[rgba(198,160,59,0.2)]">
              <FileText className="h-5 w-5 text-[#0C5536]" />
            </div>
            <div className="flex-1">
              <h3 className="text-[1rem] font-semibold text-[#0C5536] mb-1">
                {t('portal:willEnquiries')}
              </h3>
              <p className="text-[13px] text-[#555555] leading-relaxed">
                {t('portal:willEnquiriesDesc')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-white border border-[#E6E6E4] rounded-[10px] shadow-[0_1px_4px_rgba(12,85,54,0.05)] hover:bg-[rgba(12,85,54,0.05)] transition-colors cursor-pointer p-5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-[rgba(198,160,59,0.15)] to-[rgba(198,160,59,0.05)] flex items-center justify-center border border-[rgba(198,160,59,0.2)]">
              <FolderOpen className="h-5 w-5 text-[#0C5536]" />
            </div>
            <div className="flex-1">
              <h3 className="text-[1rem] font-semibold text-[#0C5536] mb-1">
                {t('portal:documentUploads')}
              </h3>
              <p className="text-[13px] text-[#555555] leading-relaxed">
                {t('portal:documentUploadsDesc')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-white border border-[#E6E6E4] rounded-[10px] shadow-[0_1px_4px_rgba(12,85,54,0.05)] hover:bg-[rgba(12,85,54,0.05)] transition-colors cursor-pointer p-5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-[rgba(198,160,59,0.15)] to-[rgba(198,160,59,0.05)] flex items-center justify-center border border-[rgba(198,160,59,0.2)]">
              <Briefcase className="h-5 w-5 text-[#0C5536]" />
            </div>
            <div className="flex-1">
              <h3 className="text-[1rem] font-semibold text-[#0C5536] mb-1">
                {t('portal:estatePlanningAdvice')}
              </h3>
              <p className="text-[13px] text-[#555555] leading-relaxed">
                {t('portal:estatePlanningAdviceDesc')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Support Form Card */}
      <Card className="bg-white rounded-lg border border-[#E6E6E4] shadow-[0_1px_4px_rgba(12,85,54,0.05)]">
        <CardContent className="pt-12 pb-12 px-8">
          <div className="mb-6">
            <h2 className="text-[1.25rem] font-semibold text-[#0C5536] mb-2">
              {t('portal:sendMessageTitle')}
            </h2>
            <p className="text-[0.95rem] text-[#5C5C5C]">
              {t('portal:sendMessageSubtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[13px] font-medium text-[#333333]">
                {t('portal:fullName')} *
              </Label>
              <Input
                id="name"
                {...register("name")}
                className="h-10 border-[#E6E6E4] focus:border-[#0C5536] focus:ring-[#0C5536] rounded-md"
                placeholder={t('portal:fullNamePlaceholder')}
              />
              {errors.name && (
                <p className="text-[12px] text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px] font-medium text-[#333333]">
                {t('portal:emailAddress')} *
              </Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                className="h-10 border-[#E6E6E4] focus:border-[#0C5536] focus:ring-[#0C5536] rounded-md"
                placeholder={t('portal:emailPlaceholder')}
              />
              {errors.email && (
                <p className="text-[12px] text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject" className="text-[13px] font-medium text-[#333333]">
                {t('portal:subjectLabel')} *
              </Label>
              <Input
                id="subject"
                {...register("subject")}
                className="h-10 border-[#E6E6E4] focus:border-[#0C5536] focus:ring-[#0C5536] rounded-md"
                placeholder={t('portal:subjectPlaceholder')}
              />
              {errors.subject && (
                <p className="text-[12px] text-destructive">{errors.subject.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="message" className="text-[13px] font-medium text-[#333333]">
                {t('portal:messageLabel')} *
              </Label>
              <Textarea
                id="message"
                {...register("message")}
                rows={6}
                className="border-[#E6E6E4] focus:border-[#0C5536] focus:ring-[#0C5536] rounded-md resize-none"
                placeholder={t('portal:messagePlaceholder')}
              />
              {errors.message && (
                <p className="text-[12px] text-destructive">{errors.message.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="attachment" className="text-[13px] font-medium text-[#333333]">
                {t('portal:attachmentLabel')}
              </Label>

              <div className="border-2 border-dashed border-[#C6A03B] rounded-md bg-[rgba(198,160,59,0.04)] p-6 text-center transition-colors hover:bg-[rgba(198,160,59,0.08)]">
                <input
                  type="file"
                  accept=".pdf,.docx,.jpg,.jpeg,.png"
                  className="hidden"
                  id="file-upload"
                  onChange={handleFileChange}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-5 h-5 text-[#C6A03B] mx-auto mb-2" />
                  <p className="text-[13px] text-[#333333]">
                    <span className="font-semibold text-[#C6A03B]">{t('portal:chooseFile')}</span> {t('portal:dragAndDrop')}
                  </p>
                  <p className="text-[11px] text-[#6B6B6B] mt-1">
                    {t('portal:fileTypes')}
                  </p>
                </label>
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between px-3 py-2 bg-[rgba(198,160,59,0.06)] rounded-md border border-[rgba(198,160,59,0.2)]">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-[#C6A03B]" />
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

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  setSelectedFile(null);
                  setFileError(null);
                }}
                className="flex-1 bg-white border border-[#E6E6E4] text-[#333333] hover:bg-[rgba(12,85,54,0.05)] rounded-md px-6 py-3 h-auto font-medium text-[15px]"
              >
                {t('portal:clearForm')}
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-[#0C5536] hover:bg-[#11714A] text-white rounded-md px-6 py-3 h-auto font-semibold text-[15px] shadow-[0_0_6px_rgba(198,160,59,0.3)] hover:shadow-[0_0_8px_rgba(198,160,59,0.45)] transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('portal:sending')}
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    {t('portal:sendMessage')}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Security Footer */}
      <div className="mt-10 pt-8 border-t border-[#E6E6E4]">
        <div className="max-w-2xl mx-auto bg-[rgba(12,85,54,0.02)] border border-[#E6E6E4] rounded-[8px] p-6">
          <div className="flex items-start gap-3 justify-center">
            <Lock className="h-5 w-5 text-[#C6A03B] flex-shrink-0 mt-0.5" />
            <div className="text-center">
              <p className="text-[13px] text-[#555555] leading-relaxed">
                {t('portal:securityNotice')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
