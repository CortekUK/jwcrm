"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSelectedRole } from "@/hooks/useSelectedRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LogOut, ChevronDown, Languages, Sun, Moon, Monitor } from "lucide-react";
import { ReminderNotificationBadge } from "@/components/lead-management/reminders/ReminderNotificationBadge";
import { cn } from "@/lib/utils";

interface UserProfileMenuProps {
  compact?: boolean;
  showReminderBadge?: boolean;
  portalLabel?: string; // e.g., "HR Dashboard", "Client Portal"
}

export function UserProfileMenu({ 
  compact = false, 
  showReminderBadge = false,
  portalLabel 
}: UserProfileMenuProps) {
  const { profile, signOut } = useAuth();
  const { selectedRole } = useSelectedRole();
  const { locale, changeLanguage, isLoading: isChangingLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation("common");
  const isRtl = i18n.language === "ar";
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering theme UI after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLanguageChange = async (newLocale: string) => {
    await changeLanguage(newLocale as "en" | "ar");
  };

  const handleSignOut = () => {
    setIsOpen(false);
    signOut();
  };

  const roleLabel = portalLabel || (selectedRole ? t(`role.${selectedRole}`) : "");

  // Compact mode - collapsed sidebar
  if (compact) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button className="flex items-center justify-center w-full p-2 rounded-lg bg-sidebar-accent/30 hover:bg-sidebar-accent/50 transition-colors cursor-pointer">
                <Avatar className="h-8 w-8 shrink-0 border-2 border-sidebar-primary/20">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                    {profile?.full_name ? getInitials(profile.full_name) : "U"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          {!isOpen && (
            <TooltipContent side={isRtl ? "left" : "right"} className="bg-sidebar text-sidebar-foreground border-sidebar-border">
              <p className="font-medium">{profile?.full_name || "User"}</p>
              <p className="text-xs text-sidebar-foreground/70">{roleLabel}</p>
            </TooltipContent>
          )}
        </Tooltip>
        <PopoverContent 
          side={isRtl ? "left" : "right"} 
          align="end"
          className="w-64 p-0 bg-sidebar border-sidebar-border"
        >
          <MenuContent 
            profile={profile}
            roleLabel={roleLabel}
            locale={locale}
            isChangingLanguage={isChangingLanguage}
            onLanguageChange={handleLanguageChange}
            theme={mounted ? theme : "system"}
            onThemeChange={setTheme}
            onSignOut={handleSignOut}
            t={t}
            isRtl={isRtl}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Expanded mode
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button 
          className={cn(
            "flex items-center gap-3 w-full rounded-lg bg-sidebar-accent/30 p-3 hover:bg-sidebar-accent/50 transition-colors cursor-pointer text-left",
            isRtl && "flex-row-reverse text-right"
          )}
        >
          <Avatar className="h-9 w-9 shrink-0 border-2 border-sidebar-primary/20">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
              {profile?.full_name ? getInitials(profile.full_name) : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground leading-tight truncate">
              {profile?.full_name?.split(" ")[0] || "User"}
            </p>
            <p className="text-[11px] text-sidebar-foreground/70 leading-tight mt-0.5">
              {roleLabel}
            </p>
          </div>
          <div className={cn("flex items-center gap-1 shrink-0", isRtl && "flex-row-reverse")}>
            {showReminderBadge && selectedRole === "salesperson" && <ReminderNotificationBadge />}
            <ChevronDown className={cn(
              "h-4 w-4 text-sidebar-foreground/50 transition-transform",
              isOpen && "rotate-180"
            )} />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        align={isRtl ? "end" : "start"}
        sideOffset={8}
        className="w-64 p-0 bg-sidebar border-sidebar-border"
      >
        <MenuContent 
          profile={profile}
          roleLabel={roleLabel}
          locale={locale}
          isChangingLanguage={isChangingLanguage}
          onLanguageChange={handleLanguageChange}
          theme={mounted ? theme : "system"}
          onThemeChange={setTheme}
          onSignOut={handleSignOut}
          t={t}
          isRtl={isRtl}
        />
      </PopoverContent>
    </Popover>
  );
}

// Extracted menu content for reuse
interface MenuContentProps {
  profile: { full_name?: string; email?: string } | null;
  roleLabel: string;
  locale: string;
  isChangingLanguage: boolean;
  onLanguageChange: (locale: string) => void;
  theme: string | undefined;
  onThemeChange: (theme: string) => void;
  onSignOut: () => void;
  t: (key: string) => string;
  isRtl: boolean;
}

function MenuContent({ 
  profile, 
  roleLabel, 
  locale, 
  isChangingLanguage, 
  onLanguageChange,
  theme,
  onThemeChange,
  onSignOut, 
  t,
  isRtl 
}: MenuContentProps) {
  return (
    <div className={cn("text-sidebar-foreground", isRtl && "text-right")}>
      {/* User Info Header */}
      <div className="px-4 py-3">
        <p className="font-medium text-sm">{profile?.full_name || "User"}</p>
        <p className="text-xs text-sidebar-foreground/70 mt-0.5">{roleLabel}</p>
      </div>
      
      <Separator className="bg-sidebar-border" />
      
      {/* Language Section */}
      <div className="px-4 py-3">
        <div className={cn("flex items-center gap-2 mb-3", isRtl && "flex-row-reverse")}>
          <Languages className="h-4 w-4 text-sidebar-foreground/70" />
          <span className="text-sm font-medium">{t("language")}</span>
        </div>
        <RadioGroup 
          value={locale} 
          onValueChange={onLanguageChange}
          disabled={isChangingLanguage}
          className="gap-2"
        >
          <div className={cn("flex items-center space-x-2", isRtl && "flex-row-reverse space-x-reverse")}>
            <RadioGroupItem 
              value="en" 
              id="lang-en" 
              className="border-sidebar-foreground/30 text-[#C6A03B] data-[state=checked]:border-[#C6A03B]"
            />
            <Label 
              htmlFor="lang-en" 
              className="text-sm text-sidebar-foreground cursor-pointer"
            >
              {t("english")}
            </Label>
          </div>
          <div className={cn("flex items-center space-x-2", isRtl && "flex-row-reverse space-x-reverse")}>
            <RadioGroupItem 
              value="ar" 
              id="lang-ar"
              className="border-sidebar-foreground/30 text-[#C6A03B] data-[state=checked]:border-[#C6A03B]"
            />
            <Label 
              htmlFor="lang-ar" 
              className="text-sm text-sidebar-foreground cursor-pointer"
            >
              {t("arabic")}
            </Label>
          </div>
        </RadioGroup>
      </div>
      
      <Separator className="bg-sidebar-border" />
      
      {/* Theme Section */}
      <div className="px-4 py-3">
        <div className={cn("flex items-center gap-2 mb-3", isRtl && "flex-row-reverse")}>
          <Sun className="h-4 w-4 text-sidebar-foreground/70" />
          <span className="text-sm font-medium">{t("theme")}</span>
        </div>
        <RadioGroup 
          value={theme || "system"} 
          onValueChange={onThemeChange}
          className="gap-2"
        >
          <div className={cn("flex items-center space-x-2", isRtl && "flex-row-reverse space-x-reverse")}>
            <RadioGroupItem 
              value="light" 
              id="theme-light" 
              className="border-sidebar-foreground/30 text-[#C6A03B] data-[state=checked]:border-[#C6A03B]"
            />
            <Label 
              htmlFor="theme-light" 
              className={cn("text-sm text-sidebar-foreground cursor-pointer flex items-center gap-2", isRtl && "flex-row-reverse")}
            >
              <Sun className="h-3.5 w-3.5" />
              {t("themeLight")}
            </Label>
          </div>
          <div className={cn("flex items-center space-x-2", isRtl && "flex-row-reverse space-x-reverse")}>
            <RadioGroupItem 
              value="dark" 
              id="theme-dark"
              className="border-sidebar-foreground/30 text-[#C6A03B] data-[state=checked]:border-[#C6A03B]"
            />
            <Label 
              htmlFor="theme-dark" 
              className={cn("text-sm text-sidebar-foreground cursor-pointer flex items-center gap-2", isRtl && "flex-row-reverse")}
            >
              <Moon className="h-3.5 w-3.5" />
              {t("themeDark")}
            </Label>
          </div>
          <div className={cn("flex items-center space-x-2", isRtl && "flex-row-reverse space-x-reverse")}>
            <RadioGroupItem 
              value="system" 
              id="theme-system"
              className="border-sidebar-foreground/30 text-[#C6A03B] data-[state=checked]:border-[#C6A03B]"
            />
            <Label 
              htmlFor="theme-system" 
              className={cn("text-sm text-sidebar-foreground cursor-pointer flex items-center gap-2", isRtl && "flex-row-reverse")}
            >
              <Monitor className="h-3.5 w-3.5" />
              {t("themeSystem")}
            </Label>
          </div>
        </RadioGroup>
      </div>
      
      <Separator className="bg-sidebar-border" />
      
      {/* Sign Out */}
      <div className="p-2">
        <Button
          variant="ghost"
          onClick={onSignOut}
          className={cn(
            "w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-red-400",
            isRtl && "flex-row-reverse"
          )}
        >
          <LogOut className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
          {t("signOut")}
        </Button>
      </div>
    </div>
  );
}
