"use client";

import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import {
  UserPlus,
  UserCheck,
  FileText,
  Send,
  CreditCard,
  Clock,
  MessageCircle,
  Phone,
  Mail,
  Video,
  Users,
  Pencil,
  Trash2,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TimelineEvent {
  id: string;
  type: "created" | "assigned" | "proposal_created" | "proposal_sent" | "invoice_sent" | "payment_received" | "communication";
  timestamp: string;
  title: string;
  description: string;
  metadata?: {
    proposalId?: string;
    invoiceNumber?: string;
    amount?: number;
    currency?: string;
    salespersonName?: string;
    communicationMethod?: string;
    communicationIcon?: string;
  };
}

interface LeadHistoryTimelineProps {
  events: TimelineEvent[];
  isLoading?: boolean;
  canEdit?: boolean;
  onEditCommunication?: (communicationId: string) => void;
  onDeleteCommunication?: (communicationId: string) => void;
}

export function LeadHistoryTimeline({ events, isLoading, canEdit, onEditCommunication, onDeleteCommunication }: LeadHistoryTimelineProps) {
  const { t } = useTranslation("leadManagement");

  const getCommunicationIcon = (iconName?: string) => {
    switch (iconName) {
      case "phone":
        return <Phone className="h-4 w-4" />;
      case "message-circle":
        return <MessageCircle className="h-4 w-4" />;
      case "mail":
        return <Mail className="h-4 w-4" />;
      case "video":
        return <Video className="h-4 w-4" />;
      case "users":
        return <Users className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getEventIcon = (type: TimelineEvent["type"], metadata?: TimelineEvent["metadata"]) => {
    switch (type) {
      case "created":
        return <UserPlus className="h-4 w-4" />;
      case "assigned":
        return <UserCheck className="h-4 w-4" />;
      case "proposal_created":
        return <FileText className="h-4 w-4" />;
      case "proposal_sent":
        return <Send className="h-4 w-4" />;
      case "invoice_sent":
        return <Receipt className="h-4 w-4" />;
      case "payment_received":
        return <CreditCard className="h-4 w-4" />;
      case "communication":
        return getCommunicationIcon(metadata?.communicationIcon);
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "created":
        return "bg-[#E6F0FF] text-[#2563EB] border-[#E6F0FF]";
      case "assigned":
        return "bg-[#F3E8FF] text-[#7C3AED] border-[#F3E8FF]";
      case "proposal_created":
        return "bg-[#F5F5F5] text-[#6B6B6B] border-[#F5F5F5]";
      case "proposal_sent":
        return "bg-[#FFF9E6] text-[#C6A03B] border-[#FFF9E6]";
      case "invoice_sent":
        return "bg-[#E6F7F1] text-[#0C5536] border-[#E6F7F1]";
      case "payment_received":
        return "bg-[#E6F7F1] text-[#0C5536] border-[#E6F7F1]";
      case "communication":
        return "bg-[#E6F4FF] text-[#0369A1] border-[#E6F4FF]";
      default:
        return "bg-[#F5F5F5] text-[#6B6B6B] border-[#F5F5F5]";
    }
  };

  const formatCurrency = (amount: number, currency: string = "AED") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-[#E6E6E4] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-[#E6E6E4] rounded animate-pulse w-1/3" />
              <div className="h-3 bg-[#E6E6E4] rounded animate-pulse w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-10 w-10 text-[#C6A03B] mb-3" />
        <p className="font-medium text-[#222222]">{t("noTimelineEvents")}</p>
        <p className="text-sm text-[#6B6B6B] mt-1">{t("noTimelineEventsDescription", "Activity will appear here as it happens")}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute ltr:left-5 rtl:right-5 top-0 bottom-0 w-px bg-[#E6E6E4]" />

      <div className="space-y-6">
        {events.map((event, index) => (
          <div key={event.id} className="relative flex gap-4">
            {/* Icon */}
            <div
              className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 ${getEventColor(
                event.type
              )}`}
            >
              {getEventIcon(event.type, event.metadata)}
            </div>

            {/* Content */}
            <div className="flex-1 pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-[#222222]">{event.title}</h4>
                  <p className="text-sm text-[#777777]">
                    {event.description}
                  </p>
                  {event.metadata?.amount && (
                    <p className="text-sm font-semibold text-[#0C5536] mt-1">
                      {formatCurrency(event.metadata.amount, event.metadata.currency)}
                    </p>
                  )}
                  {event.metadata?.invoiceNumber && (
                    <p className="text-xs text-[#999999] mt-0.5">
                      {t("invoiceNumber")}: {event.metadata.invoiceNumber}
                    </p>
                  )}
                </div>
                <div className="flex items-start gap-2 ltr:ml-4 rtl:mr-4">
                  {canEdit && event.type === "communication" && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[#999999] hover:text-[#0C5536]"
                        onClick={() => onEditCommunication?.(event.id.replace("communication_", ""))}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[#999999] hover:text-[#C0392B]"
                        onClick={() => onDeleteCommunication?.(event.id.replace("communication_", ""))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <time className="text-xs text-[#999999] whitespace-nowrap">
                    {format(new Date(event.timestamp), "MMM d, yyyy")}
                    <br />
                    {format(new Date(event.timestamp), "h:mm a")}
                  </time>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper function to build timeline events from lead data
export function buildTimelineEvents(
  lead: {
    created_at: string;
    assigned_at: string | null;
    assigned_user?: { full_name: string } | null;
  },
  proposals: Array<{
    id: string;
    invoice_number: string;
    amount: number;
    currency: string;
    proposal_content?: string | null;
    created_at: string;
    sent_at: string | null;
    paid_at: string | null;
  }>,
  t: (key: string, options?: Record<string, unknown>) => string,
  communications?: Array<{
    id: string;
    scheduled_at: string;
    notes: string | null;
    communication_method: {
      id: string;
      name: string;
      icon: string;
    } | null;
  }>
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Lead created event
  events.push({
    id: "created",
    type: "created",
    timestamp: lead.created_at,
    title: t("eventCreated"),
    description: t("eventCreatedDescription"),
  });

  // Lead assigned event
  if (lead.assigned_at && lead.assigned_user) {
    events.push({
      id: "assigned",
      type: "assigned",
      timestamp: lead.assigned_at,
      title: t("eventAssigned"),
      description: t("eventAssignedDescription", { name: lead.assigned_user.full_name }),
      metadata: {
        salespersonName: lead.assigned_user.full_name,
      },
    });
  }

  // Communication events
  if (communications) {
    communications.forEach((comm) => {
      events.push({
        id: `communication_${comm.id}`,
        type: "communication",
        timestamp: comm.scheduled_at,
        title: t("eventCommunication", { method: comm.communication_method?.name || t("unknown") }),
        description: comm.notes || t("eventCommunicationDescription"),
        metadata: {
          communicationMethod: comm.communication_method?.name,
          communicationIcon: comm.communication_method?.icon,
        },
      });
    });
  }

  // Proposal / Invoice events
  proposals.forEach((proposal) => {
    const isInvoiceOnly = !proposal.proposal_content;

    // Proposal/Invoice created
    events.push({
      id: `proposal_created_${proposal.id}`,
      type: "proposal_created",
      timestamp: proposal.created_at,
      title: isInvoiceOnly
        ? t("eventInvoiceCreated", "Invoice Created")
        : t("eventProposalCreated"),
      description: isInvoiceOnly
        ? t("eventInvoiceCreatedDescription", { invoiceNumber: proposal.invoice_number, defaultValue: "Invoice {{invoiceNumber}} was created." })
        : t("eventProposalCreatedDescription", { invoiceNumber: proposal.invoice_number }),
      metadata: {
        proposalId: proposal.id,
        invoiceNumber: proposal.invoice_number,
        amount: proposal.amount,
        currency: proposal.currency,
      },
    });

    // Proposal sent / Invoice sent
    if (proposal.sent_at) {
      events.push({
        id: isInvoiceOnly ? `invoice_sent_${proposal.id}` : `proposal_sent_${proposal.id}`,
        type: isInvoiceOnly ? "invoice_sent" : "proposal_sent",
        timestamp: proposal.sent_at,
        title: isInvoiceOnly
          ? t("eventInvoiceSent", "Invoice Sent")
          : t("eventProposalSent"),
        description: isInvoiceOnly
          ? t("eventInvoiceSentDescription", { invoiceNumber: proposal.invoice_number, defaultValue: "Invoice {{invoiceNumber}} was sent to client." })
          : t("eventProposalSentDescription", { invoiceNumber: proposal.invoice_number }),
        metadata: {
          proposalId: proposal.id,
          invoiceNumber: proposal.invoice_number,
          amount: proposal.amount,
          currency: proposal.currency,
        },
      });
    }

    // Payment received
    if (proposal.paid_at) {
      events.push({
        id: `payment_received_${proposal.id}`,
        type: "payment_received",
        timestamp: proposal.paid_at,
        title: t("eventPaymentReceived"),
        description: t("eventPaymentReceivedDescription", { invoiceNumber: proposal.invoice_number }),
        metadata: {
          proposalId: proposal.id,
          invoiceNumber: proposal.invoice_number,
          amount: proposal.amount,
          currency: proposal.currency,
        },
      });
    }
  });

  // Sort by timestamp descending (most recent first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events;
}
