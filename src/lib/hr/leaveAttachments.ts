/**
 * Leave certificate (medical certificate) attachments.
 *
 * Storage lives in the existing PRIVATE `wills` bucket (created with
 * public = false in 20251002213115) under a dedicated `leave-certificates/`
 * prefix — the same shape `employee-documents/` already uses for HR documents.
 * No new bucket is introduced, so no bucket has to be created before this works.
 *
 * Access model: every read and write goes through an API route holding the
 * service-role key, which authorises the caller itself (owning employee, or
 * hr/admin/superadmin). That is the model this app already uses for leave
 * (`/api/hr/leave/self`) — RLS is disabled on most HR tables and the gate is at
 * the API layer. Browsers never touch this prefix directly, and files are only
 * ever handed out as short-lived signed URLs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const LEAVE_ATTACHMENT_BUCKET = "wills";
export const LEAVE_ATTACHMENT_PREFIX = "leave-certificates";

/** 5MB, well under the bucket's own 10MB file_size_limit. */
export const MAX_LEAVE_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/**
 * The `wills` bucket was created with allowed_mime_types limited to these three,
 * so accepting anything else would be rejected by storage anyway.
 */
export const ALLOWED_LEAVE_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

/** For the `accept` attribute of a file input. */
export const LEAVE_ATTACHMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png";

export const LEAVE_ATTACHMENT_SIZE_MESSAGE =
  "The certificate must be 5MB or smaller.";
export const LEAVE_ATTACHMENT_TYPE_MESSAGE =
  "Please attach a PDF, JPG or PNG file.";

/**
 * Returns an error message when the file is not an acceptable certificate,
 * or null when it is. Used identically on the client (fast feedback) and on
 * the server (the check that actually counts).
 */
export function validateLeaveAttachment(file: {
  size: number;
  type: string;
  name: string;
}): string | null {
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > MAX_LEAVE_ATTACHMENT_BYTES) return LEAVE_ATTACHMENT_SIZE_MESSAGE;
  if (!ALLOWED_LEAVE_ATTACHMENT_TYPES.includes(file.type)) {
    return LEAVE_ATTACHMENT_TYPE_MESSAGE;
  }
  return null;
}

function sanitizeFilename(filename: string): string {
  const cleaned = filename
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+/, "");
  return cleaned || "certificate";
}

/**
 * `leave-certificates/<employeeId>/<timestamp>-<safe-name>`.
 *
 * The path is always built server-side from the employee resolved out of the
 * caller's own token, so a client can never choose where its file lands or
 * overwrite somebody else's certificate.
 */
export function buildLeaveAttachmentPath(
  employeeId: string,
  filename: string
): string {
  return `${LEAVE_ATTACHMENT_PREFIX}/${employeeId}/${Date.now()}-${sanitizeFilename(
    filename
  )}`;
}

/**
 * Guard for paths that arrive from outside (e.g. a stored value being signed).
 * Rejects traversal and anything outside this feature's own prefix so a
 * tampered value can't be used to read arbitrary objects in the bucket.
 */
export function isLeaveAttachmentPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0 || path.length > 512) return false;
  if (path.includes("..") || path.startsWith("/")) return false;
  return new RegExp(
    `^${LEAVE_ATTACHMENT_PREFIX}/[0-9a-fA-F-]{36}/[A-Za-z0-9._-]+$`
  ).test(path);
}

/**
 * Uploads a certificate with the service-role client and returns its storage
 * path. Throws on failure so callers can refuse the whole operation rather
 * than silently dropping the document.
 */
export async function uploadLeaveAttachment(
  admin: SupabaseClient,
  employeeId: string,
  file: File
): Promise<string> {
  const problem = validateLeaveAttachment(file);
  if (problem) throw new Error(problem);

  const path = buildLeaveAttachmentPath(employeeId, file.name);
  const { error } = await admin.storage
    .from(LEAVE_ATTACHMENT_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("Leave certificate upload failed:", error);
    throw new Error("Could not upload the certificate. Please try again.");
  }
  return path;
}

/** Short-lived signed URL for a stored certificate. */
export async function signLeaveAttachment(
  admin: SupabaseClient,
  path: string,
  expiresIn = 120
): Promise<string | null> {
  if (!isLeaveAttachmentPath(path)) return null;
  const { data, error } = await admin.storage
    .from(LEAVE_ATTACHMENT_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) {
    console.error("Leave certificate signing failed:", error);
    return null;
  }
  return data?.signedUrl ?? null;
}
