"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSelectedRole } from "@/hooks/useSelectedRole";
import { getNavItemsForRole } from "@/config/dashboards";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ReminderNotificationBadge } from "@/components/lead-management/reminders/ReminderNotificationBadge";

interface UnifiedDashboardLayoutProps {
  children: ReactNode;
}

export function UnifiedDashboardLayout({ children }: UnifiedDashboardLayoutProps) {
  const { profile, signOut } = useAuth();
  const { selectedRole } = useSelectedRole();
  const { t, i18n } = useTranslation(["common", "admin", "hr", "finance", "leadManagement"]);
  const isRtl = i18n.language === "ar";
  const pathname = usePathname();

  // Get nav items based on selected role
  const navItems = selectedRole ? getNavItemsForRole(selectedRole) : [];

  // Check if a nav item is active
  const isNavItemActive = (itemPath: string) => {
    // Exact match for dashboard routes
    if (pathname === itemPath) {
      return true;
    }

    // For sub-routes, check if pathname starts with itemPath
    // But exclude the dashboard link itself from matching sub-pages
    const isDashboardLink =
      itemPath === "/admin" ||
      itemPath === "/admin/hr" ||
      itemPath === "/admin/finance";
    // Note: /admin/lead-management is NOT a dashboard link (no dashboard tab)

    if (isDashboardLink) {
      return pathname === itemPath;
    }

    // For non-dashboard links, check if current path starts with the nav item path
    return pathname?.startsWith(itemPath + "/") || pathname === itemPath;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const NavContent = () => (
    <div className="space-y-[14px]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = isNavItemActive(item.path);
        return (
          <Link key={item.path} href={item.path}>
            <div
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 ${
                isRtl ? "flex-row-reverse" : ""
              } ${
                isActive
                  ? "bg-[rgba(198,160,59,0.15)] text-white"
                  : "text-[#E8E8E8] hover:bg-[rgba(198,160,59,0.08)] hover:text-white"
              }`}
            >
              {isActive && (
                <div
                  className={`absolute top-0 bottom-0 w-[3px] bg-[#C6A03B] ${
                    isRtl ? "right-0 rounded-l-full" : "left-0 rounded-r-full"
                  }`}
                />
              )}
              <Icon className={`h-6 w-6 ${isActive ? "text-white" : "text-[#E8E8E8]"}`} />
              <span className="font-medium text-[14px]">{t(item.labelKey)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );

  const UserProfile = () => (
    <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/30 p-3">
      <Avatar className="h-9 w-9 shrink-0 border-2 border-sidebar-primary/20">
        <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
          {profile?.full_name ? getInitials(profile.full_name) : "U"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-sidebar-foreground leading-tight">
          {profile?.full_name?.split(" ")[0] || "User"}
        </p>
        <p className="text-[11px] text-sidebar-foreground/70 leading-tight mt-0.5">
          {selectedRole ? t(`common:role.${selectedRole}`) : ""}
        </p>
      </div>
      <div className="flex items-center shrink-0">
        {selectedRole === "salesperson" && <ReminderNotificationBadge />}
        <Button
          variant="ghost"
          size="icon"
          onClick={signOut}
          className="h-7 w-7 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-destructive"
          title={t("common:signOut")}
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden min-w-[320px]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-[220px] border-r border-sidebar-border bg-sidebar lg:block sticky top-0 h-screen overflow-y-hidden">
        <div className="flex h-full flex-col">
          {/* Logo/Brand Section */}
          <div className="border-b border-sidebar-border py-6 px-6">
            <div className="text-center">
              <h1 className="text-2xl font-serif font-semibold tracking-tight text-sidebar-foreground mb-1">
                Just Wills
              </h1>
              <p className="text-[12px] font-medium text-[#C6A03B] tracking-wider uppercase">
                {t("common:internalDashboard")}
              </p>
            </div>
            <div className="mt-4">
              <LanguageSwitcher />
            </div>
          </div>

          {/* Role Switcher */}
          <div className="px-4 py-3 border-b border-sidebar-border">
            <RoleSwitcher />
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-[14px] p-4 overflow-y-auto">
            <NavContent />
          </nav>

          {/* User Profile Footer */}
          <div className="border-t border-sidebar-border p-4">
            <UserProfile />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0 h-screen overflow-y-auto">
        {/* Mobile Header */}
        <header className="flex items-center justify-between border-b bg-card p-3 sm:p-4 lg:hidden min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-serif font-semibold text-[#0C5536]">Just Wills</h1>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side={isRtl ? "right" : "left"} className="w-[220px] bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="flex h-full flex-col">
                {/* Logo/Brand Section */}
                <div className="border-b border-sidebar-border py-6 px-6">
                  <div className="text-center">
                    <h1 className="text-2xl font-serif font-semibold tracking-tight text-sidebar-foreground mb-1">
                      Just Wills
                    </h1>
                    <p className="text-[12px] font-medium text-[#C6A03B] tracking-wider uppercase">
                      {t("common:internalDashboard")}
                    </p>
                  </div>
                  <div className="mt-4">
                    <LanguageSwitcher />
                  </div>
                </div>

                {/* Role Switcher */}
                <div className="px-4 py-3 border-b border-sidebar-border">
                  <RoleSwitcher />
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-[14px] p-4 overflow-y-auto">
                  <NavContent />
                </nav>

                {/* User Profile Footer */}
                <div className="border-t border-sidebar-border p-4">
                  <UserProfile />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">{children}</main>
      </div>
    </div>
  );
}
