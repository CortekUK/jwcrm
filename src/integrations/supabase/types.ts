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
    PostgrestVersion: "14.5"
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
      custom_kpi_evaluations: {
        Row: {
          achieved_value: number | null
          created_at: string | null
          custom_kpi_id: string
          employee_id: string
          evaluated_at: string | null
          evaluated_by: string | null
          id: string
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
          custom_kpi_id: string
          employee_id: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          id?: string
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
          custom_kpi_id?: string
          employee_id?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          id?: string
          month?: number
          notes?: string | null
          score?: number | null
          status?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_kpi_evaluations_custom_kpi_id_fkey"
            columns: ["custom_kpi_id"]
            isOneToOne: false
            referencedRelation: "employee_custom_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_kpi_evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
          metadata: Json | null
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
          metadata?: Json | null
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
          metadata?: Json | null
          notification_type?: Database["public"]["Enums"]["notification_type"]
          recipient_email?: string
          resend_email_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string
        }
        Relationships: []
      }
      employee_custom_kpis: {
        Row: {
          created_at: string | null
          created_by: string | null
          deadline: string | null
          description: string | null
          employee_id: string
          id: string
          is_archived: boolean | null
          name: string
          target_value: number
          unit: string
          updated_at: string | null
          updated_by: string | null
          weighting: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          employee_id: string
          id?: string
          is_archived?: boolean | null
          name: string
          target_value?: number
          unit?: string
          updated_at?: string | null
          updated_by?: string | null
          weighting?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          employee_id?: string
          id?: string
          is_archived?: boolean | null
          name?: string
          target_value?: number
          unit?: string
          updated_at?: string | null
          updated_by?: string | null
          weighting?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_custom_kpis_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          alert_thresholds_sent: Json | null
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
          alert_thresholds_sent?: Json | null
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
          alert_thresholds_sent?: Json | null
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
      employee_leave_balances: {
        Row: {
          created_at: string
          employee_id: string
          entitled: number
          id: string
          leave_type_slug: string
          pending: number
          updated_at: string
          used: number
          year: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          entitled?: number
          id?: string
          leave_type_slug: string
          pending?: number
          updated_at?: string
          used?: number
          year: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          entitled?: number
          id?: string
          leave_type_slug?: string
          pending?: number
          updated_at?: string
          used?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_leave_balances_employee_id_fkey"
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
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
      finance_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["transaction_category"]
          created_at: string | null
          created_by: string | null
          currency: string
          description: string | null
          id: string
          receipt_path: string | null
          reference_number: string | null
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string | null
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["transaction_category"]
          created_at?: string | null
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          receipt_path?: string | null
          reference_number?: string | null
          transaction_date?: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["transaction_category"]
          created_at?: string | null
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          receipt_path?: string | null
          reference_number?: string | null
          transaction_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
        }
        Relationships: []
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
            foreignKeyName: "kpis_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          is_primary: boolean
          lead_id: string
          salesperson_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          is_primary?: boolean
          lead_id: string
          salesperson_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          is_primary?: boolean
          lead_id?: string
          salesperson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_communications: {
        Row: {
          call_outcome: Database["public"]["Enums"]["call_outcome"] | null
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
          call_outcome?: Database["public"]["Enums"]["call_outcome"] | null
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
          call_outcome?: Database["public"]["Enums"]["call_outcome"] | null
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
      lead_notes: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          lead_id: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notification_events: {
        Row: {
          body: string | null
          created_at: string
          email_html: string | null
          email_sent_at: string | null
          email_state: string
          email_subject: string | null
          event_type: string
          id: string
          lead_id: string | null
          metadata: Json
          read_at: string | null
          recipient_id: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          email_html?: string | null
          email_sent_at?: string | null
          email_state?: string
          email_subject?: string | null
          event_type: string
          id?: string
          lead_id?: string | null
          metadata?: Json
          read_at?: string | null
          recipient_id: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          email_html?: string | null
          email_sent_at?: string | null
          email_state?: string
          email_subject?: string | null
          event_type?: string
          id?: string
          lead_id?: string | null
          metadata?: Json
          read_at?: string | null
          recipient_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notification_events_lead_id_fkey"
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
          call_attempt_count: number | null
          company_name: string | null
          created_at: string | null
          created_by: string | null
          email: string
          full_name: string
          id: string
          is_paid: boolean | null
          last_call_attempt_at: string | null
          lead_type: string
          needs_identified: string | null
          next_steps: string | null
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          paid_currency: string | null
          phone: string | null
          portal_created_at: string | null
          portal_user_id: string | null
          quoted_currency: string | null
          quoted_price: number | null
          source: string | null
          source_id: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          call_attempt_count?: number | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          email: string
          full_name: string
          id?: string
          is_paid?: boolean | null
          last_call_attempt_at?: string | null
          lead_type?: string
          needs_identified?: string | null
          next_steps?: string | null
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_currency?: string | null
          phone?: string | null
          portal_created_at?: string | null
          portal_user_id?: string | null
          quoted_currency?: string | null
          quoted_price?: number | null
          source?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          call_attempt_count?: number | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          is_paid?: boolean | null
          last_call_attempt_at?: string | null
          lead_type?: string
          needs_identified?: string | null
          next_steps?: string | null
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_currency?: string | null
          phone?: string | null
          portal_created_at?: string | null
          portal_user_id?: string | null
          quoted_currency?: string | null
          quoted_price?: number | null
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
      leave_approval_delegations: {
        Row: {
          created_at: string | null
          delegate_id: string
          delegator_id: string
          end_date: string
          id: string
          is_active: boolean | null
          leave_types: string[] | null
          max_days: number | null
          reason: string | null
          start_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delegate_id: string
          delegator_id: string
          end_date: string
          id?: string
          is_active?: boolean | null
          leave_types?: string[] | null
          max_days?: number | null
          reason?: string | null
          start_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delegate_id?: string
          delegator_id?: string
          end_date?: string
          id?: string
          is_active?: boolean | null
          leave_types?: string[] | null
          max_days?: number | null
          reason?: string | null
          start_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      leave_approval_rules: {
        Row: {
          created_at: string | null
          escalation_days: number | null
          id: string
          is_active: boolean | null
          leave_type: string | null
          max_days: number | null
          min_days: number | null
          priority: number | null
          requires_director_approval: boolean | null
          requires_hr_approval: boolean | null
          requires_manager_approval: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          escalation_days?: number | null
          id?: string
          is_active?: boolean | null
          leave_type?: string | null
          max_days?: number | null
          min_days?: number | null
          priority?: number | null
          requires_director_approval?: boolean | null
          requires_hr_approval?: boolean | null
          requires_manager_approval?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          escalation_days?: number | null
          id?: string
          is_active?: boolean | null
          leave_type?: string | null
          max_days?: number | null
          min_days?: number | null
          priority?: number | null
          requires_director_approval?: boolean | null
          requires_hr_approval?: boolean | null
          requires_manager_approval?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      leave_approval_steps: {
        Row: {
          approver_id: string | null
          approver_type: string
          comments: string | null
          created_at: string | null
          delegate_for: string | null
          escalated_at: string | null
          escalated_to: string | null
          id: string
          leave_request_id: string
          response_at: string | null
          response_by: string | null
          status: string
          step_order: number
          updated_at: string | null
        }
        Insert: {
          approver_id?: string | null
          approver_type: string
          comments?: string | null
          created_at?: string | null
          delegate_for?: string | null
          escalated_at?: string | null
          escalated_to?: string | null
          id?: string
          leave_request_id: string
          response_at?: string | null
          response_by?: string | null
          status?: string
          step_order: number
          updated_at?: string | null
        }
        Update: {
          approver_id?: string | null
          approver_type?: string
          comments?: string | null
          created_at?: string | null
          delegate_for?: string | null
          escalated_at?: string | null
          escalated_to?: string | null
          id?: string
          leave_request_id?: string
          response_at?: string | null
          response_by?: string | null
          status?: string
          step_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_approval_steps_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
        ]
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
          approval_rule_id: string | null
          approved_at: string | null
          approved_by: string | null
          attachment_path: string | null
          created_at: string | null
          current_approval_step: number | null
          denial_reason: string | null
          employee_id: string
          end_date: string
          escalation_count: number | null
          id: string
          last_escalated_at: string | null
          leave_type: string
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_request_status"] | null
          total_approval_steps: number | null
          total_days: number
          updated_at: string | null
        }
        Insert: {
          approval_rule_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachment_path?: string | null
          created_at?: string | null
          current_approval_step?: number | null
          denial_reason?: string | null
          employee_id: string
          end_date: string
          escalation_count?: number | null
          id?: string
          last_escalated_at?: string | null
          leave_type: string
          reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_request_status"] | null
          total_approval_steps?: number | null
          total_days: number
          updated_at?: string | null
        }
        Update: {
          approval_rule_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachment_path?: string | null
          created_at?: string | null
          current_approval_step?: number | null
          denial_reason?: string | null
          employee_id?: string
          end_date?: string
          escalation_count?: number | null
          id?: string
          last_escalated_at?: string | null
          leave_type?: string
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_request_status"] | null
          total_approval_steps?: number | null
          total_days?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approval_rule_id_fkey"
            columns: ["approval_rule_id"]
            isOneToOne: false
            referencedRelation: "leave_approval_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          balance_field_prefix: string | null
          bg_color_class: string
          color_class: string
          created_at: string | null
          icon_name: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          tracks_balance: boolean
          updated_at: string | null
        }
        Insert: {
          balance_field_prefix?: string | null
          bg_color_class?: string
          color_class?: string
          created_at?: string | null
          icon_name?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          tracks_balance?: boolean
          updated_at?: string | null
        }
        Update: {
          balance_field_prefix?: string | null
          bg_color_class?: string
          color_class?: string
          created_at?: string | null
          icon_name?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          tracks_balance?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      monthly_reviews: {
        Row: {
          achievements: string | null
          approved_at: string | null
          approved_by: string | null
          challenges: string | null
          completed_at: string | null
          created_at: string | null
          deadline_date: string | null
          employee_id: string
          goals_progress: string | null
          id: string
          linked_quarterly_review_id: string | null
          manager_notes: string | null
          month: number
          overall_kpi_score: number | null
          performance_summary: string | null
          reviewer_id: string
          status: Database["public"]["Enums"]["review_status"]
          submitted_at: string | null
          updated_at: string | null
          year: number
        }
        Insert: {
          achievements?: string | null
          approved_at?: string | null
          approved_by?: string | null
          challenges?: string | null
          completed_at?: string | null
          created_at?: string | null
          deadline_date?: string | null
          employee_id: string
          goals_progress?: string | null
          id?: string
          linked_quarterly_review_id?: string | null
          manager_notes?: string | null
          month: number
          overall_kpi_score?: number | null
          performance_summary?: string | null
          reviewer_id: string
          status?: Database["public"]["Enums"]["review_status"]
          submitted_at?: string | null
          updated_at?: string | null
          year: number
        }
        Update: {
          achievements?: string | null
          approved_at?: string | null
          approved_by?: string | null
          challenges?: string | null
          completed_at?: string | null
          created_at?: string | null
          deadline_date?: string | null
          employee_id?: string
          goals_progress?: string | null
          id?: string
          linked_quarterly_review_id?: string | null
          manager_notes?: string | null
          month?: number
          overall_kpi_score?: number | null
          performance_summary?: string | null
          reviewer_id?: string
          status?: Database["public"]["Enums"]["review_status"]
          submitted_at?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_reviews_approver_profile_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "monthly_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_reviews_linked_quarterly_review_id_fkey"
            columns: ["linked_quarterly_review_id"]
            isOneToOne: false
            referencedRelation: "quarterly_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_reviews_reviewer_profile_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
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
      proposal_payments: {
        Row: {
          amount: number
          created_at: string
          external_reference: string | null
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
          external_reference?: string | null
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
          external_reference?: string | null
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
      proposals: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          followup_count: number
          followup_sent_at: string | null
          id: string
          invoice_number: string | null
          invoice_pdf_path: string | null
          invoiced_at: string | null
          last_followup_at: string | null
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
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          followup_count?: number
          followup_sent_at?: string | null
          id?: string
          invoice_number?: string | null
          invoice_pdf_path?: string | null
          invoiced_at?: string | null
          last_followup_at?: string | null
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
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          followup_count?: number
          followup_sent_at?: string | null
          id?: string
          invoice_number?: string | null
          invoice_pdf_path?: string | null
          invoiced_at?: string | null
          last_followup_at?: string | null
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
          vat_amount?: number | null
          vat_rate?: number | null
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
      quarterly_reviews: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          areas_for_improvement: string | null
          completed_at: string | null
          created_at: string | null
          custom_fields: Json | null
          deadline_date: string | null
          development_plan: string | null
          employee_id: string
          generated_from_monthly: boolean | null
          goals_next_quarter: string | null
          id: string
          manager_comments: string | null
          overall_kpi_score: number | null
          performance_summary: string | null
          quarter: number
          reviewer_id: string
          status: Database["public"]["Enums"]["review_status"]
          strengths: string | null
          submitted_at: string | null
          updated_at: string | null
          year: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          areas_for_improvement?: string | null
          completed_at?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          deadline_date?: string | null
          development_plan?: string | null
          employee_id: string
          generated_from_monthly?: boolean | null
          goals_next_quarter?: string | null
          id?: string
          manager_comments?: string | null
          overall_kpi_score?: number | null
          performance_summary?: string | null
          quarter: number
          reviewer_id: string
          status?: Database["public"]["Enums"]["review_status"]
          strengths?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          year: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          areas_for_improvement?: string | null
          completed_at?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          deadline_date?: string | null
          development_plan?: string | null
          employee_id?: string
          generated_from_monthly?: boolean | null
          goals_next_quarter?: string | null
          id?: string
          manager_comments?: string | null
          overall_kpi_score?: number | null
          performance_summary?: string | null
          quarter?: number
          reviewer_id?: string
          status?: Database["public"]["Enums"]["review_status"]
          strengths?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "quarterly_reviews_approver_profile_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "quarterly_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quarterly_reviews_reviewer_profile_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      review_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          sections: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          sections?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          sections?: Json
          updated_at?: string | null
        }
        Relationships: []
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
      user_outlook_connections: {
        Row: {
          access_token: string
          connected_at: string
          expires_at: string
          ms_user_id: string | null
          outlook_email: string
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          expires_at: string
          ms_user_id?: string | null
          outlook_email: string
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          expires_at?: string
          ms_user_id?: string | null
          outlook_email?: string
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          permission_level: Database["public"]["Enums"]["permission_level"]
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_level?: Database["public"]["Enums"]["permission_level"]
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_level?: Database["public"]["Enums"]["permission_level"]
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      will_document_versions: {
        Row: {
          created_at: string
          docx_path: string | null
          id: string
          notes: string | null
          pdf_path: string
          uploaded_by: string | null
          version_number: number
          will_id: string
        }
        Insert: {
          created_at?: string
          docx_path?: string | null
          id?: string
          notes?: string | null
          pdf_path: string
          uploaded_by?: string | null
          version_number: number
          will_id: string
        }
        Update: {
          created_at?: string
          docx_path?: string | null
          id?: string
          notes?: string | null
          pdf_path?: string
          uploaded_by?: string | null
          version_number?: number
          will_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "will_document_versions_will_id_fkey"
            columns: ["will_id"]
            isOneToOne: false
            referencedRelation: "wills"
            referencedColumns: ["id"]
          },
        ]
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
          account_manager_id: string | null
          answers: Json | null
          client_approval_at: string | null
          client_approval_comments: string | null
          client_approval_image_path: string | null
          client_approval_message: string | null
          client_approval_status: string | null
          client_approval_subject: string | null
          client_signature: string | null
          client_signature_at: string | null
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
          signed_pdf_path: string | null
          status: Database["public"]["Enums"]["will_status"]
          submitted_at: string | null
          updated_at: string
          upload_files: Json | null
          user_id: string
          visible_to_client: boolean | null
        }
        Insert: {
          account_manager_id?: string | null
          answers?: Json | null
          client_approval_at?: string | null
          client_approval_comments?: string | null
          client_approval_image_path?: string | null
          client_approval_message?: string | null
          client_approval_status?: string | null
          client_approval_subject?: string | null
          client_signature?: string | null
          client_signature_at?: string | null
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
          signed_pdf_path?: string | null
          status?: Database["public"]["Enums"]["will_status"]
          submitted_at?: string | null
          updated_at?: string
          upload_files?: Json | null
          user_id: string
          visible_to_client?: boolean | null
        }
        Update: {
          account_manager_id?: string | null
          answers?: Json | null
          client_approval_at?: string | null
          client_approval_comments?: string | null
          client_approval_image_path?: string | null
          client_approval_message?: string | null
          client_approval_status?: string | null
          client_approval_subject?: string | null
          client_signature?: string | null
          client_signature_at?: string | null
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
          signed_pdf_path?: string | null
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
      find_auth_user_id_by_email: { Args: { p_email: string }; Returns: string }
      get_active_delegate: {
        Args: {
          p_delegator_id: string
          p_leave_type: string
          p_total_days: number
        }
        Returns: string
      }
      get_applicable_approval_rule: {
        Args: { p_leave_type: string; p_total_days: number }
        Returns: string
      }
      get_permission_level: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: Database["public"]["Enums"]["permission_level"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoke_kpi_monthly_notifications: { Args: never; Returns: undefined }
      is_head_for_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_lead_reminders: { Args: never; Returns: undefined }
      process_proposal_followups: { Args: never; Returns: undefined }
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
        | "account_manager"
      attendance_status:
        | "present"
        | "late"
        | "wfh"
        | "on_leave"
        | "sick_leave"
        | "absent"
      call_outcome:
        | "answered"
        | "no_answer"
        | "voicemail"
        | "busy"
        | "wrong_number"
      lead_status:
        | "not_started"
        | "contacted"
        | "consultation"
        | "pending"
        | "drafting"
        | "won"
        | "lost"
        | "meeting"
        | "hold"
        | "qualified"
        | "negotiation"
        | "consultation_completed"
        | "unreachable"
      leave_request_status: "pending" | "approved" | "denied"
      notification_status: "sent" | "failed" | "skipped"
      notification_type:
        | "document_expiry_digest"
        | "individual_reminder"
        | "leave_approval"
        | "leave_denial"
        | "kpi_quarterly_report"
        | "kpi_incomplete_reminder"
        | "kpi_monthly_reminder"
        | "document_threshold_alert"
      permission_level: "head" | "employee"
      proposal_status: "draft" | "sent" | "paid" | "cancelled"
      reminder_status: "pending" | "triggered" | "done" | "dismissed"
      review_status: "draft" | "submitted" | "approved" | "complete"
      transaction_category:
        | "consultation_fee"
        | "service_fee"
        | "other_income"
        | "salary"
        | "rent"
        | "utilities"
        | "marketing"
        | "software"
        | "office_supplies"
        | "travel"
        | "legal"
        | "taxes"
        | "other_expense"
      transaction_type: "earning" | "expense"
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
        "account_manager",
      ],
      attendance_status: [
        "present",
        "late",
        "wfh",
        "on_leave",
        "sick_leave",
        "absent",
      ],
      call_outcome: [
        "answered",
        "no_answer",
        "voicemail",
        "busy",
        "wrong_number",
      ],
      lead_status: [
        "not_started",
        "contacted",
        "consultation",
        "pending",
        "drafting",
        "won",
        "lost",
        "meeting",
        "hold",
        "qualified",
        "negotiation",
        "consultation_completed",
        "unreachable",
      ],
      leave_request_status: ["pending", "approved", "denied"],
      notification_status: ["sent", "failed", "skipped"],
      notification_type: [
        "document_expiry_digest",
        "individual_reminder",
        "leave_approval",
        "leave_denial",
        "kpi_quarterly_report",
        "kpi_incomplete_reminder",
        "kpi_monthly_reminder",
        "document_threshold_alert",
      ],
      permission_level: ["head", "employee"],
      proposal_status: ["draft", "sent", "paid", "cancelled"],
      reminder_status: ["pending", "triggered", "done", "dismissed"],
      review_status: ["draft", "submitted", "approved", "complete"],
      transaction_category: [
        "consultation_fee",
        "service_fee",
        "other_income",
        "salary",
        "rent",
        "utilities",
        "marketing",
        "software",
        "office_supplies",
        "travel",
        "legal",
        "taxes",
        "other_expense",
      ],
      transaction_type: ["earning", "expense"],
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
