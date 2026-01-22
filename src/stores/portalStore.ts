import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { type WillStatus } from '@/lib/status-config';

interface WillAnswers {
  personal?: {
    full_name?: string;
    contact_number?: string;
    address?: string;
    email?: string;
    date?: string;
    marital_status?: string;
    religion?: string;
  };
  [key: string]: unknown;
}

export interface PortalWill {
  id: string;
  status: WillStatus;
  submitted_at: string | null;
  created_at: string;
  pdf_path: string | null;
  answers?: WillAnswers | null;
}

export interface PortalActivityEvent {
  id: string;
  new_status: WillStatus;
  previous_status: WillStatus | null;
  changed_at: string;
  notes: string | null;
  will_id?: string;
}

interface PortalState {
  // State
  currentWill: PortalWill | null;
  willsCount: number;
  docsCount: number;
  recentActivity: PortalActivityEvent[];
  lastFetched: number | null;
  isLoading: boolean;
  hasDraftWithData: boolean;

  // Actions
  fetchDashboardData: (userId: string) => Promise<void>;
  setCurrentWill: (will: PortalWill | null) => void;
  invalidate: () => void;
  reset: () => void;
}

// Cache duration: 2 minutes
const CACHE_DURATION = 2 * 60 * 1000;

export const usePortalStore = create<PortalState>((set, get) => ({
  // Initial state
  currentWill: null,
  willsCount: 0,
  docsCount: 0,
  recentActivity: [],
  lastFetched: null,
  isLoading: false,
  hasDraftWithData: false,

  // Actions
  fetchDashboardData: async (userId: string) => {
    const { lastFetched, isLoading } = get();

    // Skip if already loading
    if (isLoading) return;

    // Use cache if data is fresh
    if (lastFetched && Date.now() - lastFetched < CACHE_DURATION) {
      return;
    }

    set({ isLoading: true });

    try {
      // Fetch all data in parallel for better performance
      const [willsCountResult, docsCountResult, currentWillResult, userWillsResult] = await Promise.all([
        // Wills count (submitted only)
        supabase
          .from('wills')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .not('submitted_at', 'is', null),

        // Documents count (draft_released or finalized)
        supabase
          .from('wills')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .in('status', ['draft_released', 'finalized']),

        // Current will (most recent)
        supabase
          .from('wills')
          .select('id, status, submitted_at, created_at, pdf_path, answers')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),

        // All user wills (for activity lookup)
        supabase
          .from('wills')
          .select('id')
          .eq('user_id', userId),
      ]);

      const willsCount = willsCountResult.count || 0;
      const docsCount = docsCountResult.count || 0;
      const currentWill = currentWillResult.data as PortalWill | null;

      // Check if there's a draft will with Step 1 data
      let hasDraftWithData = false;
      const answers = currentWill?.answers as WillAnswers | null;
      if (currentWill && !currentWill.submitted_at && answers?.personal) {
        const personal = answers.personal;
        const filledFields = [
          personal.full_name,
          personal.contact_number,
          personal.address,
          personal.email,
          personal.date,
          personal.marital_status,
          personal.religion
        ].filter(field => field && field.toString().trim() !== '').length;
        hasDraftWithData = filledFields > 1;
      }

      // Fetch recent activity if user has wills
      let recentActivity: PortalActivityEvent[] = [];
      if (userWillsResult.data && userWillsResult.data.length > 0) {
        const willIds = userWillsResult.data.map(w => w.id);
        const { data: activityData } = await supabase
          .from('will_status_events')
          .select('id, new_status, previous_status, changed_at, notes, will_id')
          .in('will_id', willIds)
          .order('changed_at', { ascending: false })
          .limit(5);
        recentActivity = (activityData || []) as PortalActivityEvent[];
      }

      set({
        currentWill,
        willsCount,
        docsCount,
        recentActivity,
        hasDraftWithData,
        lastFetched: Date.now(),
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching portal dashboard data:', error);
      set({ isLoading: false });
    }
  },

  setCurrentWill: (will) => set({ currentWill: will }),

  invalidate: () => set({ lastFetched: null }),

  reset: () => set({
    currentWill: null,
    willsCount: 0,
    docsCount: 0,
    recentActivity: [],
    lastFetched: null,
    isLoading: false,
    hasDraftWithData: false,
  }),
}));
