"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, UserRole } from "@/hooks/useAuth";
import {
  DashboardType,
  getDashboardBySlug,
  getDashboardByRole,
  hasAccessToDashboard,
  hasInternalAccess,
  INTERNAL_ROLES,
} from "@/config/dashboards";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  dashboardType?: DashboardType;
  /** Allow any internal role (admin, hr, finance, lead_management) to access */
  allowInternalRoles?: boolean;
}

export function ProtectedRoute({
  children,
  requiredRole,
  dashboardType,
  allowInternalRoles,
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Redirect to dashboard-specific auth if we know the dashboard
        if (dashboardType) {
          const config = getDashboardBySlug(dashboardType);
          router.push(config.authPath);
        } else {
          // Fallback to client auth
          router.push("/client/auth");
        }
      } else if (allowInternalRoles) {
        // Check if user has any internal role
        if (!hasInternalAccess(profile?.roles)) {
          // User doesn't have any internal role, redirect to client portal
          router.push("/client");
        }
      } else if (requiredRole && !profile?.roles?.includes(requiredRole)) {
        // User doesn't have required role, redirect to their appropriate dashboard
        const targetDashboard = getDashboardByRole(profile?.role || "client");
        router.push(targetDashboard?.basePath || "/client");
      }
    }
  }, [user, profile, loading, requiredRole, dashboardType, allowInternalRoles, router]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Don't render children until auth is verified
  if (!user) {
    return null;
  }

  // Check for internal roles access
  if (allowInternalRoles) {
    if (!hasInternalAccess(profile?.roles)) {
      return null;
    }
    return <>{children}</>;
  }

  // Check if user has the required role (using roles array for multi-role support)
  if (requiredRole) {
    const hasRequiredRole = profile?.roles?.includes(requiredRole);
    if (!hasRequiredRole) {
      return null;
    }
  }

  return <>{children}</>;
}
