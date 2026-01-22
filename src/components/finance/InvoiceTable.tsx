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
import { Eye, Download, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Proposal, ProposalStatus } from "@/types/finance";

interface InvoiceTableProps {
  proposals: Proposal[];
  isLoading?: boolean;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onViewProposal?: (proposal: Proposal) => void;
  onDownloadInvoice?: (proposal: Proposal) => void;
}

export function InvoiceTable({
  proposals,
  isLoading,
  statusFilter,
  onStatusFilterChange,
  onViewProposal,
  onDownloadInvoice,
}: InvoiceTableProps) {
  const { t } = useTranslation("finance");

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusBadge = (status: ProposalStatus) => {
    const styles: Record<ProposalStatus, string> = {
      draft: "bg-gray-100 text-gray-700 border-gray-200",
      sent: "bg-blue-100 text-blue-700 border-blue-200",
      paid: "bg-green-100 text-green-700 border-green-200",
      cancelled: "bg-red-100 text-red-700 border-red-200",
    };

    return (
      <Badge variant="outline" className={styles[status]}>
        {t(`status.${status}`)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <div className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoiceNumber")}</TableHead>
                <TableHead>{t("client")}</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("sentDate")}</TableHead>
                <TableHead>{t("paidDate")}</TableHead>
                <TableHead className="text-center">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-6 bg-gray-200 rounded animate-pulse w-20" /></TableCell>
                  <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
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
      <div className="flex justify-end">
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="draft">{t("status.draft")}</SelectItem>
            <SelectItem value="sent">{t("status.sent")}</SelectItem>
            <SelectItem value="paid">{t("status.paid")}</SelectItem>
            <SelectItem value="cancelled">{t("status.cancelled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {proposals.length === 0 ? (
        <div className="rounded-md border p-8 text-center">
          <p className="text-muted-foreground">{t("noInvoices")}</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoiceNumber")}</TableHead>
                <TableHead>{t("client")}</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("sentDate")}</TableHead>
                <TableHead>{t("paidDate")}</TableHead>
                <TableHead className="text-center">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals.map((proposal) => (
                <TableRow key={proposal.id}>
                  <TableCell className="font-mono text-sm">
                    {proposal.invoice_number || "-"}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{proposal.lead?.full_name || "-"}</div>
                      <div className="text-sm text-muted-foreground">
                        {proposal.lead?.email || "-"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(proposal.amount, proposal.currency)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(proposal.status)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {proposal.sent_at
                      ? format(new Date(proposal.sent_at), "MMM d, yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {proposal.paid_at
                      ? format(new Date(proposal.paid_at), "MMM d, yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {onViewProposal && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onViewProposal(proposal)}
                          title={t("viewProposal")}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {onDownloadInvoice && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onDownloadInvoice(proposal)}
                          title={t("downloadInvoice")}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {proposal.stripe_payment_link && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          asChild
                          title={t("paymentLink")}
                        >
                          <a
                            href={proposal.stripe_payment_link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
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
