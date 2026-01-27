"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, LayoutDashboard, Users, Building, Calendar, CalendarDays, Settings, Briefcase, Target, ChevronLeft, ChevronRight, ClipboardCheck } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { UserProfileMenu } from "@/components/layouts/UserProfileMenu";
import { cn } from "@/lib/utils";

interface HRPortalLayoutProps {
  children: ReactNode;
}

function SidebarContent() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();

  const navItems = [
    { name: t("hr:dashboard"), path: "/hr", icon: LayoutDashboard },
    { name: t("hr:employees"), path: "/hr/employees", icon: Users },
    { name: t("hr:jobRoles"), path: "/hr/job-roles", icon: Briefcase },
    { name: t("hr:kpis"), path: "/hr/kpis", icon: Target },
    { name: t("hr:performanceReviews", "Performance Reviews"), path: "/hr/reviews", icon: ClipboardCheck },
    { name: t("hr:departments"), path: "/hr/departments", icon: Building },
    { name: t("hr:attendance"), path: "/hr/attendance", icon: Calendar },
    { name: t("hr:leave"), path: "/hr/leave", icon: CalendarDays },
    { name: t("common:settings"), path: "/hr/settings", icon: Settings },
  ];

  const NavContent = () => (
    <div className="space-y-[14px]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path || (item.path !== "/hr" && pathname?.startsWith(item.path));
        const navItem = (
          <Link key={item.path} href={item.path}>
            <div
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
                isRtl ? "flex-row-reverse" : "",
                isCollapsed && "justify-center px-2",
                isActive
                  ? "bg-[rgba(198,160,59,0.15)] text-white"
                  : "text-[#E8E8E8] hover:bg-[rgba(198,160,59,0.08)] hover:text-white"
              )}
            >
              {isActive && (
                <div
                  className={cn(
                    "absolute top-0 bottom-0 w-[3px] bg-[#C6A03B]",
                    isRtl ? "right-0 rounded-l-full" : "left-0 rounded-r-full"
                  )}
                />
              )}
              <Icon className={cn("h-6 w-6 shrink-0", isActive ? "text-white" : "text-[#E8E8E8]")} />
              {!isCollapsed && (
                <span className="font-medium text-[14px]">{item.name}</span>
              )}
            </div>
          </Link>
        );

        if (isCollapsed) {
          return (
            <Tooltip key={item.path} delayDuration={0}>
              <TooltipTrigger asChild>{navItem}</TooltipTrigger>
              <TooltipContent side={isRtl ? "left" : "right"} className="bg-sidebar text-sidebar-foreground border-sidebar-border">
                {item.name}
              </TooltipContent>
            </Tooltip>
          );
        }

        return navItem;
      })}
    </div>
  );

  const CollapseToggle = () => (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-7 w-7 text-sidebar-foreground/70 hover:bg-[rgba(198,160,59,0.15)] hover:text-[#C6A03B]"
        >
          {isCollapsed ? (
            isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={isRtl ? "left" : "right"} className="bg-sidebar text-sidebar-foreground border-sidebar-border">
        {isCollapsed ? t("common:expandSidebar", "Expand sidebar") : t("common:collapseSidebar", "Collapse sidebar")}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <aside
      className={cn(
        "hidden border-r border-sidebar-border bg-sidebar lg:block sticky top-0 h-screen overflow-y-hidden transition-all duration-200",
        isCollapsed ? "w-16" : "w-[220px]"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo/Brand Section */}
        <div className={cn(
          "border-b border-sidebar-border",
          isCollapsed ? "px-2 py-4" : "py-5 px-4"
        )}>
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div className="h-9 w-9 rounded-lg bg-[rgba(198,160,59,0.15)] flex items-center justify-center">
                    <span className="text-sm font-serif font-bold text-[#C6A03B]">JW</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side={isRtl ? "left" : "right"} className="bg-sidebar text-sidebar-foreground border-sidebar-border">
                  Just Wills - HR Dashboard
                </TooltipContent>
              </Tooltip>
              <CollapseToggle />
            </div>
          ) : (
            <div className={cn("flex items-center gap-2", isRtl ? "flex-row-reverse" : "")}>
              <CollapseToggle />
              <div className="flex-1 text-center">
                <h1 className="text-xl font-serif font-semibold tracking-tight text-sidebar-foreground">
                  Just Wills
                </h1>
                <p className="text-[11px] font-medium text-[#C6A03B] tracking-wider uppercase">
                  HR Dashboard
                </p>
              </div>
              <div className="w-7" /> {/* Spacer for balance */}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 space-y-[14px] overflow-y-auto",
          isCollapsed ? "p-2" : "p-4"
        )}>
          <NavContent />
        </nav>

        {/* User Profile Menu (consolidated: profile, language, sign out) */}
        <div className={cn(
          "border-t border-sidebar-border",
          isCollapsed ? "p-2" : "p-3"
        )}>
          <UserProfileMenu compact={isCollapsed} portalLabel={t("hr:hrDashboard")} />
        </div>
      </div>
    </aside>
  );
}

function MobileSidebar() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const pathname = usePathname();

  const navItems = [
    { name: t("hr:dashboard"), path: "/hr", icon: LayoutDashboard },
    { name: t("hr:employees"), path: "/hr/employees", icon: Users },
    { name: t("hr:jobRoles"), path: "/hr/job-roles", icon: Briefcase },
    { name: t("hr:kpis"), path: "/hr/kpis", icon: Target },
    { name: t("hr:performanceReviews", "Performance Reviews"), path: "/hr/reviews", icon: ClipboardCheck },
    { name: t("hr:departments"), path: "/hr/departments", icon: Building },
    { name: t("hr:attendance"), path: "/hr/attendance", icon: Calendar },
    { name: t("hr:leave"), path: "/hr/leave", icon: CalendarDays },
    { name: t("common:settings"), path: "/hr/settings", icon: Settings },
  ];

  const NavContent = () => (
    <div className="space-y-[14px]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path || (item.path !== "/hr" && pathname?.startsWith(item.path));
        return (
          <Link key={item.path} href={item.path}>
            <div
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
                isRtl ? "flex-row-reverse" : "",
                isActive
                  ? "bg-[rgba(198,160,59,0.15)] text-white"
                  : "text-[#E8E8E8] hover:bg-[rgba(198,160,59,0.08)] hover:text-white"
              )}
            >
              {isActive && (
                <div
                  className={cn(
                    "absolute top-0 bottom-0 w-[3px] bg-[#C6A03B]",
                    isRtl ? "right-0 rounded-l-full" : "left-0 rounded-r-full"
                  )}
                />
              )}
              <Icon className={cn("h-6 w-6", isActive ? "text-white" : "text-[#E8E8E8]")} />
              <span className="font-medium text-[14px]">{item.name}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );

  return (
    <header className="flex items-center justify-between border-b bg-card p-3 sm:p-4 lg:hidden min-w-0">
      <h1 className="text-lg font-semibold">{t("hr:dashboard")}</h1>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side={isRtl ? "right" : "left"} className="w-[220px] bg-sidebar p-0">
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
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-[14px] p-4">
              <NavContent />
            </nav>

            {/* User Profile Menu (consolidated: profile, language, sign out) */}
            <div className="border-t border-sidebar-border p-3">
              <UserProfileMenu portalLabel={t("hr:hrDashboard")} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

export function HRPortalLayout({ children }: HRPortalLayoutProps) {
  return (
    <SidebarProvider layoutType="hr">
      <TooltipProvider>
        <div className="flex min-h-screen w-full overflow-x-hidden min-w-[320px]">
          {/* Desktop Sidebar */}
          <SidebarContent />

          {/* Main Content */}
          <div className="flex flex-1 flex-col min-w-0 h-screen overflow-y-auto">
            {/* Mobile Header */}
            <MobileSidebar />

            {/* Page Content */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">{children}</main>
          </div>
        </div>
      </TooltipProvider>
    </SidebarProvider>
  );
}
