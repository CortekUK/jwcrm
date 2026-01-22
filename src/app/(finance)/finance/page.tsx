"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import {
  FinanceStatsCards,
  calculateFinanceStats,
} from "@/components/finance/FinanceStatsCards";
import { InvoiceTable } from "@/components/finance/InvoiceTable";
import { TransactionTable } from "@/components/finance/TransactionTable";
import { AddTransactionDialog } from "@/components/finance/AddTransactionDialog";
import { ViewInvoiceDialog } from "@/components/finance/ViewInvoiceDialog";
import { FinanceCharts } from "@/components/finance/FinanceCharts";
import {
  FinanceTransaction,
  Proposal,
  FinanceStats,
  TransactionType,
} from "@/types/finance";
import { supabase } from "@/integrations/supabase/client";

export default function FinanceDashboard() {
  const { t } = useTranslation("finance");
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const defaultTab = tabParam === "transactions" ? "transactions" : "invoices";

  // State
  const [isLoading, setIsLoading] = useState(true);
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
    currency: "USD",
  });

  // Filters
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<FinanceTransaction | null>(null);
  const [defaultTransactionType, setDefaultTransactionType] = useState<TransactionType>("earning");
  const [deleteTransaction, setDeleteTransaction] = useState<FinanceTransaction | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Proposal | null>(null);

  // Fetch proposals
  const fetchProposals = useCallback(async () => {
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
  }, [t]);

  // Fetch transactions
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

      const response = await fetch(`/api/finance/transactions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");
      const { data } = await response.json();
      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error(t("failedToFetchTransactions"));
    }
  }, [transactionTypeFilter, startDate, endDate, t]);

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

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("financeDashboard")}</h1>
        <p className="text-muted-foreground">{t("dashboardDescription")}</p>
      </div>

      {/* Stats Cards */}
      <FinanceStatsCards stats={stats} isLoading={isLoading} />

      {/* Main Content Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">{t("invoices")}</TabsTrigger>
          <TabsTrigger value="transactions">{t("earningsExpenses")}</TabsTrigger>
          <TabsTrigger value="analytics">{t("analytics")}</TabsTrigger>
        </TabsList>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("invoicesList")}</CardTitle>
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

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("transactionsList")}</CardTitle>
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
          />
        </TabsContent>
      </Tabs>

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
            <AlertDialogTitle>{t("deleteTransaction")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteTransactionConfirmation")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
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
    </div>
  );
}
