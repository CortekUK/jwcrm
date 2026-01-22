"use client";

import {
  CheckCircle2,
  Clock,
  Home,
  Plane,
  Thermometer,
  XCircle,
  Minus,
  Star,
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface LegendItem {
  icon: React.ElementType;
  color: string;
  label: string;
  labelKey: string;
}

const legendItems: LegendItem[] = [
  { icon: CheckCircle2, color: "text-green-600", label: "Present", labelKey: "present" },
  { icon: Clock, color: "text-orange-600", label: "Late", labelKey: "late" },
  { icon: Home, color: "text-blue-600", label: "WFH", labelKey: "wfh" },
  { icon: Plane, color: "text-purple-600", label: "On Leave", labelKey: "onLeave" },
  { icon: Thermometer, color: "text-yellow-600", label: "Sick", labelKey: "sick" },
  { icon: XCircle, color: "text-red-600", label: "Absent", labelKey: "absent" },
  { icon: Minus, color: "text-gray-400", label: "Weekend", labelKey: "weekend" },
  { icon: Star, color: "text-amber-500", label: "Holiday", labelKey: "holiday" },
];

interface CalendarLegendProps {
  className?: string;
  compact?: boolean;
}

export function CalendarLegend({ className = "", compact = false }: CalendarLegendProps) {
  const { t } = useTranslation(["hr"]);

  if (compact) {
    return (
      <div className={`flex flex-wrap gap-3 ${className}`}>
        {legendItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.labelKey} className="flex items-center gap-1">
              <Icon className={`h-3.5 w-3.5 ${item.color}`} />
              <span className="text-xs text-[#6B6B6B]">
                {t(`calendar.legend.${item.labelKey}`, item.label)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`p-3 bg-gray-50 rounded-lg border border-[#E6E6E4] ${className}`}>
      <p className="text-xs font-medium text-[#222222] mb-2">
        {t("calendar.legend.title", "Legend")}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {legendItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.labelKey} className="flex items-center gap-1.5">
              <Icon className={`h-4 w-4 ${item.color}`} />
              <span className="text-xs text-[#6B6B6B]">
                {t(`calendar.legend.${item.labelKey}`, item.label)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
