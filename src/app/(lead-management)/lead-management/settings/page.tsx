"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Settings,
  Bell,
  Mail,
  Users,
  Zap,
  Save,
  Loader2,
  Send,
  Eye,
  Clock,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  PhoneOff,
  Info,
  User,
  Lock,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ALL_FAILED_OUTCOMES,
  DEFAULT_LEAD_AUTOMATION,
  DEFAULT_LEAD_CADENCE,
  DEFAULT_LEAD_NOTIFICATIONS,
  DEFAULT_LEAD_TEAM,
  DEFAULT_LEAD_TEMPLATES,
  LEAD_SETTINGS_WRITE_ROLES,
  type LeadAutomationRule,
  type LeadCadenceSettings,
  type LeadEmailTemplate,
  type LeadNotificationSettings,
  type LeadTeamSettings,
} from "@/lib/lead-management/settingsTypes";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { OutlookConnectionCard } from "@/components/integrations/OutlookConnectionCard";

// Types and defaults are shared with the API routes and the server-side
// senders (src/lib/lead-management/settingsTypes.ts) so what this page renders
// and what the server falls back to can never drift apart.
type NotificationSettings = LeadNotificationSettings;
type EmailTemplate = LeadEmailTemplate;
type AutomationRule = LeadAutomationRule;
type TeamSettings = LeadTeamSettings;
type CadenceSettings = LeadCadenceSettings;

const DEFAULT_CADENCE_SETTINGS = DEFAULT_LEAD_CADENCE;
const DEFAULT_TEMPLATES = DEFAULT_LEAD_TEMPLATES;
const DEFAULT_AUTOMATION_RULES = DEFAULT_LEAD_AUTOMATION.rules;

