"use client";

import { useMemo } from "react";
import { useAuth, UserRole, PermissionLevel, RoleWithPermission } from "./useAuth";

// Roles that support tiered permissions (head/employee)
export const TIERED_PERMISSION_ROLES: UserRole[] = ["hr", "finance", "lead_management", "admin"];

// Operation types for each dashboard
export type HROperation =
  | "deactivate_employee"
  | "delete_department"
  | "delete_job_role"
  | "archive_kpi"
  | "manage_leave_rules";

export type FinanceOperation =
  | "delete_transaction"
  | "modify_settings";

export type LeadManagementOperation =
  | "delete_lead"
  | "delete_source";

export type AdminOperation =
  | "critical_admin_operations";

export type Operation = HROperation | FinanceOperation | LeadManagementOperation | AdminOperation;

// Map of operations that are restricted for "employee" level users
const HEAD_ONLY_OPERATIONS: Record<UserRole, Operation[]> = {
  hr: ["deactivate_employee", "delete_department", "delete_job_role", "archive_kpi", "manage_leave_rules"],
  finance: ["delete_transaction", "modify_settings"],
  lead_management: ["delete_lead", "delete_source"],
  admin: ["critical_admin_operations"],
  // These roles don't have tiered permissions
  client: [],
  superadmin: [],
  salesperson: [],
};

export interface PermissionsResult {
  // Check if user is "head" for a specific role
  isHead: (role: UserRole) => boolean;

  // Check if user is "employee" for a specific role
  isEmployee: (role: UserRole) => boolean;

  // Get the permission level for a specific role
  getPermissionLevel: (role: UserRole) => PermissionLevel | null;

  // Check if user can perform a specific operation
  canPerform: (role: UserRole, operation: Operation) => boolean;

  // Check if a role supports tiered permissions
  hasTieredPermissions: (role: UserRole) => boolean;

  // Get all roles with their permission levels
  rolesWithPermissions: RoleWithPermission[];

  // Check if user has any role with head permission
  hasAnyHeadRole: boolean;

  // Loading state
  loading: boolean;
}

export function usePermissions(): PermissionsResult {
  const { profile, loading } = useAuth();

  const rolesWithPermissions = useMemo(() => {
    return profile?.rolesWithPermissions || [];
  }, [profile?.rolesWithPermissions]);

  const getPermissionLevel = (role: UserRole): PermissionLevel | null => {
    const roleData = rolesWithPermissions.find(r => r.role === role);
    return roleData?.permissionLevel || null;
  };

  const isHead = (role: UserRole): boolean => {
    // Superadmin always has head access
    if (profile?.roles?.includes("superadmin")) {
      return true;
    }

    const permLevel = getPermissionLevel(role);
    // If no permission level found, check if user has the role at all
    // Default to 'head' for backward compatibility
    if (permLevel === null) {
      return profile?.roles?.includes(role) || false;
    }
    return permLevel === "head";
  };

  const isEmployee = (role: UserRole): boolean => {
    const permLevel = getPermissionLevel(role);
    return permLevel === "employee";
  };

  const hasTieredPermissions = (role: UserRole): boolean => {
    return TIERED_PERMISSION_ROLES.includes(role);
  };

  const canPerform = (role: UserRole, operation: Operation): boolean => {
    // Superadmin can do everything
    if (profile?.roles?.includes("superadmin")) {
      return true;
    }

    // Check if user has the role at all
    if (!profile?.roles?.includes(role)) {
      return false;
    }

    // Check if this is a head-only operation
    const headOnlyOps = HEAD_ONLY_OPERATIONS[role] || [];
    if (headOnlyOps.includes(operation)) {
      // Only heads can perform this operation
      return isHead(role);
    }

    // Not a restricted operation, allow it
    return true;
  };

  const hasAnyHeadRole = useMemo(() => {
    if (profile?.roles?.includes("superadmin")) {
      return true;
    }
    return rolesWithPermissions.some(r => r.permissionLevel === "head");
  }, [rolesWithPermissions, profile?.roles]);

  return {
    isHead,
    isEmployee,
    getPermissionLevel,
    canPerform,
    hasTieredPermissions,
    rolesWithPermissions,
    hasAnyHeadRole,
    loading,
  };
}
