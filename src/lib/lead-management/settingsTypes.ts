/**
 * Shared shapes + defaults for the lead-management Settings page.
 *
 * Isomorphic on purpose: the settings page (a client component) and the API
 * routes / server helpers all read from this file, so the defaults rendered
 * in the browser can never drift from the defaults the server falls back to
 * when a `system_settings` row is missing.
 *
 * Everything here is ORG-WIDE, not per-user. Each group is persisted as one
 * `system_settings` row keyed by the constants below.
 */

export const LEAD_SETTING_KEYS = {
  notifications: "lead_notifications",
  templates: "lead_email_templates",
  automation: "lead_automation",
  team: "lead_team",
  cadence: "lead_followup_cadence",
} as const;

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export type NotificationFrequency = "immediate" | "daily" | "weekly";

export interface LeadNotificationSettings {
  emailNewLeadAssigned: boolean;
  emailStatusChanges: boolean;
  emailReminders: boolean;
  /** In-app only (the notification bell). Never Web Push. */
  browserNotifications: boolean;
  notificationFrequency: NotificationFrequency;
}

export const DEFAULT_LEAD_NOTIFICATIONS: LeadNotificationSettings = {
  emailNewLeadAssigned: true,
  emailStatusChanges: true,
  emailReminders: true,
  browserNotifications: true,
  notificationFrequency: "immediate",
};

/** The events that genuinely fire, and the switch each one obeys. */
export type LeadNotificationEventType =
  | "lead_assigned"
  | "status_changed"
  | "reminder_due"
  | "lead_stale"
  | "deal_won";

export const EVENT_SWITCH: Record<
  LeadNotificationEventType,
  keyof LeadNotificationSettings | null
> = {
  lead_assigned: "emailNewLeadAssigned",
  status_changed: "emailStatusChanges",
  reminder_due: "emailReminders",
  // Stale leads have no switch of their own — they only appear in digests.
  lead_stale: null,
  // Deliberately NOT mapped to emailStatusChanges. This event exists only
  // because an admin explicitly switched the `notify_manager_won` automation
  // rule ON; a general "email me about status changes" preference must not be
  // able to silently cancel a rule someone turned on on purpose. The rule is
  // its only gate.
  deal_won: null,
};

/* ------------------------------------------------------------------ */
/* Email templates                                                     */
/* ------------------------------------------------------------------ */

export interface LeadEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  isActive: boolean;
}

export const DEFAULT_LEAD_TEMPLATES: LeadEmailTemplate[] = [
  {
    id: "proposal",
    name: "Proposal Email",
    subject: "Your Proposal from Just Wills - {{invoice_number}}",
    body: "Dear {{lead_name}},\n\nThank you for your interest in our services. Please find attached your personalized proposal.\n\nProposal Amount: {{amount}}\n\nIf you have any questions, please don't hesitate to contact us.\n\nBest regards,\n{{salesperson_name}}",
    variables: ["lead_name", "invoice_number", "amount", "salesperson_name"],
    isActive: true,
  },
  {
    id: "reminder",
    name: "Reminder Email",
    subject: "Reminder: {{reminder_title}}",
    body: "Dear {{lead_name}},\n\nThis is a friendly reminder about: {{reminder_title}}\n\n{{reminder_description}}\n\nPlease feel free to reach out if you need any assistance.\n\nBest regards,\n{{salesperson_name}}",
    variables: ["lead_name", "reminder_title", "reminder_description", "salesperson_name"],
    isActive: true,
  },
  {
    id: "followup",
    name: "Follow-up Email",
    subject: "Following up on our conversation",
    body: "Dear {{lead_name}},\n\nI wanted to follow up on our recent conversation regarding your will and estate planning needs.\n\nPlease let me know if you have any questions or if there's anything I can help with.\n\nBest regards,\n{{salesperson_name}}",
    variables: ["lead_name", "salesperson_name"],
    isActive: true,
  },
  {
    id: "meeting_invite",
    name: "Meeting Invitation",
    subject: "Meeting Invitation: {{meeting_title}}",
    body: "Dear {{lead_name}},\n\nYou are invited to a meeting:\n\nTitle: {{meeting_title}}\nDate: {{meeting_date}}\nTime: {{meeting_time}}\nLocation: {{meeting_location}}\n\nPlease confirm your attendance.\n\nBest regards,\n{{salesperson_name}}",
    variables: [
      "lead_name",
      "meeting_title",
      "meeting_date",
      "meeting_time",
      "meeting_location",
      "salesperson_name",
    ],
    isActive: true,
  },
];

