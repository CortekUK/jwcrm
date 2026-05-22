import { UserRole } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  Home,
  FolderOpen,
  MessageCircle,
  Building,
  Calendar,
  CalendarDays,
  LucideIcon,
  Briefcase,
  Target,
  UserCog,
  Receipt,
} from "lucide-react";

export type DashboardType = "admin" | "hr" | "finance" | "lead-management" | "client" | "salesperson";

export interface NavItem {
  path: string;
  labelKey: string; // i18n key for the label
  icon: LucideIcon;
}

export interface DashboardConfig {
  slug: DashboardType;
  role: UserRole;
  nameKey: string; // i18n key for dashboard name
  basePath: string;
  authPath: string;
  layoutType: "header" | "sidebar";
  navItems: NavItem[];
  theme?: {
    primaryColor?: string;
    accentColor?: string;
  };
}

export const DASHBOARD_CONFIGS: Record<DashboardType, DashboardConfig> = {
  admin: {
    slug: "admin",
    role: "admin",
    nameKey: "admin:adminDashboard",
    basePath: "/admin",
    authPath: "/admin/auth",
    layoutType: "header",
    navItems: [
      { path: "/admin", labelKey: "admin:dashboard", icon: LayoutDashboard },
      { path: "/admin/wills", labelKey: "admin:wills", icon: FileText },
      { path: "/admin/manage-users", labelKey: "admin:manageUsers", icon: Users },
    ],
  },
  hr: {
    slug: "hr",
    role: "hr",
    nameKey: "hr:hrDashboard",
    basePath: "/hr",
    authPath: "/hr/auth",
    layoutType: "sidebar",
    navItems: [
      { path: "/hr", labelKey: "hr:dashboard", icon: LayoutDashboard },
      { path: "/hr/employees", labelKey: "hr:employees", icon: Users },
      { path: "/hr/departments", labelKey: "hr:departments", icon: Building },
      { path: "/hr/documents", labelKey: "hr:documents", icon: FolderOpen },
      { path: "/hr/attendance", labelKey: "hr:attendance", icon: Calendar },
      { path: "/hr/leave", labelKey: "hr:leave", icon: CalendarDays },
      { path: "/hr/settings", labelKey: "common:settings", icon: Settings },
    ],
  },
  finance: {
    slug: "finance",
    role: "finance",
    nameKey: "finance:financeDashboard",
    basePath: "/finance",
    authPath: "/finance/auth",
    layoutType: "header",
    navItems: [
      { path: "/finance", labelKey: "finance:dashboard", icon: LayoutDashboard },
      { path: "/finance/settings", labelKey: "common:settings", icon: Settings },
    ],
  },
  "lead-management": {
    slug: "lead-management",
    role: "lead_management",
    nameKey: "leadManagement:leadManagementDashboard",
    basePath: "/lead-management",
    authPath: "/lead-management/auth",
    layoutType: "header",
    navItems: [
      { path: "/lead-management/leads", labelKey: "leadManagement:leads", icon: Users },
      { path: "/lead-management/settings", labelKey: "common:settings", icon: Settings },
    ],
  },
  client: {
    slug: "client",
    role: "client",
    nameKey: "portal:clientPortal",
    basePath: "/client",
    authPath: "/client/auth",
    layoutType: "sidebar",
    navItems: [
      { path: "/client", labelKey: "portal:home", icon: Home },
      { path: "/client/will", labelKey: "portal:createEditWill", icon: FileText },
      { path: "/client/documents", labelKey: "portal:myDocuments", icon: FolderOpen },
      { path: "/client/support", labelKey: "portal:support", icon: MessageCircle },
      { path: "/client/settings", labelKey: "portal:settings", icon: Settings },
    ],
  },
  salesperson: {
    slug: "salesperson",
    role: "salesperson",
    nameKey: "salesperson:salespersonDashboard",
    basePath: "/admin/salesperson",
    authPath: "/admin/auth",
    layoutType: "header",
    navItems: [
      { path: "/admin/salesperson/leads", labelKey: "salesperson:myLeads", icon: Users },
      { path: "/admin/salesperson/calendar", labelKey: "salesperson:calendar", icon: Calendar },
      { path: "/admin/salesperson/settings", labelKey: "common:settings", icon: Settings },
    ],
  },
};

/**
 * Get dashboard configuration by role
 */
export function getDashboardByRole(role: UserRole): DashboardConfig | undefined {
  // Superadmin uses the admin dashboard
  if (role === "superadmin") {
    return DASHBOARD_CONFIGS.admin;
  }
  return Object.values(DASHBOARD_CONFIGS).find((config) => config.role === role);
}

/**
 * Get dashboard configuration by path
 */
export function getDashboardByPath(path: string): DashboardConfig | undefined {
  return Object.values(DASHBOARD_CONFIGS).find((config) =>
    path.startsWith(config.basePath)
  );
}

/**
 * Get dashboard configuration by slug
 */
export function getDashboardBySlug(slug: DashboardType): DashboardConfig {
  return DASHBOARD_CONFIGS[slug];
}

/**
 * Get auth path for a role - used for redirecting unauthenticated users
 */