export default function LeadManagementSettings() {
  const { t } = useTranslation(["leadManagement", "common", "portal"]);
  const { profile, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("account");

  // Only these roles may WRITE. Salespeople see every control, disabled —
  // nothing is hidden and the layout is unchanged. The real gate is
  // server-side in each PUT route; this is only so the UI does not invite a
  // click that would 403.
  const canWrite = (profile?.roles || []).some((role) =>
    (LEAD_SETTINGS_WRITE_ROLES as readonly string[]).includes(role)
  );

  // Notification settings state
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>(DEFAULT_LEAD_NOTIFICATIONS);

  // Email templates state
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  // Automation rules state
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>(DEFAULT_AUTOMATION_RULES);

  // Team settings state
  const [teamSettings, setTeamSettings] = useState<TeamSettings>(DEFAULT_LEAD_TEAM);

  // Threshold for the "stale leads" automation rule (permitted UI addition).
  const [staleLeadDays, setStaleLeadDays] = useState<number>(
    DEFAULT_LEAD_AUTOMATION.staleLeadDays
  );

  // Cadence settings state
  const [cadenceSettings, setCadenceSettings] = useState<CadenceSettings>(DEFAULT_CADENCE_SETTINGS);

  // Load the org-wide settings from the database. These used to live in
  // localStorage, which meant every browser had its own private copy and no
  // server code could ever read them. Old localStorage values are deliberately
  // not migrated — the DB rows are seeded with clean defaults instead.
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const [notifications, templates, automation, team, cadence] = await Promise.all([
          fetch("/api/lead-management/settings/notifications").then((r) => r.json()),
          fetch("/api/lead-management/settings/email-templates").then((r) => r.json()),
          fetch("/api/lead-management/settings/automation").then((r) => r.json()),
          fetch("/api/lead-management/settings/team").then((r) => r.json()),
          fetch("/api/lead-management/settings/followup-cadence").then((r) => r.json()),
        ]);

        if (notifications?.data) setNotificationSettings(notifications.data);
        if (templates?.data?.templates) setEmailTemplates(templates.data.templates);
        if (automation?.data?.rules) setAutomationRules(automation.data.rules);
        if (typeof automation?.data?.staleLeadDays === "number") {
          setStaleLeadDays(automation.data.staleLeadDays);
        }
        if (team?.data) setTeamSettings(team.data);
        if (cadence?.data) setCadenceSettings(cadence.data);
      } catch (error) {
        console.error("Error loading settings:", error);
        toast.error(t("failedToLoadSettings", "Failed to load settings"));
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, [t]);

  // Save settings. One PUT per group; every route re-checks the caller's role
  // server-side, so a salesperson who bypasses the disabled controls still
  // gets a 403.
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const headers = {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      };

      const groups: { url: string; body: unknown }[] = [
        { url: "/api/lead-management/settings/notifications", body: notificationSettings },
        { url: "/api/lead-management/settings/email-templates", body: { templates: emailTemplates } },
        { url: "/api/lead-management/settings/automation", body: { rules: automationRules, staleLeadDays } },
        { url: "/api/lead-management/settings/team", body: teamSettings },
        { url: "/api/lead-management/settings/followup-cadence", body: cadenceSettings },
      ];

      const results = await Promise.all(
        groups.map(async (group) => {
          const response = await fetch(group.url, {
            method: "PUT",
            headers,
            body: JSON.stringify(group.body),
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || `Failed to save ${group.url}`);
          }
          return response.json();
        })
      );

      // Adopt the server's normalised values so the screen shows exactly what
      // was stored (e.g. the stale rule's trigger text tracking the threshold).
      if (results[2]?.data?.rules) setAutomationRules(results[2].data.rules);

      toast.success(t("settingsSaved", "Settings saved successfully"));
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("failedToSaveSettings", "Failed to save settings")
      );
    } finally {
      setIsSaving(false);
    }
  }, [notificationSettings, emailTemplates, automationRules, staleLeadDays, teamSettings, cadenceSettings, t]);

  // Toggle automation rule
  const toggleAutomationRule = (ruleId: string) => {
    setAutomationRules(rules => 
      rules.map(rule => 
        rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule
      )
    );
  };

  // Toggle email template
  const toggleEmailTemplate = (templateId: string) => {
    setEmailTemplates(templates => 
      templates.map(template => 
        template.id === templateId ? { ...template, isActive: !template.isActive } : template
      )
    );
  };

  // Update email template
  const updateEmailTemplate = (templateId: string, updates: Partial<EmailTemplate>) => {
    setEmailTemplates(templates => 
      templates.map(template => 
        template.id === templateId ? { ...template, ...updates } : template
      )
    );
    if (selectedTemplate?.id === templateId) {
      setSelectedTemplate({ ...selectedTemplate, ...updates });
    }
  };

  // Send test email. This used to be a lie — it only showed a toast. It now
  // actually renders the template (including any unsaved edits on screen) and
  // sends it to the signed-in user's own address.
  const [isTesting, setIsTesting] = useState(false);
  const sendTestEmail = async (templateId: string) => {
    const template = emailTemplates.find((item) => item.id === templateId);
    setIsTesting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const response = await fetch("/api/lead-management/settings/test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          templateId,
          subject: template?.subject,
          body: template?.body,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to send test email");
      }
      toast.success(t("testEmailSent", "Test email sent to your address"));
    } catch (error) {
      console.error("Error sending test email:", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("failedToSendTestEmail", "Failed to send test email")
      );
    } finally {
      setIsTesting(false);
    }
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
              {t("settingsDescription", "Configure lead management preferences and automation")}
            </p>
          </div>
          <Button 
            onClick={handleSave}
            disabled={isSaving || isLoading || !canWrite}
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
        <TabsList className="bg-white border border-[#E6E6E4] p-1.5 rounded-xl w-full grid grid-cols-5 h-auto">
          <TabsTrigger
            value="account"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-[#555555] font-medium transition-all"
          >
            <User className="h-4 w-4 mr-2" />
            {t("common:account", "Account")}
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-[#555555] font-medium transition-all"
          >
            <Bell className="h-4 w-4 mr-2" />
            {t("leadManagement:notifications", "Notifications")}
          </TabsTrigger>
          <TabsTrigger
            value="templates"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-[#555555] font-medium transition-all"
          >
            <Mail className="h-4 w-4 mr-2" />
            {t("emailTemplates", "Email Templates")}
          </TabsTrigger>
          <TabsTrigger
            value="automation"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-[#555555] font-medium transition-all"
          >
            <Zap className="h-4 w-4 mr-2" />
            {t("automation", "Automation")}
          </TabsTrigger>
          <TabsTrigger
            value="team"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-[#555555] font-medium transition-all"
          >
            <Users className="h-4 w-4 mr-2" />
            {t("teamSettings", "Team")}
          </TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <OutlookConnectionCard />
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("common:accountInformation", "Account Information")}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-[#555555] text-sm">{t("common:fullName", "Full Name")}</Label>
                  <p className="mt-1 text-[#222222] font-medium">{profile?.full_name || t("common:notAvailable", "N/A")}</p>
                </div>
                <div>
                  <Label className="text-[#555555] text-sm flex items-center gap-1">
                    <Mail className="h-3 w-3 text-[#C6A03B]" />
                    {t("common:email", "Email")}
                  </Label>
                  <p className="mt-1 text-[#222222] font-medium">{user?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("portal:settings.changePassword", "Change Password")}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("emailNotifications", "Email Notifications")}
                </CardTitle>
              </div>
              <CardDescription className="text-[#777777]">
                {t("emailNotificationsDescription", "Choose which events trigger email notifications")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-[#E6E6E4]">
                <div>
                  <Label className="text-[#222222] font-medium">{t("newLeadAssigned", "New Lead Assigned")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("newLeadAssignedDesc", "Get notified when a lead is assigned to you")}</p>
                </div>
                <Switch 
                  disabled={!canWrite}
                  checked={notificationSettings.emailNewLeadAssigned}
                  onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, emailNewLeadAssigned: checked }))}
                />
              </div>
              <div className="flex items-center justify-between py-3 border-b border-[#E6E6E4]">
                <div>
                  <Label className="text-[#222222] font-medium">{t("statusChanges", "Status Changes")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("statusChangesDesc", "Get notified when a lead status changes")}</p>
                </div>
                <Switch 
                  disabled={!canWrite}
                  checked={notificationSettings.emailStatusChanges}
                  onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, emailStatusChanges: checked }))}
                />
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <Label className="text-[#222222] font-medium">{t("remindersDue", "Reminders Due")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("remindersDueDesc", "Get notified when reminders are due")}</p>
                </div>
                <Switch 
                  disabled={!canWrite}
                  checked={notificationSettings.emailReminders}
                  onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, emailReminders: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("notificationFrequency", "Notification Frequency")}
                </CardTitle>
              </div>
              <CardDescription className="text-[#777777]">
                {t("notificationFrequencyDescription", "How often should we send notification digests?")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select 
                value={notificationSettings.notificationFrequency} 
                onValueChange={(value: "immediate" | "daily" | "weekly") => 
                  setNotificationSettings(prev => ({ ...prev, notificationFrequency: value }))
                }
              >
                <SelectTrigger disabled={!canWrite} className="w-[300px] border-[#E6E6E4]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">{t("immediate", "Immediate (Real-time)")}</SelectItem>
                  <SelectItem value="daily">{t("dailyDigest", "Daily Digest")}</SelectItem>
                  <SelectItem value="weekly">{t("weeklyDigest", "Weekly Digest")}</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("browserNotifications", "Browser Notifications")}
                </CardTitle>
              </div>
              <CardDescription className="text-[#777777]">
                {t("browserNotificationsDescription", "Receive push notifications in your browser")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-[#222222] font-medium">{t("enableBrowserNotifications", "Enable Browser Notifications")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("browserNotificationsNote", "You may need to allow notifications in your browser")}</p>
                </div>
                <Switch 
                  disabled={!canWrite}
                  checked={notificationSettings.browserNotifications}
                  onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, browserNotifications: checked }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Template List */}
            <Card className="border-[#E6E6E4]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                  <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                    {t("templates", "Templates")}
                  </CardTitle>
                </div>
                <CardDescription className="text-[#777777]">
                  {t("templatesDescription", "Select a template to edit")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {emailTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedTemplate?.id === template.id
                        ? "border-[#C6A03B] bg-[#FFF9E6]"
                        : "border-[#E6E6E4] hover:bg-[#FAFAF8]"
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="flex items-center gap-3">
                      <Mail className={`h-4 w-4 ${template.isActive ? "text-[#0C5536]" : "text-[#999999]"}`} />
                      <div>
                        <p className="font-medium text-[#222222]">{template.name}</p>
                        <p className="text-xs text-[#6B6B6B] truncate max-w-[200px]">{template.subject}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={template.isActive ? "bg-[#E6F7F1] text-[#0C5536] border-0" : "bg-[#F5F5F5] text-[#6B6B6B] border-0"}>
                        {template.isActive ? t("active", "Active") : t("inactive", "Inactive")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Template Editor */}
            <Card className="border-[#E6E6E4]">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                    <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                      {t("editTemplate", "Edit Template")}
                    </CardTitle>
                  </div>
                  {selectedTemplate && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendTestEmail(selectedTemplate.id)}
                        disabled={!canWrite || isTesting}
                        className="border-[#E6E6E4]"
                      >
                        <Send className="h-4 w-4 mr-1" />
                        {t("testSend", "Test")}
                      </Button>
                      <Switch 
                        disabled={!canWrite}
                        checked={selectedTemplate.isActive}
                        onCheckedChange={(checked) => toggleEmailTemplate(selectedTemplate.id)}
                      />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedTemplate ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-[#222222]">{t("subject", "Subject")}</Label>
                      <Input
                        disabled={!canWrite}
                        value={selectedTemplate.subject}
                        onChange={(e) => updateEmailTemplate(selectedTemplate.id, { subject: e.target.value })}
                        className="mt-1 border-[#E6E6E4]"
                      />
                    </div>
                    <div>
                      <Label className="text-[#222222]">{t("body", "Body")}</Label>
                      <Textarea
                        disabled={!canWrite}
                        value={selectedTemplate.body}
                        onChange={(e) => updateEmailTemplate(selectedTemplate.id, { body: e.target.value })}
                        className="mt-1 border-[#E6E6E4] min-h-[200px] font-mono text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[#222222]">{t("availableVariables", "Available Variables")}</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedTemplate.variables.map((variable) => (
                          <Badge key={variable} variant="outline" className="font-mono text-xs">
                            {"{{" + variable + "}}"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-[#6B6B6B]">
                    <Mail className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
                    <p>{t("selectTemplateToEdit", "Select a template to edit")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-6">
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                  <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                    {t("automationRules", "Automation Rules")}
                  </CardTitle>
                </div>
              </div>
              <CardDescription className="text-[#777777]">
                {t("automationRulesDescription", "Configure automatic actions based on triggers")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {automationRules.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    rule.isActive 
                      ? "border-[#0C5536]/20 bg-[#E6F7F1]/30" 
                      : "border-[#E6E6E4] bg-[#FAFAF8]"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      rule.isActive ? "bg-[#E6F7F1]" : "bg-[#F5F5F5]"
                    }`}>
                      <Zap className={`h-5 w-5 ${rule.isActive ? "text-[#0C5536]" : "text-[#999999]"}`} />
                    </div>
                    <div>
                      <p className="font-medium text-[#222222]">{rule.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs font-normal">
                          {t("trigger", "Trigger")}: {rule.trigger}
                        </Badge>
                        <span className="text-[#6B6B6B]">→</span>
                        <Badge variant="outline" className="text-xs font-normal">
                          {t("action", "Action")}: {rule.action}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {rule.id === "auto_reminder_7days" && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          disabled={!canWrite}
                          value={staleLeadDays}
                          onChange={(e) => setStaleLeadDays(parseInt(e.target.value) || 7)}
                          className="w-20 border-[#E6E6E4]"
                        />
                        <span className="text-sm text-[#6B6B6B]">{t("days", "days")}</span>
                      </div>
                    )}
                    <Badge className={rule.isActive ? "bg-[#E6F7F1] text-[#0C5536] border-0" : "bg-[#F5F5F5] text-[#6B6B6B] border-0"}>
                      {rule.isActive ? t("active", "Active") : t("inactive", "Inactive")}
                    </Badge>
                    <Switch 
                      disabled={!canWrite}
                      checked={rule.isActive}
                      onCheckedChange={() => toggleAutomationRule(rule.id)}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Contact Cadence Settings */}
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <PhoneOff className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("contactCadence", "Contact Cadence")}
                </CardTitle>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger>
                    <span className="inline-flex items-center justify-center cursor-help">
                      <Info className="h-4 w-4 text-[#999999]" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[280px] text-xs leading-relaxed">
                    {t("contactCadenceTooltip", "When a call results in a failed outcome (e.g. no answer, busy), the system counts consecutive failures. Once the count reaches the maximum attempts, the lead is automatically marked as unreachable.")}
                  </TooltipContent>
                </Tooltip>
              </div>
              <CardDescription className="text-[#777777]">
                {t("contactCadenceDescription", "Configure automatic handling of failed contact attempts")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[#222222]">{t("maxContactAttempts", "Maximum Contact Attempts")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    disabled={!canWrite}
                    value={cadenceSettings.maxAttempts}
                    onChange={(e) => setCadenceSettings(prev => ({ ...prev, maxAttempts: parseInt(e.target.value) || 3 }))}
                    className="border-[#E6E6E4]"
                  />
                  <p className="text-xs text-[#6B6B6B]">{t("maxAttemptsHint", "Number of failed attempts before marking unreachable")}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#222222]">{t("daysBetweenAttempts", "Days Between Attempts")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    disabled={!canWrite}
                    value={cadenceSettings.intervalDays}
                    onChange={(e) => setCadenceSettings(prev => ({ ...prev, intervalDays: parseInt(e.target.value) || 2 }))}
                    className="border-[#E6E6E4]"
                  />
                  <p className="text-xs text-[#6B6B6B]">{t("intervalDaysHint", "Recommended gap between contact attempts")}</p>
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border-t border-[#E6E6E4]">
                <div>
                  <Label className="text-[#222222] font-medium">{t("autoMarkUnreachable", "Auto-mark as unreachable")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("autoMarkUnreachableDesc", "Automatically change lead status to unreachable after max attempts")}</p>
                </div>
                <Switch
                  disabled={!canWrite}
                  checked={cadenceSettings.autoMarkUnreachable}
                  onCheckedChange={(checked) => setCadenceSettings(prev => ({ ...prev, autoMarkUnreachable: checked }))}
                />
              </div>

              <div className="border-t border-[#E6E6E4] pt-4">
                <Label className="text-[#222222] font-medium mb-3 block">{t("failedOutcomes", "Call outcomes counted as failed")}</Label>
                <div className="grid grid-cols-2 gap-3">
                  {ALL_FAILED_OUTCOMES.map((outcome) => (
                    <div key={outcome.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`outcome_${outcome.value}`}
                        disabled={!canWrite}
                        checked={cadenceSettings.failedOutcomes.includes(outcome.value)}
                        onCheckedChange={(checked) => {
                          setCadenceSettings(prev => ({
                            ...prev,
                            failedOutcomes: checked
                              ? [...prev.failedOutcomes, outcome.value]
                              : prev.failedOutcomes.filter(o => o !== outcome.value),
                          }));
                        }}
                      />
                      <label
                        htmlFor={`outcome_${outcome.value}`}
                        className="text-sm text-[#555555] cursor-pointer"
                      >
                        {t(`callOutcome_${outcome.value}`, outcome.label)}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* Team Settings Tab */}
        <TabsContent value="team" className="space-y-6">
          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("leadAssignment", "Lead Assignment")}
                </CardTitle>
              </div>
              <CardDescription className="text-[#777777]">
                {t("leadAssignmentDescription", "Configure how new leads are assigned to salespeople")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-[#222222]">{t("defaultAssignmentMethod", "Default Assignment Method")}</Label>
                <Select 
                  value={teamSettings.defaultAssignmentMethod} 
                  onValueChange={(value: "round_robin" | "manual" | "by_source") => 
                    setTeamSettings(prev => ({ ...prev, defaultAssignmentMethod: value }))
                  }
                >
                  <SelectTrigger disabled={!canWrite} className="w-full mt-1 border-[#E6E6E4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="by_source">{t("bySource", "By Source (Based on source assignment)")}</SelectItem>
                    <SelectItem value="round_robin">{t("roundRobin", "Round Robin (Distribute evenly)")}</SelectItem>
                    <SelectItem value="manual">{t("manualAssignment", "Manual (Assign individually)")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-3 border-t border-[#E6E6E4]">
                <div>
                  <Label className="text-[#222222] font-medium">{t("autoAssignNewLeads", "Auto-assign New Leads")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("autoAssignNewLeadsDesc", "Automatically assign new leads based on the method above")}</p>
                </div>
                <Switch 
                  disabled={!canWrite}
                  checked={teamSettings.autoAssignNewLeads}
                  onCheckedChange={(checked) => setTeamSettings(prev => ({ ...prev, autoAssignNewLeads: checked }))}
                />
              </div>

              <div className="flex items-center justify-between py-3 border-t border-[#E6E6E4]">
                <div>
                  <Label className="text-[#222222] font-medium">{t("notifyOnAssignment", "Notify on Assignment")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("notifyOnAssignmentDesc", "Send email when a lead is assigned")}</p>
                </div>
                <Switch 
                  disabled={!canWrite}
                  checked={teamSettings.notifyOnAssignment}
                  onCheckedChange={(checked) => setTeamSettings(prev => ({ ...prev, notifyOnAssignment: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E6E6E4]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-lg font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("workingHours", "Working Hours")}
                </CardTitle>
              </div>
              <CardDescription className="text-[#777777]">
                {t("workingHoursDescription", "Set the team's working hours for scheduling")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-[#222222]">{t("startTime", "Start Time")}</Label>
                  <Input
                    type="time"
                    disabled={!canWrite}
                    value={teamSettings.workingHoursStart}
                    onChange={(e) => setTeamSettings(prev => ({ ...prev, workingHoursStart: e.target.value }))}
                    className="mt-1 border-[#E6E6E4]"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-[#222222]">{t("endTime", "End Time")}</Label>
                  <Input
                    type="time"
                    disabled={!canWrite}
                    value={teamSettings.workingHoursEnd}
                    onChange={(e) => setTeamSettings(prev => ({ ...prev, workingHoursEnd: e.target.value }))}
                    className="mt-1 border-[#E6E6E4]"
                  />
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
