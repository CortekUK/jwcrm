"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Activity, 
  Loader2,
  RefreshCw,
  Filter,
  Phone,
  Mail,
  MessageCircle,
  Video,
  Users,
  Target,
  Bell,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Building,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";
import { LeadStatus } from "./LeadStatusBadge";

export type ActivityType = 
  | "lead_created"
  | "lead_updated"
  | "status_changed"
  | "communication_logged"
  | "reminder_created"
  | "reminder_completed"
  | "proposal_sent"
  | "proposal_paid"
  | "lead_assigned";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  lead_id?: string;
  lead_name?: string;
  user_id?: string;
  user_name?: string;
  old_value?: string;
  new_value?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface LeadActivityFeedProps {
  userId?: string;
  leadId?: string;
  limit?: number;
  showFilters?: boolean;
  showHeader?: boolean;
  compact?: boolean;
  className?: string;
}

const ACTIVITY_CONFIG: Record<ActivityType, { icon: typeof Activity; color: string; bgColor: string }> = {
  lead_created: { icon: Target, color: "#0C5536", bgColor: "#E6F7F1" },
  lead_updated: { icon: FileText, color: "#C6A03B", bgColor: "#FFF9E6" },
  status_changed: { icon: TrendingUp, color: "#7C3AED", bgColor: "#F3E8FF" },
  communication_logged: { icon: MessageCircle, color: "#2563EB", bgColor: "#E6F0FF" },
  reminder_created: { icon: Bell, color: "#D97706", bgColor: "#FFF7ED" },
  reminder_completed: { icon: CheckCircle2, color: "#0C5536", bgColor: "#E6F7F1" },
  proposal_sent: { icon: FileText, color: "#C6A03B", bgColor: "#FFF9E6" },
  proposal_paid: { icon: CheckCircle2, color: "#0C5536", bgColor: "#D4EDDA" },
  lead_assigned: { icon: User, color: "#4F46E5", bgColor: "#E6E6FF" },
};

const COMMUNICATION_ICONS: Record<string, typeof Phone> = {
  phone: Phone,
  mail: Mail,
  "message-circle": MessageCircle,
  video: Video,
  users: Users,
};

