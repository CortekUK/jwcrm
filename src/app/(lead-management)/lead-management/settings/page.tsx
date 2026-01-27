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
} from "lucide-react";

interface NotificationSettings {
  emailNewLeadAssigned: boolean;
  emailStatusChanges: boolean;
  emailReminders: boolean;
  emailProposalViewed: boolean;
  browserNotifications: boolean;
  notificationFrequency: "immediate" | "daily" | "weekly";
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  isActive: boolean;
}

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  isActive: boolean;
}

interface TeamSettings {
  defaultAssignmentMethod: "round_robin" | "manual" | "by_source";
  workingHoursStart: string;
  workingHoursEnd: string;
  autoAssignNewLeads: boolean;
  notifyOnAssignment: boolean;
}

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: "proposal",
    name: "Proposal Email",
    subject: "Your Proposal from Just Wills - {{invoice_number}}",
    body: "Dear {{lead_name}},\n\nThank you for your interest in our services. Please find attached your personalized proposal.\n\nProposal Amount: {{amount}}\n\nIf you have any questions, please don't hesitate to contact us.\n\nBest regards,\n{{salesperson_name}}",
    variables: ["lead_name", "invoice_number", "amount", "salesperson_name"],
    isActive: true,
  },
  {
    id: "reminder",
    name: "Reminder Email",
    subject: "Reminder: {{reminder_title}}",
    body: "Dear {{lead_name}},\n\nThis is a friendly reminder about: {{reminder_title}}\n\n{{reminder_description}}\n\nPlease feel free to reach out if you need any assistance.\n\nBest regards,\n{{salesperson_name}}",
    variables: ["lead_name", "reminder_title", "reminder_description", "salesperson_name"],
    isActive: true,
  },
  {
    id: "followup",
    name: "Follow-up Email",
    subject: "Following up on our conversation",
    body: "Dear {{lead_name}},\n\nI wanted to follow up on our recent conversation regarding your will and estate planning needs.\n\nPlease let me know if you have any questions or if there's anything I can help with.\n\nBest regards,\n{{salesperson_name}}",
    variables: ["lead_name", "salesperson_name"],
    isActive: true,
  },
  {
    id: "meeting_invite",
    name: "Meeting Invitation",
    subject: "Meeting Invitation: {{meeting_title}}",
    body: "Dear {{lead_name}},\n\nYou are invited to a meeting:\n\nTitle: {{meeting_title}}\nDate: {{meeting_date}}\nTime: {{meeting_time}}\nLocation: {{meeting_location}}\n\nPlease confirm your attendance.\n\nBest regards,\n{{salesperson_name}}",
    variables: ["lead_name", "meeting_title", "meeting_date", "meeting_time", "meeting_location", "salesperson_name"],
    isActive: true,
  },
];

const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: "auto_reminder_7days",
    name: "Auto-create reminder for stale leads",
    trigger: "Lead not contacted for 7 days",
    action: "Create follow-up reminder",
    isActive: true,
  },
  {
    id: "auto_status_contacted",
    name: "Auto-update status on first contact",
    trigger: "First communication logged",
    action: "Change status to 'Contacted'",
    isActive: true,
  },
  {
    id: "notify_manager_won",
    name: "Notify manager on deal won",
    trigger: "Lead status changed to 'Won'",
    action: "Send notification to manager",
    isActive: false,
  },
  {
    id: "auto_assign_source",
    name: "Auto-assign by source",
    trigger: "New lead created",
    action: "Assign to salesperson based on source",
    isActive: true,
  },
];

