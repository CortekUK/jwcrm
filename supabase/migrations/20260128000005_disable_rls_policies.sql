-- Migration: Disable RLS and remove all policies
-- Reason: Application layer handles authorization, RLS was causing access issues
-- Date: 2026-01-28

-- =============================================
-- DROP ALL RLS POLICIES
-- =============================================

-- attendance
DROP POLICY IF EXISTS "Admin can manage attendance" ON attendance;
DROP POLICY IF EXISTS "HR can manage attendance" ON attendance;

-- attendance_warnings
DROP POLICY IF EXISTS "HR and Admin can manage attendance warnings" ON attendance_warnings;

-- communication_methods
DROP POLICY IF EXISTS "Lead managers can manage communication methods" ON communication_methods;
DROP POLICY IF EXISTS "Salespeople can view active communication methods" ON communication_methods;

-- departments
DROP POLICY IF EXISTS "HR can delete departments" ON departments;
DROP POLICY IF EXISTS "HR can insert departments" ON departments;
DROP POLICY IF EXISTS "HR can view departments" ON departments;

-- email_notification_logs
DROP POLICY IF EXISTS "Admin has full access to notification logs" ON email_notification_logs;
DROP POLICY IF EXISTS "HR can view notification logs" ON email_notification_logs;
DROP POLICY IF EXISTS "Service role can insert notification logs" ON email_notification_logs;

-- employee_documents
DROP POLICY IF EXISTS "HR can delete employee documents" ON employee_documents;
DROP POLICY IF EXISTS "HR can insert employee documents" ON employee_documents;
DROP POLICY IF EXISTS "HR can update employee documents" ON employee_documents;
DROP POLICY IF EXISTS "HR can view employee documents" ON employee_documents;

-- employees
DROP POLICY IF EXISTS "HR can delete employees" ON employees;
DROP POLICY IF EXISTS "HR can insert employees" ON employees;
DROP POLICY IF EXISTS "HR can update employees" ON employees;
DROP POLICY IF EXISTS "HR can view employees" ON employees;

-- finance_transactions
DROP POLICY IF EXISTS "admin_full_access" ON finance_transactions;
DROP POLICY IF EXISTS "finance_full_access" ON finance_transactions;
DROP POLICY IF EXISTS "superadmin_full_access" ON finance_transactions;

-- job_roles
DROP POLICY IF EXISTS "HR can delete job_roles" ON job_roles;
DROP POLICY IF EXISTS "HR can insert job_roles" ON job_roles;
DROP POLICY IF EXISTS "HR can update job_roles" ON job_roles;
DROP POLICY IF EXISTS "HR can view job_roles" ON job_roles;

-- kpi_evaluations
DROP POLICY IF EXISTS "HR can delete kpi_evaluations" ON kpi_evaluations;
DROP POLICY IF EXISTS "HR can insert kpi_evaluations" ON kpi_evaluations;
DROP POLICY IF EXISTS "HR can update kpi_evaluations" ON kpi_evaluations;
DROP POLICY IF EXISTS "HR can view kpi_evaluations" ON kpi_evaluations;

-- kpis
DROP POLICY IF EXISTS "HR can delete kpis" ON kpis;
DROP POLICY IF EXISTS "HR can insert kpis" ON kpis;
DROP POLICY IF EXISTS "HR can update kpis" ON kpis;
DROP POLICY IF EXISTS "HR can view kpis" ON kpis;

-- lead_communications
DROP POLICY IF EXISTS "Lead managers can manage all communications" ON lead_communications;
DROP POLICY IF EXISTS "Salespeople can create communications for assigned leads" ON lead_communications;
DROP POLICY IF EXISTS "Salespeople can delete their own communications" ON lead_communications;
DROP POLICY IF EXISTS "Salespeople can update their own communications" ON lead_communications;
DROP POLICY IF EXISTS "Salespeople can view communications for assigned leads" ON lead_communications;

-- lead_reminders
DROP POLICY IF EXISTS "Lead managers can view all reminders" ON lead_reminders;
DROP POLICY IF EXISTS "Salespeople can create their own reminders" ON lead_reminders;
DROP POLICY IF EXISTS "Salespeople can delete their own reminders" ON lead_reminders;
DROP POLICY IF EXISTS "Salespeople can update their own reminders" ON lead_reminders;
DROP POLICY IF EXISTS "Salespeople can view their own reminders" ON lead_reminders;

