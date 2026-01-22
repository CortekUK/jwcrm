"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SalespersonLeadTable, CommunicationMethod } from "@/components/salesperson/SalespersonLeadTable";
import { EditLeadDialog } from "@/components/lead-management/EditLeadDialog";
import { SendProposalDialog } from "@/components/lead-management/SendProposalDialog";
import { ViewProposalDialog } from "@/components/lead-management/ViewProposalDialog";
import { AddReminderDialog } from "@/components/lead-management/reminders/AddReminderDialog";
import { AddCommunicationDialog } from "@/components/lead-management/AddCommunicationDialog";
import { SendMeetingInviteDialog } from "@/components/salesperson/SendMeetingInviteDialog";
import { LeadStatus } from "@/components/lead-management/LeadStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Search } from "lucide-react";

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
  source_data?: { id: string; name: string } | null;
}

export default function SalespersonLeadsPage() {
  const { t } = useTranslation("leadManagement");
  const { t: tSalesperson } = useTranslation("salesperson");
  const { user } = useAuth();
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [viewProposalsDialogOpen, setViewProposalsDialogOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [meetingInviteDialogOpen, setMeetingInviteDialogOpen] = useState(false);
  const [communicationDialogOpen, setCommunicationDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [communicationMethods, setCommunicationMethods] = useState<CommunicationMethod[]>([]);

  // Fetch only leads assigned to current user
  const fetchLeads = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from("leads")
        .select(`
          *,
          source_data:lead_sources(id, name)
        `)
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (searchQuery) {
        query = query.or(
          `full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query;

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
  }, [user?.id, statusFilter, searchQuery]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tSalesperson("myLeads")}</h1>
          <p className="text-muted-foreground">
            {tSalesperson("myLeadsDescription")}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchLeads")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ltr:pl-9 rtl:pr-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="not_started">{t("notStarted")}</SelectItem>
            <SelectItem value="contacted">{t("contacted")}</SelectItem>
            <SelectItem value="consultation">{t("consultation")}</SelectItem>
            <SelectItem value="qualified">{t("qualified")}</SelectItem>
            <SelectItem value="pending">{t("pending")}</SelectItem>
            <SelectItem value="won">{t("won")}</SelectItem>
            <SelectItem value="lost">{t("lost")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lead Table */}
      <SalespersonLeadTable
        leads={leads}
        onEdit={handleEdit}
        onSendProposal={handleSendProposal}
        onViewProposals={handleViewProposals}
        onStatusChange={handleStatusChange}
        onViewHistory={(lead) => router.push(`/admin/salesperson/leads/${lead.id}`)}
        onSetReminder={handleSetReminder}
        onSendMeetingInvite={handleSendMeetingInvite}
        onAddCommunication={handleAddCommunication}
        communicationMethods={communicationMethods}
        isLoading={isLoading}
      />

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
    </div>
  );
}
