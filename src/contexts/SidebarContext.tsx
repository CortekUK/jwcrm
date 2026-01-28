"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

type SidebarLayoutType = "admin" | "hr" | "client";

interface SidebarContextValue {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

const SIDEBAR_STORAGE_KEY_PREFIX = "sidebar_collapsed_";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

interface SidebarProviderProps {
  children: ReactNode;
  layoutType: SidebarLayoutType;
  defaultCollapsed?: boolean;
}

export function SidebarProvider({ 
  children, 
  layoutType, 
  defaultCollapsed = false 
}: SidebarProviderProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isInitialized, setIsInitialized] = useState(false);

  const storageKey = `${SIDEBAR_STORAGE_KEY_PREFIX}${layoutType}`;

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        setIsCollapsed(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load sidebar state:", error);
    }
    setIsInitialized(true);
  }, [storageKey]);

  // Save collapsed state to localStorage when it changes
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(isCollapsed));
      } catch (error) {
        console.error("Failed to save sidebar state:", error);
      }
    }
  }, [isCollapsed, isInitialized, storageKey]);

  const toggleSidebar = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + B
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key &&
        event.key.toLowerCase() === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const value: SidebarContextValue = {
    isCollapsed,
    toggleSidebar,
    setCollapsed,
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

// Export a version that doesn't throw for optional sidebar usage
export function useSidebarOptional() {
  return useContext(SidebarContext);
}
