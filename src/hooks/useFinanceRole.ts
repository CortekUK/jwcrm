"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type FinanceRole = "head" | "employee";

interface UseFinanceRoleReturn {
  financeRole: FinanceRole;
  isHead: boolean;
  isLoading: boolean;
  userId: string | null;
}

export function useFinanceRole(): UseFinanceRoleReturn {
  const { profile } = useAuth();
  const [financeRole, setFinanceRole] = useState<FinanceRole>("employee");
  const [isLoading, setIsLoading] = useState(true);

  const userId = profile?.user_id ?? null;
  const roles = profile?.roles ?? [];

  // Admin and superadmin always get head access
  const isAdminBypass = roles.includes("admin") || roles.includes("superadmin");

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    if (isAdminBypass) {
      setFinanceRole("head");
      setIsLoading(false);
      return;
    }

    const fetchFinanceRole = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("finance_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) throw error;
        setFinanceRole((data?.role as FinanceRole) ?? "employee");
      } catch (error) {
        console.error("Error fetching finance role:", error);
        setFinanceRole("employee");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFinanceRole();
  }, [userId, isAdminBypass]);

  return {
    financeRole,
    isHead: isAdminBypass || financeRole === "head",
    isLoading,
    userId,
  };
}
