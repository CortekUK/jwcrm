// Help-assistant knowledge base: hand-written guide sections, each tagged with
// the roles that can actually use that part of the CRM. The assistant API
// sends the model only the sections the signed-in user's roles allow, plus
// the titles of the rest, so it can say "that's handled by HR" instead of
// giving directions to a screen the user cannot open.

/** Roles as stored in `user_roles.role` on the live database. */
export type AssistantRole =
  | "superadmin"
  | "admin"
  | "hr"
  | "finance"
  | "lead_management"
  | "salesperson"
  | "account_manager";

/** Sections every staff member can use regardless of role (e.g. My Leave). */
export const ALL_STAFF = "all_staff" as const;

export interface KnowledgeSection {
  /** Stable kebab-case id, unique across all knowledge files. */
  id: string;
  /** Short title, e.g. "Checking an employee's remaining leave". */
  title: string;
  /** Who can use this. `ALL_STAFF` means every non-client role. */
  roles: (AssistantRole | typeof ALL_STAFF)[];
  /**
   * Plain-English markdown: where to click (exact menu labels and paths as the
   * user sees them), step by step, plus what the user should expect to see.
   * No code, table or column names.
   */
  content: string;
}
