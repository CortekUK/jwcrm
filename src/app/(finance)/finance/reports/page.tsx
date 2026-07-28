"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import {
  FileBarChart,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  ClipboardList,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRole } from "@/hooks/useFinanceRole";
import { FinanceTransaction, Proposal } from "@/types/finance";
import { TransactionExportButton } from "@/components/finance/TransactionExportButton";
import { InvoiceExportButton } from "@/components/finance/InvoiceExportButton";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";

const COLORS = {
  earning: "#10b981",
  expense: "#ef4444",
  profit: "#0C5536",
  pending: "#f59e0b",
  paid: "#22c55e",
  draft: "#6b7280",
  cancelled: "#9ca3af",
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

interface FinanceAnalytics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  outstandingInvoices: number;
  currency: string;
  revenueByMonth: { month: string; revenue: number; expenses: number }[];
  expensesByCategory: { name: string; value: number; color: string }[];
  invoicesByStatus: { name: string; value: number; color: string }[];
  revenueTrend: { day: string; amount: number }[];
}

export default function FinanceReportsPage() {
  const { t, i18n } = useTranslation(["finance", "common"]);
  const isRtl = i18n.language === "ar";
  const { isHead, userId } = useFinanceRole();

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);

  useEffect(() => {
    fetchData();
  }, [isHead, userId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Build transaction query — employees see only their own
      let txQuery = supabase.from("finance_transactions").select("*").order("transaction_date", { ascending: false });
      if (!isHead && userId) {
        txQuery = txQuery.eq("created_by", userId);
      }

      // Employees skip proposals entirely
      const promises: Promise<any>[] = [txQuery];
      if (isHead) {
        promises.push(
          supabase.from("proposals").select("*, lead:leads(id, full_name, email, company_name)").order("created_at", { ascending: false })
        );
      }

      const results = await Promise.all(promises);

      if (results[0].data) setTransactions(results[0].data as FinanceTransaction[]);
      if (isHead && results[1]?.data) {
        setProposals(results[1].data as Proposal[]);
      } else if (!isHead) {
        setProposals([]);
      }
    } catch (error) {
      console.error("Error fetching finance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const analytics = useMemo((): FinanceAnalytics => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    // Current month transactions
    const currentMonthTx = transactions.filter((tx) => {
      const txDate = parseISO(tx.transaction_date);
      return isWithinInterval(txDate, { start: currentMonthStart, end: currentMonthEnd });
    });

    const totalRevenue = currentMonthTx
      .filter((tx) => tx.type === "earning")
      .reduce((sum, tx) => sum + tx.amount, 0);

    const totalExpenses = currentMonthTx
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + tx.amount, 0);

    const netProfit = totalRevenue - totalExpenses;

    // Outstanding invoices (sent but not paid). A proposal that was only
    // ever sent as a proposal (never invoiced) has no payment capability and
    // shouldn't count toward outstanding revenue.
    const outstandingInvoices = proposals
      .filter((p) => p.status === "sent" && !!p.invoiced_at)
      .reduce((sum, p) => sum + p.amount, 0);

    // Revenue by month (last 6 months)
    const revenueByMonth = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, "MMM");

      const monthRevenue = transactions
        .filter((tx) => {
          const txDate = parseISO(tx.transaction_date);
          return tx.type === "earning" && isWithinInterval(txDate, { start: monthStart, end: monthEnd });
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      const monthExpenses = transactions
        .filter((tx) => {
          const txDate = parseISO(tx.transaction_date);
          return tx.type === "expense" && isWithinInterval(txDate, { start: monthStart, end: monthEnd });
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      revenueByMonth.push({ month: monthLabel, revenue: monthRevenue, expenses: monthExpenses });
    }

    // Expenses by category
    const expenseByCat: Record<string, number> = {};
    transactions
      .filter((tx) => tx.type === "expense")
      .forEach((tx) => {
        expenseByCat[tx.category] = (expenseByCat[tx.category] || 0) + tx.amount;
      });

    const expensesByCategory = Object.entries(expenseByCat)
      .map(([category, amount]) => ({
        name: t(`finance:categories.${category}`, category),
        value: amount,
        color: COLORS[category as keyof typeof COLORS] || "#6b7280",
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Invoices by status
    const statusCount: Record<string, { count: number; amount: number }> = {
      draft: { count: 0, amount: 0 },
      sent: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
    };
    proposals.forEach((p) => {
      if (statusCount[p.status]) {
        statusCount[p.status].count++;
        statusCount[p.status].amount += p.amount;
      }
    });

    const invoicesByStatus = [
      { name: t("finance:paid", "Paid"), value: statusCount.paid.count, color: COLORS.paid },
      { name: t("finance:sent", "Sent"), value: statusCount.sent.count, color: COLORS.pending },
      { name: t("finance:draft", "Draft"), value: statusCount.draft.count, color: COLORS.draft },
      { name: t("finance:cancelled", "Cancelled"), value: statusCount.cancelled.count, color: COLORS.cancelled },
    ].filter((s) => s.value > 0);

    // 7-day revenue trend
    const revenueTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = format(date, "yyyy-MM-dd");
      const dayRevenue = transactions
        .filter((tx) => tx.type === "earning" && tx.transaction_date === dateStr)
        .reduce((sum, tx) => sum + tx.amount, 0);
      revenueTrend.push({
        day: format(date, "EEE"),
        amount: dayRevenue,
      });
    }

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      outstandingInvoices,
      currency: "AED",
      revenueByMonth,
      expensesByCategory,
      invoicesByStatus,
      revenueTrend,
    };
  }, [transactions, proposals, t]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: analytics.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };


  return (
    <div className="space-y-8 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FileBarChart className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("finance:reports.title", "Reports & Analytics")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {t("finance:reports.subtitle", "Financial insights, trends, and data exports")}
            </p>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--jw-primary-green))] mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
          {t("finance:reports.overview", "Overview")}
        </h2>
        <div className={`grid grid-cols-2 ${isHead ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4`}>
          {/* Total Revenue */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#6B6B6B]">{t("finance:reports.revenueThisMonth", "Revenue This Month")}</p>
                    <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-[#0C5536]" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-[#222222]">{formatCurrency(analytics.totalRevenue)}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total Expenses */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#6B6B6B]">{t("finance:reports.expensesThisMonth", "Expenses This Month")}</p>
                    <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                      <TrendingDown className="h-5 w-5 text-[#0C5536]" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-[#222222]">{formatCurrency(analytics.totalExpenses)}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Net Profit */}
          <Card className="border-[#E6E6E4]">
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#6B6B6B]">{t("finance:reports.netProfit", "Net Profit")}</p>
                    <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-[#0C5536]" />
                    </div>
                  </div>
                  <p className={`text-2xl font-bold mt-2 ${analytics.netProfit >= 0 ? "text-[#0C5536]" : "text-[#C0392B]"}`}>
                    {formatCurrency(analytics.netProfit)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Outstanding Invoices (heads only) */}
          {isHead && (
            <Card className="border-[#E6E6E4]">
              <CardContent className="p-4">
                {loading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[#6B6B6B]">{t("finance:reports.outstanding", "Outstanding")}</p>
                      <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                        <Clock className="h-5 w-5 text-[#0C5536]" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold mt-2 text-[#222222]">{formatCurrency(analytics.outstandingInvoices)}</p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Analytics Charts */}
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--jw-primary-green))] mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
          {t("finance:reports.insights", "Insights")}
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Revenue vs Expenses */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("finance:reports.revenueVsExpenses", "Revenue vs Expenses")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : analytics.revenueByMonth.length > 0 ? (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E4" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#777777" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#777777" />
                      <Bar dataKey="revenue" fill={COLORS.earning} name={t("finance:revenue", "Revenue")} />
                      <Bar dataKey="expenses" fill={COLORS.expense} name={t("finance:expenses", "Expenses")} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[#777777]">
                  {t("finance:reports.noData", "No data available")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 7-Day Revenue Trend */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("finance:reports.revenueTrend", "7-Day Revenue Trend")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.revenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E4" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#777777" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#777777" />
                      <Line type="monotone" dataKey="amount" stroke={COLORS.profit} strokeWidth={2} dot={{ fill: COLORS.profit, r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expenses by Category */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-[#222222]">
                {t("finance:reports.expensesByCategory", "Expenses by Category")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : analytics.expensesByCategory.length > 0 ? (
                <div className="h-[200px]">
                  <div className="h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.expensesByCategory}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {analytics.expensesByCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {analytics.expensesByCategory.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[#555555]">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[#777777]">
                  {t("finance:reports.noExpenses", "No expenses recorded")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Status (heads only) */}
          {isHead && (
            <Card className="border-[#E6E6E4]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-[#222222]">
                  {t("finance:reports.invoiceStatus", "Invoice Status")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : analytics.invoicesByStatus.length > 0 ? (
                  <div className="h-[200px]">
                    <div className="h-[140px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.invoicesByStatus}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={65}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {analytics.invoicesByStatus.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                      {analytics.invoicesByStatus.map((item) => (
                        <div key={item.name} className="flex items-center gap-1.5 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-[#555555]">{item.name}: {item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-[#777777]">
                    {t("finance:reports.noInvoices", "No invoices recorded")}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Data Exports */}
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--jw-primary-green))] mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
          {t("finance:reports.dataExports", "Data Exports")}
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {/* Transactions Export */}
          <Card className="border-[#E6E6E4] hover:border-[#C6A03B] transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="h-5 w-5 text-[#0C5536]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#222222]">{t("finance:reports.transactions", "Transactions")}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#999999] mt-1 mb-3">
                    <FileSpreadsheet className="h-3 w-3" />
                    <span>CSV</span>
                  </div>
                  <TransactionExportButton />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoices Export (heads only) */}
          {isHead && (
            <Card className="border-[#E6E6E4] hover:border-[#C6A03B] transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-[#0C5536]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[#222222]">{t("finance:reports.invoices", "Invoices")}</h3>
                    <div className="flex items-center gap-2 text-xs text-[#999999] mt-1 mb-3">
                      <FileSpreadsheet className="h-3 w-3" />
                      <span>CSV</span>
                    </div>
                    <InvoiceExportButton />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
