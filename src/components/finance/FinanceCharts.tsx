"use client";

import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { FinanceTransaction, Proposal } from "@/types/finance";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";

interface FinanceChartsProps {
  proposals: Proposal[];
  transactions: FinanceTransaction[];
  isLoading?: boolean;
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
}: FinanceChartsProps) {
  const { t } = useTranslation("finance");

  // Generate last 6 months data
  const getMonthlyData = () => {
    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, "MMM");

      // Calculate earnings for this month
      const monthEarnings = transactions
        .filter((t) => {
          const txDate = parseISO(t.transaction_date);
          return (
            t.type === "earning" &&
            isWithinInterval(txDate, { start: monthStart, end: monthEnd })
          );
        })
        .reduce((sum, t) => sum + t.amount, 0);

      // Calculate expenses for this month
      const monthExpenses = transactions
        .filter((t) => {
          const txDate = parseISO(t.transaction_date);
          return (
            t.type === "expense" &&
            isWithinInterval(txDate, { start: monthStart, end: monthEnd })
          );
        })
        .reduce((sum, t) => sum + t.amount, 0);

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
        earnings: monthEarnings + monthInvoicesPaid,
        expenses: monthExpenses,
        invoicesPaid: monthInvoicesPaid,
      });
    }

    return months;
  };

  // Get expense breakdown by category
  const getExpenseBreakdown = () => {
    const categoryTotals: Record<string, number> = {};

    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
      });

    return Object.entries(categoryTotals).map(([category, amount]) => ({
      category: t(`categories.${category}`),
      amount,
      fill: COLORS[category as keyof typeof COLORS] || "#64748b",
    }));
  };

  // Get invoice status breakdown
  const getInvoiceStatusBreakdown = () => {
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
        category: t(`status.${status}`),
        amount,
        fill: statusColors[status as keyof typeof statusColors],
      }));
  };

  const monthlyData = getMonthlyData();
  const expenseBreakdown = getExpenseBreakdown();
  const invoiceBreakdown = getInvoiceStatusBreakdown();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className={i === 0 ? "md:col-span-2" : ""}>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded animate-pulse w-1/3" />
            </CardHeader>
            <CardContent>
              <div className="h-[300px] bg-gray-100 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Monthly Overview Bar Chart */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>{t("monthlyOverview")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={barChartConfig} className="h-[300px] w-full">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value) => [`$${Number(value).toLocaleString()}`, ""]}
              />
              <Legend />
              <Bar
                dataKey="earnings"
                fill={COLORS.earning}
                radius={[4, 4, 0, 0]}
                name={t("earnings")}
              />
              <Bar
                dataKey="expenses"
                fill={COLORS.expense}
                radius={[4, 4, 0, 0]}
                name={t("expenses")}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Expense Breakdown Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t("expenseBreakdown")}</CardTitle>
        </CardHeader>
        <CardContent>
          {expenseBreakdown.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              {t("noExpenseData")}
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
                >
                  {expenseBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, ""]}
                />
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Invoice Status Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t("invoiceStatusBreakdown")}</CardTitle>
        </CardHeader>
        <CardContent>
          {invoiceBreakdown.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              {t("noInvoiceData")}
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
                >
                  {invoiceBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, ""]}
                />
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
