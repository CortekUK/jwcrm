-- Seed the org-wide rows behind the lead-management Settings page.
--
-- These four tabs previously wrote to localStorage and were read by nothing.
-- The values below are the defaults that were hardcoded in
-- src/app/(lead-management)/lead-management/settings/page.tsx, so applying
-- this migration reproduces exactly what the page used to show on a fresh
-- browser. Existing localStorage values are deliberately NOT migrated.
--
-- New rows use ON CONFLICT DO NOTHING so re-running never stomps on settings
-- the team has since changed.

-- 1. Notifications ---------------------------------------------------------
-- Note: the old `emailProposalViewed` field is intentionally absent. Proposal
-- open-tracking was unreliable and the switch has been removed from the UI.
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'lead_notifications',
  jsonb_build_object(
    'emailNewLeadAssigned', true,
    'emailStatusChanges',   true,
    'emailReminders',       true,
    'browserNotifications', true,
    'notificationFrequency','immediate'
  ),
  'Lead-management notifications: which events email, whether the in-app bell is on, and immediate vs daily/weekly digest batching.'
)
ON CONFLICT (setting_key) DO NOTHING;

-- 2. Email templates -------------------------------------------------------
-- Templates supply subject + body TEXT only; the branded HTML shell is built
-- in code. isActive = false makes the corresponding send fall back to its
-- original hardcoded builder, so an empty email can never go out.
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'lead_email_templates',
  jsonb_build_object('templates', jsonb_build_array(
    jsonb_build_object(
      'id', 'proposal',
      'name', 'Proposal Email',
      'subject', 'Your Proposal from Just Wills - {{invoice_number}}',
      'body', E'Dear {{lead_name}},\n\nThank you for your interest in our services. Please find attached your personalized proposal.\n\nProposal Amount: {{amount}}\n\nIf you have any questions, please don''t hesitate to contact us.\n\nBest regards,\n{{salesperson_name}}',
      'variables', jsonb_build_array('lead_name','invoice_number','amount','salesperson_name'),
      'isActive', true
    ),
    jsonb_build_object(
      'id', 'reminder',
      'name', 'Reminder Email',
      'subject', 'Reminder: {{reminder_title}}',
      'body', E'Dear {{lead_name}},\n\nThis is a friendly reminder about: {{reminder_title}}\n\n{{reminder_description}}\n\nPlease feel free to reach out if you need any assistance.\n\nBest regards,\n{{salesperson_name}}',
      'variables', jsonb_build_array('lead_name','reminder_title','reminder_description','salesperson_name'),
      'isActive', true
    ),
    jsonb_build_object(
      'id', 'followup',
      'name', 'Follow-up Email',
      'subject', 'Following up on our conversation',
      'body', E'Dear {{lead_name}},\n\nI wanted to follow up on our recent conversation regarding your will and estate planning needs.\n\nPlease let me know if you have any questions or if there''s anything I can help with.\n\nBest regards,\n{{salesperson_name}}',
      'variables', jsonb_build_array('lead_name','salesperson_name'),
      'isActive', true
    ),
    jsonb_build_object(
      'id', 'meeting_invite',
      'name', 'Meeting Invitation',
      'subject', 'Meeting Invitation: {{meeting_title}}',
      'body', E'Dear {{lead_name}},\n\nYou are invited to a meeting:\n\nTitle: {{meeting_title}}\nDate: {{meeting_date}}\nTime: {{meeting_time}}\nLocation: {{meeting_location}}\n\nPlease confirm your attendance.\n\nBest regards,\n{{salesperson_name}}',
      'variables', jsonb_build_array('lead_name','meeting_title','meeting_date','meeting_time','meeting_location','salesperson_name'),
      'isActive', true
    )
  )),
  'Editable subject/body for the proposal, reminder, follow-up and meeting-invitation emails. English only. isActive=false falls back to the hardcoded builder.'
)
ON CONFLICT (setting_key) DO NOTHING;

-- 3. Automation ------------------------------------------------------------
-- staleLeadDays backs the number input added inline to the stale-lead rule.
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'lead_automation',
  jsonb_build_object(
    'staleLeadDays', 7,
    'rules', jsonb_build_array(
      jsonb_build_object(
        'id','auto_reminder_7days',
        'name','Auto-create reminder for stale leads',
        'trigger','Lead not contacted for 7 days',
        'action','Create follow-up reminder',
        'isActive', true
      ),
      jsonb_build_object(
        'id','auto_status_contacted',
        'name','Auto-update status on first contact',
        'trigger','First communication logged',
        'action','Change status to ''Contacted''',
        'isActive', true
      ),
      jsonb_build_object(
        'id','notify_manager_won',
        'name','Notify manager on deal won',
        'trigger','Lead status changed to ''Won''',
        'action','Send notification to manager',
        'isActive', false
      ),
      jsonb_build_object(
        'id','auto_assign_source',
        'name','Auto-assign by source',
        'trigger','New lead created',
        'action','Assign to salesperson based on source',
        'isActive', true
      )
    )
  ),
  'Lead-management automation rules plus the configurable stale-lead threshold (days of silence before a follow-up reminder is auto-created).'
)
ON CONFLICT (setting_key) DO NOTHING;

-- 4. Team ------------------------------------------------------------------
-- workingHoursStart/End are interpreted in Asia/Dubai and hold notification
-- emails outside the window. Working DAYS are deliberately not modelled.
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'lead_team',
  jsonb_build_object(
    'defaultAssignmentMethod','by_source',
    'workingHoursStart','09:00',
    'workingHoursEnd','18:00',
    'autoAssignNewLeads', true,
    'notifyOnAssignment', true
  ),
  'Lead assignment method (by_source | round_robin | manual), auto-assign and assignment-email switches, and the working-hours window used to hold notification emails.'
)
ON CONFLICT (setting_key) DO NOTHING;

-- 5. Contact cadence -------------------------------------------------------
-- This key already exists with an older shape ({enabled, max_attempts,
-- interval_hours}) that nothing read except its own settings route. The UI is
-- the source of truth, so the row is REPLACED with the UI's shape rather than
-- left in a form no screen can edit.
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'lead_followup_cadence',
  jsonb_build_object(
    'maxAttempts', 3,
    'intervalDays', 2,
    'autoMarkUnreachable', true,
    'failedOutcomes', jsonb_build_array('no_answer','voicemail','busy','wrong_number')
  ),
  'Contact cadence: how many consecutive failed call outcomes mark a lead unreachable, the recommended gap between attempts, and which outcomes count as failed.'
)
ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = EXCLUDED.setting_value,
      description   = EXCLUDED.description
  -- Only rewrite the row if it is still in the abandoned old shape.
  WHERE public.system_settings.setting_value ? 'max_attempts';
