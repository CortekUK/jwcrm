"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Menu, LayoutDashboard, Users, Building, Calendar, CalendarDays, Settings, Briefcase, Target } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface HRPortalLayoutProps {
  children: ReactNode;
}

export function HRPortalLayout({ children }: HRPortalLayoutProps) {
  const { profile, signOut } = useAuth();
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const pathname = usePathname();

  const navItems = [
    { name: t("hr:dashboard"), path: "/hr", icon: LayoutDashboard },
    { name: t("hr:employees"), path: "/hr/employees", icon: Users },
    { name: t("hr:jobRoles"), path: "/hr/job-roles", icon: Briefcase },
    { name: t("hr:kpis"), path: "/hr/kpis", icon: Target },
    { name: t("hr:departments"), path: "/hr/departments", icon: Building },
    { name: t("hr:attendance"), path: "/hr/attendance", icon: Calendar },
    { name: t("hr:leave"), path: "/hr/leave", icon: CalendarDays },
    { name: t("common:settings"), path: "/hr/settings", icon: Settings },
  ];

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
        const isActive = pathname === item.path || (item.path !== "/hr" && pathname?.startsWith(item.path));
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
              <span className="font-medium text-[14px]">{item.name}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );

  const UserProfile = () => (
    <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/30 p-3">
      <Avatar className="h-10 w-10 border-2 border-sidebar-primary/20">
        <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
          {profile?.full_name ? getInitials(profile.full_name) : "U"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 overflow-hidden">
        <p className="truncate text-sm font-semibold text-sidebar-foreground">
          {profile?.full_name || "User"}
        </p>
        <p className="truncate text-[12px] text-[#E8E8E8] opacity-85">{t("hr:hrDashboard")}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={signOut}
        className="h-8 w-8 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-destructive"
        title={t("common:signOut")}
      >
        <LogOut className="h-4 w-4" />
      </Button>
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
                HR Dashboard
              </p>
            </div>
            <div className="mt-4">
              <LanguageSwitcher />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-[14px] p-4">
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
          <h1 className="text-lg font-semibold">{t("hr:dashboard")}</h1>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[220px] bg-sidebar p-0">
              <SheetTitle className="sr-only">HR Navigation Menu</SheetTitle>
              <div className="flex h-full flex-col">
                {/* Logo/Brand Section */}
                <div className="border-b border-sidebar-border py-6 px-6">
                  <div className="text-center">
                    <h1 className="text-2xl font-serif font-semibold tracking-tight text-sidebar-foreground mb-1">
                      Just Wills
                    </h1>
                    <p className="text-[12px] font-medium text-[#C6A03B] tracking-wider uppercase">
                      HR Dashboard
                    </p>
                  </div>
                  <div className="mt-4">
                    <LanguageSwitcher />
                  </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-[14px] p-4">
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
