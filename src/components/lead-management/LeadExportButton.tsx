"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExportLeadsDialog } from "./ExportLeadsDialog";

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
  status: string;
  is_paid: boolean;
  paid_at: string | null;
  paid_amount: number | null;
  paid_currency: string | null;
  created_at: string;
  updated_at: string;
  source_data?: { id: string; name: string } | null;
  assigned_user?: { user_id: string; full_name: string } | null;
}

interface LeadExportButtonProps {
  salespersonId?: string; // If provided, filter to this salesperson's leads
}

export function LeadExportButton({ salespersonId }: LeadExportButtonProps) {
  const { t } = useTranslation(["leadManagement", "common"]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    if (open) {
      fetchLeads();
    }
  }, [open, salespersonId]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      // leads.assigned_to references auth.users, NOT profiles, so there is no
      // leads_assigned_to_fkey to embed through — asking for one made PostgREST
      // fail the whole request (PGRST200) and the export silently produced an
      // empty file. Fetch the profiles separately and join in JS instead, the
      // same way the leads list page does.
      let query = supabase
        .from("leads")
        .select(`
          *,
          source_data:lead_sources!leads_source_id_fkey(id, name)
        `)
        .order("created_at", { ascending: false });

      // Filter by salesperson if provided
      if (salespersonId) {
        query = query.eq("assigned_to", salespersonId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const rows = data || [];
      const assigneeIds = Array.from(
        new Set(rows.map((lead) => lead.assigned_to).filter(Boolean))
      ) as string[];

      const profileMap = new Map<string, { user_id: string; full_name: string }>();
      if (assigneeIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", assigneeIds);

        if (profilesError) throw profilesError;

        (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));
      }

      setLeads(
        rows.map((lead: any) => ({
          ...lead,
          assigned_user: lead.assigned_to
            ? profileMap.get(lead.assigned_to) ?? null
            : null,
        })) as Lead[]
      );
    } catch (error: any) {
      console.error("Error fetching leads:", error);
      setLeads([]);
      // Never let a broken export look like it succeeded with zero rows.
      toast.error(
        t("failedToFetchLeads", "Failed to load leads for export"),
        { description: error?.message }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="w-full border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
        onClick={() => setOpen(true)}
      >
        <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
        {t("common:export", "Export")}
      </Button>

      <ExportLeadsDialog
        open={open}
        onOpenChange={setOpen}
        leads={leads}
      />
    </>
  );
}
