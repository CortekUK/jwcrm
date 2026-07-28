"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Eye, Loader2, Clock, Shield, Lock, ArrowLeft, ArrowRight, ThumbsUp, ThumbsDown, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusTimeline } from "@/components/StatusTimeline";
import { StatusBadge } from "@/components/StatusBadge";
import { EditRequestModal } from "@/components/EditRequestModal";
import { SignaturePad } from "@/components/ui/SignaturePad";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { textAlign } from "@/lib/rtl-utils";

interface Will {
  id: string;
  status: Database["public"]["Enums"]["will_status"];
  pdf_path: string | null;
  pdf_generated_at: string | null;
  submitted_at: string | null;
  created_at: string;
  visible_to_client?: boolean;
  updated_at: string;
  client_approval_status?: "approved" | "disapproved" | null;
  client_approval_at?: string | null;
  client_approval_comments?: string | null;
  // Signature on the FINALISED will — distinct from the intake signature
  // stored in answers.family_exclusion.signature.
  client_signature?: string | null;
  client_signature_at?: string | null;
  // Signed COPY of the finalised will. pdf_path keeps the original.
  signed_pdf_path?: string | null;
}

export default function ClientDocumentDetail() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const { t } = useTranslation('portal');
  const { locale } = useLanguage();
  const isRtl = locale === 'ar';
  const [will, setWill] = useState<Will | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showDisapprovalDialog, setShowDisapprovalDialog] = useState(false);
  const [approvalComments, setApprovalComments] = useState("");
  const [disapprovalSubject, setDisapprovalSubject] = useState("");
  const [disapprovalMessage, setDisapprovalMessage] = useState("");
  const [disapprovalImage, setDisapprovalImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  // Drawn but not yet submitted — the client must confirm before it is saved.
  const [pendingSignature, setPendingSignature] = useState<string>("");
  const [submittingSignature, setSubmittingSignature] = useState(false);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchWill = async () => {
      if (!user || !id) return;

      try {
        const { data, error } = await supabase
          .from('wills')
          .select('id, status, pdf_path, pdf_generated_at, submitted_at, created_at, updated_at, visible_to_client, client_approval_status, client_approval_at, client_approval_comments, client_signature, client_signature_at, signed_pdf_path')
          .eq('id', id)
          .eq('user_id', user.id)
          .not('submitted_at', 'is', null)
          .single();

        if (error) throw error;

        setWill(data);

        if (data?.client_approval_comments) {
          setApprovalComments(data.client_approval_comments);
        }

        if (data?.pdf_path && data?.visible_to_client) {
          const { data: urlData } = await supabase.storage
            .from('wills')
            .createSignedUrl(data.pdf_path, 600);

          if (urlData?.signedUrl) {
            setPdfUrl(urlData.signedUrl);
          }
        }

        // The signed copy is a separate file, so it needs its own URL.
        if (data?.signed_pdf_path && data?.visible_to_client) {
          const { data: signedUrlData } = await supabase.storage
            .from('wills')
            .createSignedUrl(data.signed_pdf_path, 600);

          if (signedUrlData?.signedUrl) {
            setSignedPdfUrl(signedUrlData.signedUrl);
          }
        }
      } catch (error) {
        console.error('Error fetching will:', error);
        toast({
          variant: "destructive",
          title: t('toast:error'),
          description: t('toast:documents.errorLoadingDocuments'),
        });
        router.push('/client/documents');
      } finally {
        setLoading(false);
      }
    };

    fetchWill();
  }, [user, id, router, t]);

  const handleDownload = async () => {
    if (!pdfUrl) return;

    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `will-draft-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        variant: "destructive",
        title: t('toast:documents.downloadFailed'),
        description: t('toast:documents.downloadError'),
      });
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setImageError("File size must be less than 10MB");
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setImageError("Only image files (JPG, PNG, GIF, WebP) are allowed");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setDisapprovalImage(file);
    setImagePreview(previewUrl);
    setImageError(null);
  };

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Sign the finalised will. Writes to its own columns so the intake
  // signature (answers.family_exclusion.signature) is never touched.
  const handleSignDocument = async () => {
    if (!id || !user || !pendingSignature) return;

    setSubmittingSignature(true);
    try {
      // Handled server-side: it appends the execution page to a COPY of the
      // finalised PDF, so the original document is never modified.
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/wills/${id}/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ signature: pendingSignature }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Could not save your signature");
      }

      setWill((prev) =>
        prev
          ? {
              ...prev,
              client_signature: pendingSignature,
              client_signature_at: result.signedAt,
              signed_pdf_path: result.signedPdfPath,
            }
          : prev
      );

      // Fetch a URL for the newly created signed copy so it appears at once.
      if (result?.signedPdfPath) {
        const { data: signedUrlData } = await supabase.storage
          .from('wills')
          .createSignedUrl(result.signedPdfPath, 600);
        if (signedUrlData?.signedUrl) setSignedPdfUrl(signedUrlData.signedUrl);
      }

      setPendingSignature("");
      toast({
        title: t('documentDetail.signature.signedTitle', 'Document signed'),
        description: t('documentDetail.signature.signedDescription', 'Your signature has been recorded on your will.'),
      });
    } catch (error) {
      console.error("Error signing document:", error);
      toast({
        variant: "destructive",
        title: t('documentDetail.signature.failedTitle', 'Could not save signature'),
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSubmittingSignature(false);
    }
  };

  const handleApproval = async (status: "approved" | "disapproved") => {
    if (!id || !user) return;

    setSubmittingApproval(true);
    try {
      const updateData: any = {
        client_approval_status: status,
        client_approval_at: new Date().toISOString(),
      };

      if (status === "approved") {
        updateData.client_approval_comments = approvalComments || null;
        updateData.client_approval_subject = null;
        updateData.client_approval_message = null;
        updateData.client_approval_image_path = null;
      } else {
        updateData.client_approval_subject = disapprovalSubject;
        updateData.client_approval_message = disapprovalMessage;

        if (disapprovalImage) {
          const fileExt = disapprovalImage.name.split('.').pop();
          const fileName = `${id}_${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('change-requests')
            .upload(fileName, disapprovalImage);

          if (uploadError) throw uploadError;

          updateData.client_approval_image_path = fileName;
        } else {
          updateData.client_approval_image_path = null;
        }
      }

      const { error } = await supabase
        .from('wills')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setWill(prev => prev ? {
        ...prev,
        ...updateData,
      } : null);

      toast({
        title: t('toast:success'),
        description: status === "approved"
          ? t('toast:documents.approvalSuccess')
          : t('toast:documents.disapprovalSuccess'),
        className: "bg-[#0C5536] text-white",
      });

      if (status === "approved") {
        setShowApprovalDialog(false);
        setApprovalComments("");
      } else {
        setShowDisapprovalDialog(false);
        setDisapprovalSubject("");
        setDisapprovalMessage("");
        setDisapprovalImage(null);
        setImagePreview(null);
        setImageError(null);
      }
    } catch (error: any) {
      console.error('Error submitting approval:', error);
      toast({
        variant: "destructive",
        title: t('toast:error'),
        description: t('toast:documents.approvalError'),
      });
    } finally {
      setSubmittingApproval(false);
    }
  };

  const getDocumentType = (status: Database["public"]["Enums"]["will_status"]) => {
    if (status === "finalized") {
      return {
        type: "final" as const,
        badge: { label: t('documentDetail.finalBadge'), bgColor: "bg-[rgba(198,160,59,0.1)]", textColor: "text-[#C6A03B]" },
        icon: { color: "text-[#C6A03B]", bg: "bg-[rgba(198,160,59,0.1)]" },
        statusText: t('documentDetail.finalStatusText'),
      };
    }
    return {
      type: "draft" as const,
      badge: { label: t('documentDetail.draftBadge'), bgColor: "bg-[rgba(12,85,54,0.08)]", textColor: "text-[#0C5536]" },
      icon: { color: "text-[#0C5536]", bg: "bg-[rgba(12,85,54,0.08)]" },
      statusText: t('documentDetail.draftStatusText'),
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!will) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('documentDetail.notFound')} subtitle={t('documentDetail.notFoundSubtitle')} />
        <Card>
          <CardContent className="pt-6">
            <Link href="/client/documents">
              <Button>
                {isRtl ? (
                  <ArrowRight className="ml-2 h-4 w-4" />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" />
                )}
                {t('documentDetail.backToDocuments')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // State 2a: In Progress (submitted but status not updated by admin yet)
  if (will.status === 'in_progress' && will.submitted_at) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/client/documents')}>
            {isRtl ? <ArrowRight className="ml-2 h-4 w-4" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
            {t('documentDetail.back')}
          </Button>
        </div>

        <PageHeader title={t('documentDetail.myDocument')} subtitle={t('documentDetail.willSubmitted')} />

        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-[rgba(198,160,59,0.02)] shadow-sm">
          <CardContent className="pt-12 pb-12">
            <div className={`flex flex-col items-center text-center space-y-6 ${textAlign(isRtl)}`}>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10 border border-[rgba(198,160,59,0.2)]">
                <Clock className="h-10 w-10 text-blue-600" />
              </div>
              <div className="space-y-3 max-w-md">
                <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold text-blue-700 bg-blue-100">
                  {t('documentDetail.inProgressStatus')}
                </div>
                <h2 className="text-[1.25rem] font-semibold text-[#0C5536]">{t('documentDetail.willInProgress')}</h2>
                <p className="text-muted-foreground">{t('documentDetail.inProgressMessage')}</p>
                <p className="text-sm text-muted-foreground/70 pt-2">
                  {t('documentDetail.submittedAt', { date: will.submitted_at && format(new Date(will.submitted_at), 'PPp') })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // State 2b: Awaiting Review
  if (will.status === 'awaiting_review') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/client/documents')}>
            {isRtl ? <ArrowRight className="ml-2 h-4 w-4" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
            {t('documentDetail.back')}
          </Button>
        </div>

        <PageHeader title={t('documentDetail.myDocument')} subtitle={t('documentDetail.awaitingReviewSubtitle')} />
        <StatusTimeline currentStatus={will.status} view="client" useClientFriendlyLabels={true} />

        <Card className="border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-[rgba(198,160,59,0.02)] shadow-sm">
          <CardContent className="pt-12 pb-12">
            <div className={`flex flex-col items-center text-center space-y-6 ${textAlign(isRtl)}`}>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500/10 border border-[rgba(198,160,59,0.2)]">
                <Clock className="h-10 w-10 text-yellow-600" />
              </div>
              <div className="space-y-3 max-w-md">
                <StatusBadge status="awaiting_review" clientFriendly={true} />
                <h2 className="text-[1.25rem] font-semibold text-[#0C5536]">{t('documentDetail.submittedForReview')}</h2>
                <p className="text-muted-foreground">{t('documentDetail.awaitingReviewMessage')}</p>
                <p className="text-sm text-muted-foreground/70 pt-2">
                  {t('documentDetail.submittedAt', { date: will.submitted_at && format(new Date(will.submitted_at), 'PPp') })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // State 3: Under Review
  if (will.status === 'under_review') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/client/documents')}>
            {isRtl ? <ArrowRight className="ml-2 h-4 w-4" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
            {t('documentDetail.back')}
          </Button>
        </div>

        <PageHeader title={t('documentDetail.myDocument')} subtitle={t('documentDetail.underReviewSubtitle')} />
        <StatusTimeline currentStatus={will.status} view="client" useClientFriendlyLabels={true} />

        <Card className="border-accent/20 bg-gradient-to-br from-accent/5 to-[rgba(198,160,59,0.02)] shadow-sm">
          <CardContent className="pt-12 pb-12">
            <div className={`flex flex-col items-center text-center space-y-6 ${textAlign(isRtl)}`}>
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 border border-[rgba(198,160,59,0.15)]">
                  <Loader2 className="h-10 w-10 text-accent animate-spin" />
                </div>
              </div>
              <div className="space-y-3 max-w-md">
                <StatusBadge status="under_review" clientFriendly={true} />
                <h2 className="text-[1.25rem] font-semibold text-[#0C5536]">{t('documentDetail.underReview')}</h2>
                <p className="text-muted-foreground">{t('documentDetail.underReviewMessage')}</p>
              </div>
              <Button variant="outline" onClick={() => window.location.reload()} className="rounded-full px-8">
                {t('documentDetail.refreshStatus')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // State 4: Draft Ready
  if (will.status === 'draft_ready') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/client/documents')}>
            {isRtl ? <ArrowRight className="ml-2 h-4 w-4" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
            {t('documentDetail.back')}
          </Button>
        </div>

        <PageHeader title={t('documentDetail.myDocument')} subtitle={t('documentDetail.draftReadySubtitle')} />
        <StatusTimeline currentStatus={will.status} view="client" useClientFriendlyLabels={true} />

        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-[rgba(198,160,59,0.02)] shadow-sm">
          <CardContent className="pt-12 pb-12">
            <div className={`flex flex-col items-center text-center space-y-6 ${textAlign(isRtl)}`}>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-500/10">
                <Shield className="h-10 w-10 text-purple-600" />
              </div>
              <div className="space-y-3 max-w-md">
                <StatusBadge status="draft_ready" clientFriendly={true} />
                <h2 className="text-[1.25rem] font-semibold text-[#0C5536]">{t('documentDetail.draftReady')}</h2>
                <p className="text-muted-foreground">{t('documentDetail.draftReadyMessage')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // State 5: Draft Released or Finalized with PDF
  if ((will.status === 'draft_released' || will.status === 'finalized') && will.visible_to_client && will.pdf_path && pdfUrl) {
    const docType = getDocumentType(will.status);
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => router.push('/client/documents')}>
            {isRtl ? <ArrowRight className="ml-2 h-4 w-4" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
            {t('documentDetail.back')}
          </Button>
        </div>

        <PageHeader title={t('documentDetail.myDocument')} subtitle={t('documentDetail.documentReady')} />

        {/* Document Card */}
        <Card className="mb-8 overflow-hidden border-[#E6E6E4] shadow-[0_1px_4px_rgba(12,85,54,0.05)] transition-shadow hover:shadow-[0_2px_6px_rgba(12,85,54,0.08)]">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-5 flex items-start justify-between">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${docType.icon.bg}`}>
                <FileText className={`h-6 w-6 ${docType.icon.color}`} />
              </div>
              <div className={`rounded px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${docType.badge.bgColor} ${docType.badge.textColor}`}>
                {docType.badge.label}
              </div>
            </div>

            <div className="mb-6 space-y-3">
              <h3 className={`text-[1.25rem] font-semibold text-[#0C5536] ${textAlign(isRtl)}`}>
                {t('documentDetail.clientWillTitle', {
                  date: new Date(will.pdf_generated_at || will.created_at).toLocaleDateString(isRtl ? "ar-SA" : "en-GB", { month: "long", year: "numeric" })
                })}
              </h3>

              <div className="space-y-2 text-[14px]">
                <div className={`flex items-center justify-between ${textAlign(isRtl)}`}>
                  <span className="text-[#6B6B6B]">{t('documentDetail.status')}</span>
                  <span className={`font-medium ${docType.icon.color}`}>{docType.statusText}</span>
                </div>
                <div className={`flex items-center justify-between ${textAlign(isRtl)}`}>
                  <span className="text-[#6B6B6B]">{t('documentDetail.uploadedBy')}</span>
                  <span className="text-[#121212]">{t('documentDetail.legalTeam')}</span>
                </div>
                <div className={`flex items-center justify-between ${textAlign(isRtl)}`}>
                  <span className="text-[#6B6B6B]">{t('documentDetail.dateUploaded')}</span>
                  <span className="text-[#121212]">
                    {new Date(will.pdf_generated_at || will.created_at).toLocaleDateString(isRtl ? "ar-SA" : "en-GB", { day: "2-digit", month: "long", year: "numeric" })}
                  </span>
                </div>
                <div className={`flex items-center justify-between ${textAlign(isRtl)}`}>
                  <span className="text-[#6B6B6B]">{t('documentDetail.version')}</span>
                  <span className="text-[#121212]">
                    {docType.type === "final" ? t('documentDetail.finalVersion') : t('documentDetail.draftVersion')}
                    {will.signed_pdf_path && (
                      <span className="text-[#6B6B6B]">
                        {" "}
                        {t('documentDetail.signature.originalSuffix', '(original, unsigned)')}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => window.open(pdfUrl, '_blank')} className="flex-1 bg-[#0C5536] text-white shadow-sm transition-all hover:bg-[#0C5536]/90 hover:shadow-[0_0_6px_rgba(198,160,59,0.3)]">
                <Eye className={isRtl ? "ml-2 h-4 w-4" : "mr-2 h-4 w-4"} />
                {t('documentDetail.viewDocument')}
              </Button>
              <Button onClick={handleDownload} variant="outline" className="flex-1 border-2 border-[#0C5536] bg-background text-[#0C5536] hover:bg-[#0C5536] hover:text-white hover:border-[#C6A03B]">
                <Download className={isRtl ? "ml-2 h-4 w-4" : "mr-2 h-4 w-4"} />
                {t('documentDetail.downloadPdf')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* E-signature - only on the FINAL will, once it is the client's to sign */}
        {will.status === 'finalized' && (
          <Card className="mb-8 overflow-hidden border-[#E6E6E4] shadow-[0_1px_4px_rgba(12,85,54,0.05)]">
            <CardContent className="p-6">
              {will.client_signature ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 flex-shrink-0">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <div className={textAlign(isRtl)}>
                      <h3 className="text-lg font-semibold text-[#0C5536]">
                        {t('documentDetail.signature.signedTitle', 'Document signed')}
                      </h3>
                      {will.client_signature_at && (
                        <p className="text-sm text-[#6B6B6B]">
                          {t('documentDetail.signature.signedOn', 'Signed on')}{' '}
                          {format(new Date(will.client_signature_at), "d MMMM yyyy, h:mm a")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#E6E6E4] bg-white p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={will.client_signature}
                      alt={t('documentDetail.signature.yourSignature', 'Your signature')}
                      className="max-h-32 object-contain"
                    />
                  </div>

                  {/* The signed copy is a separate document from the original
                      final will above, so it gets its own clearly-labelled
                      actions rather than replacing them. */}
                  {signedPdfUrl && (
                    <div className="rounded-lg border border-[#C6A03B]/40 bg-[rgba(198,160,59,0.06)] p-4">
                      <div className={`mb-3 ${textAlign(isRtl)}`}>
                        <p className="text-[14px] font-semibold text-[#0C5536]">
                          {t('documentDetail.signature.signedCopyTitle', 'Signed copy')}
                        </p>
                        <p className="text-[12px] text-[#6B6B6B]">
                          {t('documentDetail.signature.signedCopyHint', 'Your final will with the signed execution page attached. The original above is unchanged.')}
                        </p>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                          onClick={() => window.open(signedPdfUrl, '_blank')}
                          className="flex-1 bg-[#0C5536] text-white hover:bg-[#0C5536]/90"
                        >
                          <Eye className={isRtl ? "ml-2 h-4 w-4" : "mr-2 h-4 w-4"} />
                          {t('documentDetail.signature.viewSigned', 'View signed copy')}
                        </Button>
                        <Button
                          onClick={() => window.open(signedPdfUrl, '_blank')}
                          variant="outline"
                          className="flex-1 border-2 border-[#0C5536] bg-background text-[#0C5536] hover:bg-[#0C5536] hover:text-white hover:border-[#C6A03B]"
                        >
                          <Download className={isRtl ? "ml-2 h-4 w-4" : "mr-2 h-4 w-4"} />
                          {t('documentDetail.signature.downloadSigned', 'Download signed copy')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={textAlign(isRtl)}>
                    <h3 className="text-lg font-semibold text-[#0C5536]">
                      {t('documentDetail.signature.title', 'Sign your will')}
                    </h3>
                    <p className="mt-1 text-sm text-[#6B6B6B]">
                      {t('documentDetail.signature.instruction', 'Please review the document above, then sign below to confirm it reflects your wishes.')}
                    </p>
                  </div>

                  <SignaturePad
                    value={pendingSignature}
                    onChange={(signature) => setPendingSignature(signature)}
                    label={t('documentDetail.signature.label', 'Your signature')}
                  />

                  <Button
                    onClick={handleSignDocument}
                    disabled={!pendingSignature || submittingSignature}
                    className="w-full bg-[#0C5536] text-white hover:bg-[#0C5536]/90 sm:w-auto"
                  >
                    {submittingSignature ? (
                      <Loader2 className={isRtl ? "ml-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4 animate-spin"} />
                    ) : (
                      <CheckCircle className={isRtl ? "ml-2 h-4 w-4" : "mr-2 h-4 w-4"} />
                    )}
                    {t('documentDetail.signature.confirm', 'Confirm and sign')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Client Approval Section - Only for draft_released */}
        {will.status === 'draft_released' && (
          <Card className="mb-8 overflow-hidden border-[#E6E6E4] shadow-[0_1px_4px_rgba(12,85,54,0.05)]">
            <CardContent className="p-6">
              {will.client_approval_status ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {will.client_approval_status === "approved" ? (
                      <>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 flex-shrink-0">
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-[#0C5536]">{t('clientApproval.draftApproved')}</h3>
                          <p className="text-sm text-muted-foreground">
                            {t('clientApproval.approvedOn')} {will.client_approval_at && format(new Date(will.client_approval_at), 'PPp')}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 flex-shrink-0">
                          <XCircle className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-red-600">{t('clientApproval.changesRequested')}</h3>
                          <p className="text-sm text-muted-foreground">
                            {t('clientApproval.submittedOn')} {will.client_approval_at && format(new Date(will.client_approval_at), 'PPp')}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  {will.client_approval_comments && (
                    <div className="rounded-md bg-muted p-4">
                      <p className="text-sm font-medium text-muted-foreground mb-1">{t('clientApproval.yourComments')}</p>
                      <p className="text-sm text-foreground">{will.client_approval_comments}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-[#0C5536] mb-2">{t('clientApproval.reviewDraftApproval')}</h3>
                    <p className="text-sm text-muted-foreground">{t('clientApproval.reviewDraftMessage')}</p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button onClick={() => setShowApprovalDialog(true)} className="flex-1 bg-green-600 text-white hover:bg-green-700">
                      <ThumbsUp className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                      {t('clientApproval.approveDraft')}
                    </Button>
                    <Button onClick={() => setShowDisapprovalDialog(true)} variant="outline" className="flex-1 border-2 border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700">
                      <ThumbsDown className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                      {t('clientApproval.requestChanges')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Approval Dialog */}
              <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-green-700">
                      <ThumbsUp className="h-5 w-5" />
                      {t('clientApproval.approveDraft')}
                    </DialogTitle>
                    <DialogDescription>{t('clientApproval.approveDescription')}</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="approval-comments" className="text-sm font-medium">
                        {t('clientApproval.commentsLabel')} <span className="text-muted-foreground">({t('clientApproval.optional')})</span>
                      </Label>
                      <Textarea
                        id="approval-comments"
                        value={approvalComments}
                        onChange={(e) => setApprovalComments(e.target.value)}
                        placeholder={t('clientApproval.commentsPlaceholder')}
                        rows={4}
                        className="resize-none"
                      />
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button onClick={() => handleApproval("approved")} disabled={submittingApproval} className="flex-1 bg-green-600 text-white hover:bg-green-700">
                        {submittingApproval ? <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" /> : <CheckCircle className="ltr:mr-2 rtl:ml-2 h-4 w-4" />}
                        {t('clientApproval.confirmApproval')}
                      </Button>
                      <Button onClick={() => { setShowApprovalDialog(false); setApprovalComments(""); }} variant="outline" disabled={submittingApproval} className="flex-1">
                        {t('clientApproval.cancel')}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Request Changes Dialog */}
              <Dialog open={showDisapprovalDialog} onOpenChange={setShowDisapprovalDialog}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-700">
                      <ThumbsDown className="h-5 w-5" />
                      {t('clientApproval.requestChanges')}
                    </DialogTitle>
                    <DialogDescription>{t('clientApproval.requestChangesDescription')}</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="disapproval-subject" className="text-sm font-medium">
                        {t('portal:subject')} <span className="text-red-600">*</span>
                      </Label>
                      <Input id="disapproval-subject" value={disapprovalSubject} onChange={(e) => setDisapprovalSubject(e.target.value)} placeholder={t('portal:subjectPlaceholder')} className="h-10" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="disapproval-message" className="text-sm font-medium">
                        {t('portal:yourMessage')} <span className="text-red-600">*</span>
                      </Label>
                      <Textarea id="disapproval-message" value={disapprovalMessage} onChange={(e) => setDisapprovalMessage(e.target.value)} placeholder={t('portal:messagePlaceholder')} rows={5} className="resize-none" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="disapproval-image" className="text-sm font-medium">
                        {t('clientApproval.attachImage')} <span className="text-muted-foreground">({t('clientApproval.optional')})</span>
                      </Label>

                      <div className="border-2 border-dashed border-[#0C5536] rounded-md bg-[rgba(12,85,54,0.03)] overflow-hidden transition-colors hover:bg-[rgba(12,85,54,0.06)]">
                        <input type="file" accept="image/*" className="hidden" id="disapproval-image" onChange={handleImageChange} />

                        {disapprovalImage && imagePreview ? (
                          <div className="relative">
                            <img src={imagePreview} alt="Preview" className="w-full h-auto max-h-[300px] object-contain bg-white" />
                            <button type="button" onClick={() => { setDisapprovalImage(null); setImagePreview(null); setImageError(null); }} className="absolute top-2 ltr:right-2 rtl:left-2 p-1.5 bg-white rounded-full shadow-md hover:bg-red-50 transition-colors border border-red-200" title="Remove image">
                              <XCircle className="h-5 w-5 text-red-600" />
                            </button>
                            <div className="px-4 py-3 bg-white border-t border-[#E6E6E4]">
                              <div className="flex items-center gap-2 text-[11px] text-[#6B6B6B]">
                                <FileText className="h-3.5 w-3.5" />
                                <span className="font-medium text-[#333333]">{disapprovalImage.name}</span>
                                <span>({(disapprovalImage.size / 1024).toFixed(1)} KB)</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <label htmlFor="disapproval-image" className="cursor-pointer block p-4 text-center">
                            <FileText className="w-5 h-5 text-[#0C5536] mx-auto mb-2" />
                            <p className="text-[13px] text-[#333333]">
                              <span className="font-semibold text-[#0C5536]">{t('portal:chooseFile')}</span> {t('portal:dragAndDrop')}
                            </p>
                            <p className="text-[11px] text-[#6B6B6B] mt-1">{t('clientApproval.imageTypes')}</p>
                          </label>
                        )}
                      </div>

                      {imageError && <p className="text-[12px] text-destructive mt-1">{imageError}</p>}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button onClick={() => handleApproval("disapproved")} disabled={submittingApproval || !disapprovalSubject.trim() || !disapprovalMessage.trim()} className="flex-1 bg-red-600 text-white hover:bg-red-700">
                        {submittingApproval ? <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" /> : <ThumbsDown className="ltr:mr-2 rtl:ml-2 h-4 w-4" />}
                        {t('clientApproval.submitChanges')}
                      </Button>
                      <Button onClick={() => { setShowDisapprovalDialog(false); setDisapprovalSubject(""); setDisapprovalMessage(""); setDisapprovalImage(null); setImagePreview(null); setImageError(null); }} variant="outline" disabled={submittingApproval} className="flex-1">
                        {t('clientApproval.cancel')}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {/* Reassurance Section */}
        <div className={`rounded-md bg-[rgba(198,160,59,0.04)] border border-[rgba(198,160,59,0.15)] px-4 py-3 text-center ${textAlign(isRtl)}`}>
          <p className="text-[13px] leading-relaxed text-[#6B6B6B]">
            {t('documentDetail.securityMessage')}<br />
            {t('documentDetail.securityMessageDetail')}
          </p>
        </div>

        <EditRequestModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          documentName={`Client ${docType.badge.label} Will — ${format(new Date(will.pdf_generated_at || will.created_at), 'MMMM yyyy')}`}
          documentType={docType.type}
          willId={will.id}
        />
      </div>
    );
  }

  // Fallback
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push('/client/documents')}>
          <ArrowLeft className={isRtl ? "ml-2 h-4 w-4" : "mr-2 h-4 w-4"} />
          {t('documentDetail.back')}
        </Button>
      </div>
      <PageHeader title={t('documentDetail.documentTitle')} subtitle={t('documentDetail.documentSubtitle')} />
      <Card>
        <CardContent className={`pt-6 ${textAlign(isRtl)}`}>
          <p className="text-muted-foreground">{t('documentDetail.documentUnavailable')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
