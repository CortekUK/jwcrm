"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import {
  Bell,
  Clock,
  Mail,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Target,
  Calendar,
  CalendarDays,
  Users,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

// Document expiry notification settings
interface DocumentNotificationSettings {
  enabled: boolean;
  send_time: string;
  timezone: string;
  recipient_email: string;
  recipient_name: string;
  include_expired: boolean;
  include_critical: boolean;
  include_urgent: boolean;
}

// KPI monthly notification settings
interface KPIMonthlySettings {
  enabled: boolean;
  send_time: string;
  timezone: string;
  hr_recipient_email: string;
  hr_recipient_name: string;
  days_before_month_end: number;
}

// KPI quarterly notification settings
interface KPIQuarterlySettings {
  enabled: boolean;
  send_time: string;
  timezone: string;
  hr_recipient_email: string;
  hr_recipient_name: string;
  days_before_quarter_end: number;
  send_employee_reports: boolean;
}

// Document threshold alert settings
interface ThresholdAlertSettings {
  enabled: boolean;
  thresholds: number[];
  send_time: string;
  timezone: string;
  recipient_email: string;
  recipient_name: string;
  send_individual_alerts: boolean;
}

interface NotificationLog {
  id: string;
  notification_type: string;
  recipient_email: string;
  subject: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  documents_included: unknown;
  metadata?: unknown;
}

const defaultDocSettings: DocumentNotificationSettings = {
  enabled: true,
  send_time: "08:00",
  timezone: "Asia/Dubai",
  recipient_email: "",
  recipient_name: "HR Manager",
  include_expired: true,
  include_critical: true,
  include_urgent: true,
};

const defaultKPIMonthlySettings: KPIMonthlySettings = {
  enabled: true,
  send_time: "09:00",
  timezone: "Asia/Dubai",
  hr_recipient_email: "",
  hr_recipient_name: "HR Manager",
  days_before_month_end: 7,
};

const defaultKPIQuarterlySettings: KPIQuarterlySettings = {
  enabled: true,
  send_time: "09:00",
  timezone: "Asia/Dubai",
  hr_recipient_email: "",
  hr_recipient_name: "HR Manager",
  days_before_quarter_end: 7,
  send_employee_reports: true,
};

const defaultThresholdSettings: ThresholdAlertSettings = {
  enabled: true,
  thresholds: [90, 60, 30, 14, 7],
  send_time: "08:00",
  timezone: "Asia/Dubai",
  recipient_email: "",
  recipient_name: "HR Manager",
  send_individual_alerts: true,
};

const AVAILABLE_THRESHOLDS = [
  { value: 90, label: "90 days (3 months)" },
  { value: 60, label: "60 days (2 months)" },
  { value: 30, label: "30 days (1 month)" },
  { value: 14, label: "14 days (2 weeks)" },
  { value: 7, label: "7 days (1 week)" },
];

