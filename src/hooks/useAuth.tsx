"use client";

import { useState, useEffect, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export type UserRole = "client" | "admin" | "superadmin" | "hr" | "finance" | "lead_management" | "salesperson";

export interface UserProfile {
  user_id: string;
  full_name: string | null;
  locale: string;
  roles?: UserRole[];
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<(UserProfile & { role: UserRole }) | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation('toast');
  const profileLoadedRef = useRef(false);

  // Auth listener - runs ONCE on mount, profile fetched only once per session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          profileLoadedRef.current = false;
          setLoading(false);
          return;
        }

        if (session?.user) {
          const isActive = session.user.user_metadata?.is_active;
          if (isActive === false) {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
            toast({
              variant: "destructive",
              title: t('toast:auth.accountDeactivated'),
              description: t('toast:auth.yourAccountHasBeenDeactivated'),
            });
            return;
          }
        }

        setSession(session);
        setUser(session?.user ?? null);

        // Only fetch profile ONCE per session
        if (session?.user && !profileLoadedRef.current) {
          fetchProfile(session.user.id);
        } else if (!session?.user) {
          setProfile(null);
          profileLoadedRef.current = false;
          setLoading(false);
        }
      }
    );

    // Check for existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const isActive = session.user.user_metadata?.is_active;
        if (isActive === false) {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          toast({
            variant: "destructive",
            title: t('toast:auth.accountDeactivated'),
            description: t('toast:auth.yourAccountHasBeenDeactivated'),
          });
          return;
        }
      }

      setSession(session);
      setUser(session?.user ?? null);

      // Only fetch profile ONCE - check ref to prevent duplicate calls
      if (session?.user && !profileLoadedRef.current) {
        fetchProfile(session.user.id);
      } else if (!session?.user) {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Profile/role deletion listener - runs when user.id becomes available
  useEffect(() => {
    if (!user?.id) return;

    const profileChannel = supabase
      .channel(`profile-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          toast({
            variant: "destructive",
            title: t('toast:auth.accountDeleted'),
            description: t('toast:auth.yourAccountHasBeenDeleted'),
          });
          supabase.auth.signOut();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          toast({
            variant: "destructive",
            title: t('toast:auth.accountDeactivated'),
            description: t('toast:auth.yourAccountHasBeenDeactivated'),
          });
          supabase.auth.signOut();
        }
      )
      .subscribe();

    return () => {
      profileChannel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchProfile = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError) throw profileError;

      // Check if profile exists
      if (!profileData) {
        // Profile deleted, user is deactivated
        toast({
          variant: "destructive",
          title: t('toast:auth.accountDeactivated'),
          description: t('toast:auth.yourAccountHasBeenDeactivated'),
        });
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // Fetch user roles from user_roles table (users can have multiple roles)
      const { data: rolesData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (roleError) throw roleError;

      // Check if user has any roles (if no roles, user is deactivated)
      if (!rolesData || rolesData.length === 0) {
        toast({
          variant: "destructive",
          title: t('toast:auth.accountDeactivated'),
          description: t('toast:auth.noActiveRole'),
        });
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // Get all roles and determine primary role (prefer admin > other roles > client)
      const roles = rolesData.map(r => r.role as UserRole);
      const rolePriority: UserRole[] = ['superadmin', 'admin', 'hr', 'finance', 'lead_management', 'salesperson', 'client'];
      const primaryRole = rolePriority.find(r => roles.includes(r)) || 'client';

      setProfile({
        ...profileData,
        role: primaryRole,
        roles: roles, // Store all roles for future use
      });
      profileLoadedRef.current = true;
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      toast({
        variant: "destructive",
        title: t('toast:auth.errorLoadingProfile'),
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      toast({
        variant: "destructive",
        title: t('toast:auth.errorSigningOut'),
        description: error.message,
      });
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  return {
    user,
    session,
    profile,
    loading,
    signOut,
    refreshProfile,
  };
}
