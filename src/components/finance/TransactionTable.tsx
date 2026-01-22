"use client";

import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Pencil, Trash2, TrendingUp, TrendingDown, Plus, Receipt } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { FinanceTransaction, TransactionType } from "@/types/finance";
import { supabase } from "@/integrations/supabase/client";

interface TransactionTableProps {
  transactions: FinanceTransaction[];
  isLoading?: boolean;
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onEdit: (transaction: FinanceTransaction) => void;
  onDelete: (transaction: FinanceTransaction) => void;
  onAddNew: (type: TransactionType) => void;
}

export function TransactionTable({
  transactions,
  isLoading,
  typeFilter,
  onTypeFilterChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onEdit,
  onDelete,
  onAddNew,
}: TransactionTableProps) {
  const { t } = useTranslation("finance");

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const openReceipt = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("finance-receipts")
        .createSignedUrl(path, 3600); // 1 hour expiry

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error) {
      console.error("Error getting receipt URL:", error);
      toast.error(t("failedToOpenReceipt"));
    }
  };

  const getTypeBadge = (type: TransactionType) => {
    if (type === "earning") {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 gap-1">
          <TrendingUp className="h-3 w-3" />
          {t("earning")}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 gap-1">
        <TrendingDown className="h-3 w-3" />
        {t("expense")}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-36 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-36 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("category")}</TableHead>
                <TableHead>{t("description")}</TableHead>
                <TableHead>{t("reference")}</TableHead>
                <TableHead>{t("receipt")}</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead className="text-center">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-6 bg-gray-200 rounded animate-pulse w-20" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse w-8" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-8 bg-gray-200 rounded animate-pulse" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={typeFilter} onValueChange={onTypeFilterChange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder={t("type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              <SelectItem value="earning">{t("earning")}</SelectItem>
              <SelectItem value="expense">{t("expense")}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <DatePicker
              date={startDate ? parseISO(startDate) : undefined}
              onDateChange={(date) => onStartDateChange(date ? format(date, "yyyy-MM-dd") : "")}
              placeholder={t("startDate")}
            />

            <span className="text-muted-foreground">{t("to")}</span>

            <DatePicker
              date={endDate ? parseISO(endDate) : undefined}
              onDateChange={(date) => onEndDateChange(date ? format(date, "yyyy-MM-dd") : "")}
              placeholder={t("endDate")}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-1 border-green-500 text-green-600 hover:bg-green-50"
            onClick={() => onAddNew("earning")}
          >
            <Plus className="h-4 w-4" />
            {t("addEarning")}
          </Button>
          <Button
            variant="outline"
            className="gap-1 border-red-500 text-red-600 hover:bg-red-50"
            onClick={() => onAddNew("expense")}
          >
            <Plus className="h-4 w-4" />
            {t("addExpense")}
          </Button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-md border p-8 text-center">
          <p className="text-muted-foreground">{t("noTransactions")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("addFirstTransaction")}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("category")}</TableHead>
                <TableHead>{t("description")}</TableHead>
                <TableHead>{t("reference")}</TableHead>
                <TableHead>{t("receipt")}</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead className="text-center">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(transaction.transaction_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    {getTypeBadge(transaction.type)}
                  </TableCell>
                  <TableCell>
                    {t(`categories.${transaction.category}`)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {transaction.description || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {transaction.reference_number || "-"}
                  </TableCell>
                  <TableCell>
                    {transaction.receipt_path ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => openReceipt(transaction.receipt_path!)}
                        title={t("viewReceipt")}
                      >
                        <Receipt className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className={`font-medium ${
                    transaction.type === "earning" ? "text-green-600" : "text-red-600"
                  }`}>
                    {transaction.type === "expense" ? "-" : "+"}
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                        onClick={() => onEdit(transaction)}
                        title={t("edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => onDelete(transaction)}
                        title={t("delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
