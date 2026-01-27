"use client";

import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  Trophy,
  XCircle,
  Clock,
  TrendingUp,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SalespersonStats {
  total: number;
  won: number;
  lost: number;
  pending: number;
  inProgress: number;
  conversionRate: number;
  totalRevenue: number;
  currency?: string;
}

export interface PreviousPeriodStats {
  total?: number;
  won?: number;
  lost?: number;
  inProgress?: number;
  conversionRate?: number;
  totalRevenue?: number;
}

export type KPICardAction = 
  | { type: "filter"; status?: string; paid?: boolean }
  | { type: "analytics" }
  | { type: "all" };

interface SalespersonStatsCardProps {
  stats: SalespersonStats;
  previousStats?: PreviousPeriodStats;
  isLoading?: boolean;
  onCardClick?: (action: KPICardAction) => void;
}

export function SalespersonStatsCard({ 
  stats, 
  previousStats,
  isLoading,
  onCardClick,
}: SalespersonStatsCardProps) {
  const { t } = useTranslation("leadManagement");

  const formatCurrency = (amount: number, currency: string = "AED") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const calculateChange = (current: number, previous: number | undefined): { change: number; isPositive: boolean } | null => {
    if (previous === undefined || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return { change: Math.abs(change), isPositive: change >= 0 };
  };

  const statItems = [
    {
      id: "total",
      title: t("totalLeads"),
      value: stats.total,
      icon: Users,
      comparison: calculateChange(stats.total, previousStats?.total),
      action: { type: "all" as const },
    },
    {
      id: "won",
      title: t("won"),
      value: stats.won,
      icon: Trophy,
      comparison: calculateChange(stats.won, previousStats?.won),
      action: { type: "filter" as const, status: "won" },
      iconColor: "text-[#0C5536]",
      bgColor: "bg-[#E6F7F1]",
    },
    {
      id: "lost",
      title: t("lost"),
      value: stats.lost,
      icon: XCircle,
      comparison: calculateChange(stats.lost, previousStats?.lost),
      invertComparison: true, // Less lost = better
      action: { type: "filter" as const, status: "lost" },
      iconColor: "text-[#C0392B]",
      bgColor: "bg-[#FEECEC]",
    },
    {
      id: "inProgress",
      title: t("inProgressLeads"),
      value: stats.inProgress,
      icon: Clock,
      comparison: calculateChange(stats.inProgress, previousStats?.inProgress),
      action: { type: "filter" as const, status: "in_progress" },
      iconColor: "text-[#C6A03B]",
      bgColor: "bg-[#FFF9E6]",
    },
    {
      id: "conversionRate",
      title: t("conversionRate"),
      value: `${stats.conversionRate.toFixed(1)}%`,
      icon: TrendingUp,
      comparison: calculateChange(stats.conversionRate, previousStats?.conversionRate),
      action: { type: "analytics" as const },
      iconColor: "text-[#2563EB]",
      bgColor: "bg-[#E6F0FF]",
    },
    {
      id: "totalRevenue",
      title: t("totalRevenue"),
      value: formatCurrency(stats.totalRevenue, stats.currency || "AED"),
      icon: Banknote,
      comparison: calculateChange(stats.totalRevenue, previousStats?.totalRevenue),
      action: { type: "filter" as const, paid: true },
      iconColor: "text-[#0C5536]",
      bgColor: "bg-[#E6F7F1]",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="border-[#E6E6E4]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="h-4 bg-[#E6E6E4] rounded animate-pulse w-1/2" />
                <div className="h-12 w-12 rounded-full bg-[#E6E6E4] animate-pulse" />
              </div>
              <div className="h-8 bg-[#E6E6E4] rounded animate-pulse w-1/3" />
              <div className="h-0.5 w-0 bg-[#E6E6E4] mt-3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {statItems.map((item) => {
        const isPositiveChange = item.comparison 
          ? (item.invertComparison ? !item.comparison.isPositive : item.comparison.isPositive)
          : null;
        
        return (
          <Card 
            key={item.id} 
            className={cn(
              "border-[#E6E6E4] transition-all duration-200 group",
              onCardClick && "cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-[hsl(var(--jw-gold-accent))]"
            )}
            onClick={() => onCardClick?.(item.action)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-[#6B6B6B]">
                  {item.title}
                </p>
                <div 
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full transition-transform group-hover:scale-110",
                    item.bgColor || "bg-[rgba(198,160,59,0.15)]"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", item.iconColor || "text-[hsl(var(--jw-primary-green))]")} />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div className="text-3xl font-bold tracking-tight text-[#222222]">{item.value}</div>
                {item.comparison && (
                  <div className={cn(
                    "flex items-center gap-0.5 text-xs font-medium",
                    isPositiveChange ? "text-[#0C5536]" : "text-[#C0392B]"
                  )}>
                    {isPositiveChange ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    <span>{item.comparison.change.toFixed(0)}%</span>
                  </div>
                )}
              </div>
              {/* Animated underline on hover */}
              <div className="h-0.5 w-0 group-hover:w-full bg-[#C6A03B] transition-all duration-300 mt-3" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Helper function to calculate stats from leads
export function calculateSalespersonStats(
  leads: Array<{
    status: string;
    is_paid: boolean;
    paid_amount: number | null;
    paid_currency: string | null;
  }>
): SalespersonStats {
  const total = leads.length;
  const won = leads.filter((l) => l.status === "won").length;
  const lost = leads.filter((l) => l.status === "lost").length;
  const pending = leads.filter((l) => l.status === "pending").length;
  const inProgress = leads.filter(
    (l) => !["won", "lost", "pending"].includes(l.status)
  ).length;

  const conversionRate = total > 0 ? (won / total) * 100 : 0;

  const totalRevenue = leads
    .filter((l) => l.is_paid && l.paid_amount)
    .reduce((sum, l) => sum + (l.paid_amount || 0), 0);

  // Get the most common currency
  const currencies = leads
    .filter((l) => l.paid_currency)
    .map((l) => l.paid_currency!);
  const currency = currencies.length > 0 ? currencies[0] : "AED";

  return {
    total,
    won,
    lost,
    pending,
    inProgress,
    conversionRate,
    totalRevenue,
    currency,
  };
}

// Helper function to calculate stats for previous period (for comparison)
export function calculatePreviousPeriodStats(
  leads: Array<{
    status: string;
    is_paid: boolean;
    paid_amount: number | null;
    paid_currency: string | null;
    created_at: string;
  }>,
  periodStartDate: Date,
  periodEndDate: Date
): PreviousPeriodStats {
  const filteredLeads = leads.filter((l) => {
    const createdDate = new Date(l.created_at);
    return createdDate >= periodStartDate && createdDate <= periodEndDate;
  });

  if (filteredLeads.length === 0) {
    return {};
  }

  const stats = calculateSalespersonStats(filteredLeads);
  
  return {
    total: stats.total,
    won: stats.won,
    lost: stats.lost,
    inProgress: stats.inProgress,
    conversionRate: stats.conversionRate,
    totalRevenue: stats.totalRevenue,
  };
}