-- lead_sources
DROP POLICY IF EXISTS "admin_full_access" ON lead_sources;
DROP POLICY IF EXISTS "lead_management_full_access" ON lead_sources;
DROP POLICY IF EXISTS "salesperson_read_access" ON lead_sources;
DROP POLICY IF EXISTS "superadmin_full_access" ON lead_sources;

-- leads
DROP POLICY IF EXISTS "admin_full_access" ON leads;
DROP POLICY IF EXISTS "lead_management_full_access" ON leads;
DROP POLICY IF EXISTS "salesperson_update_assigned" ON leads;
DROP POLICY IF EXISTS "salesperson_view_assigned" ON leads;
DROP POLICY IF EXISTS "superadmin_full_access" ON leads;

-- leave_analytics_results
DROP POLICY IF EXISTS "HR and Admin can view leave analytics" ON leave_analytics_results;
DROP POLICY IF EXISTS "Service role can delete old leave analytics" ON leave_analytics_results;
DROP POLICY IF EXISTS "Service role can insert leave analytics" ON leave_analytics_results;

-- leave_balances
DROP POLICY IF EXISTS "Admin can manage leave_balances" ON leave_balances;
DROP POLICY IF EXISTS "HR can manage leave_balances" ON leave_balances;

-- leave_requests
DROP POLICY IF EXISTS "Admin can manage leave_requests" ON leave_requests;
DROP POLICY IF EXISTS "HR can manage leave_requests" ON leave_requests;

-- profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Lead management can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Salesperson can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Superadmin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- proposals
DROP POLICY IF EXISTS "admin_full_access" ON proposals;
DROP POLICY IF EXISTS "lead_management_full_access" ON proposals;

-- source_salesperson_assignments
DROP POLICY IF EXISTS "admin_full_access" ON source_salesperson_assignments;
DROP POLICY IF EXISTS "lead_management_full_access" ON source_salesperson_assignments;
DROP POLICY IF EXISTS "salesperson_read_own" ON source_salesperson_assignments;
DROP POLICY IF EXISTS "superadmin_full_access" ON source_salesperson_assignments;

-- system_settings
DROP POLICY IF EXISTS "Admin has full access to system settings" ON system_settings;
DROP POLICY IF EXISTS "HR can update system settings" ON system_settings;
DROP POLICY IF EXISTS "HR can view system settings" ON system_settings;

-- user_identity_documents
DROP POLICY IF EXISTS "Admins can delete user documents" ON user_identity_documents;
DROP POLICY IF EXISTS "Admins can insert user documents" ON user_identity_documents;
DROP POLICY IF EXISTS "Admins can read all user documents" ON user_identity_documents;
DROP POLICY IF EXISTS "Admins can update user documents" ON user_identity_documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON user_identity_documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON user_identity_documents;
DROP POLICY IF EXISTS "Users can read their own documents" ON user_identity_documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON user_identity_documents;

-- user_roles
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;

-- will_status_events
DROP POLICY IF EXISTS "Admins can insert status events" ON will_status_events;
DROP POLICY IF EXISTS "Admins can view all status events" ON will_status_events;
DROP POLICY IF EXISTS "Users can view status events for their own wills" ON will_status_events;

-- wills
DROP POLICY IF EXISTS "Admins can update wills" ON wills;
DROP POLICY IF EXISTS "Admins can view all wills" ON wills;
DROP POLICY IF EXISTS "Users can create own wills" ON wills;
DROP POLICY IF EXISTS "Users can update own wills" ON wills;
DROP POLICY IF EXISTS "Users can view own wills" ON wills;

-- =============================================
-- DISABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_warnings DISABLE ROW LEVEL SECURITY;
ALTER TABLE communication_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_notification_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE job_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE kpis DISABLE ROW LEVEL SECURITY;
ALTER TABLE lead_communications DISABLE ROW LEVEL SECURITY;
ALTER TABLE lead_reminders DISABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_analytics_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE proposals DISABLE ROW LEVEL SECURITY;
ALTER TABLE source_salesperson_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_identity_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE will_status_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE wills DISABLE ROW LEVEL SECURITY;
