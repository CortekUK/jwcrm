// Shared validation for the staff "Report an issue" feedback form.
// Used by POST /api/feedback (authoritative) and mirrored in the dialog UI.

export const FEEDBACK_CATEGORIES = {
  bug: "Something isn't working",
  suggestion: "Suggestion",
  question: "Question",
} as const;

export type FeedbackCategory = keyof typeof FEEDBACK_CATEGORIES;

export const FEEDBACK_MESSAGE_MIN = 5;
export const FEEDBACK_MESSAGE_MAX = 5000;
export const FEEDBACK_URL_MAX = 2000;
// 3 MB: base64 inflates by ~4/3 and Vercel rejects request bodies over 4.5 MB.
export const FEEDBACK_MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
export const FEEDBACK_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export interface FeedbackAttachment {
  content: string; // base64, no data: prefix
  filename: string;
  contentType: string;
}

export interface FeedbackPayload {
  category: FeedbackCategory;
  message: string;
  pageUrl: string;
  attachment?: FeedbackAttachment;
}

export type FeedbackValidation =
  | { ok: true; value: FeedbackPayload }
  | { ok: false; error: string };

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** Decoded byte length of a base64 string, without decoding it. */
function base64ByteLength(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export function validateFeedback(input: unknown): FeedbackValidation {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Invalid request body" };
  }
  const body = input as Record<string, unknown>;

  const category = body.category;
  if (
    typeof category !== "string" ||
    !Object.prototype.hasOwnProperty.call(FEEDBACK_CATEGORIES, category)
  ) {
    return { ok: false, error: "Invalid category" };
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < FEEDBACK_MESSAGE_MIN) {
    return { ok: false, error: `Message must be at least ${FEEDBACK_MESSAGE_MIN} characters` };
  }
  if (message.length > FEEDBACK_MESSAGE_MAX) {
    return { ok: false, error: `Message must be at most ${FEEDBACK_MESSAGE_MAX} characters` };
  }

  const rawUrl = typeof body.pageUrl === "string" ? body.pageUrl.trim() : "";
  if (rawUrl.length > FEEDBACK_URL_MAX) {
    return { ok: false, error: "Page URL is too long" };
  }
  let pageUrl = "";
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "Invalid page URL" };
      }
      pageUrl = parsed.toString();
    } catch {
      return { ok: false, error: "Invalid page URL" };
    }
  }

  let attachment: FeedbackAttachment | undefined;
  if (body.attachment !== undefined && body.attachment !== null) {
    const a = body.attachment as Record<string, unknown>;
    if (typeof a !== "object") {
      return { ok: false, error: "Invalid attachment" };
    }
    const contentType = typeof a.contentType === "string" ? a.contentType.toLowerCase() : "";
    if (!(FEEDBACK_ATTACHMENT_TYPES as readonly string[]).includes(contentType)) {
      return { ok: false, error: "Screenshot must be a PNG, JPEG, GIF or WebP image" };
    }
    const content = typeof a.content === "string" ? a.content.replace(/\s/g, "") : "";
    if (!content || !BASE64_RE.test(content)) {
      return { ok: false, error: "Invalid attachment content" };
    }
    if (base64ByteLength(content) > FEEDBACK_MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: "Screenshot must be 3 MB or smaller" };
    }
    const ext = contentType.split("/")[1].replace("jpeg", "jpg");
    const rawName = typeof a.filename === "string" ? a.filename : "";
    const cleanName = rawName.replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 100).trim();
    attachment = {
      content,
      contentType,
      filename: cleanName || `screenshot.${ext}`,
    };
  }

  return {
    ok: true,
    value: { category: category as FeedbackCategory, message, pageUrl, attachment },
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
