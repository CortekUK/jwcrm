"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  SalespersonStatsCard, 
  calculateSalespersonStats,
  calculatePreviousPeriodStats,
  KPICardAction,
} from "@/components/lead-management/SalespersonStatsCard";
import { SalesAnalyticsCharts } from "@/components/lead-management/SalesAnalyticsCharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Target, 
  BarChart3, 
  Users, 
  Bell, 
  Clock, 
  TrendingUp,
  ArrowRight,
  Calendar,
  Phone,
  Mail,
  MessageCircle,
  Video,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { format, parseISO, subMonths, startOfMonth, endOfMonth, isToday, isPast, isFuture, differenceInDays } from "date-fns";
import { LeadStatus } from "@/components/lead-management/LeadStatusBadge";

interface Lead {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  status: LeadStatus;
  source: string | null;
  source_id: string | null;
  source_data?: { id: string; name: string } | null;
  is_paid: boolean;
  paid_amount: number | null;
  paid_currency: string | null;
  created_at: string;
  updated_at: string;
}

interface Reminder {
  id: string;
  lead_id: string;
  title: string;
  description: string | null;
  due_date: string;
  is_completed: boolean;
  lead?: {
    full_name: string;
    email: string;
  };
}

interface RecentActivity {
  id: string;
  lead_id: string;
  type: string;
  description: string;
  created_at: string;
  lead?: {
    full_name: string;
  };
}

const METHOD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  phone: Phone,
  mail: Mail,
  "message-circle": MessageCircle,
  video: Video,
};

