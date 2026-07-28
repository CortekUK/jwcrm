"use client";

import { useSelectedRole } from "@/hooks/useSelectedRole";
import { UserRole } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutDashboard, Users, DollarSign, Target, ShieldCheck, UserCheck, UserCog } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";

// Icons for each role
const ROLE_ICONS: Record<UserRole, React.ElementType> = {
  superadmin: ShieldCheck,
  admin: LayoutDashboard,
  hr: Users,
  finance: DollarSign,
  lead_management: Target,
  salesperson: UserCheck,
  account_manager: UserCog,
  client: LayoutDashboard,
};

// Short display names for the switcher (to prevent overflow)
const ROLE_SHORT_NAMES: Record<UserRole, { en: string; ar: string }> = {
  superadmin: { en: "Super Admin", ar: "المسؤول الأعلى" },
  admin: { en: "Wills", ar: "الوصايا" },
  hr: { en: "HR", ar: "الموارد البشرية" },
  finance: { en: "Finance", ar: "المالية" },
  lead_management: { en: "Leads", ar: "العملاء" },
  salesperson: { en: "Sales", ar: "المبيعات" },
  account_manager: { en: "My Cases", ar: "ملفاتي" },
  client: { en: "Client", ar: "العميل" },
};

// Dashboard routes for each role (default landing page when switching)
const ROLE_DASHBOARD_ROUTES: Record<UserRole, string> = {
  superadmin: "/admin/manage-users",
  admin: "/admin",
  hr: "/admin/hr",
  finance: "/admin/finance",
  lead_management: "/admin/lead-management/leads",
  salesperson: "/admin/lead-management/leads",
  account_manager: "/admin/wills",
  client: "/client",
};

interface RoleSwitcherProps {
  className?: string;
  /** Use "light" for light backgrounds (mobile header), "dark" for dark sidebar */
  variant?: "light" | "dark";
}

export function RoleSwitcher({ className, variant = "dark" }: RoleSwitcherProps) {
  const { selectedRole, setSelectedRole, availableRoles } = useSelectedRole();
  const { i18n } = useTranslation();
  const router = useRouter();
  const isRtl = i18n.language === "ar";
  const lang = i18n.language === "ar" ? "ar" : "en";

  // Handle role change with navigation
  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    // Navigate to the dashboard for the selected role
    router.push(ROLE_DASHBOARD_ROUTES[role]);
  };

  // Styling based on variant
  const isLight = variant === "light";
  const textColor = isLight ? "text-[#0C5536]" : "text-sidebar-foreground";
  const bgColor = isLight ? "bg-[#0C5536]/10" : "bg-sidebar-accent/30";
  const triggerBg = isLight ? "bg-[#0C5536]/10 border-[#0C5536]/20" : "bg-sidebar-accent/20 border-sidebar-border";
  const triggerHover = isLight ? "hover:bg-[#0C5536]/15" : "hover:bg-sidebar-accent/30";
  const dropdownBg = isLight ? "bg-white border-[#E6E6E4]" : "bg-sidebar border-sidebar-border";
  const itemStyles = isLight
    ? "text-[#222222] hover:bg-[#0C5536]/10 focus:bg-[#0C5536]/10 focus:text-[#0C5536]"
    : "text-sidebar-foreground hover:bg-sidebar-accent focus:bg-sidebar-accent focus:text-sidebar-foreground";

  // Don't show switcher if user has only one role or no roles
  if (availableRoles.length <= 1) {
    // Show static display for single role
    if (selectedRole) {
      const Icon = ROLE_ICONS[selectedRole];
      return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bgColor} overflow-hidden ${className}`}>
          <Icon className="h-4 w-4 shrink-0 text-[#C6A03B]" />
          <span className={`text-sm font-medium ${textColor} truncate`}>
            {ROLE_SHORT_NAMES[selectedRole][lang]}
          </span>
        </div>
      );
    }
    return null;
  }

  return (
    <Select value={selectedRole || undefined} onValueChange={(value) => handleRoleChange(value as UserRole)}>
      <SelectTrigger
        className={`w-full ${triggerBg} ${textColor} ${triggerHover} transition-colors overflow-hidden ${className}`}
      >
        <div className={`flex items-center gap-2 min-w-0 ${isRtl ? "flex-row-reverse" : ""}`}>
          {selectedRole && (
            <>
              {(() => {
                const Icon = ROLE_ICONS[selectedRole];
                return <Icon className="h-4 w-4 shrink-0 text-[#C6A03B]" />;
              })()}
              <span className="truncate text-sm">
                {ROLE_SHORT_NAMES[selectedRole][lang]}
              </span>
            </>
          )}
        </div>
      </SelectTrigger>
      <SelectContent className={`${dropdownBg} min-w-[180px]`}>
        {availableRoles.map((role) => {
          const Icon = ROLE_ICONS[role];
          return (
            <SelectItem
              key={role}
              value={role}
              className={itemStyles}
            >
              <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                <Icon className="h-4 w-4 shrink-0 text-[#C6A03B]" />
                <span className="truncate">{ROLE_SHORT_NAMES[role][lang]}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
