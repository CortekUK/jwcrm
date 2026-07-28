"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, PieChart as PieChartIcon, TrendingDown, TrendingUp } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { FinanceTransaction, Proposal, TransactionCategory, ProposalStatus } from "@/types/finance";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";

type DateRangeOption = "3months" | "6months" | "12months" | "thisYear";

interface ChartClickAction {
  type: "month" | "category" | "status";
  value: string;
  month?: Date;
  category?: TransactionCategory;
  status?: ProposalStatus;
}

interface FinanceChartsProps {
  proposals: Proposal[];
  transactions: FinanceTransaction[];
  isLoading?: boolean;
  onChartClick?: (action: ChartClickAction) => void;
}

const COLORS = {
  earning: "#10b981", // emerald-500
  expense: "#ef4444", // red-500
  paid: "#22c55e", // green-500
  // Category colors
  consultation_fee: "#3b82f6",
  service_fee: "#8b5cf6",
  other_income: "#06b6d4",
  salary: "#f59e0b",
  rent: "#ef4444",
  utilities: "#6366f1",
  marketing: "#ec4899",
  software: "#14b8a6",
  office_supplies: "#f97316",
  travel: "#84cc16",
  legal: "#a855f7",
  taxes: "#dc2626",
  other_expense: "#64748b",
};

const barChartConfig = {
  earnings: {
    label: "Earnings",
    color: COLORS.earning,
  },
  expenses: {
    label: "Expenses",
    color: COLORS.expense,
  },
  invoicesPaid: {
    label: "Paid Invoices",
    color: COLORS.paid,
  },
} satisfies ChartConfig;

const pieChartConfig = {
  amount: {
    label: "Amount",
  },
} satisfies ChartConfig;

