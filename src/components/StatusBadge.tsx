import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { STATUS_WORKFLOW, getClientStep } from "@/lib/status-config";
import { useTranslation } from "react-i18next";

type WillStatus = Database["public"]["Enums"]["will_status"];

interface StatusBadgeProps {
  status: WillStatus;
  showIcon?: boolean;
  clientFriendly?: boolean;
  className?: string;
}

export function StatusBadge({ status, showIcon = true, clientFriendly = false, className }: StatusBadgeProps) {
  const { t } = useTranslation(['admin', 'portal']);

  // Use client-friendly labels when requested
  if (clientFriendly) {
    const clientStep = getClientStep(status);
    // Convert snake_case to camelCase for translation key
    const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    const translationKey = `portal:documentsPage.statusLabels.${toCamelCase(status)}`;
    return (
      <span
        style={{ backgroundColor: clientStep.color }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-white text-[13px] font-semibold",
          className
        )}
        aria-label={`Status: ${t(translationKey)}`}
      >
        {t(translationKey)}
      </span>
    );
  }

  // Standard admin/technical labels
  const config = STATUS_WORKFLOW[status];
  const Icon = config.icon;

  return (
    <span
      style={{ backgroundColor: config.color }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white text-[13px] font-medium transition-all duration-200 border border-white/20",
        className
      )}
      aria-label={`Status: ${t(status)}`}
    >
      {showIcon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {t(status)}
    </span>
  );
}
