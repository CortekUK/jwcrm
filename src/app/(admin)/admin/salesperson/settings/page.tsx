"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Settings, 
  Bell, 
  Target, 
  Calendar, 
  User,
  Save,
  Loader2,
  Clock,
  ListFilter,
  Eye,
  TrendingUp,
  Award,
  Trophy,
  Link2,
  ExternalLink,
  Sparkles,
} from "lucide-react";

interface PersonalPreferences {
  defaultView: "table" | "kanban";
  itemsPerPage: number;
  defaultStatusFilter: string;
  defaultSourceFilter: string;
  showHealthIndicators: boolean;
  showCompactView: boolean;
}

interface ReminderSettings {
  defaultReminderTime: number; // hours before
  reminderChannels: {
    email: boolean;
    browser: boolean;
    inApp: boolean;
  };
  snoozeDurations: number[]; // in minutes
  autoCreateFollowUp: boolean;
  followUpDays: number;
}

interface PerformanceGoals {
  monthlyLeadTarget: number;
  monthlyConversionTarget: number;
  monthlyRevenueTarget: number;
  quarterlyLeadTarget: number;
  quarterlyConversionTarget: number;
  quarterlyRevenueTarget: number;
}

interface CalendarSettings {
  defaultMeetingDuration: number; // in minutes
  bufferBetweenMeetings: number; // in minutes
  workingDays: string[];
  preferredMeetingTimes: {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  };
}

