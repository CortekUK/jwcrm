"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  // Threshold alert state
  const [thresholdSettings, setThresholdSettings] = useState<ThresholdAlertSettings>(defaultThresholdSettings);
  const [thresholdLogs, setThresholdLogs] = useState<NotificationLog[]>([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);
  const [isTestingDoc, setIsTestingDoc] = useState(false);
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

  const handleSaveThresholdSettings = async () => {
    setIsSavingThreshold(true);
    try {
      const { error: updateError } = await supabase
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--jw-primary-green))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Document Expiry Notifications */}
      <Card className="border-[#E6E6E4] dark:border-border shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("hr:documentExpiryNotifications")}
            </CardTitle>
          </div>
          <CardDescription className="text-sm text-[#777777] dark:text-muted-foreground ltr:ml-7 rtl:mr-7">
            {t("hr:documentExpiryNotificationsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-[#FAFAF8] dark:bg-muted rounded-lg border border-[#E6E6E4] dark:border-border">
            <div className="space-y-0.5">
              <Label className="text-base font-medium text-[#222222] dark:text-foreground">{t("hr:enableNotifications")}</Label>
              <p className="text-sm text-[#6B6B6B] dark:text-muted-foreground">
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
                  <Label htmlFor="doc_send_time" className="flex items-center gap-2 text-[#555555] dark:text-muted-foreground">
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
                    className="border-[#E6E6E4] dark:border-border focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                  />
                  <p className="text-xs text-[#6B6B6B]">{t("hr:sendTimeDesc")}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doc_timezone" className="text-[#555555] dark:text-muted-foreground">{t("hr:timezone")}</Label>
                  <Input
                    id="doc_timezone"
                    value={docSettings.timezone}
                    onChange={(e) =>
                      setDocSettings({ ...docSettings, timezone: e.target.value })
                    }
                    placeholder="Asia/Dubai"
                    className="border-[#E6E6E4] dark:border-border focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                  />
                </div>
              </div>

              {/* Recipient */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="doc_recipient_name" className="text-[#555555] dark:text-muted-foreground">{t("hr:recipientName")}</Label>
                  <Input
                    id="doc_recipient_name"
                    value={docSettings.recipient_name}
                    onChange={(e) =>
                      setDocSettings({ ...docSettings, recipient_name: e.target.value })
                    }
                    placeholder="HR Manager"
                    className="border-[#E6E6E4] dark:border-border focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doc_recipient_email" className="flex items-center gap-2 text-[#555555] dark:text-muted-foreground">
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
                    className="border-[#E6E6E4] dark:border-border focus:border-[#C6A03B] focus:ring-1 focus:ring-[#C6A03B]"
                  />
                </div>
              </div>

              {/* Include Options */}
              <div className="space-y-3">
                <Label className="text-base font-medium text-[#222222] dark:text-foreground">{t("hr:includeInDigest")}</Label>
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
          <div className="flex gap-3 pt-4 border-t border-[#E6E6E4] dark:border-border">
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
              className="border-[#E6E6E4] dark:border-border hover:border-[#C6A03B] hover:bg-[#FAFAF8] dark:hover:bg-accent"
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
      <Card className="border-[#E6E6E4] dark:border-border shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("hr:recentNotifications")}
                </CardTitle>
              </div>
              <CardDescription className="text-sm text-[#777777] dark:text-muted-foreground ltr:ml-7 rtl:mr-7 mt-1">
                {t("hr:recentNotificationsDesc")}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/hr/settings/email-logs">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#E6E6E4] dark:border-border hover:border-[#C6A03B] hover:bg-[#FAFAF8] dark:hover:bg-accent"
                >
                  {t("hr:viewAllLogs", "View All Logs")}
                  <ExternalLink className="h-3.5 w-3.5 ltr:ml-1.5 rtl:mr-1.5" />
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAllLogs}
                className="border-[#E6E6E4] dark:border-border hover:border-[#C6A03B] hover:bg-[#FAFAF8] dark:hover:bg-accent"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {docLogs.length === 0 ? (
            <div className="text-center py-12 text-[#6B6B6B] dark:text-muted-foreground">
              <Mail className="h-10 w-10 mx-auto mb-3 text-[#C6A03B]" />
              <p className="font-medium text-[#222222] dark:text-foreground">{t("hr:noNotificationsYet")}</p>
              <p className="text-sm mt-1">{t("hr:noNotificationsYetDesc", "Notification history will appear here")}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-[#E6E6E4] dark:border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAF8] dark:bg-muted">
                    <TableHead className="font-semibold text-[#222222] dark:text-foreground">{t("hr:date")}</TableHead>
                    <TableHead className="font-semibold text-[#222222] dark:text-foreground">{t("hr:recipient")}</TableHead>
                    <TableHead className="font-semibold text-[#222222] dark:text-foreground">{t("hr:subject")}</TableHead>
                    <TableHead className="font-semibold text-[#222222] dark:text-foreground">{t("hr:documents")}</TableHead>
                    <TableHead className="font-semibold text-[#222222] dark:text-foreground">{t("hr:status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-[#FAFAF8] dark:hover:bg-accent">
                      <TableCell className="text-sm text-[#555555] dark:text-muted-foreground">
                        {log.sent_at ? format(new Date(log.sent_at), "MMM d, yyyy HH:mm") : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-[#555555] dark:text-muted-foreground">{log.recipient_email}</TableCell>
                      <TableCell className="text-sm text-[#555555] dark:text-muted-foreground max-w-[200px] truncate">
                        {log.subject}
                      </TableCell>
                      <TableCell className="text-sm text-[#555555] dark:text-muted-foreground">
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
      <Card className="border-[#E6E6E4] dark:border-border shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("hr:thresholdAlerts", "Expiry Threshold Alerts")}
            </CardTitle>
          </div>
          <CardDescription className="text-sm text-[#777777] dark:text-muted-foreground ltr:ml-7 rtl:mr-7">
            {t("hr:thresholdAlertsDesc", "Send alerts when documents reach specific day thresholds before expiration")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200">
            <div className="space-y-0.5">
              <Label className="text-base font-medium text-[#222222] dark:text-foreground">{t("hr:enableThresholdAlerts", "Enable Threshold Alerts")}</Label>
              <p className="text-sm text-[#6B6B6B] dark:text-muted-foreground">
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
                <Label className="text-base font-medium text-[#222222] dark:text-foreground">{t("hr:selectThresholds", "Select Alert Thresholds")}</Label>
                <p className="text-sm text-[#6B6B6B] dark:text-muted-foreground mb-3">
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
                            : "bg-gray-50 dark:bg-muted border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-accent"
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
                  <Label htmlFor="threshold_recipient_name" className="text-[#555555] dark:text-muted-foreground">{t("hr:recipientName")}</Label>
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
                  <Label htmlFor="threshold_recipient_email" className="flex items-center gap-2 text-[#555555] dark:text-muted-foreground">
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
                  <Label htmlFor="threshold_send_time" className="flex items-center gap-2 text-[#555555] dark:text-muted-foreground">
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
                  <Label htmlFor="threshold_timezone" className="text-[#555555] dark:text-muted-foreground">{t("hr:timezone")}</Label>
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
          <div className="flex gap-3 pt-4 border-t border-[#E6E6E4] dark:border-border">
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
              className="border-purple-300 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
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
      <Card className="border-[#E6E6E4] dark:border-border shadow-[0_4px_10px_rgba(12,85,54,0.06)]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-purple-500" />
                <CardTitle className="text-xl font-semibold text-[#0C5536]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {t("hr:thresholdAlertHistory", "Threshold Alert History")}
                </CardTitle>
              </div>
              <CardDescription className="text-sm text-[#777777] dark:text-muted-foreground ltr:ml-7 rtl:mr-7 mt-1">
                {t("hr:thresholdAlertHistoryDesc", "Recent threshold-based expiry alerts")}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAllLogs}
              className="border-[#E6E6E4] dark:border-border hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {thresholdLogs.length === 0 ? (
            <div className="text-center py-12 text-[#6B6B6B] dark:text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 text-purple-400" />
              <p className="font-medium text-[#222222] dark:text-foreground">{t("hr:noThresholdAlertsYet", "No threshold alerts sent yet")}</p>
              <p className="text-sm mt-1">{t("hr:noThresholdAlertsYetDesc", "Threshold alert history will appear here")}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-[#E6E6E4] dark:border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAF8] dark:bg-muted">
                    <TableHead className="font-semibold text-[#222222] dark:text-foreground">{t("hr:date")}</TableHead>
                    <TableHead className="font-semibold text-[#222222] dark:text-foreground">{t("hr:recipient")}</TableHead>
                    <TableHead className="font-semibold text-[#222222] dark:text-foreground">{t("hr:documents")}</TableHead>
                    <TableHead className="font-semibold text-[#222222] dark:text-foreground">{t("hr:status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {thresholdLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-[#FAFAF8] dark:hover:bg-accent">
                      <TableCell className="text-sm text-[#555555] dark:text-muted-foreground">
                        {log.sent_at ? format(new Date(log.sent_at), "MMM d, yyyy HH:mm") : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-[#555555] dark:text-muted-foreground">{log.recipient_email}</TableCell>
                      <TableCell className="text-sm text-[#555555] dark:text-muted-foreground">
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
    </div>
  );
}
