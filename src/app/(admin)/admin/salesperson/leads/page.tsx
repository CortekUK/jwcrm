"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { SalespersonLeadTable, CommunicationMethod } from "@/components/salesperson/SalespersonLeadTable";
import { LeadPipelineBoard } from "@/components/lead-management/LeadPipelineBoard";
import { EditLeadDialog } from "@/components/lead-management/EditLeadDialog";
import { SendProposalDialog } from "@/components/lead-management/SendProposalDialog";
import { SendInvoiceDialog } from "@/components/lead-management/SendInvoiceDialog";
import { ViewProposalDialog } from "@/components/lead-management/ViewProposalDialog";
import { AddReminderDialog } from "@/components/lead-management/reminders/AddReminderDialog";
import { AddCommunicationDialog } from "@/components/lead-management/AddCommunicationDialog";
import { SendMeetingInviteDialog } from "@/components/salesperson/SendMeetingInviteDialog";
import { QuickActionsButton } from "@/components/lead-management/QuickActionsButton";
import { LeadStatus } from "@/components/lead-management/LeadStatusBadge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Target, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

interface Lead {
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
  last_contact_date?: string | null;
  next_action_date?: string | null;
  source_data?: { id: string; name: string } | null;
  assigned_user?: { user_id: string; full_name: string } | null;
}

type ViewMode = "table" | "kanban";

