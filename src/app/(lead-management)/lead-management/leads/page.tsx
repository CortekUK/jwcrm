"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { LeadTable, Lead, CommunicationMethod } from "@/components/lead-management/LeadTable";
import { LeadPipelineBoard } from "@/components/lead-management/LeadPipelineBoard";
import { CreateLeadDialog } from "@/components/lead-management/CreateLeadDialog";
import { EditLeadDialog } from "@/components/lead-management/EditLeadDialog";
import { SendProposalDialog } from "@/components/lead-management/SendProposalDialog";
import { ViewProposalDialog } from "@/components/lead-management/ViewProposalDialog";
import { AddCommunicationDialog } from "@/components/lead-management/AddCommunicationDialog";
import { AddReminderDialog } from "@/components/lead-management/reminders/AddReminderDialog";
import { QuickActionsButton } from "@/components/lead-management/QuickActionsButton";
import { LeadStatus } from "@/components/lead-management/LeadStatusBadge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Target, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
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

type ViewMode = "table" | "kanban";

export default function LeadsPage() {
  const { t } = useTranslation("leadManagement");
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [viewProposalsDialogOpen, setViewProposalsDialogOpen] = useState(false);
  const [communicationDialogOpen, setCommunicationDialogOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [communicationMethods, setCommunicationMethods] = useState<CommunicationMethod[]>([]);

  // Load view mode from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem("leadManagement_viewMode");
    if (savedViewMode === "table" || savedViewMode === "kanban") {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view mode to localStorage
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("leadManagement_viewMode", mode);
  };

  // Fetch leads
  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("leads")
        .select(`
          *,
          source_data:lead_sources(id, name)
        `)
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

      // Fetch assigned user profiles separately
      const leadsWithProfiles = await Promise.all(
        (data || []).map(async (lead) => {
          if (lead.assigned_to) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("user_id, full_name")
              .eq("user_id", lead.assigned_to)
              .single();
            return { ...lead, assigned_user: profile };
          }
          return { ...lead, assigned_user: null };
        })
      );

      setLeads(leadsWithProfiles);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error(t("failedToFetchLeads"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [statusFilter, searchQuery]);

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

  // Create lead with auto-assignment
  const handleCreateLead = async (data: {
    full_name: string;
    email: string;
    phone?: string;
    company_name?: string;
    source_id?: string;
    notes?: string;
  }) => {
    try {
      const response = await fetch("/api/lead-management/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create lead");
      }

      toast.success(t("leadCreated"));
      fetchLeads();
    } catch (error) {
      console.error("Error creating lead:", error);
      toast.error(t("failedToCreateLead"));
      throw error;
    }
  };

  // Update lead
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
          full_name: data.full_name,
          email: data.email,
          phone: data.phone || null,
          company_name: data.company_name || null,
          source: data.source || null,
          notes: data.notes || null,
          status: data.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      toast.success(t("leadUpdated"));
      fetchLeads();
    } catch (error) {
      console.error("Error updating lead:", error);
      toast.error(t("failedToUpdateLead"));
      throw error;
    }
  };

  // Delete lead
  const handleDeleteLead = async () => {
    if (!selectedLead) return;

    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", selectedLead.id);

      if (error) throw error;

      toast.success(t("leadDeleted"));
      setDeleteDialogOpen(false);
      setSelectedLead(null);
      fetchLeads();
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast.error(t("failedToDeleteLead"));
    }
  };

  // Open edit dialog
  const handleEdit = (lead: Lead) => {
    setSelectedLead(lead);
    setEditDialogOpen(true);
  };

  // Open delete confirmation
  const handleDelete = (lead: Lead) => {
    setSelectedLead(lead);
    setDeleteDialogOpen(true);
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

  // Add communication
  const handleAddCommunication = (lead: Lead, methodId: string) => {
    setSelectedLead(lead);
    setSelectedMethodId(methodId);
    setCommunicationDialogOpen(true);
  };

  // Set reminder
  const handleSetReminder = (lead: Lead) => {
    setSelectedLead(lead);
    setReminderDialogOpen(true);
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
        .eq("id", leadId);

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
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Target className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("leads")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {t("leadsDescription")}
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
            {/* Leads Count Badge */}
            {!isLoading && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[hsl(var(--jw-primary-green))]/30 bg-white">
                <Target className="h-4 w-4 text-[hsl(var(--jw-primary-green))]" />
                <span className="text-sm font-medium text-[hsl(var(--jw-primary-green))]">
                  {leads.length} {t("leadsCount", "Leads")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lead View */}
      {viewMode === "table" ? (
        <LeadTable
          leads={leads}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSendProposal={handleSendProposal}
          onViewProposals={handleViewProposals}
          onStatusChange={handleStatusChange}
          onViewHistory={(lead) => router.push(`/admin/lead-management/leads/${lead.id}`)}
          onViewSalesperson={(salespersonId) => router.push(`/admin/lead-management/salesperson/${salespersonId}`)}
          onAddCommunication={handleAddCommunication}
          onSetReminder={handleSetReminder}
          onAddNew={() => setCreateDialogOpen(true)}
          communicationMethods={communicationMethods}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
      ) : (
        <LeadPipelineBoard
          leads={leads}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSendProposal={handleSendProposal}
          onViewProposals={handleViewProposals}
          onStatusChange={handleStatusChange}
          onViewHistory={(lead) => router.push(`/admin/lead-management/leads/${lead.id}`)}
          onSetReminder={handleSetReminder}
          isLoading={isLoading}
          basePath="/admin/lead-management/leads"
        />
      )}

      {/* Create Lead Dialog */}
      <CreateLeadDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateLead}
      />

      {/* Edit Lead Dialog */}
      <EditLeadDialog
        lead={selectedLead}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={handleUpdateLead}
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

      {/* Add Reminder Dialog */}
      {selectedLead && (
        <AddReminderDialog
          leadId={selectedLead.id}
          leadName={selectedLead.full_name}
          open={reminderDialogOpen}
          onOpenChange={setReminderDialogOpen}
          onSuccess={fetchLeads}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#C0392B]">{t("areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("permanentlyDeleteWarning", { name: selectedLead?.full_name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E6E6E4]">{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLead}
              className="bg-[#C0392B] hover:bg-[#A33025] text-white"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Quick Actions Button */}
      <QuickActionsButton
        onCreateLead={() => setCreateDialogOpen(true)}
      />

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("legalNotice", "© 2024 Just Wills. All rights reserved.")}
        </p>
      </div>
    </div>
  );
}
