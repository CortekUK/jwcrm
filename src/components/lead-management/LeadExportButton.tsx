"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
      let query = supabase
        .from("leads")
        .select(`
          *,
          source_data:lead_sources!leads_source_id_fkey(id, name),
          assigned_user:profiles!leads_assigned_to_fkey(user_id:id, full_name)
        `)
        .order("created_at", { ascending: false });

      // Filter by salesperson if provided
      if (salespersonId) {
        query = query.eq("assigned_to", salespersonId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeads((data as Lead[]) || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
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
