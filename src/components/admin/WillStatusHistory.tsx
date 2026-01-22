import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity } from "lucide-react";
import { format } from "date-fns";
import { STATUS_WORKFLOW } from "@/lib/status-config";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { textAlign } from "@/lib/rtl-utils";

interface WillStatusHistoryProps {
  willId: string;
}

export function WillStatusHistory({ willId }: WillStatusHistoryProps) {
  const { t } = useTranslation('admin');
  const { locale } = useLanguage();
  const isRtl = locale === 'ar';

  const getStatusLabel = (status: string) => {
    const statusTranslationMap: Record<string, string> = {
      'in_progress': 'inProgressStatus',
      'awaiting_review': 'awaitingReviewStatus',
      'under_review': 'underReviewStatus',
      'draft_ready': 'draftReadyStatus',
      'draft_released': 'draftReleasedStatus',
      'finalized': 'finalizedStatus',
    };

    const translationKey = statusTranslationMap[status];
    return translationKey ? t(translationKey) : STATUS_WORKFLOW[status as keyof typeof STATUS_WORKFLOW]?.label || status;
  };

  const { data: statusHistory, isLoading } = useQuery({
    queryKey: ["will-status-history", willId],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from("will_status_events")
        .select("*")
        .eq("will_id", willId)
        .order("changed_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for all actors
      if (events && events.length > 0) {
        const actorIds = [...new Set(events.map(e => e.actor_user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", actorIds);

        // Map profiles to events
        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        return events.map(event => ({
          ...event,
          actor_profile: profileMap.get(event.actor_user_id)
        }));
      }

      return events || [];
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "in_progress":
        return "secondary";
      case "awaiting_pdf":
        return "default";
      case "draft_generated":
        return "default";
      case "in_review":
        return "default";
      case "finalized":
        return "default";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('statusHistory')}</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E6E6E4] shadow-[0_2px_8px_rgba(12,85,54,0.08)]">
      <CardHeader className="border-b border-[hsl(var(--jw-gold-accent))]/10">
        <CardTitle className={`text-[hsl(var(--jw-primary-green))] ${textAlign(isRtl)}`} style={{ fontFamily: 'Playfair Display, serif', fontSize: '17px', fontWeight: 600 }}>
          {t('statusHistory')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {statusHistory && statusHistory.length > 0 ? (
          <div className={`relative space-y-6 ${isRtl ? 'pr-6' : 'pl-6'}`}>
            {/* Gold vertical timeline line */}
            <div className={`absolute top-2 bottom-2 w-0.5 bg-gradient-to-b from-[hsl(var(--jw-gold-accent))] to-[hsl(var(--jw-primary-green))] ${isRtl ? 'right-2' : 'left-2'}`} />

            {statusHistory.map((event: any, index: number) => (
              <div key={event.id} className="relative animate-slideIn" style={{ animationDelay: `${index * 50}ms` }}>
                {/* Gold dot */}
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-[hsl(var(--jw-gold-accent))] border-2 border-white shadow-sm ${isRtl ? '-right-6' : '-left-6'}`} />

                <div className="space-y-2">
                  <div className={`flex items-center gap-2 flex-wrap ${isRtl ? 'flex-row-reverse' : ''}`}>
                    {event.previous_status && (
                      <>
                        <Badge variant="outline" className="text-xs border-[#E6E6E4] text-[#777777]">
                          {getStatusLabel(event.previous_status)}
                        </Badge>
                        <span className="text-[#777777]">{isRtl ? '←' : '→'}</span>
                      </>
                    )}
                    <Badge variant="success" className="text-xs">
                      {getStatusLabel(event.new_status)}
                    </Badge>
                  </div>
                  <p className={`text-sm font-medium text-[hsl(var(--jw-primary-green))] ${textAlign(isRtl)}`} style={{ fontFamily: 'Inter, sans-serif' }}>
                    {t('changedBy')} {event.actor_profile?.full_name || "System"}
                  </p>
                  <p className={`text-xs text-[#999999] ${textAlign(isRtl)}`}>
                    {format(new Date(event.changed_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                  {event.notes && (
                    <p className="text-sm mt-2 p-3 bg-[#FDFBF4] rounded-md border border-[hsl(var(--jw-gold-accent))]/10 text-[#555555]">
                      {event.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-16 w-16 rounded-lg bg-[#FDFBF4] border border-[hsl(var(--jw-gold-accent))]/20 flex items-center justify-center mb-4">
              <Activity className="h-8 w-8 text-[hsl(var(--jw-gold-accent))]" />
            </div>
            <p className={`text-center text-[#555555] text-sm ${textAlign(isRtl)}`}>{t('noStatusChangesYet')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