export function LeadActivityFeed({
  userId,
  leadId,
  limit = 20,
  showFilters = true,
  showHeader = true,
  compact = false,
  className,
}: LeadActivityFeedProps) {
  const { t } = useTranslation("leadManagement");
  const { user } = useAuth();

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [displayLimit, setDisplayLimit] = useState(limit);

  // Fetch activities
  const fetchActivities = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      // Simulate activity data since the table doesn't exist yet
      // In production, this would fetch from Supabase with real-time subscriptions
      const mockActivities: ActivityItem[] = generateMockActivities(userId, leadId);
      
      // Filter by type if needed
      const filtered = filterType === "all" 
        ? mockActivities 
        : mockActivities.filter(a => a.type === filterType);

      setActivities(filtered.slice(0, displayLimit));
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId, leadId, filterType, displayLimit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Setup real-time subscription (placeholder)
  useEffect(() => {
    // In production, this would set up a Supabase realtime subscription
    // const subscription = supabase
    //   .channel('lead_activities')
    //   .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_activities' }, (payload) => {
    //     // Handle new activity
    //   })
    //   .subscribe();
    
    // return () => {
    //   subscription.unsubscribe();
    // };
  }, []);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: { label: string; activities: ActivityItem[] }[] = [];
    const today: ActivityItem[] = [];
    const yesterday: ActivityItem[] = [];
    const older: ActivityItem[] = [];

    activities.forEach(activity => {
      const date = parseISO(activity.created_at);
      if (isToday(date)) {
        today.push(activity);
      } else if (isYesterday(date)) {
        yesterday.push(activity);
      } else {
        older.push(activity);
      }
    });

    if (today.length > 0) {
      groups.push({ label: t("today", "Today"), activities: today });
    }
    if (yesterday.length > 0) {
      groups.push({ label: t("yesterday", "Yesterday"), activities: yesterday });
    }
    if (older.length > 0) {
      groups.push({ label: t("earlier", "Earlier"), activities: older });
    }

    return groups;
  }, [activities, t]);

  // Render activity icon
  const renderActivityIcon = (activity: ActivityItem) => {
    const config = ACTIVITY_CONFIG[activity.type];
    let IconComponent = config.icon;

    // Use specific icon for communication type
    if (activity.type === "communication_logged" && activity.metadata?.icon) {
      IconComponent = COMMUNICATION_ICONS[activity.metadata.icon] || MessageCircle;
    }

    return (
      <div 
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
          compact && "h-6 w-6"
        )}
        style={{ backgroundColor: config.bgColor }}
      >
        <IconComponent 
          className={compact ? "h-3 w-3" : "h-4 w-4"} 
          style={{ color: config.color }} 
        />
      </div>
    );
  };

  // Render status badge
  const renderStatusBadge = (status: string) => {
    const statusColors: Record<string, { bg: string; text: string }> = {
      not_started: { bg: "#F5F5F5", text: "#6B6B6B" },
      contacted: { bg: "#E6F7F1", text: "#0C5536" },
      consultation: { bg: "#E0F2FE", text: "#0369A1" },
      meeting: { bg: "#E6F0FF", text: "#2563EB" },
      qualified: { bg: "#F3E8FF", text: "#7C3AED" },
      negotiation: { bg: "#E6E6FF", text: "#4F46E5" },
      pending: { bg: "#FFF9E6", text: "#C6A03B" },
      won: { bg: "#D4EDDA", text: "#0C5536" },
      lost: { bg: "#FEECEC", text: "#C0392B" },
    };

    const colors = statusColors[status] || statusColors.not_started;
    return (
      <Badge 
        className="text-xs border-0 ml-1"
        style={{ backgroundColor: colors.bg, color: colors.text }}
      >
        {t(status, status.replace("_", " "))}
      </Badge>
    );
  };

  // Format activity description
  const formatActivityDescription = (activity: ActivityItem) => {
    switch (activity.type) {
      case "status_changed":
        return (
          <span>
            {t("statusChangedFromTo", "Status changed from")}
            {renderStatusBadge(activity.old_value || "not_started")}
            {" → "}
            {renderStatusBadge(activity.new_value || "not_started")}
          </span>
        );
      case "lead_assigned":
        return (
          <span>
            {t("assignedTo", "Assigned to")} <strong>{activity.new_value}</strong>
          </span>
        );
      case "proposal_paid":
        return (
          <span>
            {t("proposalPaid", "Proposal paid")} - <strong>AED {activity.metadata?.amount?.toLocaleString()}</strong>
          </span>
        );
      default:
        return activity.description;
    }
  };

  // Load more
  const handleLoadMore = () => {
    setDisplayLimit(prev => prev + limit);
  };

  if (isLoading) {
    return (
      <Card className={cn("border-[#E6E6E4]", className)}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-[#E6E6E4]", className)}>
      {showHeader && (
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
              <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("activityFeed", "Activity Feed")}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {showFilters && (
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px] h-8 text-xs border-[#E6E6E4]">
                    <Filter className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allActivity", "All Activity")}</SelectItem>
                    <SelectItem value="status_changed">{t("statusChanges", "Status Changes")}</SelectItem>
                    <SelectItem value="communication_logged">{t("communications", "Communications")}</SelectItem>
                    <SelectItem value="reminder_created">{t("reminders", "Reminders")}</SelectItem>
                    <SelectItem value="proposal_sent">{t("proposals", "Proposals")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fetchActivities(true)}
                disabled={isRefreshing}
                className="h-8 w-8"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            </div>
          </div>
          <CardDescription className="text-[#777777]">
            {t("activityFeedDescription", "Recent activity across your leads")}
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className={cn(!showHeader && "pt-4")}>
        {activities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#E6E6E4] p-8 text-center">
            <Activity className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
            <p className="font-medium text-[#222222]">{t("noActivity", "No activity yet")}</p>
            <p className="text-sm text-[#6B6B6B] mt-1">
              {t("noActivityDescription", "Activity will appear here as you work with leads")}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedActivities.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-medium text-[#999999] uppercase tracking-wider mb-3">
                  {group.label}
                </p>
                <div className="space-y-3">
                  {group.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className={cn(
                        "flex gap-3 p-3 rounded-lg hover:bg-[#FAFAF8] transition-colors",
                        compact && "p-2"
                      )}
                    >
                      {renderActivityIcon(activity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={cn(
                              "font-medium text-[#222222]",
                              compact && "text-sm"
                            )}>
                              {activity.title}
                            </p>
                            {activity.lead_name && (
                              <p className="text-xs text-[#6B6B6B]">
                                {activity.lead_name}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-[#999999] flex-shrink-0">
                            {formatDistanceToNow(parseISO(activity.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {activity.description && (
                          <p className={cn(
                            "text-[#555555] mt-1",
                            compact ? "text-xs" : "text-sm"
                          )}>
                            {formatActivityDescription(activity)}
                          </p>
                        )}
                        {activity.user_name && (
                          <p className="text-xs text-[#999999] mt-1">
                            by {activity.user_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {activities.length >= displayLimit && (
              <Button
                variant="ghost"
                onClick={handleLoadMore}
                className="w-full text-[#6B6B6B] hover:text-[#222222]"
              >
                <ChevronDown className="h-4 w-4 mr-2" />
                {t("loadMore", "Load More")}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to generate mock activities for demo
function generateMockActivities(userId?: string, leadId?: string): ActivityItem[] {
  const now = new Date();
  const activities: ActivityItem[] = [
    {
      id: "1",
      type: "status_changed",
      title: "Lead status updated",
      lead_id: "lead-1",
      lead_name: "John Smith",
      old_value: "contacted",
      new_value: "qualified",
      user_name: "Sarah Johnson",
      created_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: "2",
      type: "communication_logged",
      title: "Phone call logged",
      description: "Discussed will requirements and pricing",
      lead_id: "lead-2",
      lead_name: "Emma Wilson",
      user_name: "Mike Brown",
      metadata: { icon: "phone" },
      created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "3",
      type: "reminder_created",
      title: "Follow-up reminder set",
      description: "Call to discuss contract signing",
      lead_id: "lead-1",
      lead_name: "John Smith",
      user_name: "Sarah Johnson",
      created_at: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "4",
      type: "proposal_sent",
      title: "Proposal sent",
      description: "Single Will package - AED 299",
      lead_id: "lead-3",
      lead_name: "David Brown",
      user_name: "Sarah Johnson",
      created_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "5",
      type: "proposal_paid",
      title: "Payment received",
      lead_id: "lead-4",
      lead_name: "Lisa Taylor",
      metadata: { amount: 599 },
      user_name: "System",
      created_at: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "6",
      type: "lead_assigned",
      title: "Lead assigned",
      lead_id: "lead-5",
      lead_name: "Robert Johnson",
      new_value: "Sarah Johnson",
      user_name: "Admin",
      created_at: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "7",
      type: "lead_created",
      title: "New lead created",
      description: "From website contact form",
      lead_id: "lead-6",
      lead_name: "Alice Cooper",
      user_name: "System",
      created_at: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(),
    },
  ];

  return activities;
}
