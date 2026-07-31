// Browser-side loader for computeCollectedRevenue.
//
// Kept out of collectedRevenue.ts so the reconciliation logic itself stays a
// pure function with no Supabase import — the salesperson API route runs the
// same maths with the service-role client and must not drag the anon client in.
//
// Two round trips regardless of lead count (chunked only to keep the `in(...)`
// filter out of URL-length territory on pages that load every lead).

import { supabase } from "@/integrations/supabase/client";
import {
  computeCollectedRevenue,
  type LeadCollectedRevenue,
  type RevenueLeadLike,
  type RevenueProposalLike,
  type RevenuePaymentLike,
} from "./collectedRevenue";

// PostgREST puts `in` filters in the query string; ~150 uuids is a comfortable
// margin under the usual 8–16 KB URL ceilings.
const CHUNK_SIZE = 150;

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

/**
 * Collected revenue per lead id for the given leads.
 *
 * Leads with no money against them in either record are absent from the map;
 * callers should read that as zero.
 */
export async function fetchCollectedRevenue(
  leads: RevenueLeadLike[]
): Promise<Map<string, LeadCollectedRevenue>> {
  const leadIds = leads.map((l) => l.id).filter(Boolean);
  if (leadIds.length === 0) return new Map();

  const proposalResults = await Promise.all(
    chunk(leadIds, CHUNK_SIZE).map((ids) =>
      supabase.from("proposals").select("id, lead_id, currency").in("lead_id", ids)
    )
  );
  const proposals = proposalResults.flatMap(
    (r) => (r.data || []) as unknown as RevenueProposalLike[]
  );

  const proposalIds = proposals.map((p) => p.id);
  const paymentResults = await Promise.all(
    chunk(proposalIds, CHUNK_SIZE).map((ids) =>
      supabase.from("proposal_payments").select("proposal_id, amount").in("proposal_id", ids)
    )
  );
  const payments = paymentResults.flatMap(
    (r) => (r.data || []) as unknown as RevenuePaymentLike[]
  );

  return computeCollectedRevenue(leads, proposals, payments);
}