/* ------------------------------------------------------------------ */
/* Automation                                                          */
/* ------------------------------------------------------------------ */

export interface LeadAutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  isActive: boolean;
}

export interface LeadAutomationSettings {
  rules: LeadAutomationRule[];
  /** Days of silence before `auto_reminder_7days` creates a follow-up. */
  staleLeadDays: number;
}

export const DEFAULT_LEAD_AUTOMATION_RULES: LeadAutomationRule[] = [
  {
    id: "auto_reminder_7days",
    name: "Auto-create reminder for stale leads",
    trigger: "Lead not contacted for 7 days",
    action: "Create follow-up reminder",
    isActive: true,
  },
  {
    id: "auto_status_contacted",
    name: "Auto-update status on first contact",
    trigger: "First communication logged",
    action: "Change status to 'Contacted'",
    isActive: true,
  },
  {
    id: "notify_manager_won",
    name: "Notify manager on deal won",
    trigger: "Lead status changed to 'Won'",
    action: "Send notification to manager",
    isActive: false,
  },
  {
    id: "auto_assign_source",
    name: "Auto-assign by source",
    trigger: "New lead created",
    action: "Assign to salesperson based on source",
    isActive: true,
  },
];

export const DEFAULT_LEAD_AUTOMATION: LeadAutomationSettings = {
  rules: DEFAULT_LEAD_AUTOMATION_RULES,
  staleLeadDays: 7,
};

export function isRuleActive(
  automation: LeadAutomationSettings,
  ruleId: string
): boolean {
  return automation.rules.some((r) => r.id === ruleId && r.isActive);
}

/* ------------------------------------------------------------------ */
/* Team                                                                */
/* ------------------------------------------------------------------ */

export type AssignmentMethod = "round_robin" | "manual" | "by_source";

export interface LeadTeamSettings {
  defaultAssignmentMethod: AssignmentMethod;
  /** "HH:MM", interpreted in TEAM_TIMEZONE. */
  workingHoursStart: string;
  workingHoursEnd: string;
  autoAssignNewLeads: boolean;
  notifyOnAssignment: boolean;
}

export const DEFAULT_LEAD_TEAM: LeadTeamSettings = {
  defaultAssignmentMethod: "by_source",
  workingHoursStart: "09:00",
  workingHoursEnd: "18:00",
  autoAssignNewLeads: true,
  notifyOnAssignment: true,
};

/** Matches the timezone the HR digests already assume. */
export const TEAM_TIMEZONE = "Asia/Dubai";

/* ------------------------------------------------------------------ */
/* Contact cadence                                                     */
/* ------------------------------------------------------------------ */

export interface LeadCadenceSettings {
  maxAttempts: number;
  intervalDays: number;
  autoMarkUnreachable: boolean;
  failedOutcomes: string[];
}

export const DEFAULT_LEAD_CADENCE: LeadCadenceSettings = {
  maxAttempts: 3,
  intervalDays: 2,
  autoMarkUnreachable: true,
  failedOutcomes: ["no_answer", "voicemail", "busy", "wrong_number"],
};

export const ALL_FAILED_OUTCOMES = [
  { value: "no_answer", label: "No Answer" },
  { value: "voicemail", label: "Voicemail" },
  { value: "busy", label: "Busy" },
  { value: "wrong_number", label: "Wrong Number" },
];

/* ------------------------------------------------------------------ */
/* Permissions                                                         */
/* ------------------------------------------------------------------ */

/** Roles allowed to WRITE lead-management settings. Salespeople read only. */
export const LEAD_SETTINGS_WRITE_ROLES = [
  "admin",
  "superadmin",
  "lead_management",
] as const;
