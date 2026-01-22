"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Loader2, Upload } from "lucide-react";
import { WillDocumentPreview } from "@/components/admin/WillDocumentPreview";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminWillPrint() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { t, i18n } = useTranslation(['admin', 'toast']);
  const { toast } = useToast();
  const { locale } = useLanguage();
  const [pdfLanguage, setPdfLanguage] = useState<string>(locale);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [translatedAnswers, setTranslatedAnswers] = useState<any>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    i18n.changeLanguage(locale);
  }, [i18n, locale]);

  const { data: will, isLoading } = useQuery({
    queryKey: ["admin-will-print", id],
    queryFn: async () => {
      if (!id) throw new Error("No will ID provided");

      const { data: willData, error } = await supabase
        .from("wills")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, locale")
        .eq("user_id", willData.user_id)
        .single();

      return {
        ...willData,
        profile: profileData,
      };
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (will?.answers) {
      setTranslatedAnswers(will.answers);
      setIsTranslating(false);
    }
  }, [will]);

  const handlePrint = () => {
    window.print();
  };

  const handleGeneratePdf = async () => {
    if (!id || !will) return;

    setGeneratingPdf(true);
    try {
      toast({
        title: t('toast:admin.pdfGenerationStarted'),
        description: t('toast:admin.generatingPdfWithEngine'),
        className: "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
      });

      const html2pdf = (await import('html2pdf.js')).default;

      const element = document.querySelector('.will-document-preview') as HTMLElement;
      if (!element) {
        throw new Error('Document preview not found');
      }

      const opt = {
        margin: 10,
        filename: 'will.pdf',
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');

      const fileSizeMB = pdfBlob.size / (1024 * 1024);
      console.log(`PDF size: ${fileSizeMB.toFixed(2)} MB`);

      if (fileSizeMB > 10) {
        throw new Error(`PDF file is too large (${fileSizeMB.toFixed(2)} MB). Please reduce the document size.`);
      }

      let blobToUpload = pdfBlob;

      if (will.status !== 'finalized') {
        console.log('Adding DRAFT watermark to PDF (status:', will.status, ')');

        try {
          const { PDFDocument, rgb, degrees } = await import('pdf-lib');

          const arrayBuffer = await pdfBlob.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const pages = pdfDoc.getPages();

          for (const page of pages) {
            const { width, height } = page.getSize();

            page.drawText('JUST WILLS', {
              x: width / 2 - 200,
              y: height / 2 - 100,
              size: 120,
              color: rgb(0.776, 0.627, 0.231),
              opacity: 0.08,
              rotate: degrees(45),
            });
          }

          const watermarkedPdfBytes = await pdfDoc.save();
          blobToUpload = new Blob([watermarkedPdfBytes], { type: 'application/pdf' });

          console.log('Watermark added successfully');
        } catch (watermarkError) {
          console.error('Error adding watermark:', watermarkError);
          toast({
            title: t('toast:warning'),
            description: t('toast:admin.watermarkCouldNotBeAdded'),
            variant: "default",
          });
        }
      }

      const fileName = `${will.user_id}/draft_${Date.now()}.pdf`;
      console.log('Uploading PDF to:', fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("wills")
        .upload(fileName, blobToUpload, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { error: updateError } = await supabase
        .from("wills")
        .update({
          pdf_path: fileName,
          pdf_generated_at: new Date().toISOString(),
          visible_to_client: true,
        })
        .eq("id", id);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      toast({
        title: t('toast:admin.pdfGeneratedAndUploaded'),
        description: t('toast:admin.draftPdfVisibleToClient'),
        className: "bg-[hsl(var(--jw-primary-green))] text-white border-[hsl(var(--jw-gold-accent))]",
      });

      router.push(`/admin/wills/${id}`);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast({
        title: t('toast:admin.generationFailed'),
        description: error.message || t('toast:admin.couldNotGeneratePdf'),
        variant: "destructive",
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  useEffect(() => {
    if (will) {
      setTimeout(() => {
        const printButton = document.getElementById("print-button");
        printButton?.focus();
      }, 100);
    }
  }, [will]);

  if (isLoading || isTranslating) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))] mx-auto mb-4" />
          {isTranslating && <p className="text-sm text-gray-600">Translating content to Arabic...</p>}
        </div>
      </div>
    );
  }

  if (!will) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <p className="text-lg text-gray-600 mb-4">Will not found</p>
        <Button onClick={() => router.push("/admin/wills")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Wills
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Print controls - hidden when printing */}
      <div className="no-print sticky top-0 z-50 bg-white border-b border-gray-300 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push(`/admin/wills/${id}`)}
            className="text-gray-700 hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backToWillDetails')}
          </Button>

          <div className="flex items-center gap-3">
            {/* PDF Language Selector */}
            <Select value={pdfLanguage} onValueChange={setPdfLanguage}>
              <SelectTrigger id="pdf-language-select" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t('english')}</SelectItem>
                <SelectItem value="ar">{t('arabic')}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleGeneratePdf}
              disabled={generatingPdf}
              className="bg-[hsl(var(--jw-gold-accent))] hover:bg-[hsl(var(--jw-gold-accent))]/90 text-white"
            >
              {generatingPdf ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('uploading')}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {t('uploadPdf')}
                </>
              )}
            </Button>
            <Button
              id="print-button"
              onClick={handlePrint}
              variant="outline"
              className="border-[hsl(var(--jw-primary-green))] text-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))] hover:text-white"
            >
              <Printer className="mr-2 h-4 w-4" />
              {t('printOnly')}
            </Button>
          </div>
        </div>
      </div>

      {/* Document Preview */}
      <div className="py-8 relative">
        {/* Watermark - Only shows when printing and if NOT finalized */}
        {will.status !== 'finalized' && (
          <div className="watermark-container">
            <div className="watermark-text">JUST WILLS</div>
          </div>
        )}

        <WillDocumentPreview
          answers={translatedAnswers || will.answers}
          clientName={will.profile?.full_name || "Unknown Client"}
          willId={will.id}
          locale={pdfLanguage}
          status={will.status}
          includeSignature={(will.answers as any)?.family_exclusion?.include_signature_in_pdf ?? true}
        />
      </div>
    </div>
  );
}