export default function SalespersonSettings() {
  const { t } = useTranslation("salesperson");
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("preferences");

  // Personal preferences state
  const [personalPreferences, setPersonalPreferences] = useState<PersonalPreferences>({
    defaultView: "table",
    itemsPerPage: 10,
    defaultStatusFilter: "all",
    defaultSourceFilter: "all",
    showHealthIndicators: true,
    showCompactView: false,
  });

  // Reminder settings state
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
    defaultReminderTime: 24,
    reminderChannels: {
      email: true,
      browser: true,
      inApp: true,
    },
    snoozeDurations: [15, 30, 60, 240],
    autoCreateFollowUp: true,
    followUpDays: 7,
  });

  // Performance goals state
  const [performanceGoals, setPerformanceGoals] = useState<PerformanceGoals>({
    monthlyLeadTarget: 50,
    monthlyConversionTarget: 10,
    monthlyRevenueTarget: 50000,
    quarterlyLeadTarget: 150,
    quarterlyConversionTarget: 30,
    quarterlyRevenueTarget: 150000,
  });

  // Calendar settings state
  const [calendarSettings, setCalendarSettings] = useState<CalendarSettings>({
    defaultMeetingDuration: 30,
    bufferBetweenMeetings: 15,
    workingDays: ["mon", "tue", "wed", "thu"],
    preferredMeetingTimes: {
      morning: true,
      afternoon: true,
      evening: false,
    },
  });

  // Current stats for goal progress (would come from API)
  const [currentStats, setCurrentStats] = useState({
    monthlyLeads: 32,
    monthlyConversions: 6,
    monthlyRevenue: 34500,
    quarterlyLeads: 89,
    quarterlyConversions: 18,
    quarterlyRevenue: 98000,
  });

  // Load settings from localStorage
  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedPreferences = localStorage.getItem("salesperson_preferences");
        const savedReminders = localStorage.getItem("salesperson_reminders");
        const savedGoals = localStorage.getItem("salesperson_goals");
        const savedCalendar = localStorage.getItem("salesperson_calendar");

        if (savedPreferences) setPersonalPreferences(JSON.parse(savedPreferences));
        if (savedReminders) setReminderSettings(JSON.parse(savedReminders));
        if (savedGoals) setPerformanceGoals(JSON.parse(savedGoals));
        if (savedCalendar) setCalendarSettings(JSON.parse(savedCalendar));
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    loadSettings();
  }, []);

  // Save settings
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      localStorage.setItem("salesperson_preferences", JSON.stringify(personalPreferences));
      localStorage.setItem("salesperson_reminders", JSON.stringify(reminderSettings));
      localStorage.setItem("salesperson_goals", JSON.stringify(performanceGoals));
      localStorage.setItem("salesperson_calendar", JSON.stringify(calendarSettings));
      
      toast.success(t("settingsSaved", "Settings saved successfully"));
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(t("failedToSaveSettings", "Failed to save settings"));
    } finally {
      setIsSaving(false);
    }
  }, [personalPreferences, reminderSettings, performanceGoals, calendarSettings, t]);

  // Toggle working day
  const toggleWorkingDay = (day: string) => {
    setCalendarSettings(prev => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter(d => d !== day)
        : [...prev.workingDays, day],
    }));
  };

  // Calculate goal progress
  const calculateProgress = (current: number, target: number) => {
    return Math.min(Math.round((current / target) * 100), 100);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-white to-[#F8F6EC] border-b-2 border-[hsl(var(--jw-gold-accent))]/25 -mx-6 -mt-6 px-6 py-8 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Settings className="h-6 w-6 text-[hsl(var(--jw-gold-accent))]" />
              <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {t("settings", "Settings")}
              </h1>
            </div>
            <p className="text-sm text-[#777777] ltr:ml-9 rtl:mr-9">
              {t("settingsDescription", "Configure your sales preferences and notifications")}
            </p>
          </div>
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t("saveSettings", "Save Settings")}
          </Button>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border border-[#E6E6E4] p-1.5 rounded-xl">
          <TabsTrigger
            value="preferences"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-[#555555] font-medium transition-all"
          >
            <User className="h-4 w-4 mr-2" />
            {t("preferences", "Preferences")}
          </TabsTrigger>
          <TabsTrigger
            value="reminders"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-[#555555] font-medium transition-all"
          >
            <Bell className="h-4 w-4 mr-2" />
            {t("reminders", "Reminders")}
          </TabsTrigger>
          <TabsTrigger
            value="goals"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-[#555555] font-medium transition-all"
          >
            <Target className="h-4 w-4 mr-2" />
            {t("goals", "Goals")}
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-[#555555] font-medium transition-all"
          >
            <Calendar className="h-4 w-4 mr-2" />
            {t("calendar", "Calendar")}
          </TabsTrigger>
        </TabsList>

        {/* Personal Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("viewPreferences", "View Preferences")}
                </CardTitle>
              </div>
              <CardDescription className="text-[#777777]">
                {t("viewPreferencesDescription", "Customize how you view your leads and data")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-[#E6E6E4]">
                <div>
                  <Label className="text-[#222222] font-medium">{t("defaultView", "Default Lead View")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("defaultViewDesc", "Choose between table and kanban board views")}</p>
                </div>
                <Select 
                  value={personalPreferences.defaultView} 
                  onValueChange={(value: "table" | "kanban") => 
                    setPersonalPreferences(prev => ({ ...prev, defaultView: value }))
                  }
                >
                  <SelectTrigger className="w-[150px] border-[#E6E6E4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="table">{t("tableView", "Table View")}</SelectItem>
                    <SelectItem value="kanban">{t("kanbanView", "Kanban Board")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-[#E6E6E4]">
                <div>
                  <Label className="text-[#222222] font-medium">{t("itemsPerPage", "Items Per Page")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("itemsPerPageDesc", "Number of items shown per page")}</p>
                </div>
                <Select 
                  value={personalPreferences.itemsPerPage.toString()} 
                  onValueChange={(value) => 
                    setPersonalPreferences(prev => ({ ...prev, itemsPerPage: parseInt(value) }))
                  }
                >
                  <SelectTrigger className="w-[100px] border-[#E6E6E4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-[#E6E6E4]">
                <div>
                  <Label className="text-[#222222] font-medium">{t("showHealthIndicators", "Show Health Indicators")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("showHealthIndicatorsDesc", "Display lead health status badges")}</p>
                </div>
                <Switch 
                  checked={personalPreferences.showHealthIndicators}
                  onCheckedChange={(checked) => setPersonalPreferences(prev => ({ ...prev, showHealthIndicators: checked }))}
                />
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <Label className="text-[#222222] font-medium">{t("compactView", "Compact View")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("compactViewDesc", "Use condensed layout for more data")}</p>
                </div>
                <Switch 
                  checked={personalPreferences.showCompactView}
                  onCheckedChange={(checked) => setPersonalPreferences(prev => ({ ...prev, showCompactView: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <ListFilter className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("defaultFilters", "Default Filters")}
                </CardTitle>
              </div>
              <CardDescription className="text-[#777777]">
                {t("defaultFiltersDescription", "Set default filters when opening the leads page")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-[#222222]">{t("defaultStatusFilter", "Default Status Filter")}</Label>
                <Select 
                  value={personalPreferences.defaultStatusFilter} 
                  onValueChange={(value) => 
                    setPersonalPreferences(prev => ({ ...prev, defaultStatusFilter: value }))
                  }
                >
                  <SelectTrigger className="w-full mt-1 border-[#E6E6E4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allStatuses", "All Statuses")}</SelectItem>
                    <SelectItem value="not_started">{t("notStarted", "Not Started")}</SelectItem>
                    <SelectItem value="contacted">{t("contacted", "Contacted")}</SelectItem>
                    <SelectItem value="qualified">{t("qualified", "Qualified")}</SelectItem>
                    <SelectItem value="negotiation">{t("negotiation", "Negotiation")}</SelectItem>
                    <SelectItem value="pending">{t("pending", "Pending")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reminder Settings Tab */}
        <TabsContent value="reminders" className="space-y-6">
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("reminderDefaults", "Reminder Defaults")}
                </CardTitle>
              </div>
              <CardDescription className="text-[#777777]">
                {t("reminderDefaultsDescription", "Configure default reminder behavior")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-[#E6E6E4]">
                <div>
                  <Label className="text-[#222222] font-medium">{t("defaultReminderTime", "Default Reminder Time")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("defaultReminderTimeDesc", "How long before the event to remind")}</p>
                </div>
                <Select 
                  value={reminderSettings.defaultReminderTime.toString()} 
                  onValueChange={(value) => 
                    setReminderSettings(prev => ({ ...prev, defaultReminderTime: parseInt(value) }))
                  }
                >
                  <SelectTrigger className="w-[150px] border-[#E6E6E4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t("oneHour", "1 hour")}</SelectItem>
                    <SelectItem value="2">{t("twoHours", "2 hours")}</SelectItem>
                    <SelectItem value="24">{t("oneDay", "1 day")}</SelectItem>
                    <SelectItem value="48">{t("twoDays", "2 days")}</SelectItem>
                    <SelectItem value="168">{t("oneWeek", "1 week")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-[#E6E6E4]">
                <div>
                  <Label className="text-[#222222] font-medium">{t("autoCreateFollowUp", "Auto-create Follow-up")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("autoCreateFollowUpDesc", "Create follow-up reminder when marking complete")}</p>
                </div>
                <Switch 
                  checked={reminderSettings.autoCreateFollowUp}
                  onCheckedChange={(checked) => setReminderSettings(prev => ({ ...prev, autoCreateFollowUp: checked }))}
                />
              </div>

              {reminderSettings.autoCreateFollowUp && (
                <div className="flex items-center justify-between py-3 pl-6 border-b border-[#E6E6E4]">
                  <div>
                    <Label className="text-[#222222] font-medium">{t("followUpAfter", "Follow-up After")}</Label>
                    <p className="text-sm text-[#6B6B6B]">{t("followUpAfterDesc", "Days until follow-up reminder")}</p>
                  </div>
                  <Select 
                    value={reminderSettings.followUpDays.toString()} 
                    onValueChange={(value) => 
                      setReminderSettings(prev => ({ ...prev, followUpDays: parseInt(value) }))
                    }
                  >
                    <SelectTrigger className="w-[120px] border-[#E6E6E4]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">{t("days", "{{count}} days", { count: 3 })}</SelectItem>
                      <SelectItem value="7">{t("days", "{{count}} days", { count: 7 })}</SelectItem>
                      <SelectItem value="14">{t("days", "{{count}} days", { count: 14 })}</SelectItem>
                      <SelectItem value="30">{t("days", "{{count}} days", { count: 30 })}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("notificationChannels", "Notification Channels")}
                </CardTitle>
              </div>
              <CardDescription className="text-[#777777]">
                {t("notificationChannelsDescription", "Choose how you receive reminder notifications")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-[#E6E6E4]">
                <div>
                  <Label className="text-[#222222] font-medium">{t("emailNotifications", "Email")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("emailNotificationsDesc", "Receive reminders via email")}</p>
                </div>
                <Switch 
                  checked={reminderSettings.reminderChannels.email}
                  onCheckedChange={(checked) => setReminderSettings(prev => ({ 
                    ...prev, 
                    reminderChannels: { ...prev.reminderChannels, email: checked } 
                  }))}
                />
              </div>
              <div className="flex items-center justify-between py-3 border-b border-[#E6E6E4]">
                <div>
                  <Label className="text-[#222222] font-medium">{t("browserNotifications", "Browser")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("browserNotificationsDesc", "Receive browser push notifications")}</p>
                </div>
                <Switch 
                  checked={reminderSettings.reminderChannels.browser}
                  onCheckedChange={(checked) => setReminderSettings(prev => ({ 
                    ...prev, 
                    reminderChannels: { ...prev.reminderChannels, browser: checked } 
                  }))}
                />
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <Label className="text-[#222222] font-medium">{t("inAppNotifications", "In-App")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("inAppNotificationsDesc", "Show notifications in the app")}</p>
                </div>
                <Switch 
                  checked={reminderSettings.reminderChannels.inApp}
                  onCheckedChange={(checked) => setReminderSettings(prev => ({ 
                    ...prev, 
                    reminderChannels: { ...prev.reminderChannels, inApp: checked } 
                  }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Goals Tab */}
        <TabsContent value="goals" className="space-y-6">
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("monthlyGoals", "Monthly Goals")}
                </CardTitle>
              </div>
              <CardDescription className="text-[#777777]">
                {t("monthlyGoalsDescription", "Set your monthly performance targets")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[#222222] font-medium">{t("leadsTarget", "Leads Target")}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#0C5536] font-medium">{currentStats.monthlyLeads}</span>
                    <span className="text-sm text-[#6B6B6B]">/</span>
                    <Input
                      type="number"
                      value={performanceGoals.monthlyLeadTarget}
                      onChange={(e) => setPerformanceGoals(prev => ({ ...prev, monthlyLeadTarget: parseInt(e.target.value) || 0 }))}
                      className="w-20 border-[#E6E6E4] text-center"
                    />
                  </div>
                </div>
                <Progress 
                  value={calculateProgress(currentStats.monthlyLeads, performanceGoals.monthlyLeadTarget)} 
                  className="h-2"
                />
                <p className="text-xs text-[#6B6B6B]">{calculateProgress(currentStats.monthlyLeads, performanceGoals.monthlyLeadTarget)}% {t("achieved", "achieved")}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[#222222] font-medium">{t("conversionsTarget", "Conversions Target")}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#0C5536] font-medium">{currentStats.monthlyConversions}</span>
                    <span className="text-sm text-[#6B6B6B]">/</span>
                    <Input
                      type="number"
                      value={performanceGoals.monthlyConversionTarget}
                      onChange={(e) => setPerformanceGoals(prev => ({ ...prev, monthlyConversionTarget: parseInt(e.target.value) || 0 }))}
                      className="w-20 border-[#E6E6E4] text-center"
                    />
                  </div>
                </div>
                <Progress 
                  value={calculateProgress(currentStats.monthlyConversions, performanceGoals.monthlyConversionTarget)} 
                  className="h-2"
                />
                <p className="text-xs text-[#6B6B6B]">{calculateProgress(currentStats.monthlyConversions, performanceGoals.monthlyConversionTarget)}% {t("achieved", "achieved")}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[#222222] font-medium">{t("revenueTarget", "Revenue Target")}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#0C5536] font-medium">AED {currentStats.monthlyRevenue.toLocaleString()}</span>
                    <span className="text-sm text-[#6B6B6B]">/</span>
                    <div className="flex items-center">
                      <span className="text-sm text-[#6B6B6B] mr-1">AED</span>
                      <Input
                        type="number"
                        value={performanceGoals.monthlyRevenueTarget}
                        onChange={(e) => setPerformanceGoals(prev => ({ ...prev, monthlyRevenueTarget: parseInt(e.target.value) || 0 }))}
                        className="w-24 border-[#E6E6E4] text-center"
                      />
                    </div>
                  </div>
                </div>
                <Progress 
                  value={calculateProgress(currentStats.monthlyRevenue, performanceGoals.monthlyRevenueTarget)} 
                  className="h-2"
                />
                <p className="text-xs text-[#6B6B6B]">{calculateProgress(currentStats.monthlyRevenue, performanceGoals.monthlyRevenueTarget)}% {t("achieved", "achieved")}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("quarterlyGoals", "Quarterly Goals")}
                </CardTitle>
              </div>
              <CardDescription className="text-[#777777]">
                {t("quarterlyGoalsDescription", "Set your quarterly performance targets")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[#222222] font-medium">{t("leadsTarget", "Leads Target")}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#0C5536] font-medium">{currentStats.quarterlyLeads}</span>
                    <span className="text-sm text-[#6B6B6B]">/</span>
                    <Input
                      type="number"
                      value={performanceGoals.quarterlyLeadTarget}
                      onChange={(e) => setPerformanceGoals(prev => ({ ...prev, quarterlyLeadTarget: parseInt(e.target.value) || 0 }))}
                      className="w-20 border-[#E6E6E4] text-center"
                    />
                  </div>
                </div>
                <Progress 
                  value={calculateProgress(currentStats.quarterlyLeads, performanceGoals.quarterlyLeadTarget)} 
                  className="h-2"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[#222222] font-medium">{t("conversionsTarget", "Conversions Target")}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#0C5536] font-medium">{currentStats.quarterlyConversions}</span>
                    <span className="text-sm text-[#6B6B6B]">/</span>
                    <Input
                      type="number"
                      value={performanceGoals.quarterlyConversionTarget}
                      onChange={(e) => setPerformanceGoals(prev => ({ ...prev, quarterlyConversionTarget: parseInt(e.target.value) || 0 }))}
                      className="w-20 border-[#E6E6E4] text-center"
                    />
                  </div>
                </div>
                <Progress 
                  value={calculateProgress(currentStats.quarterlyConversions, performanceGoals.quarterlyConversionTarget)} 
                  className="h-2"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[#222222] font-medium">{t("revenueTarget", "Revenue Target")}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#0C5536] font-medium">AED {currentStats.quarterlyRevenue.toLocaleString()}</span>
                    <span className="text-sm text-[#6B6B6B]">/</span>
                    <div className="flex items-center">
                      <span className="text-sm text-[#6B6B6B] mr-1">AED</span>
                      <Input
                        type="number"
                        value={performanceGoals.quarterlyRevenueTarget}
                        onChange={(e) => setPerformanceGoals(prev => ({ ...prev, quarterlyRevenueTarget: parseInt(e.target.value) || 0 }))}
                        className="w-24 border-[#E6E6E4] text-center"
                      />
                    </div>
                  </div>
                </div>
                <Progress 
                  value={calculateProgress(currentStats.quarterlyRevenue, performanceGoals.quarterlyRevenueTarget)} 
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar Settings Tab */}
        <TabsContent value="calendar" className="space-y-6">
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("meetingDefaults", "Meeting Defaults")}
                </CardTitle>
              </div>
              <CardDescription className="text-[#777777]">
                {t("meetingDefaultsDescription", "Set default meeting configurations")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-[#E6E6E4]">
                <div>
                  <Label className="text-[#222222] font-medium">{t("defaultMeetingDuration", "Default Duration")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("defaultMeetingDurationDesc", "Default length of meetings")}</p>
                </div>
                <Select 
                  value={calendarSettings.defaultMeetingDuration.toString()} 
                  onValueChange={(value) => 
                    setCalendarSettings(prev => ({ ...prev, defaultMeetingDuration: parseInt(value) }))
                  }
                >
                  <SelectTrigger className="w-[150px] border-[#E6E6E4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">{t("minutes", "{{count}} minutes", { count: 15 })}</SelectItem>
                    <SelectItem value="30">{t("minutes", "{{count}} minutes", { count: 30 })}</SelectItem>
                    <SelectItem value="45">{t("minutes", "{{count}} minutes", { count: 45 })}</SelectItem>
                    <SelectItem value="60">{t("minutes", "{{count}} minutes", { count: 60 })}</SelectItem>
                    <SelectItem value="90">{t("minutes", "{{count}} minutes", { count: 90 })}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <Label className="text-[#222222] font-medium">{t("bufferTime", "Buffer Between Meetings")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("bufferTimeDesc", "Time between consecutive meetings")}</p>
                </div>
                <Select 
                  value={calendarSettings.bufferBetweenMeetings.toString()} 
                  onValueChange={(value) => 
                    setCalendarSettings(prev => ({ ...prev, bufferBetweenMeetings: parseInt(value) }))
                  }
                >
                  <SelectTrigger className="w-[150px] border-[#E6E6E4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t("noBuffer", "No buffer")}</SelectItem>
                    <SelectItem value="5">{t("minutes", "{{count}} minutes", { count: 5 })}</SelectItem>
                    <SelectItem value="10">{t("minutes", "{{count}} minutes", { count: 10 })}</SelectItem>
                    <SelectItem value="15">{t("minutes", "{{count}} minutes", { count: 15 })}</SelectItem>
                    <SelectItem value="30">{t("minutes", "{{count}} minutes", { count: 30 })}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("workingSchedule", "Working Schedule")}
                </CardTitle>
              </div>
              <CardDescription className="text-[#777777]">
                {t("workingScheduleDescription", "Set your preferred working days and times")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-[#222222] font-medium mb-3 block">{t("workingDays", "Working Days")}</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "sun", label: t("sunday", "Sun") },
                    { id: "mon", label: t("monday", "Mon") },
                    { id: "tue", label: t("tuesday", "Tue") },
                    { id: "wed", label: t("wednesday", "Wed") },
                    { id: "thu", label: t("thursday", "Thu") },
                    { id: "fri", label: t("friday", "Fri") },
                    { id: "sat", label: t("saturday", "Sat") },
                  ].map((day) => (
                    <Button
                      key={day.id}
                      variant="outline"
                      size="sm"
                      onClick={() => toggleWorkingDay(day.id)}
                      className={`px-4 transition-all ${
                        calendarSettings.workingDays.includes(day.id)
                          ? "bg-[#E6F7F1] text-[#0C5536] border-[#0C5536]/30"
                          : "border-[#E6E6E4] text-[#6B6B6B]"
                      }`}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#E6E6E4]">
                <Label className="text-[#222222] font-medium mb-3 block">{t("preferredTimes", "Preferred Meeting Times")}</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#555555]">{t("morning", "Morning")} (9:00 - 12:00)</span>
                    <Switch 
                      checked={calendarSettings.preferredMeetingTimes.morning}
                      onCheckedChange={(checked) => setCalendarSettings(prev => ({ 
                        ...prev, 
                        preferredMeetingTimes: { ...prev.preferredMeetingTimes, morning: checked } 
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#555555]">{t("afternoon", "Afternoon")} (12:00 - 17:00)</span>
                    <Switch 
                      checked={calendarSettings.preferredMeetingTimes.afternoon}
                      onCheckedChange={(checked) => setCalendarSettings(prev => ({ 
                        ...prev, 
                        preferredMeetingTimes: { ...prev.preferredMeetingTimes, afternoon: checked } 
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#555555]">{t("evening", "Evening")} (17:00 - 20:00)</span>
                    <Switch 
                      checked={calendarSettings.preferredMeetingTimes.evening}
                      onCheckedChange={(checked) => setCalendarSettings(prev => ({ 
                        ...prev, 
                        preferredMeetingTimes: { ...prev.preferredMeetingTimes, evening: checked } 
                      }))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("calendarIntegration", "Calendar Integration")}
                </CardTitle>
              </div>
              <CardDescription className="text-[#777777]">
                {t("calendarIntegrationDescription", "Sync with external calendar services")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-[#E6E6E4] bg-[#FAFAF8]">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center border border-[#E6E6E4]">
                      <Sparkles className="h-5 w-5 text-[#4285F4]" />
                    </div>
                    <div>
                      <p className="font-medium text-[#222222]">Google Calendar</p>
                      <p className="text-sm text-[#6B6B6B]">{t("googleCalendarDesc", "Sync your events with Google Calendar")}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="border-[#E6E6E4]">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t("connect", "Connect")}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-[#E6E6E4] bg-[#FAFAF8]">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center border border-[#E6E6E4]">
                      <Calendar className="h-5 w-5 text-[#0078D4]" />
                    </div>
                    <div>
                      <p className="font-medium text-[#222222]">Outlook Calendar</p>
                      <p className="text-sm text-[#6B6B6B]">{t("outlookCalendarDesc", "Sync your events with Outlook")}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="border-[#E6E6E4]">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t("connect", "Connect")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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
