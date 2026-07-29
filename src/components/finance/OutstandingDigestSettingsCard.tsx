"use client";

// Who receives the weekly outstanding-balance digest, editable from the
// dashboard rather than an environment variable — finance can change the
// recipient without a redeploy.
//
// Stored in system_settings under `finance_outstanding_digest`, matching the
// existing hr_kpi_monthly_notifications pattern.

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const SETTING_KEY = "finance_outstanding_digest";

type DigestSetting = {
  enabled: boolean;
  recipient_email: string;
  recipient_name: string;
};

export function OutstandingDigestSettingsCard() {
  const { t } = useTranslation(["finance", "common"]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);

  const { data: setting, isLoading } = useQuery({
    queryKey: ["system-setting", SETTING_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", SETTING_KEY)
        .maybeSingle();
      if (error) throw error;
      return (data?.setting_value ?? null) as DigestSetting | null;
    },
  });

  useEffect(() => {
    if (setting) {
      setEmail(setting.recipient_email || "");
      setName(setting.recipient_name || "");
      setEnabled(setting.enabled !== false);
    }
  }, [setting]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = email.trim();
      // An empty address is allowed and means "fall back to the configured
      // environment address" — but a malformed one would silently fail to
      // deliver, so reject it here.
      if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        throw new Error(t("finance:invalidEmail", "Please enter a valid email address."));
      }

      const { error } = await supabase
        .from("system_settings")
        .update({
          setting_value: {
            enabled,
            recipient_email: trimmed,
            recipient_name: name.trim() || "Finance Team",
          },
          updated_at: new Date().toISOString(),
        })
        .eq("setting_key", SETTING_KEY);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-setting", SETTING_KEY] });
      toast({
        title: t("finance:settingsSaved", "Settings saved"),
        description: t("finance:digestRecipientSaved", "The weekly digest will go to this address."),
        className: "bg-[hsl(var(--jw-primary-green))] text-white",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: t("common:error", "Error"),
        description: error.message,
      });
    },
  });

  return (
    <Card className="border-[#E6E6E4]">
      <CardHeader className="pb-4">
        <CardTitle
          className="flex items-center gap-2 text-xl font-semibold text-[#0C5536]"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          <Mail className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
          {t("finance:outstandingDigestSettings", "Outstanding Balance Digest")}
        </CardTitle>
        <p className="text-[13px] text-[#777777]">
          {t(
            "finance:outstandingDigestSettingsHint",
            "A weekly summary of invoices with money still owed, sent every Monday. It goes to your team only — clients never receive it."
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-[#C6A03B]" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="digest-email" className="text-[13px] font-medium text-[#333333]">
                {t("finance:digestRecipientEmail", "Send the digest to")}
              </Label>
              <Input
                id="digest-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="finance@justwills.com"
                className="h-10 border-[#E6E6E4] focus:border-[#0C5536] focus:ring-[#0C5536]"
              />
              <p className="text-[11px] text-[#6B6B6B]">
                {t(
                  "finance:digestRecipientHint",
                  "Leave blank to use the default address configured on the server."
                )}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="digest-name" className="text-[13px] font-medium text-[#333333]">
                {t("finance:digestRecipientName", "Recipient name")}
              </Label>
              <Input
                id="digest-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Finance Team"
                className="h-10 border-[#E6E6E4] focus:border-[#0C5536] focus:ring-[#0C5536]"
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-[#E6E6E4] bg-[#FAFAF8] p-3">
              <div>
                <p className="text-[13px] font-medium text-[#333333]">
                  {t("finance:digestEnabled", "Send the weekly digest")}
                </p>
                <p className="text-[11px] text-[#6B6B6B]">
                  {t("finance:digestEnabledHint", "Turn off to stop the weekly email. The dashboard list stays either way.")}
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center shrink-0">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-[#D9D9D6] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[hsl(var(--jw-primary-green))] peer-checked:after:translate-x-full" />
              </label>
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-[hsl(var(--jw-primary-green))] text-white hover:bg-[hsl(var(--jw-hover-green))]"
            >
              {saveMutation.isPending ? (
                <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              )}
              {t("common:save", "Save")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
