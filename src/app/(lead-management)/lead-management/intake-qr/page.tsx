"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Download, Check } from "lucide-react";

export default function IntakeQrPage() {
  const [url, setUrl] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const origin = window.location.origin;
    const intakeUrl = `${origin}/intake`;
    setUrl(intakeUrl);
    QRCode.toDataURL(intakeUrl, {
      width: 320,
      margin: 2,
      color: { dark: "#0C5536", light: "#FFFFFF" },
    })
      .then(setDataUrl)
      .catch((e) => console.error("QR generation failed:", e));
  }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "jw-intake-qr.png";
    a.click();
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[hsl(var(--jw-primary-green))] mb-1">
        Enquiry Form QR Code
      </h1>
      <p className="text-sm text-[#555555] mb-6">
        Print or share this QR code. Anyone who scans it can fill in the enquiry
        form, and their details land straight in the CRM as a new lead (source:
        &quot;QR Form&quot;).
      </p>

      <Card className="border-[#E6E6E4]">
        <CardHeader>
          <CardTitle className="text-base">Scan to enquire</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
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
              Download QR (PNG)
            </Button>
            <Button variant="outline" onClick={() => window.open(url, "_blank")}>
              Open form
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
