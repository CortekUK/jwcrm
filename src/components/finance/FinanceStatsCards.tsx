"use client";

import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  Banknote,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { FinanceStats, ExtendedFinanceStats } from "@/types/finance";
import { cn } from "@/lib/utils";
import { subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";

export type KPICardAction = 
  | { tab: "invoices"; filter?: string }
  | { tab: "transactions"; filter?: string }
  | { tab: "analytics" };

interface FinanceStatsCardsProps {
  stats: FinanceStats;
  previousStats?: ExtendedFinanceStats;
  isLoading?: boolean;
  onCardClick?: (action: KPICardAction) => void;
}

export function FinanceStatsCards({ stats, previousStats, isLoading, onCardClick }: FinanceStatsCardsProps) {
  const { t } = useTranslation("finance");

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
      id: "totalInvoices",
      title: t("totalInvoices"),
      value: stats.totalInvoices,
      subValue: formatCurrency(stats.totalInvoiceAmount, stats.currency),
      icon: FileText,
      comparison: calculateChange(stats.totalInvoices, previousStats?.totalInvoices),
      action: { tab: "invoices" as const },
    },
    {
      id: "paidInvoices",
      title: t("paidInvoices"),
      value: stats.paidInvoices,
      subValue: formatCurrency(stats.paidAmount, stats.currency),
      icon: CreditCard,
      comparison: calculateChange(stats.paidInvoices, previousStats?.paidInvoices),
      action: { tab: "invoices" as const, filter: "paid" },
    },
    {
      id: "pendingInvoices",
      title: t("pendingInvoices"),
      value: stats.pendingInvoices,
      subValue: formatCurrency(stats.pendingAmount, stats.currency),
      icon: Clock,
      comparison: calculateChange(stats.pendingInvoices, previousStats?.pendingInvoices),
      invertComparison: true, // Less pending = better
      action: { tab: "invoices" as const, filter: "sent" },
    },
    {
      id: "totalEarnings",
      title: t("totalEarnings"),
      value: formatCurrency(stats.totalEarnings, stats.currency),
      icon: TrendingUp,
      comparison: calculateChange(stats.totalEarnings, previousStats?.totalEarnings),
      action: { tab: "transactions" as const, filter: "earning" },
    },
    {
      id: "totalExpenses",
      title: t("totalExpenses"),
      value: formatCurrency(stats.totalExpenses, stats.currency),
      icon: TrendingDown,
      comparison: calculateChange(stats.totalExpenses, previousStats?.totalExpenses),
      invertComparison: true, // Less expenses = better
      action: { tab: "transactions" as const, filter: "expense" },
    },
    {
      id: "netProfit",
      title: t("netProfit"),
      value: formatCurrency(stats.netProfit, stats.currency),
      icon: Banknote,
      isProfit: true,
      profitValue: stats.netProfit,
      comparison: calculateChange(stats.netProfit, previousStats?.netProfit),
      action: { tab: "analytics" as const },
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
                <div className="h-10 w-10 rounded-full bg-[#E6E6E4] animate-pulse" />
              </div>
              <div className="h-7 bg-[#E6E6E4] rounded animate-pulse w-1/3 mb-2" />
              <div className="h-4 bg-[#E6E6E4] rounded animate-pulse w-2/3" />
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
              "border-[#E6E6E4] transition-all duration-200",
              onCardClick && "cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-[hsl(var(--jw-gold-accent))]"
            )}
            onClick={() => onCardClick?.(item.action)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#6B6B6B]">{item.title}</p>
                <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-[#0C5536]" />
                </div>
              </div>
              <p className={`text-2xl font-bold mt-2 ${
                item.isProfit 
                  ? item.profitValue && item.profitValue >= 0 
                    ? "text-[#0C5536]" 
                    : "text-[#C0392B]"
                  : "text-[#222222]"
              }`}>
                {item.value}
              </p>
              <div className="flex items-center justify-between mt-1">
                {item.subValue && (
                  <p className="text-xs text-[#6B6B6B]">{item.subValue}</p>
                )}
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Helper function to calculate stats
export function calculateFinanceStats(
  proposals: Array<{
    status: string;
    amount: number;
    currency: string;
  }>,
  transactions: Array<{
    type: string;
    amount: number;
    currency: string;
  }>
): FinanceStats {
  // Invoice stats
  const totalInvoices = proposals.length;
  const totalInvoiceAmount = proposals.reduce((sum, p) => sum + p.amount, 0);

  const paidProposals = proposals.filter((p) => p.status === "paid");
  const paidInvoices = paidProposals.length;
  const paidAmount = paidProposals.reduce((sum, p) => sum + p.amount, 0);

  const pendingProposals = proposals.filter((p) => p.status === "sent");
  const pendingInvoices = pendingProposals.length;
  const pendingAmount = pendingProposals.reduce((sum, p) => sum + p.amount, 0);

  // Transaction stats
  const earnings = transactions.filter((t) => t.type === "earning");
  const expenses = transactions.filter((t) => t.type === "expense");
  const totalEarnings = earnings.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
  const netProfit = paidAmount + totalEarnings - totalExpenses;

  // Status breakdown
  const statusBreakdown = {
    draft: {
      count: proposals.filter((p) => p.status === "draft").length,
      amount: proposals.filter((p) => p.status === "draft").reduce((sum, p) => sum + p.amount, 0),
    },
    sent: {
      count: proposals.filter((p) => p.status === "sent").length,
      amount: proposals.filter((p) => p.status === "sent").reduce((sum, p) => sum + p.amount, 0),
    },
    paid: {
      count: proposals.filter((p) => p.status === "paid").length,
      amount: proposals.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0),
    },
    cancelled: {
      count: proposals.filter((p) => p.status === "cancelled").length,
      amount: proposals.filter((p) => p.status === "cancelled").reduce((sum, p) => sum + p.amount, 0),
    },
  };

  // Get the most common currency
  const currencies = [
    ...proposals.map((p) => p.currency),
    ...transactions.map((t) => t.currency),
  ];
  const currency = currencies.length > 0 ? currencies[0] : "AED";

  return {
    totalInvoices,
    totalInvoiceAmount,
    paidInvoices,
    paidAmount,
    pendingInvoices,
    pendingAmount,
    totalEarnings,
    totalExpenses,
    netProfit,
    statusBreakdown,
    currency,
  };
}

// Calculate stats for previous month for comparison
export function calculatePreviousPeriodStats(
  proposals: Array<{
    status: string;
    amount: number;
    currency: string;
    created_at: string;
    paid_at?: string | null;
  }>,
  transactions: Array<{
    type: string;
    amount: number;
    currency: string;
    transaction_date: string;
  }>
): ExtendedFinanceStats | undefined {
  const now = new Date();
  const prevMonth = subMonths(now, 1);
  const periodStart = startOfMonth(prevMonth);
  const periodEnd = endOfMonth(prevMonth);

  // Filter proposals from previous month
  const prevProposals = proposals.filter((p) => {
    try {
      const createdDate = parseISO(p.created_at);
      return isWithinInterval(createdDate, { start: periodStart, end: periodEnd });
    } catch {
      return false;
    }
  });

  // Filter transactions from previous month
  const prevTransactions = transactions.filter((t) => {
    try {
      const txDate = parseISO(t.transaction_date);
      return isWithinInterval(txDate, { start: periodStart, end: periodEnd });
    } catch {
      return false;
    }
  });

  // If no data, return undefined
  if (prevProposals.length === 0 && prevTransactions.length === 0) {
    return undefined;
  }

  const baseStats = calculateFinanceStats(prevProposals, prevTransactions);
  
  return {
    ...baseStats,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}
