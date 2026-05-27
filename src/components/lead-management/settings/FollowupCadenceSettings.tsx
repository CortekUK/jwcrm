"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Mail, Clock, Hash } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface CadenceSettings {
  enabled: boolean;
  max_attempts: number;
  interval_hours: number;
}

export function FollowupCadenceSettings() {
  const [settings, setSettings] = useState<CadenceSettings>({
    enabled: true,
    max_attempts: 3,
    interval_hours: 48,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/lead-management/settings/followup-cadence");
        if (response.ok) {
          const { data } = await response.json();
          if (data?.setting_value) {
            setSettings(data.setting_value);
          }
          if (data?.updated_at) {
            setLastUpdated(data.updated_at);
          }
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/lead-management/settings/followup-cadence", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || "Failed to save settings");
      }

      const { data } = await response.json();
      if (data?.updated_at) {
        setLastUpdated(data.updated_at);
      }
      toast.success("Follow-up settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-[hsl(var(--jw-primary-green))]" />
          <CardTitle>Proposal Follow-up Cadence</CardTitle>
        </div>
        <CardDescription>
          Configure automated follow-up emails for unpaid proposals. When enabled, the system will
          send reminder emails at the configured interval until the maximum attempts are reached or
          the proposal is paid.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Enable Follow-up Emails</Label>
            <p className="text-sm text-muted-foreground">
              Automatically send reminder emails for unpaid proposals
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, enabled: checked }))
            }
          />
        </div>

        {/* Max Attempts */}
        <div className="space-y-2">
          <Label htmlFor="max_attempts" className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            Maximum Follow-up Attempts
          </Label>
          <Input
            id="max_attempts"
            type="number"
            min={1}
            max={10}
            value={settings.max_attempts}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                max_attempts: parseInt(e.target.value) || 1,
              }))
            }
            disabled={!settings.enabled}
            className="max-w-[200px]"
          />
          <p className="text-sm text-muted-foreground">
            Number of follow-up emails to send per proposal (1-10)
          </p>
        </div>

        {/* Interval Hours */}
        <div className="space-y-2">
          <Label htmlFor="interval_hours" className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Interval Between Attempts (hours)
          </Label>
          <Input
            id="interval_hours"
            type="number"
            min={1}
            max={720}
            value={settings.interval_hours}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                interval_hours: parseInt(e.target.value) || 1,
              }))
            }
            disabled={!settings.enabled}
            className="max-w-[200px]"
          />
          <p className="text-sm text-muted-foreground">
            Hours to wait between each follow-up email (1-720). Default: 48 hours (2 days).
          </p>
        </div>

        {/* Summary */}
        {settings.enabled && (
          <div className="rounded-lg bg-muted/50 p-4 text-sm">
            <p className="font-medium mb-1">Current Configuration:</p>
            <p className="text-muted-foreground">
              The system will send up to <strong>{settings.max_attempts}</strong> follow-up
              {settings.max_attempts === 1 ? " email" : " emails"}, waiting{" "}
              <strong>{settings.interval_hours} hours</strong> (
              {Math.round((settings.interval_hours / 24) * 10) / 10} days) between each attempt.
            </p>
          </div>
        )}

        {/* Save Button */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted-foreground">
            {lastUpdated && (
              <span>Last updated: {format(new Date(lastUpdated), "MMM d, yyyy h:mm a")}</span>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
