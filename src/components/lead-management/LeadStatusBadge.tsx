"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type LeadStatus = "not_started" | "contacted" | "consultation" | "consultation_completed" | "meeting" | "hold" | "qualified" | "negotiation" | "pending" | "won" | "lost" | "unreachable";

interface LeadStatusBadgeProps {
  status: LeadStatus;
  className?: string;
}

const statusConfig: Record<
  LeadStatus,
  { label: string; className: string }
> = {
  not_started: {
    label: "Not Started",
    className: "bg-[#F5F5F5] text-[#6B6B6B] border-0",
  },
  contacted: {
    label: "Contacted",
    className: "bg-[#E6F7F1] text-[#0C5536] border-0",
  },
  consultation: {
    label: "Consultation",
    className: "bg-[#E6F4FF] text-[#0369A1] border-0",
  },
  consultation_completed: {
    label: "Consultation Completed",
    className: "bg-[#DCFCE7] text-[#166534] border-0",
  },
  meeting: {
    label: "Meeting",
    className: "bg-[#E6F0FF] text-[#2563EB] border-0",
  },
  hold: {
    label: "On Hold",
    className: "bg-[#FFF4E6] text-[#D97706] border-0",
  },
  qualified: {
    label: "Qualified",
    className: "bg-[#F3E8FF] text-[#7C3AED] border-0",
  },
  negotiation: {
    label: "Negotiation",
    className: "bg-[#EEF2FF] text-[#4F46E5] border-0",
  },
  pending: {
    label: "Pending",
    className: "bg-[#FFF9E6] text-[#C6A03B] border-0",
  },
  won: {
    label: "Won",
    className: "bg-[#E6F7F1] text-[#0C5536] border-0 font-semibold",
  },
  lost: {
    label: "Lost",
    className: "bg-[#FEECEC] text-[#C0392B] border-0",
  },
  unreachable: {
    label: "Unreachable",
    className: "bg-[#E5E5E5] text-[#737373] border-0",
  },
};

export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant="secondary" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
