-- Insert KPI notification settings into system_settings
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
  'hr_kpi_notifications',
  '{
    "enabled": true,
    "send_time": "09:00",
    "timezone": "Asia/Dubai",
    "hr_recipient_email": "aw736024@gmail.com",
    "hr_recipient_name": "HR Manager",
    "days_before_quarter_end": 7,
    "send_employee_reports": true
  }',
  'Quarterly KPI evaluation notifications - reminders to HR and reports to employees'
)
ON CONFLICT (setting_key) DO NOTHING;