export default function SalespersonDashboard() {
  const { t } = useTranslation("leadManagement");
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch leads for current salesperson
  const fetchLeads = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          source_data:lead_sources(id, name)
        `)
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error(t("failedToFetchLeads"));
    }
  }, [t]);

  // Fetch reminders
  const fetchReminders = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("lead_reminders")
        .select(`
          *,
          lead:leads(full_name, email)
        `)
        .eq("created_by", user.id)
        .eq("is_completed", false)
        .order("due_date", { ascending: true })
        .limit(10);

      if (error) throw error;
      setReminders(data || []);
    } catch (error) {
      console.error("Error fetching reminders:", error);
    }
  }, []);

  // Fetch recent activity
  const fetchRecentActivity = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get lead IDs for this salesperson
      const { data: leadIds } = await supabase
        .from("leads")
        .select("id")
        .eq("assigned_to", user.id);

      if (!leadIds || leadIds.length === 0) {
        setRecentActivity([]);
        return;
      }

      const ids = leadIds.map(l => l.id);

      const { data, error } = await supabase
        .from("lead_history")
        .select(`
          *,
          lead:leads(full_name)
        `)
        .in("lead_id", ids)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentActivity(data || []);
    } catch (error) {
      console.error("Error fetching activity:", error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchLeads(), fetchReminders(), fetchRecentActivity()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchLeads, fetchReminders, fetchRecentActivity]);

  // Calculate stats
  const stats = useMemo(() => calculateSalespersonStats(leads), [leads]);
  
  // Calculate previous period stats for comparison
  const previousStats = useMemo(() => {
    const now = new Date();
    const prevMonth = subMonths(now, 1);
    return calculatePreviousPeriodStats(
      leads.map(l => ({ ...l, created_at: l.created_at })),
      startOfMonth(prevMonth),
      endOfMonth(prevMonth)
    );
  }, [leads]);

  // Upcoming reminders (due today or in the future)
  const upcomingReminders = useMemo(() => {
    return reminders.filter(r => {
      const dueDate = parseISO(r.due_date);
      return isToday(dueDate) || isFuture(dueDate);
    }).slice(0, 5);
  }, [reminders]);

  // Overdue reminders
  const overdueReminders = useMemo(() => {
    return reminders.filter(r => {
      const dueDate = parseISO(r.due_date);
      return isPast(dueDate) && !isToday(dueDate);
    });
  }, [reminders]);

  // Handle KPI card click
  const handleKPICardClick = useCallback((action: KPICardAction) => {
    if (action.type === "analytics") {
      setActiveTab("analytics");
    } else if (action.type === "filter") {
      if (action.status) {
        router.push(`/admin/salesperson/leads?status=${action.status}`);
      } else if (action.paid) {
        router.push(`/admin/salesperson/leads?paid=true`);
      }
    } else {
      router.push("/admin/salesperson/leads");
    }
  }, [router]);

  // Handle chart click
  const handleChartClick = useCallback((action: { type: string; value: string; status?: LeadStatus }) => {
    if (action.type === "status" && action.status) {
      router.push(`/admin/salesperson/leads?status=${action.status}`);
    } else if (action.type === "source") {
      router.push(`/admin/salesperson/leads?source=${action.value}`);
    } else if (action.type === "month") {
      // Could filter by month if we add that to the leads page
      router.push("/admin/salesperson/leads");
    }
  }, [router]);

  // Quick actions
  const quickActions = [
    {
      label: t("viewAllLeads", "View All Leads"),
      icon: Users,
      href: "/admin/salesperson/leads",
      color: "bg-[#0C5536]",
    },
    {
      label: t("calendar", "Calendar"),
      icon: Calendar,
      href: "/admin/salesperson/calendar",
      color: "bg-[#2563EB]",
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center gap-3 mb-2">
          <Target className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
          <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
            {t("salesDashboard", "Sales Dashboard")}
          </h1>
        </div>
        <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
          {t("salesDashboardDescription", "Track your performance, manage leads, and stay on top of your sales pipeline")}
        </p>
      </div>

      {/* Stats Cards */}
      <SalespersonStatsCard 
        stats={stats} 
        previousStats={previousStats}
        isLoading={isLoading} 
        onCardClick={handleKPICardClick}
      />

      {/* Quick Actions */}
      <div className="flex gap-3">
        {quickActions.map((action) => (
          <Button
            key={action.href}
            onClick={() => router.push(action.href)}
            className={`${action.color} hover:opacity-90 text-white`}
          >
            <action.icon className="h-4 w-4 mr-2" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border border-[#E6E6E4] p-1.5 rounded-xl">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-[#555555] font-medium transition-all"
          >
            <Users className="h-4 w-4 mr-2" />
            {t("overview", "Overview")}
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-[#555555] font-medium transition-all"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {t("analytics", "Analytics")}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Overdue Reminders Alert */}
            {overdueReminders.length > 0 && (
              <Card className="md:col-span-2 border-[#C0392B]/30 bg-[#FEECEC]/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-[#C0392B]" />
                      <CardTitle className="text-lg font-semibold text-[#C0392B]">
                        {t("overdueReminders", "Overdue Reminders")} ({overdueReminders.length})
                      </CardTitle>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => router.push("/admin/salesperson/leads")}
                      className="text-[#C0392B] border-[#C0392B]/30 hover:bg-[#FEECEC]"
                    >
                      {t("viewAll", "View All")}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {overdueReminders.slice(0, 3).map((reminder) => (
                      <div 
                        key={reminder.id} 
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#C0392B]/20"
                      >
                        <div>
                          <p className="font-medium text-[#222222]">{reminder.title}</p>
                          <p className="text-sm text-[#6B6B6B]">
                            {reminder.lead?.full_name} • {differenceInDays(new Date(), parseISO(reminder.due_date))} days overdue
                          </p>
                        </div>
                        <Badge className="bg-[#FEECEC] text-[#C0392B] border-0">
                          {t("overdue", "Overdue")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upcoming Reminders */}
            <Card className="border-[#E6E6E4]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                    <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                      {t("upcomingReminders", "Upcoming Reminders")}
                    </CardTitle>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => router.push("/admin/salesperson/calendar")}
                    className="text-[#0C5536]"
                  >
                    {t("viewCalendar", "View Calendar")}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {upcomingReminders.length === 0 ? (
                  <div className="text-center py-8">
                    <Bell className="h-8 w-8 mx-auto mb-2 text-[#C6A03B]" />
                    <p className="text-[#6B6B6B]">{t("noUpcomingReminders", "No upcoming reminders")}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingReminders.map((reminder) => {
                      const dueDate = parseISO(reminder.due_date);
                      const isOverdue = isPast(dueDate) && !isToday(dueDate);
                      const isDueToday = isToday(dueDate);
                      
                      return (
                        <div 
                          key={reminder.id} 
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isOverdue 
                              ? "bg-[#FEECEC] border-[#C0392B]/20" 
                              : isDueToday 
                                ? "bg-[#FFF9E6] border-[#C6A03B]/20" 
                                : "bg-[#FAFAF8] border-[#E6E6E4]"
                          }`}
                        >
                          <div>
                            <p className="font-medium text-[#222222]">{reminder.title}</p>
                            <p className="text-sm text-[#6B6B6B]">
                              {reminder.lead?.full_name}
                            </p>
                          </div>
                          <Badge className={
                            isOverdue 
                              ? "bg-[#FEECEC] text-[#C0392B] border-0" 
                              : isDueToday 
                                ? "bg-[#FFF9E6] text-[#C6A03B] border-0" 
                                : "bg-[#E6F7F1] text-[#0C5536] border-0"
                          }>
                            {isDueToday ? t("today", "Today") : format(dueDate, "MMM d")}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="border-[#E6E6E4]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                    <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                      {t("recentActivity", "Recent Activity")}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-[#C6A03B]" />
                    <p className="text-[#6B6B6B]">{t("noRecentActivity", "No recent activity")}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.slice(0, 5).map((activity) => (
                      <div 
                        key={activity.id} 
                        className="flex items-start gap-3 p-3 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]"
                      >
                        <div className="h-8 w-8 rounded-full bg-[rgba(198,160,59,0.15)] flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="h-4 w-4 text-[#0C5536]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#222222] truncate">
                            {activity.description}
                          </p>
                          <p className="text-xs text-[#6B6B6B]">
                            {activity.lead?.full_name} • {format(parseISO(activity.created_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Performance Summary */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("performanceSummary", "Performance Summary")}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-[#FAFAF8] rounded-lg">
                  <p className="text-2xl font-bold text-[#0C5536]">{stats.conversionRate.toFixed(1)}%</p>
                  <p className="text-sm text-[#6B6B6B]">{t("conversionRate", "Conversion Rate")}</p>
                </div>
                <div className="text-center p-4 bg-[#FAFAF8] rounded-lg">
                  <p className="text-2xl font-bold text-[#0C5536]">
                    {stats.total > 0 ? Math.round(stats.totalRevenue / Math.max(stats.won, 1)).toLocaleString() : 0}
                  </p>
                  <p className="text-sm text-[#6B6B6B]">{t("avgDealValue", "Avg Deal Value")}</p>
                </div>
                <div className="text-center p-4 bg-[#FAFAF8] rounded-lg">
                  <p className="text-2xl font-bold text-[#0C5536]">{stats.inProgress}</p>
                  <p className="text-sm text-[#6B6B6B]">{t("activePipeline", "Active Pipeline")}</p>
                </div>
                <div className="text-center p-4 bg-[#FAFAF8] rounded-lg">
                  <p className="text-2xl font-bold text-[#0C5536]">{stats.pending}</p>
                  <p className="text-sm text-[#6B6B6B]">{t("pendingDeals", "Pending Deals")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <SalesAnalyticsCharts 
            leads={leads} 
            isLoading={isLoading}
            onChartClick={handleChartClick}
          />
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[#E6E6E4] text-center">
        <p className="text-xs text-[#777777]">
          {t("legalNotice", "© 2024 Just Wills. All rights reserved.")}
        </p>
      </div>
    </div>
  );
}
