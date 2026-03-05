import {
  Plane,
  Thermometer,
  AlertCircle,
  Wallet,
  Globe,
  Calendar,
  Briefcase,
  Heart,
  Coffee,
  Baby,
  GraduationCap,
  Clock,
  Home,
  Umbrella,
  Sun,
  type LucideIcon,
} from "lucide-react";

/**
 * Map of available icon names to Lucide icon components.
 * Admins select from these when configuring leave types.
 */
export const LEAVE_TYPE_ICON_MAP: Record<string, LucideIcon> = {
  Plane,
  Thermometer,
  AlertCircle,
  Wallet,
  Globe,
  Calendar,
  Briefcase,
  Heart,
  Coffee,
  Baby,
  GraduationCap,
  Clock,
  Home,
  Umbrella,
  Sun,
};

/** Get icon component by name, with Calendar as fallback */
export function getLeaveTypeIcon(iconName: string): LucideIcon {
  return LEAVE_TYPE_ICON_MAP[iconName] || Calendar;
}

/** List of icon options for admin selection */
export const ICON_OPTIONS = Object.keys(LEAVE_TYPE_ICON_MAP).map((name) => ({
  value: name,
  label: name.replace(/([A-Z])/g, " $1").trim(),
}));
