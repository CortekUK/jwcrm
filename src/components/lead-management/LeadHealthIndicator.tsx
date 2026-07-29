"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Flame, 
  Clock, 
  AlertTriangle, 
  Calendar,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { differenceInDays, parseISO, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface LeadHealthIndicatorProps {
  lastContactDate?: string | null;
  nextActionDate?: string | null;
  createdAt: string;
  updatedAt: string;
  status: string;
  isPaid?: boolean;
  compact?: boolean;
  showAll?: boolean;
}

type HealthStatus = "hot" | "warm" | "stale" | "cold" | "won" | "lost" | "unreachable";

interface HealthIndicator {
  status: HealthStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

export function LeadHealthIndicator({
  lastContactDate,
  nextActionDate,
  createdAt,
  updatedAt,
  status,
  isPaid,
  compact = false,
  showAll = false,
}: LeadHealthIndicatorProps) {
  const { t } = useTranslation("leadManagement");

  const healthIndicators: Record<HealthStatus, Omit<HealthIndicator, "status">> = {
    hot: {
      label: t("hotLead", "Hot"),
      icon: Flame,
      color: "text-[#C0392B]",
      bgColor: "bg-[#FEECEC]",
      borderColor: "border-[#C0392B]/20",
      description: t("hotLeadDesc", "Recently active, high engagement"),
    },
    warm: {
      label: t("warmLead", "Warm"),
      icon: TrendingUp,
      color: "text-[#D97706]",
      bgColor: "bg-[#FFF7ED]",
      borderColor: "border-[#D97706]/20",
      description: t("warmLeadDesc", "Active in the past week"),
    },
    stale: {
      label: t("staleLead", "Stale"),
      icon: Clock,
      color: "text-[#6B6B6B]",
      bgColor: "bg-[#F5F5F5]",
      borderColor: "border-[#E6E6E4]",
      description: t("staleLeadDesc", "No contact in 7+ days"),
    },
    cold: {
      label: t("coldLead", "Cold"),
      icon: AlertTriangle,
      color: "text-[#4B5563]",
      bgColor: "bg-[#F3F4F6]",
      borderColor: "border-[#D1D5DB]",
      description: t("coldLeadDesc", "No contact in 14+ days"),
    },
    won: {
      label: t("won", "Won"),
      icon: CheckCircle2,
      color: "text-[#0C5536]",
      bgColor: "bg-[#E6F7F1]",
      borderColor: "border-[#0C5536]/20",
      description: t("wonLeadDesc", "Deal closed successfully"),
    },
    lost: {
      label: t("lost", "Lost"),
      icon: AlertTriangle,
      color: "text-[#C0392B]",
      bgColor: "bg-[#FEECEC]",
      borderColor: "border-[#C0392B]/20",
      description: t("lostLeadDesc", "Deal lost"),
    },
    unreachable: {
      label: t("unreachable", "Unreachable"),
      icon: AlertTriangle,
      color: "text-[#737373]",
      bgColor: "bg-[#E5E5E5]",
      borderColor: "border-[#737373]/20",
      description: t("unreachableLeadDesc", "Could not contact after 3 attempts"),
    },
  };

  const health = useMemo((): HealthIndicator | null => {
    // Won, Lost, or Unreachable statuses take precedence
    if (status === "won") {
      return { status: "won", ...healthIndicators.won };
    }
    if (status === "lost") {
      return { status: "lost", ...healthIndicators.lost };
    }
    if (status === "unreachable") {
      return { status: "unreachable", ...healthIndicators.unreachable };
    }

    // Calculate days since last activity
    const lastActivity = lastContactDate 
      ? parseISO(lastContactDate) 
      : parseISO(updatedAt);
    const daysSinceActivity = differenceInDays(new Date(), lastActivity);
    const daysSinceCreation = differenceInDays(new Date(), parseISO(createdAt));

    // Determine health status based on activity
    if (daysSinceActivity <= 2 && daysSinceCreation <= 7) {
      return { status: "hot", ...healthIndicators.hot };
    }
    if (daysSinceActivity <= 7) {
      return { status: "warm", ...healthIndicators.warm };
    }
    if (daysSinceActivity <= 14) {
      return { status: "stale", ...healthIndicators.stale };
    }
    return { status: "cold", ...healthIndicators.cold };
  }, [lastContactDate, updatedAt, createdAt, status, healthIndicators]);

  const daysSinceContact = useMemo(() => {
    const lastActivity = lastContactDate 
      ? parseISO(lastContactDate) 
      : parseISO(updatedAt);
    return differenceInDays(new Date(), lastActivity);
  }, [lastContactDate, updatedAt]);

  const nextActionInfo = useMemo(() => {
    if (!nextActionDate) return null;
    
    const actionDate = parseISO(nextActionDate);
    const daysUntil = differenceInDays(actionDate, new Date());
    const isOverdue = daysUntil < 0;
    
    return {
      daysUntil,
      isOverdue,
      formattedDate: formatDistanceToNow(actionDate, { addSuffix: true }),
    };
  }, [nextActionDate]);

  if (!health) return null;

  const Icon = health.icon;

  // Compact mode - single badge
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="status"
              className={cn(
                "gap-1 whitespace-nowrap border cursor-default",
                health.bgColor,
                health.color,
                health.borderColor
              )}
            >
              <Icon className="h-3 w-3" />
              {health.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{health.description}</p>
            {daysSinceContact > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("lastContact", "Last contact")}: {daysSinceContact} {t("daysAgo", "days ago")}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full mode - multiple indicators
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Health badge */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="status"
              className={cn(
                "gap-1 whitespace-nowrap border cursor-default",
                health.bgColor,
                health.color,
                health.borderColor
              )}
            >
              <Icon className="h-3 w-3" />
              {health.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{health.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Days since contact - only show if stale or cold */}
      {showAll && (health.status === "stale" || health.status === "cold") && daysSinceContact > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className="gap-1 text-[#6B6B6B] border-[#E6E6E4] bg-white cursor-default"
              >
                <Clock className="h-3 w-3" />
                {daysSinceContact}d
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("daysSinceContact", "Days since last contact")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Next action due */}
      {showAll && nextActionInfo && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="status"
                className={cn(
                  "gap-1 whitespace-nowrap cursor-default",
                  nextActionInfo.isOverdue 
                    ? "bg-[#FEECEC] text-[#C0392B] border-[#C0392B]/20" 
                    : nextActionInfo.daysUntil <= 2
                      ? "bg-[#FFF9E6] text-[#C6A03B] border-[#C6A03B]/20"
                      : "bg-[#E6F7F1] text-[#0C5536] border-[#0C5536]/20"
                )}
              >
                <Calendar className="h-3 w-3" />
                {nextActionInfo.isOverdue 
                  ? t("overdue", "Overdue")
                  : nextActionInfo.formattedDate
                }
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("nextActionDue", "Next action due")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Paid indicator */}
      {isPaid && (
        <Badge variant="status" className="bg-[#E6F7F1] text-[#0C5536] border-0 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {t("paid")}
        </Badge>
      )}
    </div>
  );
}

// Helper function to get health status from lead data
export function getLeadHealthStatus(lead: {
  created_at: string;
  updated_at: string;
  status: string;
  last_contact_date?: string | null;
}): HealthStatus {
  if (lead.status === "won") return "won";
  if (lead.status === "lost") return "lost";
  if (lead.status === "unreachable") return "unreachable";

  const lastActivity = lead.last_contact_date 
    ? parseISO(lead.last_contact_date) 
    : parseISO(lead.updated_at);
  const daysSinceActivity = differenceInDays(new Date(), lastActivity);
  const daysSinceCreation = differenceInDays(new Date(), parseISO(lead.created_at));

  if (daysSinceActivity <= 2 && daysSinceCreation <= 7) return "hot";
  if (daysSinceActivity <= 7) return "warm";
  if (daysSinceActivity <= 14) return "stale";
  return "cold";
}
