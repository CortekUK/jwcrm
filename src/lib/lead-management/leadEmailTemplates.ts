/**
 * Renders the configurable lead-management email templates.
 *
 * Templates supply SUBJECT and BODY TEXT only. The branded HTML shell (green
 * header / gold accent / dark footer) is owned here and matches the house
 * style used by the existing hardcoded builders and
 * `src/lib/email/invoiceEmailTemplate.ts`. That keeps a user editing a
 * template from being able to break the brand — or produce an email that is
 * a bare wall of unstyled text.
 *
 * English only, by design: no Arabic variants were requested.
 *
 * A template with `isActive: false` returns null from `resolveLeadTemplate`,
 * and every call site falls back to its original hardcoded builder. An empty
 * email is never sent.
 */

import type { LeadEmailTemplate } from "./settingsTypes";

const escapeHtml = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Substitutes `{{variable}}` placeholders. Only the names declared on the
 * template's own `variables` array are substituted; anything else is left
 * verbatim so a typo shows up as `{{typo}}` in a test send rather than
 * vanishing silently.
 */
export function renderTemplateText(
  text: string,
  variables: string[],
  values: Record<string, string | number | null | undefined>
): string {
  let out = text || "";
  for (const name of variables) {
    const raw = values[name];
    const replacement = raw === null || raw === undefined ? "" : String(raw);
    out = out.split(`{{${name}}}`).join(replacement);
  }
  return out;
}

/** Body text -> the branded HTML shell. Newlines become paragraphs. */
export function buildBrandedLeadEmailHtml(options: {
  bodyText: string;
  heading?: string | null;
  subtitle?: string;
  /** Optional pre-built HTML injected after the body (tables, buttons, …). */
  extraHtml?: string;
  footerNote?: string;
}): string {
  const { bodyText, heading, subtitle, extraHtml, footerNote } = options;

  const paragraphs = (bodyText || "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="color:#222222;line-height:1.6;margin:0 0 16px 0;">${escapeHtml(
          block
        ).replace(/\n/g, "<br/>")}</p>`
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #0C5536; padding: 20px; text-align: center;">
        <h1 style="color: #C6A03B; margin: 0;">Just Wills</h1>
        <p style="color: #E6E6E4; margin: 5px 0 0 0; font-size: 12px;">${escapeHtml(
          subtitle || "Professional Will Drafting Services"
        )}</p>
      </div>
      <div style="padding: 30px; background-color: #FAFAF8;">
        ${heading ? `<h2 style="color:#0C5536;margin-top:0;">${escapeHtml(heading)}</h2>` : ""}
        ${paragraphs}
        ${extraHtml || ""}
      </div>
      <div style="background-color: #222222; padding: 15px; text-align: center;">
        <p style="color: #E6E6E4; margin: 0; font-size: 12px;">
          &copy; ${new Date().getFullYear()} Just Wills. All rights reserved.
        </p>
        <p style="color: #666666; margin: 5px 0 0 0; font-size: 11px;">
          ${escapeHtml(footerNote || "Questions? Contact us at support@justwills.ae")}
        </p>
      </div>
    </div>`;
}

export type RenderedLeadEmail = { subject: string; html: string };

/**
 * Finds a template and renders it, or returns null when the template is
 * missing/inactive — the signal for the caller to use its hardcoded builder.
 */
export function resolveLeadTemplate(
  templates: LeadEmailTemplate[],
  templateId: string,
  values: Record<string, string | number | null | undefined>,
  options?: { extraHtml?: string; subtitle?: string }
): RenderedLeadEmail | null {
  const template = templates.find((t) => t.id === templateId);
  if (!template || !template.isActive) return null;
  if (!template.subject?.trim() || !template.body?.trim()) return null;

  const subject = renderTemplateText(template.subject, template.variables, values);
  const bodyText = renderTemplateText(template.body, template.variables, values);

  return {
    subject,
    html: buildBrandedLeadEmailHtml({
      bodyText,
      heading: null,
      subtitle: options?.subtitle,
      extraHtml: options?.extraHtml,
    }),
  };
}