export function FinanceCharts({
  proposals,
  transactions,
  isLoading,
  onChartClick,
}: FinanceChartsProps) {
  const { t } = useTranslation("finance");
  const [dateRange, setDateRange] = useState<DateRangeOption>("6months");

  // Get number of months based on date range option
  const getMonthCount = () => {
    switch (dateRange) {
      case "3months": return 3;
      case "6months": return 6;
      case "12months": return 12;
      case "thisYear": return new Date().getMonth() + 1;
      default: return 6;
    }
  };

  // Generate monthly data based on selected range
  const monthlyData = useMemo(() => {
    const months = [];
    const now = new Date();
    const monthCount = getMonthCount();

    for (let i = monthCount - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, "MMM");

      // Calculate earnings for this month
      const monthEarnings = transactions
        .filter((tx) => {
          const txDate = parseISO(tx.transaction_date);
          return (
            tx.type === "earning" &&
            isWithinInterval(txDate, { start: monthStart, end: monthEnd })
          );
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      // Calculate expenses for this month
      const monthExpenses = transactions
        .filter((tx) => {
          const txDate = parseISO(tx.transaction_date);
          return (
            tx.type === "expense" &&
            isWithinInterval(txDate, { start: monthStart, end: monthEnd })
          );
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      // Calculate paid invoices for this month
      const monthInvoicesPaid = proposals
        .filter((p) => {
          if (!p.paid_at) return false;
          const paidDate = parseISO(p.paid_at);
          return isWithinInterval(paidDate, { start: monthStart, end: monthEnd });
        })
        .reduce((sum, p) => sum + p.amount, 0);

      months.push({
        month: monthLabel,
        monthDate: monthStart,
        earnings: monthEarnings + monthInvoicesPaid,
        expenses: monthExpenses,
        invoicesPaid: monthInvoicesPaid,
      });
    }

    return months;
  }, [transactions, proposals, dateRange]);

  // Get expense breakdown by category
  const expenseBreakdown = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    transactions
      .filter((tx) => tx.type === "expense")
      .forEach((tx) => {
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
      });

    return Object.entries(categoryTotals).map(([category, amount]) => ({
      category: t(`categories.${category}`),
      categoryKey: category as TransactionCategory,
      amount,
      fill: COLORS[category as keyof typeof COLORS] || "#64748b",
    }));
  }, [transactions, t]);

  // Get earnings breakdown by category
  const earningsBreakdown = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    transactions
      .filter((tx) => tx.type === "earning")
      .forEach((tx) => {
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
      });

    return Object.entries(categoryTotals).map(([category, amount]) => ({
      category: t(`categories.${category}`),
      categoryKey: category as TransactionCategory,
      amount,
      fill: COLORS[category as keyof typeof COLORS] || "#64748b",
    }));
  }, [transactions, t]);

  // Get invoice status breakdown
  const invoiceBreakdown = useMemo(() => {
    const statusTotals = {
      draft: 0,
      sent: 0,
      paid: 0,
      cancelled: 0,
    };

    proposals.forEach((p) => {
      statusTotals[p.status] += p.amount;
    });

    const statusColors = {
      draft: "#94a3b8",
      sent: "#3b82f6",
      paid: "#22c55e",
      cancelled: "#ef4444",
    };

    return Object.entries(statusTotals)
      .filter(([, amount]) => amount > 0)
      .map(([status, amount]) => ({
        category: t(`invoiceStatus.${status}`),
        statusKey: status as ProposalStatus,
        amount,
        fill: statusColors[status as keyof typeof statusColors],
      }));
  }, [proposals, t]);

  // Handle bar click
  const handleBarClick = (data: { month: string; monthDate: Date }) => {
    if (onChartClick) {
      onChartClick({
        type: "month",
        value: data.month,
        month: data.monthDate,
      });
    }
  };

  // Handle expense pie click
  const handleExpensePieClick = (data: { categoryKey: TransactionCategory }) => {
    if (onChartClick) {
      onChartClick({
        type: "category",
        value: data.categoryKey,
        category: data.categoryKey,
      });
    }
  };

  // Handle invoice pie click
  const handleInvoicePieClick = (data: { statusKey: ProposalStatus }) => {
    if (onChartClick) {
      onChartClick({
        type: "status",
        value: data.statusKey,
        status: data.statusKey,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className={`border-[#E6E6E4] ${i === 0 ? "md:col-span-2" : ""}`}>
            <CardHeader>
              <div className="h-6 bg-[#E6E6E4] rounded animate-pulse w-1/3" />
            </CardHeader>
            <CardContent>
              <div className="h-[300px] bg-[#FAFAF8] rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Monthly Overview Bar Chart */}
      <Card className="md:col-span-2 border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("monthlyOverview")}
              </CardTitle>
            </div>
            <Select value={dateRange} onValueChange={(val) => setDateRange(val as DateRangeOption)}>
              <SelectTrigger className="w-[160px] border-[#E6E6E4]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3months">{t("last3Months", "Last 3 months")}</SelectItem>
                <SelectItem value="6months">{t("last6Months", "Last 6 months")}</SelectItem>
                <SelectItem value="12months">{t("last12Months", "Last 12 months")}</SelectItem>
                <SelectItem value="thisYear">{t("thisYear", "This year")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {onChartClick && (
            <p className="text-xs text-[#6B6B6B] mt-1">{t("clickBarToFilter", "Click on a bar to filter transactions by month")}</p>
          )}
        </CardHeader>
        <CardContent>
          <ChartContainer config={barChartConfig} className="h-[300px] w-full">
            <BarChart 
              data={monthlyData}
              onClick={(data) => {
                if (data?.activePayload?.[0]?.payload) {
                  handleBarClick(data.activePayload[0].payload);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6E6E4" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#555555' }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `AED ${value}`} tick={{ fill: '#555555' }} />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value) => [`AED ${Number(value).toLocaleString()}`, ""]}
              />
              <Legend />
              <Bar
                dataKey="earnings"
                fill="#0C5536"
                radius={[4, 4, 0, 0]}
                name={t("earnings")}
                cursor={onChartClick ? "pointer" : undefined}
              />
              <Bar
                dataKey="expenses"
                fill="#C0392B"
                radius={[4, 4, 0, 0]}
                name={t("expenses")}
                cursor={onChartClick ? "pointer" : undefined}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Expense Breakdown Pie Chart */}
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("expenseBreakdown")}
            </CardTitle>
          </div>
          {onChartClick && expenseBreakdown.length > 0 && (
            <p className="text-xs text-[#6B6B6B] mt-1">{t("clickSliceToFilter", "Click on a slice to filter by category")}</p>
          )}
        </CardHeader>
        <CardContent>
          {expenseBreakdown.length === 0 ? (
            <div className="h-[300px] flex flex-col items-center justify-center">
              <TrendingDown className="h-10 w-10 mb-3 text-[#C6A03B]" />
              <p className="font-medium text-[#222222]">{t("noExpenseData")}</p>
              <p className="text-sm text-[#6B6B6B] mt-1">{t("noExpenseDataDesc", "Add expenses to see breakdown")}</p>
            </div>
          ) : (
            <ChartContainer config={pieChartConfig} className="h-[300px] w-full">
              <PieChart>
                <Pie
                  data={expenseBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="amount"
                  nameKey="category"
                  label={({ category, percent }) =>
                    `${category} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                  onClick={(data) => handleExpensePieClick(data)}
                  cursor={onChartClick ? "pointer" : undefined}
                >
                  {expenseBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value) => [`AED ${Number(value).toLocaleString()}`, ""]}
                />
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Earnings Breakdown Pie Chart */}
      <Card className="border-[#E6E6E4]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("earningsBreakdown", "Earnings Breakdown")}
            </CardTitle>
          </div>
          {onChartClick && earningsBreakdown.length > 0 && (
            <p className="text-xs text-[#6B6B6B] mt-1">{t("clickSliceToFilter", "Click on a slice to filter by category")}</p>
          )}
        </CardHeader>
        <CardContent>
          {earningsBreakdown.length === 0 ? (
            <div className="h-[300px] flex flex-col items-center justify-center">
              <TrendingUp className="h-10 w-10 mb-3 text-[#C6A03B]" />
              <p className="font-medium text-[#222222]">{t("noEarningsData", "No Earnings Data")}</p>
              <p className="text-sm text-[#6B6B6B] mt-1">{t("noEarningsDataDesc", "Add earnings to see breakdown")}</p>
            </div>
          ) : (
            <ChartContainer config={pieChartConfig} className="h-[300px] w-full">
              <PieChart>
                <Pie
                  data={earningsBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="amount"
                  nameKey="category"
                  label={({ category, percent }) =>
                    `${category} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                  onClick={(data) => handleExpensePieClick(data)}
                  cursor={onChartClick ? "pointer" : undefined}
                >
                  {earningsBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value) => [`AED ${Number(value).toLocaleString()}`, ""]}
                />
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Invoice Status Pie Chart */}
      <Card className="border-[#E6E6E4] md:col-span-2 lg:col-span-1">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("invoiceStatusBreakdown")}
            </CardTitle>
          </div>
          {onChartClick && invoiceBreakdown.length > 0 && (
            <p className="text-xs text-[#6B6B6B] mt-1">{t("clickSliceToFilterInvoices", "Click on a slice to filter invoices")}</p>
          )}
        </CardHeader>
        <CardContent>
          {invoiceBreakdown.length === 0 ? (
            <div className="h-[300px] flex flex-col items-center justify-center">
              <PieChartIcon className="h-10 w-10 mb-3 text-[#C6A03B]" />
              <p className="font-medium text-[#222222]">{t("noInvoiceData")}</p>
              <p className="text-sm text-[#6B6B6B] mt-1">{t("noInvoiceDataDesc", "No invoice data available")}</p>
            </div>
          ) : (
            <ChartContainer config={pieChartConfig} className="h-[300px] w-full">
              <PieChart>
                <Pie
                  data={invoiceBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="amount"
                  nameKey="category"
                  label={({ category, percent }) =>
                    `${category} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                  onClick={(data) => handleInvoicePieClick(data)}
                  cursor={onChartClick ? "pointer" : undefined}
                >
                  {invoiceBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value) => [`AED ${Number(value).toLocaleString()}`, ""]}
                />
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
