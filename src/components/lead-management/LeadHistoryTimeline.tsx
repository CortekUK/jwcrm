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
} from "lucide-react";

export interface TimelineEvent {
  id: string;
  type: "created" | "assigned" | "proposal_created" | "proposal_sent" | "payment_received" | "communication";
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
}

export function LeadHistoryTimeline({ events, isLoading }: LeadHistoryTimelineProps) {
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
        return "bg-blue-100 text-blue-600 border-blue-200";
      case "assigned":
        return "bg-purple-100 text-purple-600 border-purple-200";
      case "proposal_created":
        return "bg-gray-100 text-gray-600 border-gray-200";
      case "proposal_sent":
        return "bg-yellow-100 text-yellow-600 border-yellow-200";
      case "payment_received":
        return "bg-green-100 text-green-600 border-green-200";
      case "communication":
        return "bg-cyan-100 text-cyan-600 border-cyan-200";
      default:
        return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
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
            <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">{t("noTimelineEvents")}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute ltr:left-5 rtl:right-5 top-0 bottom-0 w-px bg-gray-200" />

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
                  <h4 className="font-medium text-gray-900">{event.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {event.description}
                  </p>
                  {event.metadata?.amount && (
                    <p className="text-sm font-semibold text-green-600 mt-1">
                      {formatCurrency(event.metadata.amount, event.metadata.currency)}
                    </p>
                  )}
                  {event.metadata?.invoiceNumber && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("invoiceNumber")}: {event.metadata.invoiceNumber}
                    </p>
                  )}
                </div>
                <time className="text-xs text-muted-foreground whitespace-nowrap ltr:ml-4 rtl:mr-4">
                  {format(new Date(event.timestamp), "MMM d, yyyy")}
                  <br />
                  {format(new Date(event.timestamp), "h:mm a")}
                </time>
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

  // Proposal events
  proposals.forEach((proposal) => {
    // Proposal created
    events.push({
      id: `proposal_created_${proposal.id}`,
      type: "proposal_created",
      timestamp: proposal.created_at,
      title: t("eventProposalCreated"),
      description: t("eventProposalCreatedDescription", { invoiceNumber: proposal.invoice_number }),
      metadata: {
        proposalId: proposal.id,
        invoiceNumber: proposal.invoice_number,
        amount: proposal.amount,
        currency: proposal.currency,
      },
    });

    // Proposal sent
    if (proposal.sent_at) {
      events.push({
        id: `proposal_sent_${proposal.id}`,
        type: "proposal_sent",
        timestamp: proposal.sent_at,
        title: t("eventProposalSent"),
        description: t("eventProposalSentDescription", { invoiceNumber: proposal.invoice_number }),
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
