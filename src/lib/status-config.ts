import type { Database } from "@/integrations/supabase/types";
import type { LucideIcon } from "lucide-react";
import { Pencil, Clock, Eye, FileText, Send, CheckCircle } from "lucide-react";

export type WillStatus = Database["public"]["Enums"]["will_status"];

export interface StatusConfig {
  label: string;
  description: string;
  color: string;
  icon: typeof Pencil;
  order: number;
  allowedTransitions: WillStatus[];
  isAutomatic: boolean;
  primaryAction?: {
    label: string;
    nextStatus?: WillStatus;
  };
}

export const STATUS_WORKFLOW: Record<WillStatus, StatusConfig> = {
  
  in_progress: {
    label: "In Progress",
    description: "Client is filling out the will form. Not submitted yet.",
    color: "#9E9E9E",
    icon: Pencil,
    order: 1,
    allowedTransitions: ["awaiting_review"],
    isAutomatic: true,
  },
  awaiting_review: {
    label: "Awaiting Review",
    description: "Client submitted form; waiting for lawyer to begin review.",
    color: "#C6A03B",
    icon: Clock,
    order: 2,
    allowedTransitions: ["under_review"],
    isAutomatic: true,
    primaryAction: {
      label: "Start Review",
      nextStatus: "under_review",
    },
  },
  under_review: {
    label: "Under Review",
    description: "Lawyer reviewing submission and generating draft.",
    color: "#557A95",
    icon: Eye,
    order: 3,
    allowedTransitions: ["draft_ready"],
    isAutomatic: false,
    primaryAction: {
      label: "Generate Draft",
      nextStatus: "draft_ready",
    },
  },
  draft_ready: {
    label: "Draft Ready",
    description: "Draft PDF generated or uploaded by lawyer.",
    color: "#0C5536",
    icon: FileText,
    order: 4,
    allowedTransitions: ["draft_released", "under_review"],
    isAutomatic: false,
    primaryAction: {
      label: "Upload or View Draft",
    },
  },
  draft_released: {
    label: "Draft Released",
    description: "Draft sent to client for review/approval.",
    color: "#128277",
    icon: Send,
    order: 5,
    allowedTransitions: ["finalized", "draft_ready"],
    isAutomatic: false,
    primaryAction: {
      label: "Mark as Finalized",
      nextStatus: "finalized",
    },
  },
  finalized: {
    label: "Finalized",
    description: "Final version approved and stored.",
    color: "#083D29",
    icon: CheckCircle,
    order: 6,
    allowedTransitions: [],
    isAutomatic: false,
    primaryAction: {
      label: "Download Final Will",
    },
  },
};

export const getStatusConfig = (status: WillStatus): StatusConfig => STATUS_WORKFLOW[status];

export const getAllowedTransitions = (currentStatus: WillStatus): WillStatus[] =>
  STATUS_WORKFLOW[currentStatus].allowedTransitions;

export const getStatusByOrder = (order: number): StatusConfig | undefined =>
  Object.values(STATUS_WORKFLOW).find((s) => s.order === order);

export const validateStatusTransition = (
  from: WillStatus,
  to: WillStatus,
  isAdmin: boolean
): { valid: boolean; warning?: string; error?: string } => {
  const allowedTransitions = getAllowedTransitions(from);

  // Check if transition is in allowed list
  if (allowedTransitions.includes(to)) return { valid: true };

  // Admin override allowed for backward transitions (with warning)
  if (isAdmin && getStatusConfig(to).order < getStatusConfig(from).order) {
    return {
      valid: true,
      warning: "You are moving backwards in the workflow. Please provide a reason in notes.",
    };
  }

  return {
    valid: false,
    error: "This status transition is not allowed.",
  };
};

// Client-friendly mapping for portal views
export interface ClientStep {
  stepNumber: number;
  label: string;
  description: string;
  color: string;
}

export const clientStatusMap: Record<WillStatus, ClientStep> = {
  in_progress: {
    stepNumber: 1,
    label: "In Progress",
    description: "You are filling out your will form",
    color: "#0C5536", // Green color to match brand
  },
  awaiting_review: {
    stepNumber: 2,
    label: "Submitted for Review",
    description: "Your form has been submitted for lawyer review",
    color: "#F59E0B",
  },
  under_review: {
    stepNumber: 3,
    label: "Under Review",
    description: "Our lawyers are reviewing your details",
    color: "#3B82F6",
  },
  draft_ready: {
    stepNumber: 4,
    label: "Draft Ready",
    description: "Your draft will is ready",
    color: "#10B981",
  },
  draft_released: {
    stepNumber: 4,
    label: "Draft Ready",
    description: "Your draft will is ready for review",
    color: "#10B981",
  },
  finalized: {
    stepNumber: 5,
    label: "Finalized",
    description: "Your will has been finalized",
    color: "#059669",
  },
};

