"use client";

import { supabase } from "@/integrations/supabase/client";

/**
 * Browser-side helpers for leave certificates.
 *
 * Neither of these touches storage directly — the bucket is private and the
 * authorisation decision belongs to `/api/hr/leave/attachment`, which holds
 * the service-role key and checks the caller's role / ownership.
 */

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetches a signed URL for a request's certificate and opens it.
 * Returns null on success, or a message to show the user on failure.
 */
export async function openLeaveCertificate(requestId: string): Promise<string | null> {
  // Opened synchronously so the eventual navigation isn't treated as a popup.
  const tab = typeof window !== "undefined" ? window.open("", "_blank") : null;
  try {
    const res = await fetch(
      `/api/hr/leave/attachment?request_id=${encodeURIComponent(requestId)}`,
      { headers: await authHeader() }
    );
    const body = await res.json().catch(() => ({}));

    if (!res.ok || !body?.url) {
      tab?.close();
      return body?.error || "Could not open the certificate.";
    }

    if (tab) tab.location.href = body.url;
    else window.open(body.url, "_blank", "noopener,noreferrer");
    return null;
  } catch (err) {
    tab?.close();
    return err instanceof Error ? err.message : "Could not open the certificate.";
  }
}

/**
 * HR-only: attach a certificate to an existing leave request.
 * Returns null on success, or a message to show the user on failure.
 */
export async function uploadLeaveCertificate(
  requestId: string,
  file: File
): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("request_id", requestId);
    form.append("file", file);

    const res = await fetch("/api/hr/leave/attachment", {
      method: "POST",
      headers: await authHeader(),
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return body?.error || "Could not attach the certificate.";
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Could not attach the certificate.";
  }
}
