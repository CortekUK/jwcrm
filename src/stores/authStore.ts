import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';

export type UserRole = 'client' | 'admin' | 'hr' | 'finance' | 'lead_management';

export interface UserProfile {
  user_id: string;
  full_name: string | null;
  locale: string;
  roles?: UserRole[];
}

interface AuthState {
  // State
  user: User | null;
  session: Session | null;
  profile: (UserProfile & { role: UserRole }) | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  profileLoaded: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: (UserProfile & { role: UserRole }) | null) => void;
  setLoading: (loading: boolean) => void;
  setProfileLoaded: (loaded: boolean) => void;
  setAuth: (user: User | null, session: Session | null, profile: (UserProfile & { role: UserRole }) | null) => void;
  clearAuth: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  profileLoaded: false,

  // Actions
  setUser: (user) => set({
    user,
    isAuthenticated: !!user
  }),

  setSession: (session) => set({ session }),

  setProfile: (profile) => set({
    profile,
    profileLoaded: !!profile
  }),

  setLoading: (isLoading) => set({ isLoading }),

  setProfileLoaded: (profileLoaded) => set({ profileLoaded }),

  setAuth: (user, session, profile) => set({
    user,
    session,
    profile,
    isAuthenticated: !!user,
    profileLoaded: !!profile,
    isLoading: false,
  }),

  clearAuth: () => set({
    user: null,
    session: null,
    profile: null,
    isAuthenticated: false,
    profileLoaded: false,
    isLoading: false,
  }),

  updateProfile: (updates) => {
    const currentProfile = get().profile;
    if (currentProfile) {
      set({
        profile: {
          ...currentProfile,
          ...updates,
        },
      });
    }
  },
}));