export function NotificationSettings() {
  const { t } = useTranslation(["hr", "common"]);
  const { toast } = useToast();

  // Document notification state
  const [docSettings, setDocSettings] = useState<DocumentNotificationSettings>(defaultDocSettings);
  const [docLogs, setDocLogs] = useState<NotificationLog[]>([]);
  
  // KPI notification state
  const [kpiMonthlySettings, setKPIMonthlySettings] = useState<KPIMonthlySettings>(defaultKPIMonthlySettings);
  const [kpiQuarterlySettings, setKPIQuarterlySettings] = useState<KPIQuarterlySettings>(defaultKPIQuarterlySettings);
  const [kpiLogs, setKPILogs] = useState<NotificationLog[]>([]);
  
  // Threshold alert state
  const [thresholdSettings, setThresholdSettings] = useState<ThresholdAlertSettings>(defaultThresholdSettings);
  const [thresholdLogs, setThresholdLogs] = useState<NotificationLog[]>([]);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [isSavingKPIMonthly, setIsSavingKPIMonthly] = useState(false);
  const [isSavingKPIQuarterly, setIsSavingKPIQuarterly] = useState(false);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);
  const [isTestingDoc, setIsTestingDoc] = useState(false);
  const [isTestingKPIMonthly, setIsTestingKPIMonthly] = useState(false);
  const [isTestingKPIQuarterly, setIsTestingKPIQuarterly] = useState(false);
  const [isTestingThreshold, setIsTestingThreshold] = useState(false);

  // Fetch all settings on mount
  useEffect(() => {
    fetchAllSettings();
    fetchAllLogs();
  }, []);

  const fetchAllSettings = async () => {
    setIsLoading(true);
    try {
      // Fetch document notification settings
      const { data: docData } = await supabase
        .from("system_settings")
        .select("*")
        .eq("setting_key", "hr_document_notifications")
        .single();

      if (docData) {
        setDocSettings(docData.setting_value as DocumentNotificationSettings);
      }

      // Fetch KPI monthly settings
      const { data: kpiMonthlyData } = await supabase
        .from("system_settings")
        .select("*")
        .eq("setting_key", "hr_kpi_monthly_notifications")
        .single();

      if (kpiMonthlyData) {
        setKPIMonthlySettings(kpiMonthlyData.setting_value as KPIMonthlySettings);
      }

      // Fetch KPI quarterly settings
      const { data: kpiQuarterlyData } = await supabase
        .from("system_settings")
        .select("*")
        .eq("setting_key", "hr_kpi_notifications")
        .single();

      if (kpiQuarterlyData) {
        setKPIQuarterlySettings(kpiQuarterlyData.setting_value as KPIQuarterlySettings);
      }

      // Fetch threshold alert settings
      const { data: thresholdData } = await supabase
        .from("system_settings")
        .select("*")
        .eq("setting_key", "hr_document_threshold_alerts")
        .single();

      if (thresholdData) {
        setThresholdSettings(thresholdData.setting_value as ThresholdAlertSettings);
      }
    } catch (error) {
      console.error("Error fetching notification settings:", error);
      toast({
        title: t("common:error"),
        description: "Failed to load notification settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllLogs = async () => {
    try {
      // Fetch document expiry logs
      const { data: docLogsData } = await supabase
        .from("email_notification_logs")
        .select("*")
        .eq("notification_type", "document_expiry_digest")
        .order("sent_at", { ascending: false })
        .limit(10);

      setDocLogs(docLogsData || []);

      // Fetch KPI notification logs
      const { data: kpiLogsData } = await supabase
        .from("email_notification_logs")
        .select("*")
        .in("notification_type", ["kpi_monthly_reminder", "kpi_incomplete_reminder", "kpi_quarterly_report"])
        .order("sent_at", { ascending: false })
        .limit(10);

      setKPILogs(kpiLogsData || []);

      // Fetch threshold alert logs
      const { data: thresholdLogsData } = await supabase
        .from("email_notification_logs")
        .select("*")
        .eq("notification_type", "document_threshold_alert")
        .order("sent_at", { ascending: false })
        .limit(10);

      setThresholdLogs(thresholdLogsData || []);
    } catch (error) {
      console.error("Error fetching notification logs:", error);
    }
  };

  // Save handlers
  const handleSaveDocSettings = async () => {
    setIsSavingDoc(true);
    try {
      const { error } = await supabase
        .from("system_settings")
        .update({ setting_value: docSettings })
        .eq("setting_key", "hr_document_notifications");

      if (error) throw error;

      toast({
        title: t("common:success"),
        description: t("hr:notificationSettingsSaved"),
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: t("common:error"),
        description: "Failed to save notification settings",
        variant: "destructive",
      });
    } finally {
      setIsSavingDoc(false);
    }
  };

  const handleSaveKPIMonthlySettings = async () => {
    setIsSavingKPIMonthly(true);
    try {
      const { error } = await supabase
        .from("system_settings")
        .update({ setting_value: kpiMonthlySettings })
        .eq("setting_key", "hr_kpi_monthly_notifications");

      if (error) throw error;

      toast({
        title: t("common:success"),
        description: t("hr:notificationSettingsSaved"),
      });
    } catch (error) {
      console.error("Error saving KPI monthly settings:", error);
      toast({
        title: t("common:error"),
        description: "Failed to save KPI monthly notification settings",
        variant: "destructive",
      });
    } finally {
      setIsSavingKPIMonthly(false);
    }
  };

  const handleSaveKPIQuarterlySettings = async () => {
    setIsSavingKPIQuarterly(true);
    try {
      const { error } = await supabase
        .from("system_settings")
        .update({ setting_value: kpiQuarterlySettings })
        .eq("setting_key", "hr_kpi_notifications");

      if (error) throw error;

      toast({
        title: t("common:success"),
        description: t("hr:notificationSettingsSaved"),
      });
    } catch (error) {
      console.error("Error saving KPI quarterly settings:", error);
      toast({
        title: t("common:error"),
        description: "Failed to save KPI quarterly notification settings",
        variant: "destructive",
      });
    } finally {
      setIsSavingKPIQuarterly(false);
    }
  };

  const handleSaveThresholdSettings = async () => {
    setIsSavingThreshold(true);
    try {
      // First try to update, if no rows affected, insert
      const { error: updateError, count } = await supabase
        .from("system_settings")
        .update({ setting_value: thresholdSettings })
        .eq("setting_key", "hr_document_threshold_alerts");

      if (updateError) throw updateError;

      toast({
        title: t("common:success"),
        description: t("hr:notificationSettingsSaved"),
      });
    } catch (error) {
      console.error("Error saving threshold settings:", error);
      toast({
        title: t("common:error"),
        description: "Failed to save threshold alert settings",
        variant: "destructive",
      });
    } finally {
      setIsSavingThreshold(false);
    }
  };

  const handleTestThresholdAlert = async () => {
    setIsTestingThreshold(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/hr/trigger-threshold-alert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ force: true }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to trigger threshold alert");
      }

      toast({
        title: t("common:success"),
        description: result.message || "Threshold alert triggered successfully",
      });

      setTimeout(fetchAllLogs, 2000);
    } catch (error) {
      console.error("Error testing threshold alert:", error);
      toast({
        title: t("common:error"),
        description: error instanceof Error ? error.message : "Failed to send threshold alert",
        variant: "destructive",
      });
    } finally {
      setIsTestingThreshold(false);
    }
  };

  const toggleThreshold = (threshold: number) => {
    const current = thresholdSettings.thresholds || [];
    if (current.includes(threshold)) {
      setThresholdSettings({
        ...thresholdSettings,
        thresholds: current.filter(t => t !== threshold),
      });
    } else {
      setThresholdSettings({
        ...thresholdSettings,
        thresholds: [...current, threshold].sort((a, b) => b - a),
      });
    }
  };

  // Test notification handlers
  const handleTestDocNotification = async () => {
    setIsTestingDoc(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/hr/trigger-expiry-digest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to trigger notification");
      }

      toast({
        title: t("common:success"),
        description: result.result?.message || "Test notification triggered successfully",
      });

      setTimeout(fetchAllLogs, 2000);
    } catch (error) {
      console.error("Error testing notification:", error);
      toast({
        title: t("common:error"),
        description: error instanceof Error ? error.message : "Failed to send test notification",
        variant: "destructive",
      });
    } finally {
      setIsTestingDoc(false);
    }
  };

  const handleTestKPINotification = async (type: "monthly" | "quarterly") => {
    if (type === "monthly") {
      setIsTestingKPIMonthly(true);
    } else {
      setIsTestingKPIQuarterly(true);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/hr/trigger-kpi-reminder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to trigger KPI notification");
      }

      toast({
        title: t("common:success"),
        description: result.message || `KPI ${type} reminder triggered successfully`,
      });

      setTimeout(fetchAllLogs, 2000);
    } catch (error) {
      console.error("Error testing KPI notification:", error);
      toast({
        title: t("common:error"),
        description: error instanceof Error ? error.message : "Failed to send KPI test notification",
        variant: "destructive",
      });
    } finally {
      if (type === "monthly") {
        setIsTestingKPIMonthly(false);
      } else {
        setIsTestingKPIQuarterly(false);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge className="bg-[#E6F7F1] text-[#0C5536] border-0">
            <CheckCircle className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            {t("hr:sent")}
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-[#FEECEC] text-[#C0392B] border-0">
            <XCircle className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            {t("hr:failed")}
          </Badge>
        );
      case "skipped":
        return (
          <Badge className="bg-[#F5F5F5] text-[#6B6B6B] border-0">
            <AlertCircle className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            {t("hr:skipped")}
          </Badge>
        );
      default:
        return <Badge variant="outline" className="border-[#E6E6E4]">{status}</Badge>;
    }
  };

  const getNotificationTypeBadge = (type: string) => {
    switch (type) {
      case "kpi_monthly_reminder":
        return (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
            <Calendar className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            Monthly
          </Badge>
        );
      case "kpi_quarterly_report":
        return (
          <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700">
            <CalendarDays className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            Quarterly
          </Badge>
        );
      case "kpi_incomplete_reminder":
        return (
          <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">
            <AlertCircle className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
            Overdue
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t("hr:documentNotifications", "Document Notifications")}
          </TabsTrigger>
          <TabsTrigger value="kpi" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            {t("hr:kpiNotifications", "KPI Notifications")}
          </TabsTrigger>
        </TabsList>

        {/* Document Expiry Notifications Tab */}
        <TabsContent value="documents" className="space-y-6">
          <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("hr:documentExpiryNotifications")}
                </CardTitle>
              </div>
              <CardDescription className="text-sm text-[#777777] ltr:ml-7 rtl:mr-7">
                {t("hr:documentExpiryNotificationsDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium text-[#222222]">{t("hr:enableNotifications")}</Label>
                  <p className="text-sm text-[#6B6B6B]">
                    {t("hr:enableNotificationsDesc")}
                  </p>
                </div>
                <Switch
                  checked={docSettings.enabled}
                  onCheckedChange={(checked) =>
                    setDocSettings({ ...docSettings, enabled: checked })
                  }
                />
              </div>

              {docSettings.enabled && (
                <>
                  {/* Send Time */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="doc_send_time" className="flex items-center gap-2 text-[#555555]">
                        <Clock className="h-4 w-4 text-[#C6A03B]" />
                        {t("hr:sendTime")}
                      </Label>
                      <Input
                        id="doc_send_time"
                        type="time"
                        value={docSettings.send_time}
                        onChange={(e) =>
                          setDocSettings({ ...docSettings, send_time: e.target.value })
                        }
                        className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                      />
                      <p className="text-xs text-[#6B6B6B]">{t("hr:sendTimeDesc")}</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="doc_timezone" className="text-[#555555]">{t("hr:timezone")}</Label>
                      <Input
                        id="doc_timezone"
                        value={docSettings.timezone}
                        onChange={(e) =>
                          setDocSettings({ ...docSettings, timezone: e.target.value })
                        }
                        placeholder="Asia/Dubai"
                        className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                      />
                    </div>
                  </div>

                  {/* Recipient */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="doc_recipient_name" className="text-[#555555]">{t("hr:recipientName")}</Label>
                      <Input
                        id="doc_recipient_name"
                        value={docSettings.recipient_name}
                        onChange={(e) =>
                          setDocSettings({ ...docSettings, recipient_name: e.target.value })
                        }
                        placeholder="HR Manager"
                        className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="doc_recipient_email" className="flex items-center gap-2 text-[#555555]">
                        <Mail className="h-4 w-4 text-[#C6A03B]" />
                        {t("hr:recipientEmail")}
                      </Label>
                      <Input
                        id="doc_recipient_email"
                        type="email"
                        value={docSettings.recipient_email}
                        onChange={(e) =>
                          setDocSettings({ ...docSettings, recipient_email: e.target.value })
                        }
                        placeholder="hr@company.com"
                        className="border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                      />
                    </div>
                  </div>

                  {/* Include Options */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium text-[#222222]">{t("hr:includeInDigest")}</Label>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="flex items-center space-x-2 rtl:space-x-reverse p-3 bg-[#FEECEC] rounded-lg border border-[#C0392B]/20">
                        <Switch
                          id="include_expired"
                          checked={docSettings.include_expired}
                          onCheckedChange={(checked) =>
                            setDocSettings({ ...docSettings, include_expired: checked })
                          }
                        />
                        <Label htmlFor="include_expired" className="text-[#C0392B] text-sm">
                          {t("hr:expiredDocuments")}
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2 rtl:space-x-reverse p-3 bg-[#FFF9E6] rounded-lg border border-[#C6A03B]/20">
                        <Switch
                          id="include_critical"
                          checked={docSettings.include_critical}
                          onCheckedChange={(checked) =>
                            setDocSettings({ ...docSettings, include_critical: checked })
                          }
                        />
                        <Label htmlFor="include_critical" className="text-[#8B6914] text-sm">
                          {t("hr:critical")} (0-7 {t("hr:days")})
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2 rtl:space-x-reverse p-3 bg-[#FFF4E6] rounded-lg border border-orange-300/40">
                        <Switch
                          id="include_urgent"
                          checked={docSettings.include_urgent}
                          onCheckedChange={(checked) =>
                            setDocSettings({ ...docSettings, include_urgent: checked })
                          }
                        />
                        <Label htmlFor="include_urgent" className="text-orange-700 text-sm">
                          {t("hr:urgent")} (8-14 {t("hr:days")})
                        </Label>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-[#E6E6E4]">
                <Button
                  onClick={handleSaveDocSettings}
                  disabled={isSavingDoc}
                  className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
                >
                  {isSavingDoc ? (
                    <>
                      <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                      {t("common:saving")}
                    </>
                  ) : (
                    t("common:saveChanges")
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleTestDocNotification}
                  disabled={isTestingDoc || !docSettings.enabled}
                  className="border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
                >
                  {isTestingDoc ? (
                    <>
                      <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                      {t("hr:sending")}
                    </>
                  ) : (
                    <>
                      <Send className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                      {t("hr:testNotification")}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Document Notification Logs */}
          <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                    <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                      {t("hr:recentNotifications")}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-sm text-[#777777] ltr:ml-7 rtl:mr-7 mt-1">
                    {t("hr:recentNotificationsDesc")}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/hr/settings/email-logs">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
                    >
                      {t("hr:viewAllLogs", "View All Logs")}
                      <ExternalLink className="h-3.5 w-3.5 ltr:ml-1.5 rtl:mr-1.5" />
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchAllLogs}
                    className="border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {docLogs.length === 0 ? (
                <div className="text-center py-12 text-[#6B6B6B]">
                  <Mail className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
                  <p className="font-medium text-[#222222]">{t("hr:noNotificationsYet")}</p>
                  <p className="text-sm mt-1">{t("hr:noNotificationsYetDesc", "Notification history will appear here")}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#FAFAF8]">
                        <TableHead className="font-semibold text-[#222222]">{t("hr:date")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:recipient")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:subject")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:documents")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {docLogs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-[#FAFAF8]">
                          <TableCell className="text-sm text-[#555555]">
                            {log.sent_at ? format(new Date(log.sent_at), "MMM d, yyyy HH:mm") : "-"}
                          </TableCell>
                          <TableCell className="text-sm text-[#555555]">{log.recipient_email}</TableCell>
                          <TableCell className="text-sm text-[#555555] max-w-[200px] truncate">
                            {log.subject}
                          </TableCell>
                          <TableCell className="text-sm text-[#555555]">
                            {Array.isArray(log.documents_included)
                              ? log.documents_included.length
                              : 0}
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Threshold Alerts Card */}
          <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-purple-500" />
                <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("hr:thresholdAlerts", "Expiry Threshold Alerts")}
                </CardTitle>
              </div>
              <CardDescription className="text-sm text-[#777777] ltr:ml-7 rtl:mr-7">
                {t("hr:thresholdAlertsDesc", "Send alerts when documents reach specific day thresholds before expiration")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium text-[#222222]">{t("hr:enableThresholdAlerts", "Enable Threshold Alerts")}</Label>
                  <p className="text-sm text-[#6B6B6B]">
                    {t("hr:enableThresholdAlertsDesc", "Send alerts at specific days before document expiry (e.g., 90, 60, 30 days)")}
                  </p>
                </div>
                <Switch
                  checked={thresholdSettings.enabled}
                  onCheckedChange={(checked) =>
                    setThresholdSettings({ ...thresholdSettings, enabled: checked })
                  }
                />
              </div>

              {thresholdSettings.enabled && (
                <>
                  {/* Threshold Checkboxes */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium text-[#222222]">{t("hr:selectThresholds", "Select Alert Thresholds")}</Label>
                    <p className="text-sm text-[#6B6B6B] mb-3">
                      {t("hr:selectThresholdsDesc", "Choose which day thresholds should trigger alerts. Each threshold sends only once per document.")}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {AVAILABLE_THRESHOLDS.map(({ value, label }) => {
                        const isSelected = (thresholdSettings.thresholds || []).includes(value);
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => toggleThreshold(value)}
                            className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                              isSelected
                                ? "bg-purple-100 border-purple-400 text-purple-700"
                                : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recipient */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="threshold_recipient_name" className="text-[#555555]">{t("hr:recipientName")}</Label>
                      <Input
                        id="threshold_recipient_name"
                        value={thresholdSettings.recipient_name}
                        onChange={(e) =>
                          setThresholdSettings({ ...thresholdSettings, recipient_name: e.target.value })
                        }
                        placeholder="HR Manager"
                        className="border-[#E6E6E4] focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="threshold_recipient_email" className="flex items-center gap-2 text-[#555555]">
                        <Mail className="h-4 w-4 text-purple-500" />
                        {t("hr:recipientEmail")}
                      </Label>
                      <Input
                        id="threshold_recipient_email"
                        type="email"
                        value={thresholdSettings.recipient_email}
                        onChange={(e) =>
                          setThresholdSettings({ ...thresholdSettings, recipient_email: e.target.value })
                        }
                        placeholder="hr@company.com"
                        className="border-[#E6E6E4] focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                      />
                    </div>
                  </div>

                  {/* Send Time */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="threshold_send_time" className="flex items-center gap-2 text-[#555555]">
                        <Clock className="h-4 w-4 text-purple-500" />
                        {t("hr:sendTime")}
                      </Label>
                      <Input
                        id="threshold_send_time"
                        type="time"
                        value={thresholdSettings.send_time}
                        onChange={(e) =>
                          setThresholdSettings({ ...thresholdSettings, send_time: e.target.value })
                        }
                        className="border-[#E6E6E4] focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="threshold_timezone" className="text-[#555555]">{t("hr:timezone")}</Label>
                      <Input
                        id="threshold_timezone"
                        value={thresholdSettings.timezone}
                        onChange={(e) =>
                          setThresholdSettings({ ...thresholdSettings, timezone: e.target.value })
                        }
                        placeholder="Asia/Dubai"
                        className="border-[#E6E6E4] focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-[#E6E6E4]">
                <Button
                  onClick={handleSaveThresholdSettings}
                  disabled={isSavingThreshold}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isSavingThreshold ? (
                    <>
                      <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                      {t("common:saving")}
                    </>
                  ) : (
                    t("common:saveChanges")
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleTestThresholdAlert}
                  disabled={isTestingThreshold || !thresholdSettings.enabled}
                  className="border-purple-300 hover:border-purple-400 hover:bg-purple-50"
                >
                  {isTestingThreshold ? (
                    <>
                      <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                      {t("hr:sending")}
                    </>
                  ) : (
                    <>
                      <Send className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                      {t("hr:testNotification")}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Threshold Alert Logs */}
          <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-purple-500" />
                    <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                      {t("hr:thresholdAlertHistory", "Threshold Alert History")}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-sm text-[#777777] ltr:ml-7 rtl:mr-7 mt-1">
                    {t("hr:thresholdAlertHistoryDesc", "Recent threshold-based expiry alerts")}
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchAllLogs}
                  className="border-[#E6E6E4] hover:border-purple-400 hover:bg-purple-50"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {thresholdLogs.length === 0 ? (
                <div className="text-center py-12 text-[#6B6B6B]">
                  <AlertCircle className="h-10 w-10 mx-auto mb-3 text-purple-400" />
                  <p className="font-medium text-[#222222]">{t("hr:noThresholdAlertsYet", "No threshold alerts sent yet")}</p>
                  <p className="text-sm mt-1">{t("hr:noThresholdAlertsYetDesc", "Threshold alert history will appear here")}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#FAFAF8]">
                        <TableHead className="font-semibold text-[#222222]">{t("hr:date")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:recipient")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:documents")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {thresholdLogs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-[#FAFAF8]">
                          <TableCell className="text-sm text-[#555555]">
                            {log.sent_at ? format(new Date(log.sent_at), "MMM d, yyyy HH:mm") : "-"}
                          </TableCell>
                          <TableCell className="text-sm text-[#555555]">{log.recipient_email}</TableCell>
                          <TableCell className="text-sm text-[#555555]">
                            {Array.isArray(log.documents_included)
                              ? log.documents_included.length
                              : 0}
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* KPI Notifications Tab */}
        <TabsContent value="kpi" className="space-y-6">
          {/* Monthly KPI Reminders Card */}
          <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("hr:monthlyKPIReminders", "Monthly KPI Reminders")}
                </CardTitle>
              </div>
              <CardDescription className="text-sm text-[#777777] ltr:ml-7 rtl:mr-7">
                {t("hr:monthlyKPIRemindersDesc", "Automated reminders sent before month end for pending KPI evaluations")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium text-[#222222]">{t("hr:enableMonthlyReminders", "Enable Monthly Reminders")}</Label>
                  <p className="text-sm text-[#6B6B6B]">
                    {t("hr:enableMonthlyRemindersDesc", "Send email reminders to HR before month end")}
                  </p>
                </div>
                <Switch
                  checked={kpiMonthlySettings.enabled}
                  onCheckedChange={(checked) =>
                    setKPIMonthlySettings({ ...kpiMonthlySettings, enabled: checked })
                  }
                />
              </div>

              {kpiMonthlySettings.enabled && (
                <>
                  {/* Days Before Month End */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="days_before_month" className="flex items-center gap-2 text-[#555555]">
                        <CalendarDays className="h-4 w-4 text-amber-500" />
                        {t("hr:daysBeforeMonthEnd", "Days Before Month End")}
                      </Label>
                      <Select
                        value={String(kpiMonthlySettings.days_before_month_end)}
                        onValueChange={(value) =>
                          setKPIMonthlySettings({ ...kpiMonthlySettings, days_before_month_end: parseInt(value) })
                        }
                      >
                        <SelectTrigger className="border-[#E6E6E4]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[3, 5, 7, 10, 14].map((days) => (
                            <SelectItem key={days} value={String(days)}>
                              {days} {t("hr:days")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-[#6B6B6B]">{t("hr:daysBeforeMonthEndDesc", "Start sending reminders this many days before month end")}</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="kpi_monthly_send_time" className="flex items-center gap-2 text-[#555555]">
                        <Clock className="h-4 w-4 text-amber-500" />
                        {t("hr:sendTime")}
                      </Label>
                      <Input
                        id="kpi_monthly_send_time"
                        type="time"
                        value={kpiMonthlySettings.send_time}
                        onChange={(e) =>
                          setKPIMonthlySettings({ ...kpiMonthlySettings, send_time: e.target.value })
                        }
                        className="border-[#E6E6E4] focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                      />
                    </div>
                  </div>

                  {/* Recipient */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="kpi_monthly_recipient_name" className="text-[#555555]">{t("hr:recipientName")}</Label>
                      <Input
                        id="kpi_monthly_recipient_name"
                        value={kpiMonthlySettings.hr_recipient_name}
                        onChange={(e) =>
                          setKPIMonthlySettings({ ...kpiMonthlySettings, hr_recipient_name: e.target.value })
                        }
                        placeholder="HR Manager"
                        className="border-[#E6E6E4] focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="kpi_monthly_recipient_email" className="flex items-center gap-2 text-[#555555]">
                        <Mail className="h-4 w-4 text-amber-500" />
                        {t("hr:recipientEmail")}
                      </Label>
                      <Input
                        id="kpi_monthly_recipient_email"
                        type="email"
                        value={kpiMonthlySettings.hr_recipient_email}
                        onChange={(e) =>
                          setKPIMonthlySettings({ ...kpiMonthlySettings, hr_recipient_email: e.target.value })
                        }
                        placeholder="hr@company.com"
                        className="border-[#E6E6E4] focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-[#E6E6E4]">
                <Button
                  onClick={handleSaveKPIMonthlySettings}
                  disabled={isSavingKPIMonthly}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isSavingKPIMonthly ? (
                    <>
                      <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                      {t("common:saving")}
                    </>
                  ) : (
                    t("common:saveChanges")
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleTestKPINotification("monthly")}
                  disabled={isTestingKPIMonthly || !kpiMonthlySettings.enabled}
                  className="border-amber-300 hover:border-amber-400 hover:bg-amber-50"
                >
                  {isTestingKPIMonthly ? (
                    <>
                      <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                      {t("hr:sending")}
                    </>
                  ) : (
                    <>
                      <Send className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                      {t("hr:testNotification")}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quarterly KPI Reminders Card */}
          <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("hr:quarterlyKPIReminders", "Quarterly KPI Reminders")}
                </CardTitle>
              </div>
              <CardDescription className="text-sm text-[#777777] ltr:ml-7 rtl:mr-7">
                {t("hr:quarterlyKPIRemindersDesc", "Automated reminders sent before quarter end (March, June, September, December)")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium text-[#222222]">{t("hr:enableQuarterlyReminders", "Enable Quarterly Reminders")}</Label>
                  <p className="text-sm text-[#6B6B6B]">
                    {t("hr:enableQuarterlyRemindersDesc", "Send email reminders to HR before quarter end")}
                  </p>
                </div>
                <Switch
                  checked={kpiQuarterlySettings.enabled}
                  onCheckedChange={(checked) =>
                    setKPIQuarterlySettings({ ...kpiQuarterlySettings, enabled: checked })
                  }
                />
              </div>

              {kpiQuarterlySettings.enabled && (
                <>
                  {/* Days Before Quarter End */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="days_before_quarter" className="flex items-center gap-2 text-[#555555]">
                        <CalendarDays className="h-4 w-4 text-orange-500" />
                        {t("hr:daysBeforeQuarterEnd", "Days Before Quarter End")}
                      </Label>
                      <Select
                        value={String(kpiQuarterlySettings.days_before_quarter_end)}
                        onValueChange={(value) =>
                          setKPIQuarterlySettings({ ...kpiQuarterlySettings, days_before_quarter_end: parseInt(value) })
                        }
                      >
                        <SelectTrigger className="border-[#E6E6E4]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[3, 5, 7, 10, 14].map((days) => (
                            <SelectItem key={days} value={String(days)}>
                              {days} {t("hr:days")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-[#6B6B6B]">{t("hr:daysBeforeQuarterEndDesc", "Start sending reminders this many days before quarter end")}</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="kpi_quarterly_send_time" className="flex items-center gap-2 text-[#555555]">
                        <Clock className="h-4 w-4 text-orange-500" />
                        {t("hr:sendTime")}
                      </Label>
                      <Input
                        id="kpi_quarterly_send_time"
                        type="time"
                        value={kpiQuarterlySettings.send_time}
                        onChange={(e) =>
                          setKPIQuarterlySettings({ ...kpiQuarterlySettings, send_time: e.target.value })
                        }
                        className="border-[#E6E6E4] focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                      />
                    </div>
                  </div>

                  {/* Recipient */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="kpi_quarterly_recipient_name" className="text-[#555555]">{t("hr:recipientName")}</Label>
                      <Input
                        id="kpi_quarterly_recipient_name"
                        value={kpiQuarterlySettings.hr_recipient_name}
                        onChange={(e) =>
                          setKPIQuarterlySettings({ ...kpiQuarterlySettings, hr_recipient_name: e.target.value })
                        }
                        placeholder="HR Manager"
                        className="border-[#E6E6E4] focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="kpi_quarterly_recipient_email" className="flex items-center gap-2 text-[#555555]">
                        <Mail className="h-4 w-4 text-orange-500" />
                        {t("hr:recipientEmail")}
                      </Label>
                      <Input
                        id="kpi_quarterly_recipient_email"
                        type="email"
                        value={kpiQuarterlySettings.hr_recipient_email}
                        onChange={(e) =>
                          setKPIQuarterlySettings({ ...kpiQuarterlySettings, hr_recipient_email: e.target.value })
                        }
                        placeholder="hr@company.com"
                        className="border-[#E6E6E4] focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                      />
                    </div>
                  </div>

                  {/* Send Employee Reports Toggle */}
                  <div className="flex items-center justify-between p-4 bg-[#FAFAF8] rounded-lg border border-[#E6E6E4]">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium text-[#222222] flex items-center gap-2">
                        <Users className="h-4 w-4 text-orange-500" />
                        {t("hr:sendEmployeeReports", "Send Employee Performance Reports")}
                      </Label>
                      <p className="text-sm text-[#6B6B6B]">
                        {t("hr:sendEmployeeReportsDesc", "Also send individual performance reports to each employee at quarter end")}
                      </p>
                    </div>
                    <Switch
                      checked={kpiQuarterlySettings.send_employee_reports}
                      onCheckedChange={(checked) =>
                        setKPIQuarterlySettings({ ...kpiQuarterlySettings, send_employee_reports: checked })
                      }
                    />
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-[#E6E6E4]">
                <Button
                  onClick={handleSaveKPIQuarterlySettings}
                  disabled={isSavingKPIQuarterly}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {isSavingKPIQuarterly ? (
                    <>
                      <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                      {t("common:saving")}
                    </>
                  ) : (
                    t("common:saveChanges")
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleTestKPINotification("quarterly")}
                  disabled={isTestingKPIQuarterly || !kpiQuarterlySettings.enabled}
                  className="border-orange-300 hover:border-orange-400 hover:bg-orange-50"
                >
                  {isTestingKPIQuarterly ? (
                    <>
                      <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                      {t("hr:sending")}
                    </>
                  ) : (
                    <>
                      <Send className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                      {t("hr:testNotification")}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* KPI Notification Logs */}
          <Card className="border-[#E6E6E4] shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                    <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                      {t("hr:kpiNotificationHistory", "KPI Notification History")}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-sm text-[#777777] ltr:ml-7 rtl:mr-7 mt-1">
                    {t("hr:kpiNotificationHistoryDesc", "Recent KPI reminder emails sent")}
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchAllLogs}
                  className="border-[#E6E6E4] hover:border-[#C6A03B] hover:bg-[#FAFAF8]"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {kpiLogs.length === 0 ? (
                <div className="text-center py-12 text-[#6B6B6B]">
                  <Target className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
                  <p className="font-medium text-[#222222]">{t("hr:noKPINotificationsYet", "No KPI notifications sent yet")}</p>
                  <p className="text-sm mt-1">{t("hr:noKPINotificationsYetDesc", "KPI reminder history will appear here")}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-[#E6E6E4] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#FAFAF8]">
                        <TableHead className="font-semibold text-[#222222]">{t("hr:date")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:type", "Type")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:recipient")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:subject")}</TableHead>
                        <TableHead className="font-semibold text-[#222222]">{t("hr:status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kpiLogs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-[#FAFAF8]">
                          <TableCell className="text-sm text-[#555555]">
                            {log.sent_at ? format(new Date(log.sent_at), "MMM d, yyyy HH:mm") : "-"}
                          </TableCell>
                          <TableCell>{getNotificationTypeBadge(log.notification_type)}</TableCell>
                          <TableCell className="text-sm text-[#555555]">{log.recipient_email}</TableCell>
                          <TableCell className="text-sm text-[#555555] max-w-[200px] truncate">
                            {log.subject}
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