export function getAuthPathForRole(role: UserRole): string {
  const dashboard = getDashboardByRole(role);
  return dashboard?.authPath || "/client/auth";
}

/**
 * Check if a role has access to a dashboard
 */
export function hasAccessToDashboard(
  userRoles: UserRole[] | undefined,
  dashboardType: DashboardType
): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  const config = DASHBOARD_CONFIGS[dashboardType];
  // Superadmin can access admin dashboard
  if (dashboardType === "admin" && userRoles.includes("superadmin")) {
    return true;
  }
  return userRoles.includes(config.role);
}

// =============================================================================
// UNIFIED ADMIN DASHBOARD - Role-based Navigation Items
// =============================================================================

/**
 * Navigation items for the unified admin dashboard based on selected role
 * All paths are under /admin route with proper sub-routes
 */

// Superadmin role nav items - only user management
const superadminNavItems: NavItem[] = [
  { path: "/admin/manage-users", labelKey: "admin:manageUsers", icon: UserCog },
];

// Admin role nav items - sees everything EXCEPT user management
const adminNavItems: NavItem[] = [
  { path: "/admin", labelKey: "admin:dashboard", icon: LayoutDashboard },
  { path: "/admin/wills", labelKey: "admin:wills", icon: FileText },
];

// HR role nav items - all under /admin/hr
const hrNavItems: NavItem[] = [
  { path: "/admin/hr", labelKey: "hr:dashboard", icon: LayoutDashboard },
  { path: "/admin/hr/employees", labelKey: "hr:employees", icon: Users },
  { path: "/admin/hr/departments", labelKey: "hr:departments", icon: Building },
  { path: "/admin/hr/documents", labelKey: "hr:documents", icon: FolderOpen },
  { path: "/admin/hr/job-roles", labelKey: "hr:jobRoles", icon: Briefcase },
  { path: "/admin/hr/kpis", labelKey: "hr:kpis", icon: Target },
  { path: "/admin/hr/attendance", labelKey: "hr:attendance", icon: Calendar },
  { path: "/admin/hr/leave", labelKey: "hr:leave", icon: CalendarDays },
  { path: "/admin/hr/settings", labelKey: "common:settings", icon: Settings },
];

// Finance role nav items - all under /admin/finance
const financeNavItems: NavItem[] = [
  { path: "/admin/finance", labelKey: "finance:dashboard", icon: LayoutDashboard },
  { path: "/admin/finance/settings", labelKey: "common:settings", icon: Settings },
];

// Lead Management role nav items - all under /admin/lead-management (no dashboard, just Leads and Settings)
const leadManagementNavItems: NavItem[] = [
  { path: "/admin/lead-management/leads", labelKey: "leadManagement:leads", icon: Users },
  { path: "/admin/lead-management/sources", labelKey: "leadManagement:sources", icon: FolderOpen },
  { path: "/admin/lead-management/settings", labelKey: "common:settings", icon: Settings },
];

// Salesperson role nav items - shares the unified leads pipeline with
// lead management. Salespeople see only their assigned leads via RLS.
const salespersonNavItems: NavItem[] = [
  { path: "/admin/lead-management/leads", labelKey: "salesperson:myLeads", icon: Users },
  { path: "/admin/salesperson/calendar", labelKey: "salesperson:calendar", icon: Calendar },
  { path: "/admin/salesperson/settings", labelKey: "common:settings", icon: Settings },
];

/**
 * Get navigation items for a specific role in the unified admin dashboard
 */
export function getNavItemsForRole(role: UserRole): NavItem[] {
  switch (role) {
    case "superadmin":
      return superadminNavItems;
    case "admin":
      return adminNavItems;
    case "hr":
      return hrNavItems;
    case "finance":
      return financeNavItems;
    case "lead_management":
      return leadManagementNavItems;
    case "salesperson":
      return salespersonNavItems;
    default:
      return [];
  }
}

/**
 * Internal roles that can access the unified admin dashboard
 */
export const INTERNAL_ROLES: UserRole[] = ["superadmin", "admin", "hr", "finance", "lead_management", "salesperson"];

/**
 * Check if user has any internal role (can access unified admin dashboard)
 */
export function hasInternalAccess(userRoles: UserRole[] | undefined): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  return userRoles.some((role) => INTERNAL_ROLES.includes(role));
}

/**
 * Get the default landing page for a role after login
 */
export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case "superadmin":
      return "/admin/manage-users";
    case "admin":
      return "/admin";
    case "hr":
      return "/admin/hr";
    case "finance":
      return "/admin/finance";
    case "lead_management":
      return "/admin/lead-management/leads";
    case "salesperson":
      return "/admin/lead-management/leads";
    case "client":
      return "/client";
    default:
      return "/admin";
  }
}

/**
 * Get the default landing page based on user's roles (uses role priority)
 */
export function getDefaultRouteForRoles(userRoles: UserRole[]): string {
  const rolePriority: UserRole[] = ["superadmin", "admin", "hr", "finance", "lead_management", "salesperson", "client"];
  const primaryRole = rolePriority.find((r) => userRoles.includes(r));
  return primaryRole ? getDefaultRouteForRole(primaryRole) : "/admin";
}
