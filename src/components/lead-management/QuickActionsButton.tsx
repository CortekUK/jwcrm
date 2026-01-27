"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Plus, 
  Users, 
  Megaphone, 
  Calendar,
  Keyboard,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  onClick: () => void;
  color?: string;
}

interface QuickActionsButtonProps {
  onCreateLead?: () => void;
  onCreateSource?: () => void;
  onOpenCalendar?: () => void;
  className?: string;
  position?: "bottom-right" | "bottom-left";
  showKeyboardHints?: boolean;
}

export function QuickActionsButton({
  onCreateLead,
  onCreateSource,
  onOpenCalendar,
  className,
  position = "bottom-right",
  showKeyboardHints = true,
}: QuickActionsButtonProps) {
  const { t } = useTranslation("leadManagement");
  const [isOpen, setIsOpen] = useState(false);
  const [showShortcutHint, setShowShortcutHint] = useState(false);

  // Build quick actions based on available handlers
  const quickActions: QuickAction[] = [];

  if (onCreateLead) {
    quickActions.push({
      id: "create-lead",
      label: t("createLead", "New Lead"),
      icon: Users,
      shortcut: "Ctrl+N",
      onClick: onCreateLead,
      color: "text-[#0C5536]",
    });
  }

  if (onCreateSource) {
    quickActions.push({
      id: "create-source",
      label: t("createSource", "New Source"),
      icon: Megaphone,
      shortcut: "Ctrl+Shift+S",
      onClick: onCreateSource,
      color: "text-[#C6A03B]",
    });
  }

  if (onOpenCalendar) {
    quickActions.push({
      id: "open-calendar",
      label: t("openCalendar", "Calendar"),
      icon: Calendar,
      shortcut: "Ctrl+K",
      onClick: onOpenCalendar,
      color: "text-[#2563EB]",
    });
  }

  // Keyboard shortcut handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Show hint when Ctrl/Cmd is pressed
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      if (showKeyboardHints) {
        setShowShortcutHint(true);
      }
    }

    // Handle specific shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "n" && onCreateLead) {
        e.preventDefault();
        onCreateLead();
      } else if (e.key === "s" && e.shiftKey && onCreateSource) {
        e.preventDefault();
        onCreateSource();
      } else if (e.key === "k" && onOpenCalendar) {
        e.preventDefault();
        onOpenCalendar();
      }
    }
  }, [onCreateLead, onCreateSource, onOpenCalendar, showKeyboardHints]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === "Control" || e.key === "Meta") {
      setShowShortcutHint(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  if (quickActions.length === 0) return null;

  // If only one action, show a simple button
  if (quickActions.length === 1) {
    const action = quickActions[0];
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={action.onClick}
              className={cn(
                "fixed z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-200 hover:scale-105",
                "bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white",
                position === "bottom-right" ? "bottom-6 right-6" : "bottom-6 left-6",
                className
              )}
            >
              <action.icon className="h-6 w-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{action.label}</p>
            {action.shortcut && (
              <p className="text-xs text-muted-foreground">{action.shortcut}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <>
      {/* Keyboard shortcut hint overlay */}
      {showShortcutHint && showKeyboardHints && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="fixed bottom-24 right-6 bg-[#222222] text-white rounded-lg shadow-xl p-4 animate-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center gap-2 mb-2">
              <Keyboard className="h-4 w-4" />
              <span className="font-medium text-sm">{t("keyboardShortcuts", "Keyboard Shortcuts")}</span>
            </div>
            <div className="space-y-1.5">
              {quickActions.map((action) => (
                action.shortcut && (
                  <div key={action.id} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-[#999999]">{action.label}</span>
                    <kbd className="px-2 py-0.5 bg-[#333333] rounded text-xs font-mono">{action.shortcut}</kbd>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating action button */}
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            className={cn(
              "fixed z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-200",
              "bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white",
              isOpen && "rotate-45 bg-[#C0392B] hover:bg-[#a33227]",
              position === "bottom-right" ? "bottom-6 right-6" : "bottom-6 left-6",
              className
            )}
          >
            {isOpen ? (
              <X className="h-6 w-6 transition-transform" />
            ) : (
              <Plus className="h-6 w-6 transition-transform" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          side="top" 
          sideOffset={12}
          className="w-56 mb-2"
        >
          <DropdownMenuLabel className="text-xs text-[#6B6B6B]">
            {t("quickActions", "Quick Actions")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {quickActions.map((action) => (
            <DropdownMenuItem
              key={action.id}
              onClick={action.onClick}
              className="cursor-pointer"
            >
              <action.icon className={cn("mr-2 h-4 w-4", action.color)} />
              <span className="flex-1">{action.label}</span>
              {action.shortcut && (
                <kbd className="ml-2 px-1.5 py-0.5 bg-[#F5F5F5] rounded text-[10px] font-mono text-[#6B6B6B]">
                  {action.shortcut}
                </kbd>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
