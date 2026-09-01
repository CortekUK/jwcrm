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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lead } from "./LeadTable";
import { ProposalPDFTemplate, ProposalPDFData } from "./ProposalPDFTemplate";
import { InvoicePDFTemplate, InvoicePDFData } from "./InvoicePDFTemplate";
import { supabase } from "@/integrations/supabase/client";
import { companyDetails } from "@/config/company";
import { type InvoiceLineItem } from "@/lib/pdf/invoiceLineItems";
import { computeInvoiceAmounts, resolvePaymentStage } from "@/lib/finance/invoiceAmounts";
import { paymentResolverPath, paymentResolverUrl } from "@/lib/finance/paymentLink";
import { format } from "date-fns";
import { Download, FileText, Receipt, Loader2, ExternalLink, Eye, ChevronDown, CircleDollarSign, Plus, Send } from "lucide-react";
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
  invoiced_at: string | null;
  // Arrives as Json from the generated row type; cast where it is read.
  line_items: unknown;
  vat_rate?: number | null;
  vat_amount?: number | null;
}

interface ProposalPayment {
  id: string;
  proposal_id: string;
  amount: number;
  method: string;
  notes: string | null;
  paid_at: string;
}

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "stripe", label: "Stripe / Card" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

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

  // Payments (partial-payment / balance-due tracking)
  const [paymentsByProposal, setPaymentsByProposal] = useState<Record<string, ProposalPayment[]>>({});
  const [recordingPaymentFor, setRecordingPaymentFor] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [requestingPaymentFor, setRequestingPaymentFor] = useState<string | null>(null);

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

  const fetchPayments = async (proposalIds: string[]) => {
    if (proposalIds.length === 0) {
      setPaymentsByProposal({});
      return;
    }
    const { data, error } = await supabase
      .from("proposal_payments")
      .select("*")
      .in("proposal_id", proposalIds)
      .order("paid_at", { ascending: false });
    if (error) {
      console.error("Error fetching payments:", error);
      return;
    }
    const grouped: Record<string, ProposalPayment[]> = {};
    for (const payment of data || []) {
      (grouped[payment.proposal_id] ??= []).push(payment as ProposalPayment);
    }
    setPaymentsByProposal(grouped);
  };

  const balanceFor = (proposal: Proposal) => {
    const amounts = computeInvoiceAmounts(
      {
        amount: proposal.amount,
        line_items: proposal.line_items as InvoiceLineItem[] | null,
        vat_rate: proposal.vat_rate,
        vat_amount: proposal.vat_amount,
      },
      companyDetails.vatRate
    );
    const totalPaid = (paymentsByProposal[proposal.id] || []).reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );
    const stageState = resolvePaymentStage(amounts, totalPaid);
    return {
      invoiceTotal: amounts.invoiceTotal,
      totalPaid,
      balanceDue: Math.max(0, stageState.balanceDue),
      // What the payment link would charge right now: on a staged invoice the
      // drafting fee, not the whole balance.
      amountDue: stageState.amountDue,
      stage: stageState.stage,
      amounts,
    };
  };

  // Status shown on the card. Only a display concern — the stored
  // proposal_status enum is untouched, so nothing downstream has to change.
  const displayStatusFor = (proposal: Proposal): string => {
    if (proposal.status !== "sent" || !proposal.invoiced_at) return proposal.status;
    const { totalPaid, balanceDue } = balanceFor(proposal);
    return totalPaid > 0 && balanceDue > 0.01 ? "partially_paid" : proposal.status;
  };

  const resetPaymentForm = () => {
    setRecordingPaymentFor(null);
    setPaymentAmount("");
    setPaymentMethod("bank_transfer");
    setPaymentNotes("");
  };

  const handleRecordPayment = async (proposal: Proposal) => {
    const amountNum = parseFloat(paymentAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error(t("validAmountRequired"));
      return;
    }
    setIsRecordingPayment(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/lead-management/proposals/${proposal.id}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          amount: amountNum,
          method: paymentMethod,
          notes: paymentNotes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record payment");

      toast.success(t("paymentRecorded", "Payment recorded"));

      // Recording the drafting fee opens the client portal and moves the lead
      // to Drafting, so say so rather than leaving it to be discovered.
      if (json.portal === "created" || json.portal === "linked_existing") {
        toast.success(
          t("portalOpened", "Client portal account created and welcome email sent")
        );
      } else if (json.portal === "failed") {
        toast.error(
          t("portalFailed", "Payment saved, but the portal account could not be created")
        );
      }

      resetPaymentForm();
      await fetchProposals();
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error(error instanceof Error ? error.message : t("failedToRecordPayment", "Failed to record payment"));
    } finally {
      setIsRecordingPayment(false);
    }
  };

  // Emails the client a request for whatever is payable right now. Needed
  // because the two stages of a staged invoice are weeks apart — asking the
  // client to dig out the original invoice email and press its button again is
  // not a reasonable way to collect the second instalment.
  const handleRequestPayment = async (proposal: Proposal) => {
    setRequestingPaymentFor(proposal.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(
        `/api/lead-management/proposals/${proposal.id}/request-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({}),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send payment request");

      toast.success(
        t("paymentRequestSent", "Payment request for {{amount}} sent to {{email}}", {
          amount: formatCurrency(json.amountRequested, json.currency),
          email: json.sentTo,
        })
      );
    } catch (error) {
      console.error("Error requesting payment:", error);
      toast.error(
        error instanceof Error ? error.message : t("failedToRequestPayment", "Failed to send payment request")
      );
    } finally {
      setRequestingPaymentFor(null);
    }
  };

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
      // Normalise the nullable columns once here rather than guarding every
      // render site: created_at/invoice_number have DB defaults (the latter via
      // a trigger) and proposal_content is only null on a bare draft.
      setProposals(
        (data || []).map((p) => ({
          ...p,
          proposal_content: p.proposal_content ?? "",
          invoice_number: p.invoice_number ?? "",
          created_at: p.created_at ?? new Date().toISOString(),
        })) as Proposal[]
      );
      await fetchPayments((data || []).map((p) => p.id));
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
      case "partially_paid":
        return "bg-[#FFF4DC] text-[#8B6914]";
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

  // Button labels sit in a crowded action row, so drop the ".00" that a whole
  // amount always carries — "AED 3,150" reads the same and costs three fewer
  // characters in a row that was already overflowing.
  const formatCurrencyCompact = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);

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
      lineItems: (proposal.line_items as InvoiceLineItem[] | null) ?? undefined,
      vatRate: proposal.vat_rate,
      vatAmount: proposal.vat_amount,
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
      lineItems: (proposal.line_items as InvoiceLineItem[] | null) ?? undefined,
      vatRate: proposal.vat_rate,
      vatAmount: proposal.vat_amount,
      amountPaid: balanceFor(proposal).totalPaid,
      status: proposal.status,
      createdAt: proposal.created_at,
      paidAt: proposal.paid_at,
      // Balance-resolving link, not the frozen Stripe URL.
      paymentLink: proposal.stripe_payment_link ? paymentResolverUrl(proposal.id) : null,
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
      case "partially_paid":
        return t("partiallyPaid", "Part paid");
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
        <DialogContent className="sm:max-w-[820px] max-h-[80vh] overflow-y-auto">
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
                          <Badge variant="outline" className="text-xs">
                            {proposal.invoiced_at ? t("invoice", "Invoice") : t("proposal", "Proposal")}
                          </Badge>
                          {/* "Sent" is technically right for a part-paid
                              invoice, but it hides that money has already come
                              in. Show that explicitly instead. */}
                          {(() => {
                            const display = displayStatusFor(proposal);
                            return (
                              <Badge variant="status" className={getStatusColor(display)}>
                                {getStatusLabel(display)}
                              </Badge>
                            );
                          })()}
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
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
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
                          onClick={() => window.open(paymentResolverPath(proposal.id), "_blank")}
                        >
                          <ExternalLink className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                          {t("paymentLink")}
                        </Button>
                      )}

                      {proposal.invoiced_at &&
                        proposal.status !== "paid" &&
                        proposal.status !== "cancelled" &&
                        balanceFor(proposal).amountDue > 0.01 && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={requestingPaymentFor === proposal.id}
                            onClick={() => handleRequestPayment(proposal)}
                          >
                            {requestingPaymentFor === proposal.id ? (
                              <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                            )}
                            {t("requestPayment", "Request {{amount}}", {
                              amount: formatCurrencyCompact(
                                balanceFor(proposal).amountDue,
                                proposal.currency
                              ),
                            })}
                          </Button>
                        )}

                      {proposal.invoiced_at && proposal.status !== "paid" && proposal.status !== "cancelled" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Prefill what is actually due at this stage — the
                            // drafting fee on a staged invoice, otherwise the
                            // whole balance.
                            const due = balanceFor(proposal).amountDue;
                            setPaymentAmount(due > 0 ? due.toFixed(2) : "");
                            setRecordingPaymentFor(
                              recordingPaymentFor === proposal.id ? null : proposal.id
                            );
                          }}
                        >
                          <CircleDollarSign className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                          {t("recordPayment", "Record Payment")}
                        </Button>
                      )}
                    </div>

                    {/* Balance / payment history — only for real, payable invoices */}
                    {proposal.invoiced_at && (() => {
                      const { invoiceTotal, totalPaid, balanceDue, amountDue, stage, amounts } =
                        balanceFor(proposal);
                      const payments = paymentsByProposal[proposal.id] || [];
                      return (
                        <div className="pt-3 border-t space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                            <span className="text-muted-foreground">
                              {t("balanceSummary", "{{paid}} of {{total}} paid", {
                                paid: formatCurrency(totalPaid, proposal.currency),
                                total: formatCurrency(invoiceTotal, proposal.currency),
                              })}
                            </span>
                            <span
                              className={
                                balanceDue > 0.01
                                  ? "font-semibold text-amber-700"
                                  : "font-semibold text-green-700"
                              }
                            >
                              {balanceDue > 0.01
                                ? t("balanceOutstanding", "{{amount}} outstanding", {
                                    amount: formatCurrency(balanceDue, proposal.currency),
                                  })
                                : t("fullyPaid", "Fully paid")}
                            </span>
                          </div>

                          {/* Staged invoice: the drafting fee is collected before
                              work starts, the court fees at the court date. */}
                          {amounts.staged && balanceDue > 0.01 && (
                            <p className="text-xs text-muted-foreground">
                              {stage === "upfront"
                                ? t(
                                    "stageDueUpfront",
                                    "Drafting fee {{amount}} due now · {{later}} at court stage",
                                    {
                                      amount: formatCurrency(amountDue, proposal.currency),
                                      later: formatCurrency(amounts.laterTotal, proposal.currency),
                                    }
                                  )
                                : t(
                                    "stageDueRemainder",
                                    "Drafting fee paid · {{amount}} due at court stage",
                                    {
                                      amount: formatCurrency(amountDue, proposal.currency),
                                    }
                                  )}
                            </p>
                          )}

                          {payments.length > 0 && (
                            <div className="space-y-1">
                              {payments.map((payment) => (
                                <div
                                  key={payment.id}
                                  className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1"
                                >
                                  <span>
                                    {formatCurrency(payment.amount, proposal.currency)} &middot;{" "}
                                    {PAYMENT_METHODS.find((m) => m.value === payment.method)?.label ||
                                      payment.method}
                                    {payment.notes ? ` — ${payment.notes}` : ""}
                                  </span>
                                  <span>{format(new Date(payment.paid_at), "MMM d, yyyy")}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {recordingPaymentFor === proposal.id && (
                            <div className="mt-2 p-3 bg-[#FAFAF8] border border-[#E6E6E4] rounded-lg space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="relative">
                                  <span className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                    AED
                                  </span>
                                  <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className="ltr:pl-10 rtl:pr-10"
                                    min="0"
                                    step="0.01"
                                  />
                                </div>
                                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PAYMENT_METHODS.map((m) => (
                                      <SelectItem key={m.value} value={m.value}>
                                        {m.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Textarea
                                placeholder={t("paymentNotesPlaceholder", "Notes (optional)")}
                                value={paymentNotes}
                                onChange={(e) => setPaymentNotes(e.target.value)}
                                className="min-h-[50px]"
                              />
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={resetPaymentForm}>
                                  {t("cancel")}
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleRecordPayment(proposal)}
                                  disabled={isRecordingPayment}
                                >
                                  {isRecordingPayment ? (
                                    <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Plus className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                                  )}
                                  {t("save")}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

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
                                lineItems: (proposal.line_items as InvoiceLineItem[] | null) ?? undefined,
                                vatRate: proposal.vat_rate,
                                vatAmount: proposal.vat_amount,
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
                                lineItems:
                                  (proposal.line_items as InvoiceLineItem[] | null) ?? undefined,
                                vatRate: proposal.vat_rate,
                                vatAmount: proposal.vat_amount,
                                amountPaid: balanceFor(proposal).totalPaid,
                                status: proposal.status,
                                createdAt: proposal.created_at,
                                paidAt: proposal.paid_at,
                                // Balance-resolving link, not the frozen Stripe URL.
                                paymentLink: proposal.stripe_payment_link
                                  ? paymentResolverUrl(proposal.id)
                                  : null,
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
