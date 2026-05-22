// Microsoft Outlook (Graph) integration helpers.
//
// These helpers are environment-aware: if the Azure AD app credentials are
// not yet configured (MS_CLIENT_ID / MS_CLIENT_SECRET), the helpers return
// `{ configured: false }` so the UI can render a "configuration pending"
// state instead of crashing.

export type OutlookEnv = {
  configured: boolean;
  clientId?: string;
  clientSecret?: string;
  tenant?: string; // "common" supports both work/school and personal accounts
  redirectUri?: string;
  scopes?: string[];
};

export function getOutlookEnv(): OutlookEnv {
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  const tenant = process.env.MS_TENANT_ID || "common";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl.replace(/\/$/, "")}/api/integrations/outlook/callback`;
  const scopes = ["offline_access", "User.Read", "Mail.Send"];

  if (!clientId || !clientSecret) {
    return { configured: false };
  }
  return { configured: true, clientId, clientSecret, tenant, redirectUri, scopes };
}

export function buildAuthorizeUrl(state: string): string | null {
  const env = getOutlookEnv();
  if (!env.configured) return null;
  const url = new URL(
    `https://login.microsoftonline.com/${env.tenant}/oauth2/v2.0/authorize`
  );
  url.searchParams.set("client_id", env.clientId!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", env.redirectUri!);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", env.scopes!.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export type OutlookTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

export async function exchangeCodeForTokens(code: string): Promise<OutlookTokenResponse> {
  const env = getOutlookEnv();
  if (!env.configured) throw new Error("Outlook integration not configured");
  const body = new URLSearchParams({
    client_id: env.clientId!,
    client_secret: env.clientSecret!,
    code,
    redirect_uri: env.redirectUri!,
    grant_type: "authorization_code",
    scope: env.scopes!.join(" "),
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${env.tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function refreshTokens(refreshToken: string): Promise<OutlookTokenResponse> {
  const env = getOutlookEnv();
  if (!env.configured) throw new Error("Outlook integration not configured");
  const body = new URLSearchParams({
    client_id: env.clientId!,
    client_secret: env.clientSecret!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: env.scopes!.join(" "),
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${env.tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );
  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function fetchMyMailbox(accessToken: string): Promise<{ id: string; email: string }> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Graph /me failed (${res.status})`);
  }
  const me = await res.json();
  const email = me.mail || me.userPrincipalName || "";
  return { id: me.id, email };
}
