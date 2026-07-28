"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { UserRole, useAuth } from "./useAuth";

// Internal roles that can access the unified admin dashboard
export const INTERNAL_ROLES: UserRole[] = ["superadmin", "admin", "hr", "finance", "lead_management", "salesperson", "account_manager"];

// Role priority for determining default selection (HR first for general accounts)
const ROLE_PRIORITY: UserRole[] = ["superadmin", "hr", "admin", "finance", "lead_management", "salesperson", "account_manager", "client"];

// Role display names for the switcher
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  superadmin: "Super Admin Dashboard",
  admin: "Wills Dashboard",
  hr: "HR Dashboard",
  finance: "Finance Dashboard",
  lead_management: "MD (Managing Director) Dashboard",
  salesperson: "EA (Executive Assistant) Dashboard",
  account_manager: "Account Manager Dashboard",
  client: "Client Portal",
};

interface SelectedRoleContextType {
  selectedRole: UserRole | null;
  setSelectedRole: (role: UserRole) => void;
  availableRoles: UserRole[];
  isInternalUser: boolean;
}

const SelectedRoleContext = createContext<SelectedRoleContextType | undefined>(undefined);

const STORAGE_KEY = "jw_selected_role";

interface SelectedRoleProviderProps {
  children: ReactNode;
}

export function SelectedRoleProvider({ children }: SelectedRoleProviderProps) {
  const { profile } = useAuth();
  const [selectedRole, setSelectedRoleState] = useState<UserRole | null>(null);

  // Get available internal roles for the current user
  const availableRoles = (profile?.roles || []).filter((role) =>
    INTERNAL_ROLES.includes(role)
  );

  // Check if user has any internal roles
  const isInternalUser = availableRoles.length > 0;

  // Initialize selected role from localStorage or default to highest priority role
  useEffect(() => {
    if (availableRoles.length > 0) {
      const storedRole = localStorage.getItem(STORAGE_KEY) as UserRole | null;

      // Check if stored role is valid for current user
      if (storedRole && availableRoles.includes(storedRole)) {
        setSelectedRoleState(storedRole);
      } else {
        // Default to highest priority role
        const defaultRole = ROLE_PRIORITY.find((role) => availableRoles.includes(role));
        if (defaultRole) {
          setSelectedRoleState(defaultRole);
          localStorage.setItem(STORAGE_KEY, defaultRole);
        }
      }
    }
  }, [profile?.roles]);

  // Update selected role and persist to localStorage
  const setSelectedRole = (role: UserRole) => {
    if (availableRoles.includes(role)) {
      setSelectedRoleState(role);
      localStorage.setItem(STORAGE_KEY, role);
    }
  };

  return (
    <SelectedRoleContext.Provider
      value={{
        selectedRole,
        setSelectedRole,
        availableRoles,
        isInternalUser,
      }}
    >
      {children}
    </SelectedRoleContext.Provider>
  );
}

export function useSelectedRole() {
  const context = useContext(SelectedRoleContext);
  if (context === undefined) {
    throw new Error("useSelectedRole must be used within a SelectedRoleProvider");
  }
  return context;
}

/** Safe version that returns null when used outside a SelectedRoleProvider */
export function useSelectedRoleOptional() {
  return useContext(SelectedRoleContext) ?? null;
}
