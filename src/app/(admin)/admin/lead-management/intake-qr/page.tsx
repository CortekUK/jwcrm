"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Download, Check } from "lucide-react";

type Person = { user_id: string; full_name: string | null };

/**
 * Per-salesperson enquiry QR codes.
 *
 * One shared code could not answer "whose lead is this?" at an event — the
 * generic Team-tab rule decided, not the person actually standing at the stand.
 * Every code here carries `?ref=<userId>`, which the public intake endpoint
 * turns into a direct assignment.
 */
export default function IntakeQrPage() {
  const { t } = useTranslation("leadManagement");

  const [self, setSelf] = useState<(Person & { assignable: boolean }) | null>(null);
  const [canPickOthers, setCanPickOthers] = useState(false);
  const [salespeople, setSalespeople] = useState<Person[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await fetch("/api/lead-management/intake-qr", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error("Failed to load");

        const { data } = await res.json();
        setSelf(data.self);
        setCanPickOthers(Boolean(data.canPickOthers));
        setSalespeople(data.salespeople || []);
        // Own code first — the common case is a salesperson printing their own.
        setSelectedId(data.self?.user_id || "");
      } catch (e) {
        console.error("Intake QR load failed:", e);
        setLoadError(
          t("intakeQrLoadFailed", "Could not load your QR code. Please refresh.")
        );
      }
    };
    load();
  }, [t]);

  const selectedPerson = useMemo<Person | null>(() => {
    if (!selectedId) return null;
    if (self && selectedId === self.user_id) return self;
    return salespeople.find((p) => p.user_id === selectedId) || null;
  }, [selectedId, self, salespeople]);

  // The roster already contains the caller when they hold a lead-working role,
  // so merging here (rather than appending) keeps them from appearing twice.
  const options = useMemo<Person[]>(() => {
    if (!canPickOthers) return [];
    const merged = [...salespeople];
    if (self && !merged.some((p) => p.user_id === self.user_id)) {
      merged.unshift(self);
    }
    return merged;
  }, [canPickOthers, salespeople, self]);

  const url = useMemo(() => {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    // No ref means the lead falls back to the Team-tab rule — still a usable
    // code, just not attributed to anyone.
    return selectedId ? `${origin}/intake?ref=${selectedId}` : `${origin}/intake`;
  }, [selectedId]);

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: { dark: "#0C5536", light: "#FFFFFF" },
    })
      .then(setDataUrl)
      .catch((e) => console.error("QR generation failed:", e));
  }, [url]);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [url]);

  const download = useCallback(() => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    // Name the file after the person so a manager printing a stack of codes can
    // tell them apart on disk.
    const slug = (selectedPerson?.full_name || "team")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    a.download = `jw-intake-qr-${slug || "team"}.png`;
    a.click();
  }, [dataUrl, selectedPerson]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[hsl(var(--jw-primary-green))] mb-1">
        {t("intakeQrTitle", "My Enquiry QR Code")}
      </h1>
      <p className="text-sm text-[#555555] mb-6">
        {t(
          "intakeQrDescription",
          'Print or share this QR code. Anyone who scans it can fill in the enquiry form, and their details land straight in the CRM as a new lead (source: "QR Form") assigned to you.'
        )}
      </p>

      {loadError && <p className="text-sm text-[#C0392B] mb-4">{loadError}</p>}

      <Card className="border-[#E6E6E4]">
        <CardHeader>
          <CardTitle className="text-base">
            {selectedPerson?.full_name
              ? t("intakeQrScanFor", "Scan to enquire — {{name}}", {
                  name: selectedPerson.full_name,
                })
              : t("intakeQrScan", "Scan to enquire")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          {canPickOthers && options.length > 0 && (
            <div className="w-full space-y-1.5">
              <Label className="text-[#555555]">
                {t("intakeQrSalesperson", "Generate a code for")}
              </Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name || p.user_id}
                      {self && p.user_id === self.user_id
                        ? ` ${t("intakeQrYou", "(you)")}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {self && !self.assignable && selectedId === self.user_id && (
            <p className="w-full text-xs text-[#8A6D3B]">
              {t(
                "intakeQrNotAssignable",
                "Your account does not hold a sales role, so leads from your own code follow the team assignment rule instead."
              )}
            </p>
          )}

          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt="Enquiry form QR code"
              className="rounded-lg border border-[#E6E6E4]"
              width={320}
              height={320}
            />
          ) : (
            <div className="h-[320px] w-[320px] animate-pulse rounded-lg bg-[#F0F0EE]" />
          )}

          <div className="w-full">
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-[#E6E6E4] bg-[#FAFAF8] px-3 py-2 text-sm">
                {url}
              </code>
              <Button variant="outline" size="icon" onClick={copy} title="Copy link">
                {copied ? <Check className="h-4 w-4 text-[#0C5536]" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={download} disabled={!dataUrl} className="bg-[hsl(var(--jw-primary-green))] text-white hover:bg-[hsl(var(--jw-hover-green))]">
              <Download className="mr-2 h-4 w-4" />
              {t("intakeQrDownload", "Download QR (PNG)")}
            </Button>
            <Button variant="outline" onClick={() => window.open(url, "_blank")}>
              {t("intakeQrOpenForm", "Open form")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
