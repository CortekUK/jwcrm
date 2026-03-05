"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LeaveTypeConfig = {
  id: string;
  slug: string;
  name: string;
  icon_name: string;
  color_class: string;
  bg_color_class: string;
  tracks_balance: boolean;
  balance_field_prefix: string | null;
  is_active: boolean;
  sort_order: number;
};

/**
 * Hook to fetch configurable leave types from the database.
 * Returns active leave types sorted by sort_order.
 */
export function useLeaveTypes(includeInactive = false) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaveTypes = async () => {
      try {
        let query = supabase
          .from("leave_types")
          .select("*")
          .order("sort_order");

        if (!includeInactive) {
          query = query.eq("is_active", true);
        }

        const { data, error } = await query;

        if (error) {
          // Table may not exist yet
          if (error.code === "42P01" || error.message?.includes("relation")) {
            setLeaveTypes(FALLBACK_LEAVE_TYPES);
          } else {
            console.error("Error fetching leave types:", error);
            setLeaveTypes(FALLBACK_LEAVE_TYPES);
          }
        } else {
          setLeaveTypes(data?.length ? data : FALLBACK_LEAVE_TYPES);
        }
      } catch {
        setLeaveTypes(FALLBACK_LEAVE_TYPES);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaveTypes();
  }, [includeInactive]);

  /** Get a single leave type config by slug */
  const getBySlug = (slug: string) => leaveTypes.find((t) => t.slug === slug);

  /** Build a slug -> name lookup map */
  const labelMap: Record<string, string> = {};
  for (const lt of leaveTypes) {
    labelMap[lt.slug] = lt.name;
  }

  return { leaveTypes, loading, getBySlug, labelMap };
}

/** Fallback when the leave_types table doesn't exist yet */
const FALLBACK_LEAVE_TYPES: LeaveTypeConfig[] = [
  { id: "1", slug: "annual", name: "Annual Leave", icon_name: "Plane", color_class: "text-purple-600", bg_color_class: "bg-purple-100", tracks_balance: true, balance_field_prefix: "annual", is_active: true, sort_order: 1 },
  { id: "2", slug: "sick", name: "Sick Leave", icon_name: "Thermometer", color_class: "text-yellow-600", bg_color_class: "bg-yellow-100", tracks_balance: true, balance_field_prefix: "sick", is_active: true, sort_order: 2 },
  { id: "3", slug: "emergency", name: "Emergency Leave", icon_name: "AlertCircle", color_class: "text-orange-600", bg_color_class: "bg-orange-100", tracks_balance: false, balance_field_prefix: null, is_active: true, sort_order: 3 },
  { id: "4", slug: "unpaid", name: "Unpaid Leave", icon_name: "Wallet", color_class: "text-gray-600", bg_color_class: "bg-gray-100", tracks_balance: false, balance_field_prefix: null, is_active: true, sort_order: 4 },
  { id: "5", slug: "working_abroad", name: "Working from Abroad", icon_name: "Globe", color_class: "text-blue-600", bg_color_class: "bg-blue-100", tracks_balance: false, balance_field_prefix: null, is_active: true, sort_order: 5 },
];
