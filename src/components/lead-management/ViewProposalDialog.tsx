"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lead } from "./LeadTable";
import { ProposalPDFTemplate, ProposalPDFData } from "./ProposalPDFTemplate";
import { InvoicePDFTemplate, InvoicePDFData } from "./InvoicePDFTemplate";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Download, FileText, Receipt, Loader2, ExternalLink, Eye, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface Proposal {
  id: string;
  lead_id: string;
  amount: number;
  currency: string;
  proposal_content: string;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "cancelled";
  stripe_payment_link: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
}

interface ViewProposalDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewProposalDialog({
  lead,
  open,
  onOpenChange,
}: ViewProposalDialogProps) {
  const { t } = useTranslation("leadManagement");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadType, setDownloadType] = useState<"proposal" | "invoice" | null>(null);
  const [viewingProposal, setViewingProposal] = useState<{ id: string; type: "proposal" | "invoice" } | null>(null);

  // Refs for PDF templates
  const proposalRef = useRef<HTMLDivElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  // State to hold data for PDF generation
  const [pdfProposalData, setPdfProposalData] = useState<ProposalPDFData | null>(null);
  const [pdfInvoiceData, setPdfInvoiceData] = useState<InvoicePDFData | null>(null);

  // Fetch proposals for the lead
  useEffect(() => {
    if (lead && open) {
      fetchProposals();
    }
  }, [lead, open]);

  const fetchProposals = async () => {
    if (!lead) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProposals(data || []);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      toast.error(t("failedToFetchProposals"));
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "sent":
        return "bg-yellow-100 text-yellow-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  // Generate and download proposal PDF
  const handleDownloadProposal = async (proposal: Proposal) => {
    if (!lead) return;

    setDownloadingId(proposal.id);
    setDownloadType("proposal");

    // Set PDF data
    setPdfProposalData({
      invoiceNumber: proposal.invoice_number,
      clientName: lead.full_name,
      clientEmail: lead.email,
      clientPhone: lead.phone,
      clientCompany: lead.company_name,
      amount: proposal.amount,
      currency: proposal.currency,
      proposalContent: proposal.proposal_content,
      createdAt: proposal.created_at,
    });

    // Wait for next render to have the ref populated
    setTimeout(async () => {
      try {
        const html2pdf = (await import("html2pdf.js")).default;

        if (proposalRef.current) {
          await html2pdf()
            .set({
              margin: 10,
              filename: `Proposal-${proposal.invoice_number}.pdf`,
              image: { type: "jpeg", quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true, letterRendering: true },
              jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            })
            .from(proposalRef.current)
            .save();

          toast.success(t("proposalDownloaded"));
        }
      } catch (error) {
        console.error("Error generating PDF:", error);
        toast.error(t("failedToGeneratePDF"));
      } finally {
        setDownloadingId(null);
        setDownloadType(null);
        setPdfProposalData(null);
      }
    }, 100);
  };

  // Generate and download invoice PDF
  const handleDownloadInvoice = async (proposal: Proposal) => {
    if (!lead) return;

    setDownloadingId(proposal.id);
    setDownloadType("invoice");

    // Set PDF data
    setPdfInvoiceData({
      invoiceNumber: proposal.invoice_number,
      clientName: lead.full_name,
      clientEmail: lead.email,
      clientPhone: lead.phone,
      clientCompany: lead.company_name,
      amount: proposal.amount,
      currency: proposal.currency,
      status: proposal.status,
      createdAt: proposal.created_at,
      paidAt: proposal.paid_at,
      paymentLink: proposal.stripe_payment_link,
    });

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
        setDownloadingId(null);
        setDownloadType(null);
        setPdfInvoiceData(null);
      }
    }, 100);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "paid":
        return t("paid");
      case "sent":
        return t("sent");
      case "draft":
        return t("draft");
      case "cancelled":
        return t("cancelled");
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("proposalsFor", { name: lead?.full_name })}</DialogTitle>
            <DialogDescription>
              {t("viewAndDownload")}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : proposals.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">{t("noProposalsFound")}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("sendProposalToGetStarted")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {proposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">
                            {proposal.invoice_number}
                          </span>
                          <Badge className={getStatusColor(proposal.status)}>
                            {getStatusLabel(proposal.status)}
                          </Badge>
                        </div>
                        <p className="text-2xl font-bold text-primary mt-1">
                          {formatCurrency(proposal.amount, proposal.currency)}
                        </p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>{t("created")}: {format(new Date(proposal.created_at), "MMM d, yyyy")}</p>
                        {proposal.sent_at && (
                          <p>{t("sentDate")}: {format(new Date(proposal.sent_at), "MMM d, yyyy")}</p>
                        )}
                        {proposal.paid_at && (
                          <p className="text-green-600 font-medium">
                            {t("paidDate")}: {format(new Date(proposal.paid_at), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-3 border-t">
                      {/* Proposal Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={downloadingId === proposal.id && downloadType === "proposal"}
                            className="gap-1"
                          >
                            {downloadingId === proposal.id && downloadType === "proposal" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                            {t("proposal")}
                            <ChevronDown className="h-3 w-3 ltr:ml-1 rtl:mr-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem
                            onClick={() => setViewingProposal({ id: proposal.id, type: "proposal" })}
                          >
                            <Eye className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                            {t("view")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadProposal(proposal)}>
                            <Download className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                            {t("download")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Invoice Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={downloadingId === proposal.id && downloadType === "invoice"}
                            className="gap-1"
                          >
                            {downloadingId === proposal.id && downloadType === "invoice" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Receipt className="h-4 w-4" />
                            )}
                            {t("invoice")}
                            <ChevronDown className="h-3 w-3 ltr:ml-1 rtl:mr-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem
                            onClick={() => setViewingProposal({ id: proposal.id, type: "invoice" })}
                          >
                            <Eye className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                            {t("view")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadInvoice(proposal)}>
                            <Download className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                            {t("download")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {proposal.stripe_payment_link && proposal.status !== "paid" && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => window.open(proposal.stripe_payment_link!, "_blank")}
                        >
                          <ExternalLink className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                          {t("paymentLink")}
                        </Button>
                      )}
                    </div>

                    {/* Expandable View Section */}
                    {viewingProposal?.id === proposal.id && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-sm">
                            {viewingProposal.type === "proposal" ? t("proposalPreview") : t("invoicePreview")}
                          </h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingProposal(null)}
                            className="h-6 px-2 text-xs"
                          >
                            {t("close")}
                          </Button>
                        </div>
                        <div className="border rounded-lg overflow-hidden bg-white max-h-[400px] overflow-y-auto">
                          {viewingProposal.type === "proposal" ? (
                            <ProposalPDFTemplate
                              data={{
                                invoiceNumber: proposal.invoice_number,
                                clientName: lead?.full_name || "",
                                clientEmail: lead?.email || "",
                                clientPhone: lead?.phone,
                                clientCompany: lead?.company_name,
                                amount: proposal.amount,
                                currency: proposal.currency,
                                proposalContent: proposal.proposal_content,
                                createdAt: proposal.created_at,
                              }}
                            />
                          ) : (
                            <InvoicePDFTemplate
                              data={{
                                invoiceNumber: proposal.invoice_number,
                                clientName: lead?.full_name || "",
                                clientEmail: lead?.email || "",
                                clientPhone: lead?.phone,
                                clientCompany: lead?.company_name,
                                amount: proposal.amount,
                                currency: proposal.currency,
                                status: proposal.status,
                                createdAt: proposal.created_at,
                                paidAt: proposal.paid_at,
                                paymentLink: proposal.stripe_payment_link,
                              }}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden PDF Templates for generation */}
      {pdfProposalData && (
        <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
          <ProposalPDFTemplate ref={proposalRef} data={pdfProposalData} />
        </div>
      )}
      {pdfInvoiceData && (
        <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
          <InvoicePDFTemplate ref={invoiceRef} data={pdfInvoiceData} />
        </div>
      )}
    </>
  );
}
