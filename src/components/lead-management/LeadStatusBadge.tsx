"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type LeadStatus = "not_started" | "contacted" | "consultation" | "meeting" | "hold" | "qualified" | "negotiation" | "pending" | "won" | "lost";

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
    className: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  },
  contacted: {
    label: "Contacted",
    className: "bg-teal-100 text-teal-700 hover:bg-teal-100",
  },
  consultation: {
    label: "Consultation",
    className: "bg-cyan-100 text-cyan-700 hover:bg-cyan-100",
  },
  meeting: {
    label: "Meeting",
    className: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  },
  hold: {
    label: "On Hold",
    className: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  },
  qualified: {
    label: "Qualified",
    className: "bg-purple-100 text-purple-700 hover:bg-purple-100",
  },
  negotiation: {
    label: "Negotiation",
    className: "bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
  },
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
  },
  won: {
    label: "Won",
    className: "bg-green-100 text-green-700 hover:bg-green-100",
  },
  lost: {
    label: "Lost",
    className: "bg-red-100 text-red-700 hover:bg-red-100",
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