export const getClientStep = (status: WillStatus): ClientStep => clientStatusMap[status];

export const getClientSteps = (): ClientStep[] => [
  clientStatusMap.in_progress,
  clientStatusMap.awaiting_review,
  clientStatusMap.under_review,
  clientStatusMap.draft_released,
];

// Enhanced client-facing status configuration
export interface ClientStatusConfig {
  stepNumber: number;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerIcon: LucideIcon;
  primaryCTA?: {
    label: string;
    route: string;
  };
  secondaryCTA?: {
    label: string;
    route: string;
  };
  showTimeline: boolean;
  readOnlyForm: boolean;
  timelineLabel: string;
  timelineTooltip: string;
}

export const CLIENT_STATUS_MAP: Record<WillStatus, ClientStatusConfig> = {
  in_progress: {
    stepNumber: 1,
    bannerTitle: "portal:banner.inProgress.title",
    bannerSubtitle: "portal:banner.inProgress.subtitle",
    bannerIcon: Pencil,
    primaryCTA: { label: "portal:cta.continueWill", route: "/client/will" },
    showTimeline: true,
    readOnlyForm: false,
    timelineLabel: "portal:documentsPage.inProgress",
    timelineTooltip: "portal:timeline.tooltip.inProgress",
  },
  awaiting_review: {
    stepNumber: 2,
    bannerTitle: "portal:banner.awaitingReview.title",
    bannerSubtitle: "portal:banner.awaitingReview.subtitle",
    bannerIcon: Clock,
    // "/documents" is not a route — it 404'd. Every other CTA here is /client/*.
    primaryCTA: { label: "portal:cta.viewSubmission", route: "/client/documents" },
    showTimeline: true,
    readOnlyForm: true,
    timelineLabel: "portal:documentsPage.statusLabels.awaitingReview",
    timelineTooltip: "portal:timeline.tooltip.awaitingReview",
  },
  under_review: {
    stepNumber: 3,
    bannerTitle: "portal:banner.underReview.title",
    bannerSubtitle: "portal:banner.underReview.subtitle",
    bannerIcon: Eye,
    showTimeline: true,
    readOnlyForm: true,
    timelineLabel: "portal:documentsPage.statusLabels.underReview",
    timelineTooltip: "portal:timeline.tooltip.underReview",
  },
  draft_ready: {
    stepNumber: 3,
    bannerTitle: "portal:banner.draftReady.title",
    bannerSubtitle: "portal:banner.draftReady.subtitle",
    bannerIcon: Eye,
    showTimeline: true,
    readOnlyForm: true,
    timelineLabel: "portal:documentsPage.statusLabels.draftReady",
    timelineTooltip: "portal:timeline.tooltip.draftReady",
  },
  draft_released: {
    stepNumber: 4,
    bannerTitle: "portal:banner.draftReleased.title",
    bannerSubtitle: "portal:banner.draftReleased.subtitle",
    bannerIcon: Send,
    primaryCTA: { label: "portal:cta.downloadDraft", route: "/client/documents" },
    secondaryCTA: { label: "portal:cta.sendFeedback", route: "/client/support" },
    showTimeline: true,
    readOnlyForm: true,
    timelineLabel: "portal:documentsPage.statusLabels.draftReleased",
    timelineTooltip: "portal:timeline.tooltip.draftReleased",
  },
  finalized: {
    stepNumber: 5,
    bannerTitle: "portal:banner.finalized.title",
    bannerSubtitle: "portal:banner.finalized.subtitle",
    bannerIcon: CheckCircle,
    primaryCTA: { label: "portal:cta.downloadFinal", route: "/client/documents" },
    secondaryCTA: { label: "portal:cta.viewDocuments", route: "/client/documents" },
    showTimeline: true,
    readOnlyForm: true,
    timelineLabel: "portal:documentsPage.statusLabels.finalized",
    timelineTooltip: "portal:timeline.tooltip.finalized",
  },
};
