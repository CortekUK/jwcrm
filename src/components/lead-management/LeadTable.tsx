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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LeadStatus } from "./LeadStatusBadge";
import { Pencil, Trash2, Eye, FileText, ChevronDown, Send, CheckCircle2, History, Bell, Phone, MessageCircle, Mail, Video, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export interface Lead {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  notes: string | null;
  source: string | null;
  source_id: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  status: LeadStatus;
  is_paid: boolean;
  paid_at: string | null;
  paid_amount: number | null;
  paid_currency: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  source_data?: { id: string; name: string } | null;
  assigned_user?: { user_id: string; full_name: string } | null;
}

export interface CommunicationMethod {
  id: string;
  name: string;
  icon: string;
  is_active: boolean;
  display_order: number;
}

const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  phone: Phone,
  "message-circle": MessageCircle,
  mail: Mail,
  video: Video,
  users: Users,
};

interface LeadTableProps {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onSendProposal: (lead: Lead) => void;
  onViewProposals: (lead: Lead) => void;
  onStatusChange: (leadId: string, status: LeadStatus) => void;
  onViewHistory?: (lead: Lead) => void;
  onViewSalesperson?: (salespersonId: string) => void;
  onAddCommunication?: (lead: Lead, methodId: string) => void;
  onSetReminder?: (lead: Lead) => void;
  communicationMethods?: CommunicationMethod[];
  isLoading?: boolean;
}

export function LeadTable({
  leads,
  onEdit,
  onDelete,
  onSendProposal,
  onViewProposals,
  onStatusChange,
  onViewHistory,
  onViewSalesperson,
  onAddCommunication,
  onSetReminder,
  communicationMethods = [],
  isLoading,
}: LeadTableProps) {
  const getMethodIcon = (iconName: string) => {
    const IconComponent = iconComponents[iconName] || Phone;
    return <IconComponent className="h-4 w-4" />;
  };
  const { t } = useTranslation("leadManagement");

  const statusOptions: { value: LeadStatus; label: string }[] = [
    { value: "not_started", label: t("notStarted") },
    { value: "contacted", label: t("contacted") },
    { value: "consultation", label: t("consultation") },
    { value: "qualified", label: t("qualified") },
    { value: "pending", label: t("pending") },
    { value: "won", label: t("won") },
    { value: "lost", label: t("lost") },
  ];

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("email")}</TableHead>
              <TableHead>{t("phone")}</TableHead>
              <TableHead>{t("source")}</TableHead>
              <TableHead>{t("assignedTo")}</TableHead>
              <TableHead>{t("created")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("reminder")}</TableHead>
              <TableHead>{t("proposal")}</TableHead>
              <TableHead className="text-center">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-6 bg-gray-200 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-8 bg-gray-200 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-8 bg-gray-200 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-8 bg-gray-200 rounded animate-pulse" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">{t("noLeads")}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {t("createFirstLead")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("email")}</TableHead>
            <TableHead>{t("phone")}</TableHead>
            <TableHead>{t("source")}</TableHead>
            <TableHead>{t("assignedTo")}</TableHead>
            <TableHead>{t("created")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("reminder")}</TableHead>
            <TableHead>{t("proposal")}</TableHead>
            <TableHead className="text-center">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell className="font-medium">{lead.full_name}</TableCell>
              <TableCell>{lead.email}</TableCell>
              <TableCell>{lead.phone || "-"}</TableCell>
              <TableCell>{lead.source_data?.name || (lead.source ? lead.source.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "-")}</TableCell>
              <TableCell>
                {lead.assigned_user?.full_name ? (
                  <Badge
                    variant="secondary"
                    className={`bg-blue-50 text-blue-700 ${
                      onViewSalesperson && lead.assigned_to
                        ? "cursor-pointer hover:bg-blue-100 transition-colors"
                        : ""
                    }`}
                    onClick={() => {
                      if (onViewSalesperson && lead.assigned_to) {
                        onViewSalesperson(lead.assigned_to);
                      }
                    }}
                  >
                    {lead.assigned_user.full_name}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {format(new Date(lead.created_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-[160px] h-9 px-3 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            lead.status === "not_started" ? "bg-gray-500" :
                            lead.status === "contacted" ? "bg-teal-500" :
                            lead.status === "consultation" ? "bg-cyan-500" :
                            lead.status === "meeting" ? "bg-blue-500" :
                            lead.status === "hold" ? "bg-orange-500" :
                            lead.status === "qualified" ? "bg-purple-500" :
                            lead.status === "negotiation" ? "bg-indigo-500" :
                            lead.status === "pending" ? "bg-yellow-500" :
                            lead.status === "won" ? "bg-green-600" :
                            "bg-red-500"
                          }`} />
                          <span className="text-sm text-gray-700">
                            {statusOptions.find(s => s.value === lead.status)?.label}
                          </span>
                        </div>
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[180px]">
                      {/* Status Options */}
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">{t("status")}</div>
                      {statusOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => onStatusChange(lead.id, option.value)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              option.value === "not_started" ? "bg-gray-500" :
                              option.value === "contacted" ? "bg-teal-500" :
                              option.value === "consultation" ? "bg-cyan-500" :
                              option.value === "meeting" ? "bg-blue-500" :
                              option.value === "hold" ? "bg-orange-500" :
                              option.value === "qualified" ? "bg-purple-500" :
                              option.value === "negotiation" ? "bg-indigo-500" :
                              option.value === "pending" ? "bg-yellow-500" :
                              option.value === "won" ? "bg-green-600" :
                              "bg-red-500"
                            }`} />
                            <span>{option.label}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                      {/* Communication Methods */}
                      {onAddCommunication && communicationMethods.length > 0 && (
                        <>
                          <div className="my-1 border-t border-gray-200" />
                          <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">{t("communication")}</div>
                          {communicationMethods.map((method) => (
                            <DropdownMenuItem
                              key={method.id}
                              onClick={() => onAddCommunication(lead, method.id)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                {getMethodIcon(method.icon)}
                                <span>{method.name}</span>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {lead.is_paid && (
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {t("paid")}
                    </Badge>
                  )}
                </div>
              </TableCell>
              {/* Set Reminder Button */}
              <TableCell>
                {onSetReminder ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSetReminder(lead)}
                    className="gap-1 border-amber-500 text-amber-600 hover:bg-amber-50"
                  >
                    <Bell className="h-4 w-4" />
                    {t("setReminder")}
                  </Button>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>
              <TableCell>
                {lead.status === "not_started" ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onSendProposal(lead)}
                    className="bg-[#0C5536] hover:bg-[#0a4a2e]"
                  >
                    <Send className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                    {t("sendProposal")}
                  </Button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 border-[#0C5536] text-[#0C5536] hover:bg-[#0C5536]/10"
                      >
                        <FileText className="h-4 w-4" />
                        {t("proposal")}
                        <ChevronDown className="h-3 w-3 ltr:ml-1 rtl:mr-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => onSendProposal(lead)}>
                        <Pencil className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                        {t("edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewProposals(lead)}>
                        <Eye className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                        {t("view")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-center gap-0">
                  {onViewHistory && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                      onClick={() => onViewHistory(lead)}
                      title={t("viewHistory")}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    onClick={() => onEdit(lead)}
                    title={t("editLead")}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => onDelete(lead)}
                    title={t("deleteLead")}
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
  );
}
