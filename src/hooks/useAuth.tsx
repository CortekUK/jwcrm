"use client";

import { useState, useEffect, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export type UserRole = "client" | "admin" | "superadmin" | "hr" | "finance" | "lead_management" | "salesperson" | "account_manager";
export type PermissionLevel = "head" | "employee";

export interface RoleWithPermission {
  role: UserRole;
  permissionLevel: PermissionLevel;
}

export interface UserProfile {
  user_id: string;
  full_name: string | null;
  locale: string;
  roles?: UserRole[];
  rolesWithPermissions?: RoleWithPermission[];
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<(UserProfile & { role: UserRole }) | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation('toast');
  // Which user's profile is currently in state — NOT merely "has a profile
  // been loaded". A boolean flag here caused the previous user's profile
  // (and therefore their roles) to be reused when a different user signed in
  // without a SIGNED_OUT event in between, so the new user was authorised
  // against the old user's permissions. Keying on the id forces a refetch
  // whenever the account changes.
  const profileLoadedForUserRef = useRef<string | null>(null);

  // Auth listener - runs ONCE on mount, profile fetched only once per session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          profileLoadedForUserRef.current = null;
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

        // Fetch once per *user* — refetches when the account changes so a
        // new sign-in can never inherit the previous user's profile/roles.
        if (session?.user && profileLoadedForUserRef.current !== session.user.id) {
          setProfile(null);
          setLoading(true);
          fetchProfile(session.user.id);
        } else if (!session?.user) {
          setProfile(null);
          profileLoadedForUserRef.current = null;
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

      // Fetch once per *user* (see note on profileLoadedForUserRef) — this
      // also still prevents the duplicate call this guard originally existed for.
      if (session?.user && profileLoadedForUserRef.current !== session.user.id) {
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
        .select("role, permission_level")
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

      // Get all roles with their permission levels
      const roles = rolesData.map(r => r.role as UserRole);
      const rolesWithPermissions: RoleWithPermission[] = rolesData.map(r => ({
        role: r.role as UserRole,
        permissionLevel: (r.permission_level as PermissionLevel) || 'head',
      }));

      // Must list every internal role — a role missing here falls through to
      // the 'client' default below, which would mis-route that user's
      // dashboard and mislabel them throughout the UI.
      const rolePriority: UserRole[] = ['superadmin', 'admin', 'hr', 'finance', 'lead_management', 'salesperson', 'account_manager', 'client'];
      const primaryRole = rolePriority.find(r => roles.includes(r)) || 'client';

      setProfile({
        ...profileData,
        role: primaryRole,
        roles: roles, // Store all roles for future use
        rolesWithPermissions, // Store roles with their permission levels
      });
      profileLoadedForUserRef.current = userId;
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
