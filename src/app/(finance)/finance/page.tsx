"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  FinanceStatsCards,
  calculateFinanceStats,
  calculatePreviousPeriodStats,
  KPICardAction,
} from "@/components/finance/FinanceStatsCards";
import { InvoiceTable } from "@/components/finance/InvoiceTable";
import { OutstandingBalancesCard } from "@/components/finance/OutstandingBalancesCard";
import { TransactionTable } from "@/components/finance/TransactionTable";
import { AddTransactionDialog } from "@/components/finance/AddTransactionDialog";
import { ViewInvoiceDialog } from "@/components/finance/ViewInvoiceDialog";
import { FinanceCharts } from "@/components/finance/FinanceCharts";
import {
  FinanceTransaction,
  Proposal,
  FinanceStats,
  TransactionType,
  ExtendedFinanceStats,
  TransactionCategory,
  ProposalStatus,
} from "@/types/finance";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRole } from "@/hooks/useFinanceRole";
import { Wallet, FileText, ArrowLeftRight, BarChart3, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default function FinanceDashboard() {
  const { t } = useTranslation("finance");
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const { isHead, isLoading: isRoleLoading, userId } = useFinanceRole();

  // State - employees default to "transactions" since they can't see invoices
  const defaultTab = tabParam === "transactions" ? "transactions" : tabParam === "analytics" ? "analytics" : "invoices";
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isLoading, setIsLoading] = useState(true);

  // Update tab when URL changes or role loads
  useEffect(() => {
    if (tabParam === "transactions") {
      setActiveTab("transactions");
    } else if (tabParam === "analytics") {
      setActiveTab("analytics");
    } else if (!isHead && !isRoleLoading) {
      setActiveTab("transactions");
    } else {
      setActiveTab("invoices");
    }
  }, [tabParam, isHead, isRoleLoading]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [stats, setStats] = useState<FinanceStats>({
    totalInvoices: 0,
    totalInvoiceAmount: 0,
    paidInvoices: 0,
    paidAmount: 0,
    pendingInvoices: 0,
    pendingAmount: 0,
    totalEarnings: 0,
    totalExpenses: 0,
    netProfit: 0,
    statusBreakdown: {
      draft: { count: 0, amount: 0 },
      sent: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
    },
    currency: "AED",
  });
  const [previousStats, setPreviousStats] = useState<ExtendedFinanceStats | undefined>();

  // Filters
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Advanced filters for transactions
  const [transactionCategoryFilter, setTransactionCategoryFilter] = useState<TransactionCategory[]>([]);

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<FinanceTransaction | null>(null);
  const [defaultTransactionType, setDefaultTransactionType] = useState<TransactionType>("earning");
  const [deleteTransaction, setDeleteTransaction] = useState<FinanceTransaction | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Proposal | null>(null);

  // Fetch proposals (skip for finance employees — they can't see invoices)
  const fetchProposals = useCallback(async () => {
    if (!isHead) {
      setProposals([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("proposals")
        .select(`
          *,
          lead:leads(id, full_name, email, company_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProposals(data || []);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      toast.error(t("failedToFetchInvoices"));
    }
  }, [t, isHead]);

  // Fetch transactions (scoped to own data for finance employees)
  const fetchTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (transactionTypeFilter !== "all") {
        params.append("type", transactionTypeFilter);
      }
      if (startDate) {
        params.append("startDate", startDate);
      }
      if (endDate) {
        params.append("endDate", endDate);
      }
      if (!isHead && userId) {
        params.append("created_by", userId);
      }

      const response = await fetch(`/api/finance/transactions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");
      const { data } = await response.json();
      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error(t("failedToFetchTransactions"));
    }
  }, [transactionTypeFilter, startDate, endDate, t, isHead, userId]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchProposals(), fetchTransactions()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchProposals, fetchTransactions]);

  // Calculate stats when data changes
  useEffect(() => {
    const newStats = calculateFinanceStats(proposals, transactions);
    setStats(newStats);
    
    // Calculate previous period stats for comparison
    const prevStats = calculatePreviousPeriodStats(
      proposals.map(p => ({ ...p, created_at: p.created_at, paid_at: p.paid_at })),
      transactions.map(t => ({ ...t, transaction_date: t.transaction_date }))
    );
    setPreviousStats(prevStats);
  }, [proposals, transactions]);

  // Filter proposals by status
  const filteredProposals =
    invoiceStatusFilter === "all"
      ? proposals
      : proposals.filter((p) => p.status === invoiceStatusFilter);

  // Handle add new transaction
  const handleAddNew = (type: TransactionType) => {
    setDefaultTransactionType(type);
    setEditTransaction(null);
    setIsAddDialogOpen(true);
  };

  // Handle edit transaction
  const handleEdit = (transaction: FinanceTransaction) => {
    setEditTransaction(transaction);
    setDefaultTransactionType(transaction.type);
    setIsAddDialogOpen(true);
  };

  // Handle delete transaction
  const handleDelete = async () => {
    if (!deleteTransaction) return;

    try {
      const response = await fetch(
        `/api/finance/transactions/${deleteTransaction.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to delete transaction");

      toast.success(t("transactionDeleted"));
      setDeleteTransaction(null);
      fetchTransactions();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast.error(t("failedToDeleteTransaction"));
    }
  };

  // Handle view proposal - open dialog to show invoice
  const handleViewProposal = (proposal: Proposal) => {
    setViewingInvoice(proposal);
  };

  // Handle download invoice - same as view, dialog has download button
  const handleDownloadInvoice = (proposal: Proposal) => {
    setViewingInvoice(proposal);
  };

  // Handle KPI card click
  const handleKPICardClick = useCallback((action: KPICardAction) => {
    setActiveTab(action.tab);
    
    if (action.tab === "invoices" && action.filter) {
      setInvoiceStatusFilter(action.filter);
    } else if (action.tab === "invoices" && !action.filter) {
      setInvoiceStatusFilter("all");
    }
    
    if (action.tab === "transactions" && action.filter) {
      setTransactionTypeFilter(action.filter);
    } else if (action.tab === "transactions" && !action.filter) {
      setTransactionTypeFilter("all");
    }
  }, []);

  // Handle chart click
  const handleChartClick = useCallback((action: { type: string; value: string; month?: Date; category?: TransactionCategory; status?: ProposalStatus }) => {
    if (action.type === "month" && action.month) {
      // Switch to transactions tab and filter by month
      setActiveTab("transactions");
      const monthStart = startOfMonth(action.month);
      const monthEnd = endOfMonth(action.month);
      setStartDate(format(monthStart, "yyyy-MM-dd"));
      setEndDate(format(monthEnd, "yyyy-MM-dd"));
    } else if (action.type === "category" && action.category) {
      // Switch to transactions tab and filter by category
      setActiveTab("transactions");
      setTransactionCategoryFilter([action.category]);
    } else if (action.type === "status" && action.status) {
      // Switch to invoices tab and filter by status
      setActiveTab("invoices");
      setInvoiceStatusFilter(action.status);
    }
  }, []);

  // Quick add floating button handler
  const handleQuickAdd = useCallback((type: TransactionType) => {
    setDefaultTransactionType(type);
    setEditTransaction(null);
    setIsAddDialogOpen(true);
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center gap-3 mb-2">
          <Wallet className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
          <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
            {t("financeDashboard")}
          </h1>
        </div>
        <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
          {t("dashboardDescription")}
        </p>
      </div>

      {/* Stats Cards */}
      <FinanceStatsCards
        stats={stats}
        previousStats={previousStats}
        isLoading={isLoading}
        onCardClick={handleKPICardClick}
        hideInvoiceCards={!isHead}
      />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={`bg-white border border-[#E6E6E4] p-1.5 rounded-xl w-full grid ${isHead ? "grid-cols-3" : "grid-cols-2"} h-auto`}>
          {isHead && (
            <TabsTrigger
              value="invoices"
              className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[#555555] font-medium transition-all"
            >
              <FileText className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("invoices")}
            </TabsTrigger>
          )}
          <TabsTrigger
            value="transactions"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[#555555] font-medium transition-all"
          >
            <ArrowLeftRight className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("earningsExpenses")}
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[#555555] font-medium transition-all"
          >
            <BarChart3 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("analytics")}
          </TabsTrigger>
        </TabsList>

        {/* Invoices Tab (heads only) */}
        {isHead && (
          <TabsContent value="invoices" className="space-y-4">
            {/* Who still owes money — shown above the full invoice list so a
                part-paid invoice can't go unnoticed between the deposit and
                the court date. */}
            <OutstandingBalancesCard />

            <Card className="border-[#E6E6E4]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                  <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                    {t("invoicesList")}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <InvoiceTable
                  proposals={filteredProposals}
                  isLoading={isLoading}
                  statusFilter={invoiceStatusFilter}
                  onStatusFilterChange={setInvoiceStatusFilter}
                  onViewProposal={handleViewProposal}
                  onDownloadInvoice={handleDownloadInvoice}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("transactionsList")}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <TransactionTable
                transactions={transactions}
                isLoading={isLoading}
                typeFilter={transactionTypeFilter}
                onTypeFilterChange={setTransactionTypeFilter}
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onEdit={handleEdit}
                onDelete={(tx) => setDeleteTransaction(tx)}
                onAddNew={handleAddNew}
                categoryFilter={transactionCategoryFilter}
                onCategoryFilterChange={setTransactionCategoryFilter}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <FinanceCharts
            proposals={proposals}
            transactions={transactions}
            isLoading={isLoading}
            onChartClick={handleChartClick}
          />
        </TabsContent>
      </Tabs>

      {/* Floating Action Button for Quick Add */}
      <div className="fixed bottom-6 right-6 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg bg-[hsl(var(--jw-gold-accent))] hover:bg-[#B8922F] text-white"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem 
              onClick={() => handleQuickAdd("earning")}
              className="cursor-pointer"
            >
              <TrendingUp className="h-4 w-4 mr-2 text-[#0C5536]" />
              {t("addEarning")}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleQuickAdd("expense")}
              className="cursor-pointer"
            >
              <TrendingDown className="h-4 w-4 mr-2 text-[#C0392B]" />
              {t("addExpense")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Add/Edit Transaction Dialog */}
      <AddTransactionDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={() => {
          fetchTransactions();
        }}
        editTransaction={editTransaction}
        defaultType={defaultTransactionType}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTransaction}
        onOpenChange={(open) => !open && setDeleteTransaction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#C0392B]">{t("deleteTransaction")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteTransactionConfirmation")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E6E6E4]">{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-[#C0392B] hover:bg-[#A33025] text-white"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Invoice Dialog */}
      <ViewInvoiceDialog
        proposal={viewingInvoice}
        open={!!viewingInvoice}
        onOpenChange={(open) => !open && setViewingInvoice(null)}
      />

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("legalNotice", "© 2024 Just Wills. All rights reserved. This system is for authorized users only.")}
        </p>
      </div>
    </div>
  );
}
