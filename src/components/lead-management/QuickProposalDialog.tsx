"use client";

import { useState } from "react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Lead } from "./LeadTable";
import { Loader2, Send, ChevronDown, ChevronUp, FileText, User, Mail } from "lucide-react";
import { toast } from "sonner";
import { generateProposalContent } from "@/lib/proposal-template";

interface QuickProposalDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function QuickProposalDialog({
  lead,
  open,
  onOpenChange,
  onSuccess,
}: QuickProposalDialogProps) {
  const { t } = useTranslation("leadManagement");
  const [price, setPrice] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Generate preview content
  const previewContent = lead
    ? generateProposalContent({
        clientName: lead.full_name,
        price: parseFloat(price) || 0,
        currency: "AED",
        invoiceNumber: "INV-PREVIEW",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
    : "";

  const handleSubmit = async () => {
    if (!lead) return;

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error(t("validAmountRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/lead-management/send-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          amount: priceNum,
          currency: "AED",
          useTemplate: true, // Flag to use the fixed template
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
      setPrice("");
      setShowPreview(false);
    } catch (error) {
      console.error("Error sending proposal:", error);
      toast.error(error instanceof Error ? error.message : t("failedToSendProposal"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setPrice("");
    setShowPreview(false);
    onOpenChange(false);
  };

  const formattedPrice = parseFloat(price) || 0;
  const displayPrice = new Intl.NumberFormat("en-AE", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(formattedPrice);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-[#C6A03B]" />
            <span className="text-[hsl(var(--jw-primary-green))]">
              {t("completeAndSendProposal", "Complete & Send Proposal")}
            </span>
          </DialogTitle>
          <DialogDescription>
            {t("quickProposalDescription", "Send a proposal to the client with the quoted price.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Client Information (Read-only) */}
          <div className="p-4 bg-[#FAFAF8] border border-[#E6E6E4] rounded-lg space-y-3">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("clientInformation")}
            </Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{lead?.full_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{lead?.email}</span>
              </div>
            </div>
          </div>

          {/* Price Input - THE ONLY EDITABLE FIELD */}
          <div className="space-y-2">
            <Label htmlFor="price" className="text-base font-semibold">
              {t("priceAED", "Price (AED)")} *
            </Label>
            <div className="relative">
              <span className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                AED
              </span>
              <Input
                id="price"
                type="number"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="ltr:pl-14 rtl:pr-14 text-lg font-semibold h-12"
                min="0"
                step="0.01"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("priceHint", "Enter the quoted price for will drafting services")}
            </p>
          </div>

          {/* Proposal Preview (Collapsible) */}
          <Collapsible open={showPreview} onOpenChange={setShowPreview}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-between p-3 h-auto border border-[#E6E6E4] rounded-lg hover:bg-[#FAFAF8]"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#C6A03B]" />
                  <span className="text-sm font-medium">
                    {t("previewProposal", "Preview Proposal Template")}
                  </span>
                </div>
                {showPreview ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="border border-[#E6E6E4] rounded-lg p-4 bg-white max-h-[300px] overflow-y-auto">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewContent }}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Summary */}
          {formattedPrice > 0 && (
            <div className="p-4 bg-[#F0FDF4] border border-[#22C55E]/20 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#166534]">
                  {t("proposalTotal", "Proposal Total")}
                </span>
                <span className="text-lg font-bold text-[#166534]">
                  AED {displayPrice}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 border-t border-[#E6E6E4] pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="border-[#E6E6E4] hover:bg-[#F5F5F3]"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !price || parseFloat(price) <= 0}
            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
          >
            {isSubmitting ? (
              <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
            )}
            {t("sendProposal")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
