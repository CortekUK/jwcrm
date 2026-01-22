"use client";

import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InvoicePDFTemplate, InvoicePDFData } from "@/components/lead-management/InvoicePDFTemplate";
import { Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Proposal } from "@/types/finance";

interface ViewInvoiceDialogProps {
  proposal: Proposal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewInvoiceDialog({
  proposal,
  open,
  onOpenChange,
}: ViewInvoiceDialogProps) {
  const { t } = useTranslation("finance");
  const [isDownloading, setIsDownloading] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [pdfData, setPdfData] = useState<InvoicePDFData | null>(null);

  if (!proposal) return null;

  const invoiceData: InvoicePDFData = {
    invoiceNumber: proposal.invoice_number || "",
    clientName: proposal.lead?.full_name || "",
    clientEmail: proposal.lead?.email || "",
    clientPhone: proposal.lead?.company_name ? undefined : undefined,
    clientCompany: proposal.lead?.company_name,
    amount: proposal.amount,
    currency: proposal.currency,
    status: proposal.status,
    createdAt: proposal.created_at,
    paidAt: proposal.paid_at,
    paymentLink: proposal.stripe_payment_link,
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setPdfData(invoiceData);

    // Wait for next render to have the ref populated
    setTimeout(async () => {
      try {
        const html2pdf = (await import("html2pdf.js")).default;

        if (invoiceRef.current) {
          await html2pdf()
            .set({
              margin: 10,
              filename: `Invoice-${proposal.invoice_number}.pdf`,
              image: { type: "jpeg", quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true, letterRendering: true },
              jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            })
            .from(invoiceRef.current)
            .save();

          toast.success(t("invoiceDownloaded"));
        }
      } catch (error) {
        console.error("Error generating PDF:", error);
        toast.error(t("failedToGeneratePDF"));
      } finally {
        setIsDownloading(false);
        setPdfData(null);
      }
    }, 100);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>{t("invoicePreview")}</DialogTitle>
                <DialogDescription>
                  {proposal.invoice_number} - {proposal.lead?.full_name}
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={isDownloading}
                className="gap-2"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {t("downloadPDF")}
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto border rounded-lg bg-gray-100 p-4">
            <div className="bg-white shadow-lg">
              <InvoicePDFTemplate data={invoiceData} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden PDF Template for generation */}
      {pdfData && (
        <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
          <InvoicePDFTemplate ref={invoiceRef} data={pdfData} />
        </div>
      )}
    </>
  );
}
