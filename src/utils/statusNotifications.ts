import { supabase } from "@/integrations/supabase/client";
import type { WillStatus } from "@/lib/status-config";

export const checkForStatusChanges = async (
  userId: string,
  lastCheckedStatus: WillStatus | null
): Promise<WillStatus | null> => {
  try {
    const { data, error } = await supabase
      .from('wills')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return lastCheckedStatus;

    return data.status as WillStatus;
  } catch (error) {
    console.error('Error checking status changes:', error);
    return lastCheckedStatus;
  }
};

export const getStoredStatus = (userId: string): WillStatus | null => {
  const stored = localStorage.getItem(`last_status_${userId}`);
  return stored as WillStatus | null;
};

export const setStoredStatus = (userId: string, status: WillStatus): void => {
  localStorage.setItem(`last_status_${userId}`, status);
};
