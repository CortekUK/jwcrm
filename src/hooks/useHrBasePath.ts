"use client";

import { usePathname } from "next/navigation";

/**
 * The route prefix for HR navigation in the CURRENT portal.
 *
 * Most HR screens exist twice: once under `/hr/...` in the (hr) route group,
 * and once under `/admin/hr/...` as a thin re-export. The components are shared,
 * so a hardcoded `/hr/...` link sends an admin out of the admin portal and into
 * the (hr) one — whose layout has no role switcher, leaving them with no way
 * back. Deep links also 404 when the admin twin of a route does not exist.
 *
 * Use this instead of writing `/hr/...` literals in any component that can be
 * rendered from both portals.
 */
export function useHrBasePath(): "/admin/hr" | "/hr" {
  const pathname = usePathname();
  return pathname?.startsWith("/admin") ? "/admin/hr" : "/hr";
}