export default function LeadManagementSettings() {
  const { t } = useTranslation("leadManagement");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("notifications");

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNewLeadAssigned: true,
    emailStatusChanges: true,
    emailReminders: true,
    emailProposalViewed: false,
    browserNotifications: true,
    notificationFrequency: "immediate",
  });

  // Email templates state
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  // Automation rules state
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>(DEFAULT_AUTOMATION_RULES);

  // Team settings state
  const [teamSettings, setTeamSettings] = useState<TeamSettings>({
    defaultAssignmentMethod: "by_source",
    workingHoursStart: "09:00",
    workingHoursEnd: "18:00",
    autoAssignNewLeads: true,
    notifyOnAssignment: true,
  });

  // Load settings from localStorage
  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedNotifications = localStorage.getItem("leadManagement_notifications");
        const savedTemplates = localStorage.getItem("leadManagement_templates");
        const savedRules = localStorage.getItem("leadManagement_rules");
        const savedTeam = localStorage.getItem("leadManagement_team");

        if (savedNotifications) setNotificationSettings(JSON.parse(savedNotifications));
        if (savedTemplates) setEmailTemplates(JSON.parse(savedTemplates));
        if (savedRules) setAutomationRules(JSON.parse(savedRules));
        if (savedTeam) setTeamSettings(JSON.parse(savedTeam));
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
      localStorage.setItem("leadManagement_notifications", JSON.stringify(notificationSettings));
      localStorage.setItem("leadManagement_templates", JSON.stringify(emailTemplates));
      localStorage.setItem("leadManagement_rules", JSON.stringify(automationRules));
      localStorage.setItem("leadManagement_team", JSON.stringify(teamSettings));
      
      toast.success(t("settingsSaved", "Settings saved successfully"));
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(t("failedToSaveSettings", "Failed to save settings"));
    } finally {
      setIsSaving(false);
    }
  }, [notificationSettings, emailTemplates, automationRules, teamSettings, t]);

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

  // Send test email
  const sendTestEmail = async (templateId: string) => {
    toast.success(t("testEmailSent", "Test email sent to your address"));
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
            value="notifications"
            className="data-[state=active]:bg-[hsl(var(--jw-primary-green))] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-4 py-2 text-[#555555] font-medium transition-all"
          >
            <Bell className="h-4 w-4 mr-2" />
            {t("notifications", "Notifications")}
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
                  checked={notificationSettings.emailStatusChanges}
                  onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, emailStatusChanges: checked }))}
                />
              </div>
              <div className="flex items-center justify-between py-3 border-b border-[#E6E6E4]">
                <div>
                  <Label className="text-[#222222] font-medium">{t("remindersDue", "Reminders Due")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("remindersDueDesc", "Get notified when reminders are due")}</p>
                </div>
                <Switch 
                  checked={notificationSettings.emailReminders}
                  onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, emailReminders: checked }))}
                />
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <Label className="text-[#222222] font-medium">{t("proposalViewed", "Proposal Viewed")}</Label>
                  <p className="text-sm text-[#6B6B6B]">{t("proposalViewedDesc", "Get notified when a client views your proposal")}</p>
                </div>
                <Switch 
                  checked={notificationSettings.emailProposalViewed}
                  onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, emailProposalViewed: checked }))}
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
                <SelectTrigger className="w-[300px] border-[#E6E6E4]">
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
                        className="border-[#E6E6E4]"
                      >
                        <Send className="h-4 w-4 mr-1" />
                        {t("testSend", "Test")}
                      </Button>
                      <Switch 
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
                        value={selectedTemplate.subject}
                        onChange={(e) => updateEmailTemplate(selectedTemplate.id, { subject: e.target.value })}
                        className="mt-1 border-[#E6E6E4]"
                      />
                    </div>
                    <div>
                      <Label className="text-[#222222]">{t("body", "Body")}</Label>
                      <Textarea
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
                    <Badge className={rule.isActive ? "bg-[#E6F7F1] text-[#0C5536] border-0" : "bg-[#F5F5F5] text-[#6B6B6B] border-0"}>
                      {rule.isActive ? t("active", "Active") : t("inactive", "Inactive")}
                    </Badge>
                    <Switch 
                      checked={rule.isActive}
                      onCheckedChange={() => toggleAutomationRule(rule.id)}
                    />
                  </div>
                </div>
              ))}
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
                  <SelectTrigger className="w-full mt-1 border-[#E6E6E4]">
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
                    value={teamSettings.workingHoursStart}
                    onChange={(e) => setTeamSettings(prev => ({ ...prev, workingHoursStart: e.target.value }))}
                    className="mt-1 border-[#E6E6E4]"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-[#222222]">{t("endTime", "End Time")}</Label>
                  <Input
                    type="time"
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
