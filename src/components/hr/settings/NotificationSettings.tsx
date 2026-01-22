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
} from "lucide-react";
import { format } from "date-fns";

interface NotificationSettings {
  enabled: boolean;
  send_time: string;
  timezone: string;
  recipient_email: string;
  recipient_name: string;
  include_expired: boolean;
  include_critical: boolean;
  include_urgent: boolean;
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
}

const defaultSettings: NotificationSettings = {
  enabled: true,
  send_time: "08:00",
  timezone: "Asia/Dubai",
  recipient_email: "",
  recipient_name: "HR Manager",
  include_expired: true,
  include_critical: true,
  include_urgent: true,
};

export function NotificationSettings() {
  const { t } = useTranslation(["hr", "common"]);
  const { toast } = useToast();

  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  // Fetch settings and logs on mount
  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .eq("setting_key", "hr_document_notifications")
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setSettingsId(data.id);
        setSettings(data.setting_value as NotificationSettings);
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

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("email_notification_logs")
        .select("*")
        .eq("notification_type", "document_expiry_digest")
        .order("sent_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching notification logs:", error);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("system_settings")
        .update({ setting_value: settings })
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
      setIsSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setIsTesting(true);
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

      // Refresh logs after test
      setTimeout(fetchLogs, 2000);
    } catch (error) {
      console.error("Error testing notification:", error);
      toast({
        title: t("common:error"),
        description: error instanceof Error ? error.message : "Failed to send test notification",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            {t("hr:sent")}
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            {t("hr:failed")}
          </Badge>
        );
      case "skipped":
        return (
          <Badge className="bg-gray-100 text-gray-700 border-gray-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            {t("hr:skipped")}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
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
      {/* Notification Settings Card */}
      <Card className="border-[#E6E6E4]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            {t("hr:documentExpiryNotifications")}
          </CardTitle>
          <CardDescription>
            {t("hr:documentExpiryNotificationsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">{t("hr:enableNotifications")}</Label>
              <p className="text-sm text-[#6B6B6B]">
                {t("hr:enableNotificationsDesc")}
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, enabled: checked })
              }
            />
          </div>

          {settings.enabled && (
            <>
              {/* Send Time */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="send_time" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {t("hr:sendTime")}
                  </Label>
                  <Input
                    id="send_time"
                    type="time"
                    value={settings.send_time}
                    onChange={(e) =>
                      setSettings({ ...settings, send_time: e.target.value })
                    }
                  />
                  <p className="text-xs text-[#6B6B6B]">{t("hr:sendTimeDesc")}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">{t("hr:timezone")}</Label>
                  <Input
                    id="timezone"
                    value={settings.timezone}
                    onChange={(e) =>
                      setSettings({ ...settings, timezone: e.target.value })
                    }
                    placeholder="Asia/Dubai"
                  />
                </div>
              </div>

              {/* Recipient */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="recipient_name">{t("hr:recipientName")}</Label>
                  <Input
                    id="recipient_name"
                    value={settings.recipient_name}
                    onChange={(e) =>
                      setSettings({ ...settings, recipient_name: e.target.value })
                    }
                    placeholder="HR Manager"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recipient_email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {t("hr:recipientEmail")}
                  </Label>
                  <Input
                    id="recipient_email"
                    type="email"
                    value={settings.recipient_email}
                    onChange={(e) =>
                      setSettings({ ...settings, recipient_email: e.target.value })
                    }
                    placeholder="hr@company.com"
                  />
                </div>
              </div>

              {/* Include Options */}
              <div className="space-y-3">
                <Label className="text-base font-medium">{t("hr:includeInDigest")}</Label>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="flex items-center space-x-2 p-3 bg-red-50 rounded-lg border border-red-200">
                    <Switch
                      id="include_expired"
                      checked={settings.include_expired}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, include_expired: checked })
                      }
                    />
                    <Label htmlFor="include_expired" className="text-red-700">
                      {t("hr:expiredDocuments")}
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <Switch
                      id="include_critical"
                      checked={settings.include_critical}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, include_critical: checked })
                      }
                    />
                    <Label htmlFor="include_critical" className="text-amber-700">
                      {t("hr:critical")} (0-7 {t("hr:days")})
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <Switch
                      id="include_urgent"
                      checked={settings.include_urgent}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, include_urgent: checked })
                      }
                    />
                    <Label htmlFor="include_urgent" className="text-orange-700">
                      {t("hr:urgent")} (8-14 {t("hr:days")})
                    </Label>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common:saving")}
                </>
              ) : (
                t("common:saveChanges")
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleTestNotification}
              disabled={isTesting || !settings.enabled}
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("hr:sending")}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {t("hr:testNotification")}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Logs Card */}
      <Card className="border-[#E6E6E4]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
                {t("hr:recentNotifications")}
              </CardTitle>
              <CardDescription>
                {t("hr:recentNotificationsDesc")}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-[#6B6B6B]">
              <Mail className="h-12 w-12 mx-auto mb-2 text-[#E6E6E4]" />
              <p>{t("hr:noNotificationsYet")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("hr:date")}</TableHead>
                  <TableHead>{t("hr:recipient")}</TableHead>
                  <TableHead>{t("hr:subject")}</TableHead>
                  <TableHead>{t("hr:documents")}</TableHead>
                  <TableHead>{t("hr:status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.sent_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm">{log.recipient_email}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">
                      {log.subject}
                    </TableCell>
                    <TableCell className="text-sm">
                      {Array.isArray(log.documents_included)
                        ? log.documents_included.length
                        : 0}
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
