"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import { Label } from "@/components/ui/label";
import { ProposalEditor } from "./ProposalEditor";
import { ProposalPDFTemplate, ProposalPDFData } from "./ProposalPDFTemplate";
import {
  LineItemsEditor,
  DEFAULT_LINE_ITEM_ROWS,
  parseLineItemRows,
  toLineItemRows,
  type LineItemRow,
} from "./LineItemsEditor";
import { DEFAULT_PROPOSAL_CONTENT } from "@/lib/proposal-content";
import { computeInvoiceAmounts } from "@/lib/finance/invoiceAmounts";
import { companyDetails } from "@/config/company";
import type { InvoiceLineItem } from "@/lib/pdf/invoiceLineItems";
import { Lead } from "./LeadTable";
import { Loader2, Send, Pencil, Lock, Save, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Proposal {
  id: string;
  amount: number;
  currency: string;
  proposal_content: string | null;
  status: string;
  created_at: string | null;
  // Arrives as Json from the generated row type; cast where it is read.
  line_items?: unknown;
  vat_rate?: number | null;
  vat_amount?: number | null;
}

interface SendProposalDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onLeadUpdate?: (id: string, data: Partial<Lead>) => Promise<void>;
}

// The client's standard UAE Will wording lives in one module so the PDF
// renderers can find the fee-table token in it. Editable before sending.
const defaultProposalContent = DEFAULT_PROPOSAL_CONTENT;

