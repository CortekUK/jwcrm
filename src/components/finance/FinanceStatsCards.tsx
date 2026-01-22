"use client";

import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Clock,
} from "lucide-react";
import { FinanceStats } from "@/types/finance";

interface FinanceStatsCardsProps {
  stats: FinanceStats;
  isLoading?: boolean;
}

export function FinanceStatsCards({ stats, isLoading }: FinanceStatsCardsProps) {
  const { t } = useTranslation("finance");

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
      title: t("totalInvoices"),
      value: stats.totalInvoices,
      subValue: formatCurrency(stats.totalInvoiceAmount, stats.currency),
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: t("paidInvoices"),
      value: stats.paidInvoices,
      subValue: formatCurrency(stats.paidAmount, stats.currency),
      icon: CreditCard,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: t("pendingInvoices"),
      value: stats.pendingInvoices,
      subValue: formatCurrency(stats.pendingAmount, stats.currency),
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: t("totalEarnings"),
      value: formatCurrency(stats.totalEarnings, stats.currency),
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: t("totalExpenses"),
      value: formatCurrency(stats.totalExpenses, stats.currency),
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: t("netProfit"),
      value: formatCurrency(stats.netProfit, stats.currency),
      icon: DollarSign,
      color: stats.netProfit >= 0 ? "text-green-600" : "text-red-600",
      bgColor: stats.netProfit >= 0 ? "bg-green-50" : "bg-red-50",
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
              <div className="h-7 bg-gray-200 rounded animate-pulse w-1/3 mb-2" />
              <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
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
            {item.subValue && (
              <p className="text-xs text-muted-foreground mt-1">{item.subValue}</p>
            )}
          </CardContent>
        </Card>
      ))}
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
  const currency = currencies.length > 0 ? currencies[0] : "USD";

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
