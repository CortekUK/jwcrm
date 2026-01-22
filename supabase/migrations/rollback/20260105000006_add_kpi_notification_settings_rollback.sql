-- Rollback: 20260105000006_add_kpi_notification_settings.sql
-- Remove KPI notification settings from system_settings

DELETE FROM system_settings WHERE setting_key = 'hr_kpi_notifications';