export function SendProposalDialog({
  lead,
  open,
  onOpenChange,
  onSuccess,
  onLeadUpdate,
}: SendProposalDialogProps) {
  const { t } = useTranslation("leadManagement");
  const [items, setItems] = useState<LineItemRow[]>(DEFAULT_LINE_ITEM_ROWS);
  // VAT is per invoice now; blank falls back to the configured default.
  const [vatRate, setVatRate] = useState<string>(String(companyDetails.vatRate));
  const [proposalContent, setProposalContent] = useState(defaultProposalContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProposal, setIsLoadingProposal] = useState(false);
  const [existingProposal, setExistingProposal] = useState<Proposal | null>(null);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [editedLead, setEditedLead] = useState({
    full_name: "",
    email: "",
    phone: "",
    company_name: "",
  });
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const parsedItems = parseLineItemRows(items);
  // Totals come from the shared calculator so the preview, the PDF and the
  // amount the payment link charges can never disagree.
  const amounts = computeInvoiceAmounts(
    { amount: 0, line_items: parsedItems, vat_rate: vatRate === "" ? null : Number(vatRate) },
    companyDetails.vatRate
  );
  const total = amounts.subtotal;

  // Fetch existing proposal and initialize form when dialog opens
  useEffect(() => {
    if (lead && open) {
      // Initialize edited lead data
      setEditedLead({
        full_name: lead.full_name,
        email: lead.email,
        phone: lead.phone || "",
        company_name: lead.company_name || "",
      });
      setIsEditingLead(false);
      fetchExistingProposal();
    }
  }, [lead, open]);

  const fetchExistingProposal = async () => {
    if (!lead) return;

    setIsLoadingProposal(true);
    try {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("lead_id", lead.id)
        .in("status", ["sent", "draft"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error fetching proposal:", error);
      }

      if (data && data.length > 0) {
        const proposal = data[0];
        setExistingProposal(proposal);
        setProposalContent(proposal.proposal_content ?? defaultProposalContent);
        // toLineItemRows carries the stage + quantity back into the editor;
        // rebuilding the rows by hand used to silently unstage a re-sent invoice.
        setItems(toLineItemRows((proposal.line_items ?? null) as InvoiceLineItem[] | null));
        setVatRate(
          proposal.vat_rate != null ? String(proposal.vat_rate) : String(companyDetails.vatRate)
        );
      } else {
        // No existing proposal, use default
        setExistingProposal(null);
        setProposalContent(
          defaultProposalContent.replace("[Client Name]", lead.full_name)
        );
        setItems(DEFAULT_LINE_ITEM_ROWS);
        setVatRate(String(companyDetails.vatRate));
      }
    } catch (error) {
      console.error("Error:", error);
      // Fallback to default content
      setProposalContent(
        defaultProposalContent.replace("[Client Name]", lead.full_name)
      );
    } finally {
      setIsLoadingProposal(false);
    }
  };

  const handleSubmit = async () => {
    if (!lead) return;

    // Validate edited lead data
    if (!editedLead.full_name.trim()) {
      toast.error(t("clientNameRequired"));
      return;
    }
    if (!editedLead.email.trim() || !/\S+@\S+\.\S+/.test(editedLead.email)) {
      toast.error(t("validEmailRequired"));
      return;
    }

    if (parsedItems.length === 0 || total <= 0) {
      toast.error(t("validAmountRequired"));
      return;
    }

    if (!proposalContent.trim()) {
      toast.error(t("enterProposalContent"));
      return;
    }

    setIsSubmitting(true);
    try {
      // Update lead info if changed
      const leadChanged =
        editedLead.full_name !== lead.full_name ||
        editedLead.email !== lead.email ||
        editedLead.phone !== (lead.phone || "") ||
        editedLead.company_name !== (lead.company_name || "");

      if (leadChanged && onLeadUpdate) {
        await onLeadUpdate(lead.id, {
          full_name: editedLead.full_name,
          email: editedLead.email,
          phone: editedLead.phone || null,
          company_name: editedLead.company_name || null,
        });
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const response = await fetch("/api/lead-management/send-proposal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          leadId: lead.id,
          amount: total,
          line_items: parsedItems,
          vat_rate: vatRate === "" ? null : Number(vatRate),
          currency: "AED",
          proposalContent,
          // Pass updated lead info to ensure email goes to correct address
          leadEmail: editedLead.email,
          leadName: editedLead.full_name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send proposal");
      }

      toast.success(t("proposalSentSuccess"));
      onOpenChange(false);
      onSuccess();
      // Reset form
      setItems(DEFAULT_LINE_ITEM_ROWS);
      setVatRate(String(companyDetails.vatRate));
      setProposalContent(defaultProposalContent);
      setExistingProposal(null);
      setIsEditingLead(false);
    } catch (error) {
      console.error("Error sending proposal:", error);
      toast.error(error instanceof Error ? error.message : t("failedToSendProposal"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!lead) return;

    // Validate edited lead data
    if (!editedLead.full_name.trim()) {
      toast.error(t("clientNameRequired"));
      return;
    }
    if (!editedLead.email.trim() || !/\S+@\S+\.\S+/.test(editedLead.email)) {
      toast.error(t("validEmailRequired"));
      return;
    }

    setIsSavingDraft(true);
    try {
      // Update lead info if changed
      const leadChanged =
        editedLead.full_name !== lead.full_name ||
        editedLead.email !== lead.email ||
        editedLead.phone !== (lead.phone || "") ||
        editedLead.company_name !== (lead.company_name || "");

      if (leadChanged && onLeadUpdate) {
        await onLeadUpdate(lead.id, {
          full_name: editedLead.full_name,
          email: editedLead.email,
          phone: editedLead.phone || null,
          company_name: editedLead.company_name || null,
        });
      }

      if (existingProposal) {
        // Update existing draft
        const { error } = await supabase
          .from("proposals")
          .update({
            amount: total,
            line_items: parsedItems,
            vat_rate: vatRate === "" ? null : Number(vatRate),
            proposal_content: proposalContent,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingProposal.id);

        if (error) throw error;
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from("proposals")
          .insert({
            lead_id: lead.id,
            amount: total,
            line_items: parsedItems,
            vat_rate: vatRate === "" ? null : Number(vatRate),
            currency: "AED",
            proposal_content: proposalContent,
            status: "draft",
            invoice_number: `INV-${Date.now()}`,
          })
          .select()
          .single();

        if (error) throw error;
        setExistingProposal(data);
      }

      toast.success(t("draftSaved"));
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error(t("failedToSaveDraft"));
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Prepare preview data
  const previewData: ProposalPDFData | null = lead
    ? {
        invoiceNumber: existingProposal?.id
          ? `PROP-${existingProposal.id.slice(0, 8).toUpperCase()}`
          : `PROP-DRAFT`,
        clientName: editedLead.full_name,
        clientEmail: editedLead.email,
        clientPhone: editedLead.phone || null,
        clientCompany: editedLead.company_name || null,
        amount: total,
        currency: "AED",
        lineItems: parsedItems,
        vatRate: vatRate === "" ? null : Number(vatRate),
        proposalContent: proposalContent,
        createdAt: new Date(),
      }
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("sendProposal")}</DialogTitle>
          <DialogDescription>
            {t("sendProposalTo", { name: lead?.full_name })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Lead Info (Editable) */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t("clientInformation")}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingLead(!isEditingLead)}
                className="h-8 px-2"
              >
                {isEditingLead ? (
                  <>
                    <Lock className="ltr:mr-1 rtl:ml-1 h-3 w-3" />
                    {t("lock")}
                  </>
                ) : (
                  <>
                    <Pencil className="ltr:mr-1 rtl:ml-1 h-3 w-3" />
                    {t("edit")}
                  </>
                )}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("name")} *</Label>
                {isEditingLead ? (
                  <Input
                    value={editedLead.full_name}
                    onChange={(e) =>
                      setEditedLead((prev) => ({ ...prev, full_name: e.target.value }))
                    }
                    placeholder={t("name")}
                  />
                ) : (
                  <p className="font-medium">{editedLead.full_name}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("email")} *</Label>
                {isEditingLead ? (
                  <Input
                    type="email"
                    value={editedLead.email}
                    onChange={(e) =>
                      setEditedLead((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="client@example.com"
                  />
                ) : (
                  <p className="font-medium">{editedLead.email}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("phone")}</Label>
                {isEditingLead ? (
                  <Input
                    value={editedLead.phone}
                    onChange={(e) =>
                      setEditedLead((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="+971 50 123 4567"
                  />
                ) : (
                  <p className="font-medium">{editedLead.phone || "-"}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("company")}</Label>
                {isEditingLead ? (
                  <Input
                    value={editedLead.company_name}
                    onChange={(e) =>
                      setEditedLead((prev) => ({ ...prev, company_name: e.target.value }))
                    }
                    placeholder={t("company")}
                  />
                ) : (
                  <p className="font-medium">{editedLead.company_name || "-"}</p>
                )}
              </div>
            </div>
          </div>

          {/* Estimated Charges */}
          <LineItemsEditor
            items={items}
            onChange={setItems}
            label={t("proposalItems", "Estimated Charges")}
            vatRate={vatRate}
            currency="AED"
          />

          {/* VAT is set per invoice — leave blank to fall back to the default. */}
          <div className="flex items-end gap-3">
            <div className="w-32 space-y-2">
              <Label htmlFor="proposal-vat-rate">{t("vatRate", "VAT %")}</Label>
              <Input
                id="proposal-vat-rate"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                className="border-[#E6E6E4] focus:border-[#C6A03B]"
              />
            </div>
            <p className="pb-2 text-sm text-muted-foreground">
              {t("proposalTotalsSummary", "Subtotal {{subtotal}} · {{vatLabel}} {{vat}} · Total {{total}}", {
                subtotal: amounts.subtotal.toFixed(2),
                vatLabel: amounts.vatLabel,
                vat: amounts.vatAmount.toFixed(2),
                total: amounts.invoiceTotal.toFixed(2),
              })}
            </p>
          </div>

          {/* Proposal Content */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>{t("proposalAgreement")} *</Label>
              {existingProposal && (
                <span className="text-xs text-muted-foreground bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                  {t("editingExistingProposal")}
                </span>
              )}
            </div>
            {isLoadingProposal ? (
              <div className="border rounded-md p-4 min-h-[200px] bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ProposalEditor
                content={proposalContent}
                onChange={setProposalContent}
                placeholder={t("writeProposalPlaceholder")}
              />
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isSavingDraft}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSubmitting || isSavingDraft}
            >
              {isSavingDraft ? (
                <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              )}
              {t("saveDraft")}
            </Button>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowPreview(true)}
              disabled={isSubmitting || isSavingDraft}
            >
              <Eye className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              {t("preview")}
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || isSavingDraft}>
              {isSubmitting ? (
                <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              )}
              {t("sendProposal")}
            </Button>
          </div>
        </DialogFooter>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("previewProposal")}</DialogTitle>
              <DialogDescription>
                {t("previewProposalDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="border rounded-lg overflow-hidden">
              {previewData && <ProposalPDFTemplate data={previewData} />}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                {t("close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
