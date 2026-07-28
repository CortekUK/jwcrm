export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          check_in_time: string | null
          created_at: string | null
          date: string
          employee_id: string
          id: string
          marked_by: string | null
          reason: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string | null
        }
        Insert: {
          check_in_time?: string | null
          created_at?: string | null
          date: string
          employee_id: string
          id?: string
          marked_by?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string | null
        }
        Update: {
          check_in_time?: string | null
          created_at?: string | null
          date?: string
          employee_id?: string
          id?: string
          marked_by?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_warnings: {
        Row: {
          created_at: string | null
          employee_id: string
          id: string
          issue_summary: string
          message: string
          sent_at: string | null
          sent_by: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          id?: string
          issue_summary: string
          message: string
          sent_at?: string | null
          sent_by?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          id?: string
          issue_summary?: string
          message?: string
          sent_at?: string | null
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_warnings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_methods: {
        Row: {
          created_at: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      email_notification_logs: {
        Row: {
          documents_included: Json | null
          error_message: string | null
          id: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          recipient_email: string
          resend_email_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          subject: string
        }
        Insert: {
          documents_included?: Json | null
          error_message?: string | null
          id?: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          recipient_email: string
          resend_email_id?: string | null
          sent_at?: string | null
          status: Database["public"]["Enums"]["notification_status"]
          subject: string
        }
        Update: {
          documents_included?: Json | null
          error_message?: string | null
          id?: string
          notification_type?: Database["public"]["Enums"]["notification_type"]
          recipient_email?: string
          resend_email_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          archived_at: string | null
          document_mime: string | null
          document_name: string
          document_path: string
          document_size: number | null
          document_type: string
          employee_id: string
          expiry_date: string | null
          extracted_data: Json | null
          id: string
          is_active: boolean
          last_reminder_at: string | null
          reminder_count: number | null
          renewal_expected_at: string | null
          renewal_status: string | null
          renewal_submitted_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          archived_at?: string | null
          document_mime?: string | null
          document_name: string
          document_path: string
          document_size?: number | null
          document_type: string
          employee_id: string
          expiry_date?: string | null
          extracted_data?: Json | null
          id?: string
          is_active?: boolean
          last_reminder_at?: string | null
          reminder_count?: number | null
          renewal_expected_at?: string | null
          renewal_status?: string | null
          renewal_submitted_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          archived_at?: string | null
          document_mime?: string | null
          document_name?: string
          document_path?: string
          document_size?: number | null
          document_type?: string
          employee_id?: string
          expiry_date?: string | null
          extracted_data?: Json | null
          id?: string
          is_active?: boolean
          last_reminder_at?: string | null
          reminder_count?: number | null
          renewal_expected_at?: string | null
          renewal_status?: string | null
          renewal_submitted_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string | null
          created_by: string | null
          date_of_birth: string | null
          department_id: string | null
          email: string | null
          employment_status: string | null
          full_name: string
          id: string
          job_role_id: string | null
          job_title: string | null
          last_working_day: string | null
          manager_id: string | null
          phone: string | null
          salary: number | null
          start_date: string
          termination_reason: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          department_id?: string | null
          email?: string | null
          employment_status?: string | null
          full_name: string
          id?: string
          job_role_id?: string | null
          job_title?: string | null
          last_working_day?: string | null
          manager_id?: string | null
          phone?: string | null
          salary?: number | null
          start_date: string
          termination_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          department_id?: string | null
          email?: string | null
          employment_status?: string | null
          full_name?: string
          id?: string
          job_role_id?: string | null
          job_title?: string | null
          last_working_day?: string | null
          manager_id?: string | null
          phone?: string | null
          salary?: number | null
          start_date?: string
          termination_reason?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      job_roles: {
        Row: {
          created_at: string | null
          department_id: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_evaluations: {
        Row: {
          achieved_value: number | null
          created_at: string | null
          employee_id: string
          evaluated_at: string | null
          evaluated_by: string | null
          id: string
          kpi_id: string
          month: number
          notes: string | null
          score: number | null
          status: string | null
          updated_at: string | null
          year: number
        }
        Insert: {
          achieved_value?: number | null
          created_at?: string | null
          employee_id: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          id?: string
          kpi_id: string
          month: number
          notes?: string | null
          score?: number | null
          status?: string | null
          updated_at?: string | null
          year: number
        }
        Update: {
          achieved_value?: number | null
          created_at?: string | null
          employee_id?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          id?: string
          kpi_id?: string
          month?: number
          notes?: string | null
          score?: number | null
          status?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_evaluations_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis: {
        Row: {
          created_at: string | null
          description: string | null
          employee_id: string | null
          id: string
          is_archived: boolean
          job_role_id: string | null
          name: string
          target_value: number
          unit: string
          updated_at: string | null
          updated_by: string | null
          weighting: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          employee_id?: string | null
          id?: string
          is_archived?: boolean
          job_role_id?: string | null
          name: string
          target_value?: number
          unit?: string
          updated_at?: string | null
          updated_by?: string | null
          weighting?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          employee_id?: string | null
          id?: string
          is_archived?: boolean
          job_role_id?: string | null
          name?: string
          target_value?: number
          unit?: string
          updated_at?: string | null
          updated_by?: string | null
          weighting?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpis_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_communications: {
        Row: {
          communication_method_id: string
          created_at: string | null
          created_by: string | null
          id: string
          lead_id: string
          notes: string | null
          scheduled_at: string
          updated_at: string | null
        }
        Insert: {
          communication_method_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          scheduled_at: string
          updated_at?: string | null
        }
        Update: {
          communication_method_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          scheduled_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_communications_communication_method_id_fkey"
            columns: ["communication_method_id"]
            isOneToOne: false
            referencedRelation: "communication_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_communications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_reminders: {
        Row: {
          completed_at: string | null
          created_at: string | null
          description: string | null
          id: string
          lead_id: string
          remind_at: string
          salesperson_id: string
          status: Database["public"]["Enums"]["reminder_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          lead_id: string
          remind_at: string
          salesperson_id: string
          status?: Database["public"]["Enums"]["reminder_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          lead_id?: string
          remind_at?: string
          salesperson_id?: string
          status?: Database["public"]["Enums"]["reminder_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          company_name: string | null
          created_at: string | null
          created_by: string | null
          email: string
          full_name: string
          id: string
          is_paid: boolean | null
          lead_type: string
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          paid_currency: string | null
          phone: string | null
          source: string | null
          source_id: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          email: string
          full_name: string
          id?: string
          is_paid?: boolean | null
          lead_type?: string
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_currency?: string | null
          phone?: string | null
          source?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          is_paid?: boolean | null
          lead_type?: string
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_currency?: string | null
          phone?: string | null
          source?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_analytics_results: {
        Row: {
          alerts: Json | null
          analysis_date: string
          created_at: string | null
          data_period_end: string | null
          data_period_start: string | null
          department_health: Json | null
          employee_count: number | null
          id: string
          insights: Json
          summary: string
          total_attendance_records: number | null
          total_leave_requests: number | null
        }
        Insert: {
          alerts?: Json | null
          analysis_date?: string
          created_at?: string | null
          data_period_end?: string | null
          data_period_start?: string | null
          department_health?: Json | null
          employee_count?: number | null
          id?: string
          insights?: Json
          summary: string
          total_attendance_records?: number | null
          total_leave_requests?: number | null
        }
        Update: {
          alerts?: Json | null
          analysis_date?: string
          created_at?: string | null
          data_period_end?: string | null
          data_period_start?: string | null
          department_health?: Json | null
          employee_count?: number | null
          id?: string
          insights?: Json
          summary?: string
          total_attendance_records?: number | null
          total_leave_requests?: number | null
        }
        Relationships: []
      }
      leave_balances: {
        Row: {
          annual_entitled: number | null
          annual_pending: number | null
          annual_used: number | null
          created_at: string | null
          employee_id: string
          id: string
          sick_entitled: number | null
          sick_used: number | null
          updated_at: string | null
          year: number
        }
        Insert: {
          annual_entitled?: number | null
          annual_pending?: number | null
          annual_used?: number | null
          created_at?: string | null
          employee_id: string
          id?: string
          sick_entitled?: number | null
          sick_used?: number | null
          updated_at?: string | null
          year: number
        }
        Update: {
          annual_entitled?: number | null
          annual_pending?: number | null
          annual_used?: number | null
          created_at?: string | null
          employee_id?: string
          id?: string
          sick_entitled?: number | null
          sick_used?: number | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attachment_path: string | null
          created_at: string | null
          denial_reason: string | null
          employee_id: string
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_request_status"] | null
          total_days: number
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_path?: string | null
          created_at?: string | null
          denial_reason?: string | null
          employee_id: string
          end_date: string
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_request_status"] | null
          total_days: number
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_path?: string | null
          created_at?: string | null
          denial_reason?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_request_status"] | null
          total_days?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          locale: Database["public"]["Enums"]["app_locale"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          locale?: Database["public"]["Enums"]["app_locale"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          locale?: Database["public"]["Enums"]["app_locale"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          id: string
          invoice_number: string | null
          invoice_pdf_path: string | null
          invoiced_at: string | null
          lead_id: string
          line_items: Json
          paid_at: string | null
          proposal_content: string | null
          proposal_pdf_path: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_link: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          id?: string
          invoice_number?: string | null
          invoice_pdf_path?: string | null
          invoiced_at?: string | null
          lead_id: string
          line_items?: Json
          paid_at?: string | null
          proposal_content?: string | null
          proposal_pdf_path?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_link?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          invoice_number?: string | null
          invoice_pdf_path?: string | null
          invoiced_at?: string | null
          lead_id?: string
          line_items?: Json
          paid_at?: string | null
          proposal_content?: string | null
          proposal_pdf_path?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_link?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          notes: string | null
          paid_at: string
          proposal_id: string
          recorded_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          notes?: string | null
          paid_at?: string
          proposal_id: string
          recorded_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          proposal_id?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_payments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      source_salesperson_assignments: {
        Row: {
          assigned_at: string | null
          id: string
          salesperson_id: string
          source_id: string
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          salesperson_id: string
          source_id: string
        }
        Update: {
          assigned_at?: string | null
          id?: string
          salesperson_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_salesperson_assignments_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      user_identity_documents: {
        Row: {
          arabic_name: string | null
          document_mime: string
          document_name: string
          document_path: string
          document_size: number
          document_type: string
          emirates_id_number: string | null
          english_name: string | null
          extracted_name: string | null
          id: string
          passport_number: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by_admin_id: string | null
          user_id: string
        }
        Insert: {
          arabic_name?: string | null
          document_mime: string
          document_name: string
          document_path: string
          document_size: number
          document_type: string
          emirates_id_number?: string | null
          english_name?: string | null
          extracted_name?: string | null
          id?: string
          passport_number?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by_admin_id?: string | null
          user_id: string
        }
        Update: {
          arabic_name?: string | null
          document_mime?: string
          document_name?: string
          document_path?: string
          document_size?: number
          document_type?: string
          emirates_id_number?: string | null
          english_name?: string | null
          extracted_name?: string | null
          id?: string
          passport_number?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by_admin_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      will_status_events: {
        Row: {
          actor_user_id: string
          changed_at: string
          id: string
          is_internal: boolean
          new_status: Database["public"]["Enums"]["will_status"]
          notes: string | null
          previous_status: Database["public"]["Enums"]["will_status"] | null
          will_id: string
        }
        Insert: {
          actor_user_id: string
          changed_at?: string
          id?: string
          is_internal?: boolean
          new_status: Database["public"]["Enums"]["will_status"]
          notes?: string | null
          previous_status?: Database["public"]["Enums"]["will_status"] | null
          will_id: string
        }
        Update: {
          actor_user_id?: string
          changed_at?: string
          id?: string
          is_internal?: boolean
          new_status?: Database["public"]["Enums"]["will_status"]
          notes?: string | null
          previous_status?: Database["public"]["Enums"]["will_status"] | null
          will_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "will_status_events_will_id_fkey"
            columns: ["will_id"]
            isOneToOne: false
            referencedRelation: "wills"
            referencedColumns: ["id"]
          },
        ]
      }
      wills: {
        Row: {
          answers: Json | null
          client_approval_at: string | null
          client_approval_comments: string | null
          client_approval_image_path: string | null
          client_approval_message: string | null
          client_approval_status: string | null
          client_approval_subject: string | null
          created_at: string
          docx_path: string | null
          id: string
          pdf_generated_at: string | null
          pdf_language: string | null
          pdf_path: string | null
          released_at: string | null
          reviewed_at: string | null
          reviewer_notes: string | null
          reviewer_user_id: string | null
          status: Database["public"]["Enums"]["will_status"]
          submitted_at: string | null
          updated_at: string
          upload_files: Json | null
          user_id: string
          visible_to_client: boolean | null
        }
        Insert: {
          answers?: Json | null
          client_approval_at?: string | null
          client_approval_comments?: string | null
          client_approval_image_path?: string | null
          client_approval_message?: string | null
          client_approval_status?: string | null
          client_approval_subject?: string | null
          created_at?: string
          docx_path?: string | null
          id?: string
          pdf_generated_at?: string | null
          pdf_language?: string | null
          pdf_path?: string | null
          released_at?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          status?: Database["public"]["Enums"]["will_status"]
          submitted_at?: string | null
          updated_at?: string
          upload_files?: Json | null
          user_id: string
          visible_to_client?: boolean | null
        }
        Update: {
          answers?: Json | null
          client_approval_at?: string | null
          client_approval_comments?: string | null
          client_approval_image_path?: string | null
          client_approval_message?: string | null
          client_approval_status?: string | null
          client_approval_subject?: string | null
          created_at?: string
          docx_path?: string | null
          id?: string
          pdf_generated_at?: string | null
          pdf_language?: string | null
          pdf_path?: string | null
          released_at?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          status?: Database["public"]["Enums"]["will_status"]
          submitted_at?: string | null
          updated_at?: string
          upload_files?: Json | null
          user_id?: string
          visible_to_client?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoke_kpi_monthly_notifications: { Args: never; Returns: undefined }
      invoke_kpi_quarterly_notifications: { Args: never; Returns: undefined }
    }
    Enums: {
      app_locale: "en" | "ar"
      app_role:
        | "client"
        | "admin"
        | "hr"
        | "finance"
        | "lead_management"
        | "superadmin"
        | "salesperson"
      attendance_status:
        | "present"
        | "late"
        | "wfh"
        | "on_leave"
        | "sick_leave"
        | "absent"
      lead_status:
        | "not_started"
        | "consultation"
        | "pending"
        | "won"
        | "lost"
        | "meeting"
        | "hold"
        | "qualified"
        | "negotiation"
      leave_request_status: "pending" | "approved" | "denied"
      leave_type: "annual" | "sick" | "emergency" | "unpaid" | "working_from_abroad"
      notification_status: "sent" | "failed" | "skipped"
      notification_type:
        | "document_expiry_digest"
        | "individual_reminder"
        | "leave_approval"
        | "leave_denial"
        | "kpi_quarterly_report"
        | "kpi_incomplete_reminder"
        | "kpi_monthly_reminder"
      proposal_status: "draft" | "sent" | "paid" | "cancelled"
      reminder_status: "pending" | "triggered" | "done" | "dismissed"
      will_status:
        | "in_progress"
        | "awaiting_review"
        | "under_review"
        | "draft_ready"
        | "draft_released"
        | "finalized"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_locale: ["en", "ar"],
      app_role: [
        "client",
        "admin",
        "hr",
        "finance",
        "lead_management",
        "superadmin",
        "salesperson",
      ],
      attendance_status: [
        "present",
        "late",
        "wfh",
        "on_leave",
        "sick_leave",
        "absent",
      ],
      lead_status: [
        "not_started",
        "consultation",
        "pending",
        "won",
        "lost",
        "meeting",
        "hold",
        "qualified",
        "negotiation",
      ],
      leave_request_status: ["pending", "approved", "denied"],
      leave_type: ["annual", "sick", "emergency", "unpaid", "working_from_abroad"],
      notification_status: ["sent", "failed", "skipped"],
      notification_type: [
        "document_expiry_digest",
        "individual_reminder",
        "leave_approval",
        "leave_denial",
        "kpi_quarterly_report",
        "kpi_incomplete_reminder",
        "kpi_monthly_reminder",
      ],
      proposal_status: ["draft", "sent", "paid", "cancelled"],
      reminder_status: ["pending", "triggered", "done", "dismissed"],
      will_status: [
        "in_progress",
        "awaiting_review",
        "under_review",
        "draft_ready",
        "draft_released",
        "finalized",
      ],
    },
  },
} as const
