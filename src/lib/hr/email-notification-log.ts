import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Insert an email_notification_logs row.
 *
 * `metadata` was added by migration 20260731000001. Until that migration is
 * applied, PostgREST rejects the whole insert for an unknown column — which
 * would lose the log entirely, a worse outcome than a missing note. So on that
 * specific failure we retry without it.
 */
export async function insertEmailNotificationLog(
  supabase: SupabaseClient<any, any, any>,
  row: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from("email_notification_logs").insert(row);

  if (!error) return;

  if ("metadata" in row) {
    const { metadata, ...withoutMetadata } = row;
    console.error(
      "Email log insert failed, retrying without metadata (is migration 20260731000001 applied?):",
      error.message
    );
    const { error: retryError } = await supabase
      .from("email_notification_logs")
      .insert(withoutMetadata);
    if (retryError) throw retryError;
    return;
  }

  throw error;
}
