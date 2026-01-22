"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Eye, Loader2, Clock, Lock, CheckCircle, XCircle, ClipboardCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/portal/PageHeader";

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
}

export default function ClientDocuments() {
  const { user } = useAuth();
  const { t } = useTranslation('portal');
  const router = useRouter();
  const [wills, setWills] = useState<Will[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAnyWills, setHasAnyWills] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchWills = async () => {
      if (!user) return;

      try {
        const { count } = await supabase
          .from('wills')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        setHasAnyWills((count || 0) > 0);

        const { data, error } = await supabase
          .from('wills')
          .select('id, status, pdf_path, pdf_generated_at, submitted_at, created_at, updated_at, visible_to_client, client_approval_status, client_approval_at')
          .eq('user_id', user.id)
          .not('submitted_at', 'is', null)
          .order('submitted_at', { ascending: false });

        if (error) throw error;

        setWills(data || []);
      } catch (error) {
        console.error('Error fetching wills:', error);
        toast({
          variant: "destructive",
          title: t('toast:error'),
          description: t('toast:documents.errorLoadingDocuments'),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchWills();
  }, [user]);

  const handleDownload = async (pdfPath: string, willId: string) => {
    if (!pdfPath) {
      toast({
        variant: "destructive",
        title: t('toast:documents.downloadFailed'),
        description: t('toast:documents.noPdfPath'),
      });
      return;
    }

    setDownloadingId(willId);
    try {
      const { data: urlData, error: urlError } = await supabase.storage
        .from('wills')
        .createSignedUrl(pdfPath, 60);

      if (urlError) {
        throw new Error(`Failed to get download URL: ${urlError.message}`);
      }

      if (!urlData?.signedUrl) {
        throw new Error('Failed to get download URL');
      }

      const response = await fetch(urlData.signedUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `will-draft-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast({
        variant: "destructive",
        title: t('toast:documents.downloadFailed'),
        description: error.message || t('toast:documents.downloadError'),
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const getSignedUrl = async (pdfPath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('wills')
      .createSignedUrl(pdfPath, 600);

    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }

    return data?.signedUrl || null;
  };

  const getStatusBadge = (status: Database["public"]["Enums"]["will_status"]) => {
    const statusMap = {
      in_progress: { label: t('documentsPage.statusLabels.inProgress'), color: "bg-blue-100 text-blue-700" },
      awaiting_review: { label: t('documentsPage.statusLabels.awaitingReview'), color: "bg-yellow-100 text-yellow-700" },
      under_review: { label: t('documentsPage.statusLabels.underReview'), color: "bg-purple-100 text-purple-700" },
      draft_ready: { label: t('documentsPage.statusLabels.draftReady'), color: "bg-green-100 text-green-700" },
      draft_released: { label: t('documentsPage.statusLabels.draftReleased'), color: "bg-teal-100 text-teal-700" },
      finalized: { label: t('documentsPage.statusLabels.finalized'), color: "bg-[#C6A03B]/10 text-[#C6A03B]" },
    };
    return statusMap[status] || { label: status, color: "bg-gray-100 text-gray-700" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (wills.length === 0) {
    return (
      <div>
        <PageHeader
          title={t('documentsPage.title')}
          subtitle={t('documentsPage.subtitle')}
        />

        <Card className="bg-white rounded-lg border border-[#E6E6E4] shadow-[0_1px_4px_rgba(12,85,54,0.05)]">
          <CardContent className="pt-12 pb-12">
            <div className="flex flex-col items-center text-center space-y-6 max-w-2xl mx-auto">
              <div className="w-[72px] h-[72px] rounded-full border-2 border-[rgba(12,85,54,0.12)] bg-[rgba(12,85,54,0.08)] flex items-center justify-center">
                <FileText className="w-9 h-9 text-[#0C5536]" />
              </div>

              {hasAnyWills && (
                <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold text-[#C6A03B] bg-[rgba(198,160,59,0.1)]">
                  {t('documentsPage.inProgress')}
                </div>
              )}

              <h2 className="text-[1.25rem] font-semibold text-[#0C5536]">
                {hasAnyWills ? t('documentsPage.willInProgress') : t('documentsPage.noDocuments')}
              </h2>

              <div className="space-y-3">
                <p className="text-[1rem] text-[#4B4B4B] leading-relaxed">
                  {hasAnyWills
                    ? t('documentsPage.draftReadyMessage')
                    : t('documentsPage.startCreatingMessage')}
                </p>
              </div>

              <Link href="/client/will" className="w-full max-w-md">
                <Button
                  size="lg"
                  className="w-full bg-[#0C5536] hover:bg-[#0C5536]/90 text-white rounded-md px-8 shadow-[0_0_6px_rgba(198,160,59,0.3)] hover:shadow-[0_0_8px_rgba(198,160,59,0.45)] transition-all font-semibold text-[14px] h-11"
                >
                  {hasAnyWills ? t('documentsPage.continueWill') : t('documentsPage.createWill')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-2 pt-8">
          <Lock className="h-4 w-4 text-[#C6A03B]" />
          <p className="text-[0.8rem] text-[#777] text-center leading-relaxed">
            {t('documentsPage.securityNotice')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-6 flex-1">
        <PageHeader
          title={t('documentsPage.title')}
          subtitle={t('documentsPage.allSubmissions')}
        />

        <div className="space-y-3 pb-4">
          {wills.map((will) => {
            const statusBadge = getStatusBadge(will.status);
            const hasPDF = will.visible_to_client && will.pdf_path;

            return (
              <Card
                key={will.id}
                className="overflow-hidden border-[#E6E6E4] shadow-[0_1px_4px_rgba(12,85,54,0.05)] hover:shadow-[0_2px_6px_rgba(12,85,54,0.08)] transition-shadow cursor-pointer"
                onClick={() => router.push(`/client/documents/${will.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-8 w-8 text-[#0C5536] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-base font-semibold">{t('documentsPage.willNumber')}{will.id.slice(0, 8)}</h3>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                          {will.status === 'draft_released' && will.client_approval_status && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                              will.client_approval_status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {will.client_approval_status === 'approved' ? (
                                <>
                                  <CheckCircle className="h-3 w-3" />
                                  {t('clientApproval.approved')}
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3 w-3" />
                                  {t('clientApproval.changesRequested')}
                                </>
                              )}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{t('documentsPage.created')} {format(new Date(will.created_at), 'MMM d, yyyy')}</span>
                          <span>•</span>
                          <span>{t('documentsPage.submitted')} {format(new Date(will.submitted_at!), 'MMM d, yyyy')}</span>
                          {will.client_approval_at && (
                            <>
                              <span>•</span>
                              <span>{will.client_approval_status === 'approved' ? t('clientApproval.approved') : t('clientApproval.changesRequested')} {format(new Date(will.client_approval_at), 'MMM d, yyyy')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      {hasPDF && (will.status === 'draft_released' || will.status === 'finalized') ? (
                        <>
                          <Button
                            size="sm"
                            className="px-0 bg-transparent hover:bg-transparent [&_svg]:!size-6"
                            disabled={viewingId === will.id}
                            onClick={async (e) => {
                              e.stopPropagation();
                              setViewingId(will.id);
                              try {
                                const url = await getSignedUrl(will.pdf_path!);
                                if (url) window.open(url, '_blank');
                              } finally {
                                setViewingId(null);
                              }
                            }}
                          >
                            {viewingId === will.id ? (
                              <Loader2 className="animate-spin text-[#0C5536]" />
                            ) : (
                              <Eye className="text-[#0C5536]" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            className="px-0 bg-transparent hover:bg-transparent [&_svg]:!size-6"
                            disabled={downloadingId === will.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(will.pdf_path!, will.id);
                            }}
                          >
                            {downloadingId === will.id ? (
                              <Loader2 className="animate-spin text-[#0C5536]" />
                            ) : (
                              <Download className="text-[#0C5536]" />
                            )}
                          </Button>
                          {will.status === 'draft_released' && !will.client_approval_status && (
                            <Button
                              size="sm"
                              className="bg-transparent hover:bg-transparent text-[#0C5536] px-0 [&_svg]:!size-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/client/documents/${will.id}`);
                              }}
                            >
                              <ClipboardCheck />
                            </Button>
                          )}
                        </>
                      ) : (
                        <Button size="sm" variant="outline" disabled>
                          <Clock className="h-3 w-3 mr-1" />
                          {t('documentsPage.submittedButton')}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="sticky bottom-0 bg-background border-t border-border/50 mt-auto py-4">
        <div className="flex items-center justify-center gap-2">
          <Lock className="h-4 w-4 text-[#C6A03B]" />
          <p className="text-[0.8rem] text-[#777] text-center leading-relaxed">
            {t('documentsPage.securityNotice')}
          </p>
        </div>
      </div>
    </div>
  );
}