export default function SalespersonLeadsPage() {
  const { t } = useTranslation("leadManagement");
  const { t: tSalesperson } = useTranslation("salesperson");
  const { user } = useAuth();
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [viewProposalsDialogOpen, setViewProposalsDialogOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [meetingInviteDialogOpen, setMeetingInviteDialogOpen] = useState(false);
  const [communicationDialogOpen, setCommunicationDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [communicationMethods, setCommunicationMethods] = useState<CommunicationMethod[]>([]);

  // Load view mode from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem("salesperson_viewMode");
    if (savedViewMode === "table" || savedViewMode === "kanban") {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view mode to localStorage
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("salesperson_viewMode", mode);
  };

  // Fetch only leads assigned to current user
  const fetchLeads = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          source_data:lead_sources(id, name)
        `)
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error(t("failedToFetchLeads"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchLeads();
    }
  }, [user?.id]);

  // Fetch communication methods
  useEffect(() => {
    const fetchCommunicationMethods = async () => {
      try {
        const response = await fetch("/api/lead-management/communication-methods");
        if (response.ok) {
          const { data } = await response.json();
          setCommunicationMethods(data || []);
        }
      } catch (error) {
        console.error("Error fetching communication methods:", error);
      }
    };
    fetchCommunicationMethods();
  }, []);

  // Update lead (limited fields for salesperson)
  const handleUpdateLead = async (
    id: string,
    data: {
      full_name: string;
      email: string;
      phone?: string;
      company_name?: string;
      source?: string;
      notes?: string;
      status: LeadStatus;
    }
  ) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          notes: data.notes || null,
          status: data.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("assigned_to", user?.id); // Ensure only updating own leads

      if (error) throw error;

      toast.success(t("leadUpdated"));
      fetchLeads();
    } catch (error) {
      console.error("Error updating lead:", error);
      toast.error(t("failedToUpdateLead"));
      throw error;
    }
  };

  // Open edit dialog
  const handleEdit = (lead: Lead) => {
    setSelectedLead(lead);
    setEditDialogOpen(true);
  };

  // Send proposal
  const handleSendProposal = (lead: Lead) => {
    setSelectedLead(lead);
    setProposalDialogOpen(true);
  };

  // Send invoice
  const handleSendInvoice = (lead: Lead) => {
    setSelectedLead(lead);
    setInvoiceDialogOpen(true);
  };

  // View proposals
  const handleViewProposals = (lead: Lead) => {
    setSelectedLead(lead);
    setViewProposalsDialogOpen(true);
  };

  // Set reminder
  const handleSetReminder = (lead: Lead) => {
    setSelectedLead(lead);
    setReminderDialogOpen(true);
  };

  // Send meeting invite
  const handleSendMeetingInvite = (lead: Lead) => {
    setSelectedLead(lead);
    setMeetingInviteDialogOpen(true);
  };

  // Add communication
  const handleAddCommunication = (lead: Lead, methodId: string) => {
    setSelectedLead(lead);
    setSelectedMethodId(methodId);
    setCommunicationDialogOpen(true);
  };

  // Change lead status
  const handleStatusChange = async (leadId: string, status: LeadStatus) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId)
        .eq("assigned_to", user?.id); // Ensure only updating own leads

      if (error) throw error;

      const statusMap: Record<LeadStatus, string> = {
        not_started: t("notStarted"),
        contacted: t("contacted"),
        consultation: t("consultation"),
        meeting: t("meeting"),
        hold: t("hold"),
        qualified: t("qualified"),
        negotiation: t("negotiation"),
        pending: t("pending"),
        won: t("won"),
        lost: t("lost"),
      };
      toast.success(t("statusUpdated", { status: statusMap[status] }));
      fetchLeads();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(t("failedToUpdateStatus"));
    }
  };

  // Handle delete for Kanban (not used for salesperson but required by the interface)
  const handleDelete = (lead: Lead) => {
    toast.error(t("cannotDeleteLeads", "You cannot delete leads"));
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Target className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {tSalesperson("myLeads")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {tSalesperson("myLeadsDescription")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center rounded-lg border border-[#E6E6E4] bg-white p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewModeChange("table")}
                className={cn(
                  "h-8 px-3 rounded-md transition-all",
                  viewMode === "table"
                    ? "bg-[hsl(var(--jw-primary-green))] text-white hover:bg-[hsl(var(--jw-hover-green))] hover:text-white"
                    : "text-[#6B6B6B] hover:text-[#222222]"
                )}
              >
                <List className="h-4 w-4 mr-1.5" />
                {t("tableView", "Table")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewModeChange("kanban")}
                className={cn(
                  "h-8 px-3 rounded-md transition-all",
                  viewMode === "kanban"
                    ? "bg-[hsl(var(--jw-primary-green))] text-white hover:bg-[hsl(var(--jw-hover-green))] hover:text-white"
                    : "text-[#6B6B6B] hover:text-[#222222]"
                )}
              >
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                {t("kanbanView", "Kanban")}
              </Button>
            </div>
            {/* KPI Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[hsl(var(--jw-primary-green))]/30 bg-white">
              <Target className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
              <span className="text-sm font-medium text-[hsl(var(--jw-primary-green))]">{leads.length} {tSalesperson("leads")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lead View */}
      {viewMode === "table" ? (
        <SalespersonLeadTable
          leads={leads}
          onEdit={handleEdit}
          onSendProposal={handleSendProposal}
          onSendInvoice={handleSendInvoice}
          onViewProposals={handleViewProposals}
          onStatusChange={handleStatusChange}
          onViewHistory={(lead) => router.push(`/admin/salesperson/leads/${lead.id}`)}
          onSetReminder={handleSetReminder}
          onSendMeetingInvite={handleSendMeetingInvite}
          onAddCommunication={handleAddCommunication}
          communicationMethods={communicationMethods}
          isLoading={isLoading}
        />
      ) : (
        <LeadPipelineBoard
          leads={leads}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSendProposal={handleSendProposal}
          onViewProposals={handleViewProposals}
          onStatusChange={handleStatusChange}
          onViewHistory={(lead) => router.push(`/admin/salesperson/leads/${lead.id}`)}
          onSetReminder={handleSetReminder}
          isLoading={isLoading}
          basePath="/admin/salesperson/leads"
        />
      )}

      {/* Edit Lead Dialog */}
      <EditLeadDialog
        lead={selectedLead}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={handleUpdateLead}
        isSalesperson={true}
      />

      {/* Send Proposal Dialog */}
      <SendProposalDialog
        lead={selectedLead}
        open={proposalDialogOpen}
        onOpenChange={setProposalDialogOpen}
        onSuccess={fetchLeads}
        onLeadUpdate={async (id, data) => {
          const { error } = await supabase
            .from("leads")
            .update({
              ...data,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id);

          if (error) throw error;
        }}
      />

      {/* Send Invoice Dialog */}
      <SendInvoiceDialog
        lead={selectedLead}
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        onSuccess={fetchLeads}
      />

      {/* View Proposals Dialog */}
      <ViewProposalDialog
        lead={selectedLead}
        open={viewProposalsDialogOpen}
        onOpenChange={setViewProposalsDialogOpen}
      />

      {/* Add Reminder Dialog */}
      {selectedLead && (
        <AddReminderDialog
          leadId={selectedLead.id}
          leadName={selectedLead.full_name}
          open={reminderDialogOpen}
          onOpenChange={setReminderDialogOpen}
        />
      )}

      {/* Send Meeting Invite Dialog */}
      {selectedLead && selectedLead.email && (
        <SendMeetingInviteDialog
          open={meetingInviteDialogOpen}
          onOpenChange={setMeetingInviteDialogOpen}
          leadId={selectedLead.id}
          leadName={selectedLead.full_name}
          leadEmail={selectedLead.email}
        />
      )}

      {/* Add Communication Dialog */}
      {selectedLead && (
        <AddCommunicationDialog
          leadId={selectedLead.id}
          open={communicationDialogOpen}
          onOpenChange={setCommunicationDialogOpen}
          preSelectedMethodId={selectedMethodId}
          onSuccess={fetchLeads}
        />
      )}

      {/* Floating Quick Actions Button */}
      <QuickActionsButton
        onOpenCalendar={() => router.push("/admin/salesperson/calendar")}
      />

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">{t("legalNotice")}</p>
      </div>
    </div>
  );
}
