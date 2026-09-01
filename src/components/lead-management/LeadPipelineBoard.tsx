"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadStatus } from "./LeadStatusBadge";
import { LeadHealthIndicator } from "./LeadHealthIndicator";
import { cn } from "@/lib/utils";
import { format, differenceInDays, parseISO } from "date-fns";
import {
  GripVertical,
  MoreHorizontal,
  Eye,
  Pencil,
  FileText,
  Send,
  Bell,
  Trash2,
  Phone,
  Mail,
  Building2,
  Calendar,
  TrendingUp,
  Loader2,
  ArrowRight,
} from "lucide-react";

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
  // Enriched by the page, not columns on `leads`: newest logged communication
  // (or last call attempt) and earliest outstanding reminder.
  last_contact_at?: string | null;
  next_action_at?: string | null;
  source_data?: { id: string; name: string } | null;
  assigned_user?: { user_id: string; full_name: string } | null;
}

interface LeadPipelineBoardProps {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onSendProposal: (lead: Lead) => void;
  onViewProposals: (lead: Lead) => void;
  onStatusChange: (leadId: string, status: LeadStatus) => void;
  onViewHistory?: (lead: Lead) => void;
  onSetReminder?: (lead: Lead) => void;
  isLoading?: boolean;
  basePath?: string;
}

// Pipeline columns in order
const PIPELINE_COLUMNS: { status: LeadStatus; label: string; color: string; bgColor: string; borderColor: string }[] = [
  { status: "not_started", label: "Not Started", color: "#6B6B6B", bgColor: "#F5F5F5", borderColor: "#E6E6E4" },
  { status: "contacted", label: "Contacted", color: "#0C5536", bgColor: "#E6F7F1", borderColor: "#0C5536" },
  { status: "consultation", label: "Consultation", color: "#0369A1", bgColor: "#E0F2FE", borderColor: "#0369A1" },
  { status: "consultation_completed", label: "Consultation Completed", color: "#0E7490", bgColor: "#CFFAFE", borderColor: "#0E7490" },
  { status: "meeting", label: "Meeting", color: "#2563EB", bgColor: "#E6F0FF", borderColor: "#2563EB" },
  { status: "qualified", label: "Qualified", color: "#7C3AED", bgColor: "#F3E8FF", borderColor: "#7C3AED" },
  { status: "negotiation", label: "Negotiation", color: "#4F46E5", bgColor: "#E6E6FF", borderColor: "#4F46E5" },
  { status: "pending", label: "Pending", color: "#C6A03B", bgColor: "#FFF9E6", borderColor: "#C6A03B" },
  // `hold` is a real lead_status value; leaving it out of the columns meant
  // every lead paused on hold was grouped into a bucket the board never rendered.
  { status: "hold", label: "On Hold", color: "#D97706", bgColor: "#FFF4E6", borderColor: "#D97706" },
  // Drafting fee paid, work underway, court fees still outstanding. Leads land
  // here automatically when the upfront line items are covered.
  { status: "drafting", label: "Drafting", color: "#0369A1", bgColor: "#E0F2FE", borderColor: "#0369A1" },
  { status: "won", label: "Won", color: "#0C5536", bgColor: "#D4EDDA", borderColor: "#0C5536" },
  { status: "lost", label: "Lost", color: "#C0392B", bgColor: "#FEECEC", borderColor: "#C0392B" },
  { status: "unreachable", label: "Unreachable", color: "#737373", bgColor: "#E5E5E5", borderColor: "#737373" },
];

