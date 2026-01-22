import { useTranslation } from "react-i18next";
import { Check, Loader2, AlertTriangle, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SaveStatusType = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

interface SaveStatusProps {
  status: SaveStatusType;
  lastSavedAt?: string | null;
  error?: string | null;
  onRetry?: () => void;
}

export function SaveStatus({ status, lastSavedAt, error, onRetry }: SaveStatusProps) {
  const { t } = useTranslation(['form']);

  const getTimeAgo = () => {
    if (!lastSavedAt) return '';
    
    const date = new Date(lastSavedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return t('justNow');
    if (diffMins === 1) return t('minAgo', { count: 1 });
    if (diffMins < 60) return t('minsAgo', { count: diffMins });
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return t('hourAgo', { count: 1 });
    if (diffHours < 24) return t('hoursAgo', { count: diffHours });
    
    return date.toLocaleString([], { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (status === 'idle') return null;

  return (
    <div className="flex items-center gap-2 animate-fade-in">
      {status === 'saved' && (
        <div className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
          "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
          "border border-emerald-200/50 dark:border-emerald-800/50",
          "transition-all duration-300 ease-out"
        )}>
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span className="font-medium">{t('savedLabel')}</span>
          {lastSavedAt && (
            <>
              <span className="text-emerald-600/50 dark:text-emerald-500/50">·</span>
              <span className="text-emerald-600/90 dark:text-emerald-500/90">{getTimeAgo()}</span>
            </>
          )}
        </div>
      )}

      {status === 'saving' && (
        <div className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
          "bg-accent/10 text-accent border border-accent/20",
          "transition-all duration-300 ease-out"
        )}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
          <span className="font-medium">{t('savingLabel')}</span>
        </div>
      )}

      {status === 'error' && (
        <div className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
          "bg-destructive/10 text-destructive border border-destructive/20",
          "transition-all duration-300 ease-out"
        )}>
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span className="font-medium">{t('saveFailedLabel')}</span>
          {onRetry && (
            <>
              <span className="text-destructive/50">·</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="h-auto p-0 text-xs font-semibold hover:bg-transparent hover:underline text-destructive"
              >
                {t('retryLabel')}
              </Button>
            </>
          )}
        </div>
      )}

      {status === 'offline' && (
        <div className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
          "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400",
          "border border-orange-200/50 dark:border-orange-800/50",
          "transition-all duration-300 ease-out"
        )}>
          <CloudOff className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span className="font-medium">{t('offlineLabel')}</span>
          <span className="text-orange-600/50 dark:text-orange-500/50">·</span>
          <span className="text-orange-600/90 dark:text-orange-500/90">{t('willSyncWhenOnline')}</span>
        </div>
      )}
    </div>
  );
}
