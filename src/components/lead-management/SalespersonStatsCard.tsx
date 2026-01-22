"use client";

import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Trophy,
  XCircle,
  Clock,
  TrendingUp,
  DollarSign,
} from "lucide-react";

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

interface SalespersonStatsCardProps {
  stats: SalespersonStats;
  isLoading?: boolean;
}

export function SalespersonStatsCard({ stats, isLoading }: SalespersonStatsCardProps) {
  const { t } = useTranslation("leadManagement");

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const statItems = [
    {
      title: t("totalLeads"),
      value: stats.total,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: t("won"),
      value: stats.won,
      icon: Trophy,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: t("lost"),
      value: stats.lost,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: t("inProgressLeads"),
      value: stats.inProgress,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: t("conversionRate"),
      value: `${stats.conversionRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: t("totalRevenue"),
      value: formatCurrency(stats.totalRevenue, stats.currency || "USD"),
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
              <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-7 bg-gray-200 rounded animate-pulse w-1/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {statItems.map((item) => (
        <Card key={item.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.title}
            </CardTitle>
            <div className={`p-2 rounded-full ${item.bgColor}`}>
              <item.icon className={`h-4 w-4 ${item.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value}</div>
          </CardContent>
        </Card>
      ))}
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
  const currency = currencies.length > 0 ? currencies[0] : "USD";

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