export function LeadPipelineBoard({
  leads,
  onEdit,
  onDelete,
  onSendProposal,
  onViewProposals,
  onStatusChange,
  onViewHistory,
  onSetReminder,
  isLoading,
  basePath = "/admin/lead-management/leads",
}: LeadPipelineBoardProps) {
  const { t } = useTranslation("leadManagement");
  const router = useRouter();
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  // Group leads by status
  const leadsByStatus = useMemo(() => {
    const grouped: Record<LeadStatus, Lead[]> = {
      not_started: [],
      contacted: [],
      consultation: [],
      consultation_completed: [],
      meeting: [],
      qualified: [],
      negotiation: [],
      pending: [],
      drafting: [],
      won: [],
      lost: [],
      hold: [],
      unreachable: [],
    };

    leads.forEach((lead) => {
      if (grouped[lead.status]) {
        grouped[lead.status].push(lead);
      }
    });

    return grouped;
  }, [leads]);

  // Calculate column totals
  const columnTotals = useMemo(() => {
    const totals: Record<LeadStatus, { count: number; value: number }> = {} as any;
    
    PIPELINE_COLUMNS.forEach((col) => {
      const columnLeads = leadsByStatus[col.status] || [];
      totals[col.status] = {
        count: columnLeads.length,
        value: columnLeads.reduce((sum, lead) => sum + (lead.paid_amount || 0), 0),
      };
    });

    return totals;
  }, [leadsByStatus]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", lead.id);
    // Add a custom drag image or styling
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = "0.5";
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = "1";
    setDraggedLead(null);
    setDragOverColumn(null);
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  }, []);

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  // Handle drop
  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: LeadStatus) => {
    e.preventDefault();
    
    if (draggedLead && draggedLead.status !== newStatus) {
      setUpdatingLeadId(draggedLead.id);
      await onStatusChange(draggedLead.id, newStatus);
      setUpdatingLeadId(null);
    }
    
    setDraggedLead(null);
    setDragOverColumn(null);
  }, [draggedLead, onStatusChange]);

  // Calculate days in stage
  const getDaysInStage = (lead: Lead) => {
    const updatedDate = parseISO(lead.updated_at);
    return differenceInDays(new Date(), updatedDate);
  };

  // Render a single lead card
  const renderLeadCard = (lead: Lead) => {
    const daysInStage = getDaysInStage(lead);
    const isUpdating = updatingLeadId === lead.id;

    return (
      <div
        key={lead.id}
        draggable={!isUpdating}
        onDragStart={(e) => handleDragStart(e, lead)}
        onDragEnd={handleDragEnd}
        className={cn(
          "bg-white rounded-lg border border-[#E6E6E4] p-3 cursor-grab active:cursor-grabbing",
          "transition-all hover:shadow-md hover:border-[#C6A03B]",
          isUpdating && "opacity-50 cursor-wait"
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <GripVertical className="h-4 w-4 text-[#999999] flex-shrink-0" />
            <span className="font-medium text-[#222222] truncate">{lead.full_name}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => router.push(`${basePath}/${lead.id}`)}>
                <Eye className="h-4 w-4 mr-2" />
                {t("viewDetails", "View Details")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(lead)}>
                <Pencil className="h-4 w-4 mr-2" />
                {t("edit", "Edit")}
              </DropdownMenuItem>
              {onViewHistory && (
                <DropdownMenuItem onClick={() => onViewHistory(lead)}>
                  <FileText className="h-4 w-4 mr-2" />
                  {t("viewHistory", "View History")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onSendProposal(lead)}>
                <Send className="h-4 w-4 mr-2" />
                {t("sendProposal", "Send Proposal")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewProposals(lead)}>
                <FileText className="h-4 w-4 mr-2" />
                {t("viewProposals", "View Proposals")}
              </DropdownMenuItem>
              {onSetReminder && (
                <DropdownMenuItem onClick={() => onSetReminder(lead)}>
                  <Bell className="h-4 w-4 mr-2" />
                  {t("setReminder", "Set Reminder")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(lead)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("delete", "Delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Contact Info */}
        <div className="space-y-1 mb-2">
          {lead.email && (
            <div className="flex items-center gap-1.5 text-xs text-[#6B6B6B] truncate">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.company_name && (
            <div className="flex items-center gap-1.5 text-xs text-[#6B6B6B] truncate">
              <Building2 className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{lead.company_name}</span>
            </div>
          )}
        </div>

        {/* Health Indicator */}
        <div className="mb-2">
          <LeadHealthIndicator
            lastContactDate={lead.last_contact_at}
            nextActionDate={lead.next_action_at}
            createdAt={lead.created_at}
            status={lead.status}
            isPaid={lead.is_paid}
            compact
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[#E6E6E4]">
          <div className="flex items-center gap-1 text-xs text-[#999999]">
            <Calendar className="h-3 w-3" />
            <span>{daysInStage}d</span>
          </div>
          {lead.paid_amount && lead.paid_amount > 0 && (
            <Badge className="bg-[#E6F7F1] text-[#0C5536] border-0 text-xs">
              AED {lead.paid_amount.toLocaleString()}
            </Badge>
          )}
          {lead.source_data && (
            <span className="text-xs text-[#999999] truncate max-w-[80px]">
              {lead.source_data.name}
            </span>
          )}
        </div>

        {/* Loading overlay */}
        {isUpdating && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--jw-primary-green))]" />
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pipeline summary */}
      <div className="flex items-center gap-4 text-sm text-[#6B6B6B] px-1">
        <span className="font-medium text-[#222222]">{leads.length} {t("totalLeads", "total leads")}</span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <TrendingUp className="h-4 w-4 text-[#0C5536]" />
          AED {leads.filter(l => l.status !== "won" && l.status !== "lost").reduce((sum, l) => sum + (l.paid_amount || 0), 0).toLocaleString()} {t("inPipeline", "in pipeline")}
        </span>
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_COLUMNS.map((column) => {
          const columnLeads = leadsByStatus[column.status] || [];
          const totals = columnTotals[column.status];
          const isDragOver = dragOverColumn === column.status;

          return (
            <div
              key={column.status}
              className={cn(
                "flex-shrink-0 w-72 rounded-xl border transition-colors",
                isDragOver 
                  ? "border-[#C6A03B] bg-[#FFF9E6]/30" 
                  : "border-[#E6E6E4] bg-[#FAFAF8]"
              )}
              onDragOver={(e) => handleDragOver(e, column.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.status)}
            >
              {/* Column header */}
              <div 
                className="p-3 rounded-t-xl"
                style={{ 
                  backgroundColor: column.bgColor,
                  borderBottom: `2px solid ${column.borderColor}20`,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: column.color }}
                    />
                    <span 
                      className="font-semibold text-sm"
                      style={{ color: column.color }}
                    >
                      {t(column.status, column.label)}
                    </span>
                  </div>
                  <Badge 
                    variant="outline" 
                    className="h-5 px-1.5 text-xs font-medium"
                    style={{ 
                      color: column.color,
                      borderColor: `${column.color}40`,
                    }}
                  >
                    {totals.count}
                  </Badge>
                </div>
                {totals.value > 0 && (
                  <div className="text-xs" style={{ color: `${column.color}99` }}>
                    AED {totals.value.toLocaleString()} {t("totalValue", "total")}
                  </div>
                )}
              </div>

              {/* Column content */}
              <div className="p-2 space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                {columnLeads.length === 0 ? (
                  <div className="text-center py-8 text-[#999999] text-sm">
                    {isDragOver ? (
                      <div className="flex flex-col items-center gap-2">
                        <ArrowRight className="h-5 w-5" />
                        <span>{t("dropHere", "Drop here")}</span>
                      </div>
                    ) : (
                      t("noLeads", "No leads")
                    )}
                  </div>
                ) : (
                  columnLeads.map(renderLeadCard)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend / Help text */}
      <div className="flex items-center justify-center gap-4 text-xs text-[#999999] pt-2">
        <span className="flex items-center gap-1">
          <GripVertical className="h-3 w-3" />
          {t("dragToMove", "Drag cards to change status")}
        </span>
      </div>
    </div>
  );
}
