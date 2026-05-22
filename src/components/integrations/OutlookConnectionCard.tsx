"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Unplug, Plug, CheckCircle2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type OutlookStatus = {
  configured: boolean;
  connected: boolean;
  outlookEmail: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
};

export function OutlookConnectionCard() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<OutlookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Surface success / error messages coming back from the OAuth callback.
  useEffect(() => {
    const flag = params?.get("outlook");
    const msg = params?.get("msg");
    if (!flag) return;
    if (flag === "success") {
      toast.success("Outlook connected");
    } else {
      toast.error(`Outlook connection failed${msg ? `: ${msg}` : ""}`);
    }
    // Clean the URL so we don't re-toast on every render.
    const url = new URL(window.location.href);
    url.searchParams.delete("outlook");
    url.searchParams.delete("msg");
    router.replace(`${url.pathname}${url.search}`);
  }, [params, router]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch("/api/integrations/outlook/status", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const body = await res.json();
      setStatus(body);
    } catch (err) {
      console.error("outlook status failed:", err);
      setStatus({ configured: false, connected: false, outlookEmail: null, connectedAt: null, expiresAt: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        toast.error("You are not signed in");
        return;
      }
      const res = await fetch("/api/integrations/outlook/connect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (res.status === 501) {
        toast.message("Outlook integration not yet configured", {
          description:
            body?.error ||
            "An Azure AD app must be registered and its credentials added before users can connect.",
        });
        return;
      }
      if (!res.ok || !body.authorizeUrl) {
        toast.error(body?.error || "Failed to start Outlook connection");
        return;
      }
      window.location.href = body.authorizeUrl;
    } catch (err) {
      console.error("connect failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to connect Outlook");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch("/api/integrations/outlook/disconnect", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || "Failed to disconnect");
        return;
      }
      toast.success("Outlook disconnected");
      await load();
    } catch (err) {
      console.error("disconnect failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-[#E6E6E4]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-[hsl(var(--jw-primary-green))]" />
          Outlook integration
          {status?.connected && (
            <Badge className="bg-[#E6F7F1] text-[#0C5536] border-[#0C5536]/20">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
          {status && !status.configured && (
            <Badge variant="outline" className="border-[#C6A03B]/40 text-[#8B6914]">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Setup pending
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Send proposals, invoices, and follow-ups from your own Outlook
          mailbox. Replies arrive in your normal Outlook inbox.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading status…
          </div>
        ) : status?.connected ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-[#E6E6E4] bg-[#FAFAF8] p-3 text-sm">
              <p className="text-xs text-muted-foreground">Connected mailbox</p>
              <p className="font-medium text-[#222222]">{status.outlookEmail}</p>
              {status.connectedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Connected on {format(new Date(status.connectedAt), "MMM d, yyyy")}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleDisconnect}
              disabled={busy}
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4 mr-2" />
              )}
              Disconnect Outlook
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {!status?.configured && (
              <div className="rounded-lg border border-[#C6A03B]/30 bg-[#FFF9E6] p-3 text-sm text-[#8B6914]">
                The Outlook integration is not yet active. Once the Azure AD
                application is registered and its credentials are added to
                the server, this button will start the sign-in flow.
              </div>
            )}
            <Button
              type="button"
              onClick={handleConnect}
              disabled={busy}
              className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-hover-green))] text-white"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plug className="h-4 w-4 mr-2" />
              )}
              Connect Outlook
            </Button>
            <p className="text-xs text-muted-foreground">
              You will be redirected to Microsoft to authorize the CRM to
              send mail on your behalf. We request the minimum permissions:
              read your basic profile and send mail as you.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
