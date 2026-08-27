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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      action_plan_deadline_change_requests: {
        Row: {
          action_plan_id: string
          action_revision: number
          applied_action_revision: number | null
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          id: string
          organization_id: string
          previous_due_date: string
          reason: string
          recommendation_id: string
          requested_at: string
          requested_by: string
          requested_due_date: string
          status: Database["public"]["Enums"]["action_plan_deadline_change_status"]
        }
        Insert: {
          action_plan_id: string
          action_revision: number
          applied_action_revision?: number | null
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          organization_id: string
          previous_due_date: string
          reason: string
          recommendation_id: string
          requested_at?: string
          requested_by: string
          requested_due_date: string
          status?: Database["public"]["Enums"]["action_plan_deadline_change_status"]
        }
        Update: {
          action_plan_id?: string
          action_revision?: number
          applied_action_revision?: number | null
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          organization_id?: string
          previous_due_date?: string
          reason?: string
          recommendation_id?: string
          requested_at?: string
          requested_by?: string
          requested_due_date?: string
          status?: Database["public"]["Enums"]["action_plan_deadline_change_status"]
        }
        Relationships: [
          { foreignKeyName: "action_plan_deadline_change_requests_action_plan_id_fkey"; columns: ["action_plan_id"]; isOneToOne: false; referencedRelation: "action_plans"; referencedColumns: ["id"] },
          { foreignKeyName: "action_plan_deadline_change_requests_decided_by_fkey"; columns: ["decided_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "action_plan_deadline_change_requests_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "action_plan_deadline_change_requests_recommendation_id_fkey"; columns: ["recommendation_id"]; isOneToOne: false; referencedRelation: "current_recommendation_read_model"; referencedColumns: ["recommendation_id"] },
          { foreignKeyName: "action_plan_deadline_change_requests_recommendation_id_fkey"; columns: ["recommendation_id"]; isOneToOne: false; referencedRelation: "recommendations"; referencedColumns: ["id"] },
          { foreignKeyName: "action_plan_deadline_change_requests_requested_by_fkey"; columns: ["requested_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
        ]
      }
      action_plan_supervision_notes: {
        Row: {
          action_plan_id: string | null
          action_revision: number | null
          action_snapshot: Json
          author_id: string
          author_role: Database["public"]["Enums"]["app_user_role"]
          body: string
          created_at: string
          id: string
          lifecycle_status: Database["public"]["Enums"]["supervision_note_lifecycle_status"]
          note_type: string
          recommendation_id: string
          resolution_body: string | null
          resolved_at: string | null
          resolved_by: string | null
          responded_at: string | null
          responded_by: string | null
          response_body: string | null
        }
        Insert: {
          action_plan_id?: string | null
          action_revision?: number | null
          action_snapshot?: Json
          author_id: string
          author_role: Database["public"]["Enums"]["app_user_role"]
          body: string
          created_at?: string
          id?: string
          lifecycle_status: Database["public"]["Enums"]["supervision_note_lifecycle_status"]
          note_type: string
          recommendation_id: string
          resolution_body?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response_body?: string | null
        }
        Update: {
          action_plan_id?: string | null
          action_revision?: number | null
          action_snapshot?: Json
          author_id?: string
          author_role?: Database["public"]["Enums"]["app_user_role"]
          body?: string
          created_at?: string
          id?: string
          lifecycle_status?: Database["public"]["Enums"]["supervision_note_lifecycle_status"]
          note_type?: string
          recommendation_id?: string
          resolution_body?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response_body?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_supervision_notes_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plan_supervision_notes_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "current_recommendation_read_model"
            referencedColumns: ["recommendation_id"]
          },
          {
            foreignKeyName: "action_plan_supervision_notes_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plan_bimonthly_reports: {
        Row: {
          id: string
          cycle_id: string
          source_cycle_processing_id: string
          reference_year: number
          bimester: number
          report_version: number
          period_start: string
          period_end: string
          generated_by: string | null
          generation_kind: string
          generated_at: string
          closed_at: string | null
          active_action_count: number
          not_started_count: number
          in_progress_count: number
          completed_count: number
          overdue_count: number
          cancelled_count: number
          average_progress_percentage: number
          completed_criterion_count: number
          pending_criterion_count: number
          actions_completed_in_period: number
          actions_advanced_in_period: number
          actions_stagnant_in_period: number
          actions_became_overdue_in_period: number
          criteria_completed_in_period: number
        }
        Insert: {
          id?: string
          cycle_id: string
          source_cycle_processing_id: string
          reference_year: number
          bimester: number
          report_version: number
          period_start: string
          period_end: string
          generated_by?: string | null
          generation_kind?: string
          generated_at?: string
          closed_at?: string | null
          active_action_count?: number
          not_started_count?: number
          in_progress_count?: number
          completed_count?: number
          overdue_count?: number
          cancelled_count?: number
          average_progress_percentage?: number
          completed_criterion_count?: number
          pending_criterion_count?: number
          actions_completed_in_period?: number
          actions_advanced_in_period?: number
          actions_stagnant_in_period?: number
          actions_became_overdue_in_period?: number
          criteria_completed_in_period?: number
        }
        Update: {
          id?: string
          cycle_id?: string
          source_cycle_processing_id?: string
          reference_year?: number
          bimester?: number
          report_version?: number
          period_start?: string
          period_end?: string
          generated_by?: string | null
          generation_kind?: string
          generated_at?: string
          closed_at?: string | null
          active_action_count?: number
          not_started_count?: number
          in_progress_count?: number
          completed_count?: number
          overdue_count?: number
          cancelled_count?: number
          average_progress_percentage?: number
          completed_criterion_count?: number
          pending_criterion_count?: number
          actions_completed_in_period?: number
          actions_advanced_in_period?: number
          actions_stagnant_in_period?: number
          actions_became_overdue_in_period?: number
          criteria_completed_in_period?: number
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_bimonthly_reports_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plan_bimonthly_action_snapshots: {
        Row: {
          id: string
          report_id: string
          action_plan_id: string
          recommendation_id: string
          question_version_id: string
          section_id: string
          axis_id: string
          action_text: string
          responsible_label: string
          start_date: string
          due_date: string
          status: Database["public"]["Enums"]["action_plan_status"]
          progress_percentage: number
          revision: number
          effective_at: string
          overdue: boolean
          has_valid_evidence: boolean
          evidence_document_id: string | null
          approved: boolean
          approval_effective_at: string | null
          has_open_adjustment: boolean
          completed_in_period: boolean
          advanced_in_period: boolean
          stagnant_in_period: boolean
          became_overdue_in_period: boolean
          movements_in_period: Json
          captured_at: string
        }
        Insert: {
          id?: string
          report_id: string
          action_plan_id: string
          recommendation_id: string
          question_version_id: string
          section_id: string
          axis_id: string
          action_text: string
          responsible_label: string
          start_date: string
          due_date: string
          status: Database["public"]["Enums"]["action_plan_status"]
          progress_percentage: number
          revision: number
          effective_at: string
          overdue: boolean
          has_valid_evidence: boolean
          evidence_document_id?: string | null
          approved: boolean
          approval_effective_at?: string | null
          has_open_adjustment: boolean
          completed_in_period: boolean
          advanced_in_period: boolean
          stagnant_in_period: boolean
          became_overdue_in_period: boolean
          movements_in_period?: Json
          captured_at?: string
        }
        Update: {
          id?: string
          report_id?: string
          action_plan_id?: string
          recommendation_id?: string
          question_version_id?: string
          section_id?: string
          axis_id?: string
          action_text?: string
          responsible_label?: string
          start_date?: string
          due_date?: string
          status?: Database["public"]["Enums"]["action_plan_status"]
          progress_percentage?: number
          revision?: number
          effective_at?: string
          overdue?: boolean
          has_valid_evidence?: boolean
          evidence_document_id?: string | null
          approved?: boolean
          approval_effective_at?: string | null
          has_open_adjustment?: boolean
          completed_in_period?: boolean
          advanced_in_period?: boolean
          stagnant_in_period?: boolean
          became_overdue_in_period?: boolean
          movements_in_period?: Json
          captured_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_bimonthly_action_snapshots_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "action_plan_bimonthly_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plan_bimonthly_criterion_snapshots: {
        Row: {
          id: string
          report_id: string
          question_version_id: string
          recommendation_id: string
          section_id: string
          axis_id: string
          criterion_completed: boolean
          active_action_count: number
          completed_action_count: number
          completed_in_period: boolean
          captured_at: string
        }
        Insert: {
          id?: string
          report_id: string
          question_version_id: string
          recommendation_id: string
          section_id: string
          axis_id: string
          criterion_completed: boolean
          active_action_count: number
          completed_action_count: number
          completed_in_period: boolean
          captured_at?: string
        }
        Update: {
          id?: string
          report_id?: string
          question_version_id?: string
          recommendation_id?: string
          section_id?: string
          axis_id?: string
          criterion_completed?: boolean
          active_action_count?: number
          completed_action_count?: number
          completed_in_period?: boolean
          captured_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_bimonthly_criterion_snapshots_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "action_plan_bimonthly_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plan_documents: {
        Row: {
          action_plan_id: string
          action_revision: number
          created_at: string
          deactivated_at: string | null
          deactivated_by: string | null
          deactivation_reason: string | null
          external_link: string | null
          id: string
          kind: string
          file_validation_status: string
          validated_at: string | null
          mime_type: string | null
          organization_id: string
          original_filename: string | null
          size_bytes: number | null
          storage_path: string | null
          title: string
          uploaded_by: string
        }
        Insert: {
          action_plan_id: string
          action_revision: number
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          external_link?: string | null
          id?: string
          kind: string
          file_validation_status?: string
          validated_at?: string | null
          mime_type?: string | null
          organization_id: string
          original_filename?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          title: string
          uploaded_by: string
        }
        Update: {
          action_plan_id?: string
          action_revision?: number
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          external_link?: string | null
          id?: string
          kind?: string
          file_validation_status?: string
          validated_at?: string | null
          mime_type?: string | null
          organization_id?: string
          original_filename?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_documents_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plan_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_action_plan_document_uploads: {
        Row: {
          action_plan_id: string
          action_revision: number
          created_at: string
          expires_at: string
          id: string
          mime_type: string | null
          organization_id: string
          original_filename: string
          size_bytes: number
          storage_path: string
          title: string
          uploaded_by: string
        }
        Insert: {
          action_plan_id: string
          action_revision: number
          created_at?: string
          expires_at: string
          id?: string
          mime_type?: string | null
          organization_id: string
          original_filename: string
          size_bytes: number
          storage_path: string
          title: string
          uploaded_by: string
        }
        Update: {
          action_plan_id?: string
          action_revision?: number
          created_at?: string
          expires_at?: string
          id?: string
          mime_type?: string | null
          organization_id?: string
          original_filename?: string
          size_bytes?: number
          storage_path?: string
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_action_plan_document_uploads_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_action_plan_document_uploads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plan_storage_cleanup_queue: {
        Row: {
          attempts: number
          created_at: string
          last_error: string | null
          scheduled_for: string
          storage_path: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          last_error?: string | null
          scheduled_for?: string
          storage_path: string
        }
        Update: {
          attempts?: number
          created_at?: string
          last_error?: string | null
          scheduled_for?: string
          storage_path?: string
        }
        Relationships: []
      }
      action_plans: {
        Row: {
          action_text: string
          axis_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          due_date: string
          execution_notes: string | null
          id: string
          progress_percentage: number
          recommendation_id: string
          responsible_label: string
          responsible_user_id: string | null
          revision: number
          start_date: string
          status: Database["public"]["Enums"]["action_plan_status"]
          updated_at: string
        }
        Insert: {
          action_text: string
          axis_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          due_date: string
          execution_notes?: string | null
          id?: string
          progress_percentage?: number
          recommendation_id: string
          responsible_label: string
          responsible_user_id?: string | null
          revision?: number
          start_date: string
          status?: Database["public"]["Enums"]["action_plan_status"]
          updated_at?: string
        }
        Update: {
          action_text?: string
          axis_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string
          execution_notes?: string | null
          id?: string
          progress_percentage?: number
          recommendation_id?: string
          responsible_label?: string
          responsible_user_id?: string | null
          revision?: number
          start_date?: string
          status?: Database["public"]["Enums"]["action_plan_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_axis_id_fkey"
            columns: ["axis_id"]
            isOneToOne: false
            referencedRelation: "axes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "current_recommendation_read_model"
            referencedColumns: ["recommendation_id"]
          },
          {
            foreignKeyName: "action_plans_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plan_progress_updates: {
        Row: {
          action_plan_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          new_percentage: number
          new_status: Database["public"]["Enums"]["action_plan_status"]
          previous_percentage: number
          previous_status: Database["public"]["Enums"]["action_plan_status"]
        }
        Insert: {
          action_plan_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          new_percentage: number
          new_status: Database["public"]["Enums"]["action_plan_status"]
          previous_percentage: number
          previous_status: Database["public"]["Enums"]["action_plan_status"]
        }
        Update: {
          action_plan_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          new_percentage?: number
          new_status?: Database["public"]["Enums"]["action_plan_status"]
          previous_percentage?: number
          previous_status?: Database["public"]["Enums"]["action_plan_status"]
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_progress_updates_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limits: {
        Row: {
          bucket_key: string
          expires_at: string
          hit_count: number
          updated_at: string
          window_started_at: string
        }
        Insert: {
          bucket_key: string
          expires_at: string
          hit_count: number
          updated_at?: string
          window_started_at: string
        }
        Update: {
          bucket_key?: string
          expires_at?: string
          hit_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          actor_user_id: string | null
          after_json: Json | null
          before_json: Json | null
          created_at: string
          entity_type: string | null
          event_type: string
          id: string
          record_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity_type?: string | null
          event_type: string
          id?: string
          record_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity_type?: string | null
          event_type?: string
          id?: string
          record_id?: string | null
        }
        Relationships: []
      }
      automation_job_items: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          idempotency_key: string | null
          input: Json
          job_id: string
          message: string | null
          output: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          idempotency_key?: string | null
          input?: Json
          job_id: string
          message?: string | null
          output?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          idempotency_key?: string | null
          input?: Json
          job_id?: string
          message?: string | null
          output?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          dedupe_key: string | null
          error_message: string | null
          executed_by_system: boolean
          id: string
          kind: string
          last_duration_ms: number | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          requested_by: string | null
          result_summary: Json
          scheduled_for: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          error_message?: string | null
          executed_by_system?: boolean
          id?: string
          kind: string
          last_duration_ms?: number | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          requested_by?: string | null
          result_summary?: Json
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          error_message?: string | null
          executed_by_system?: boolean
          id?: string
          kind?: string
          last_duration_ms?: number | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          requested_by?: string | null
          result_summary?: Json
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      axes: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      cycle_processings: {
        Row: {
          completed_at: string | null
          created_at: string
          cycle_id: string
          fami_policy_version: string
          fami_scoring_model: string
          id: string
          processing_version: number
          status: Database["public"]["Enums"]["cycle_processing_status"]
          thresholds: Json
          yes_with_approved_evidence_weight: number
          yes_without_evidence_weight: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          cycle_id: string
          fami_policy_version?: string
          fami_scoring_model?: string
          id?: string
          processing_version: number
          status?: Database["public"]["Enums"]["cycle_processing_status"]
          thresholds?: Json
          yes_with_approved_evidence_weight?: number
          yes_without_evidence_weight?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          cycle_id?: string
          fami_policy_version?: string
          fami_scoring_model?: string
          id?: string
          processing_version?: number
          status?: Database["public"]["Enums"]["cycle_processing_status"]
          thresholds?: Json
          yes_with_approved_evidence_weight?: number
          yes_without_evidence_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "cycle_processings_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_processings_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "form_answer_cycle_read_model"
            referencedColumns: ["cycle_id"]
          },
        ]
      }
      cycle_reopen_allowed_questions: {
        Row: {
          question_version_id: string
          reopen_event_id: string
        }
        Insert: {
          question_version_id: string
          reopen_event_id: string
        }
        Update: {
          question_version_id?: string
          reopen_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_reopen_allowed_questions_reopen_event_id_fkey"
            columns: ["reopen_event_id"]
            isOneToOne: false
            referencedRelation: "cycle_reopen_events"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_deadline_events: {
        Row: {
          action: string
          actor_user_id: string
          batch_id: string
          created_at: string
          cycle_id: string
          form_id: string
          id: string
          justification: string
          new_deadline_at: string | null
          organization_id: string
          period_label: string
          previous_deadline_at: string | null
          scope: string
        }
        Insert: {
          action: string
          actor_user_id: string
          batch_id: string
          created_at?: string
          cycle_id: string
          form_id: string
          id?: string
          justification: string
          new_deadline_at?: string | null
          organization_id: string
          period_label: string
          previous_deadline_at?: string | null
          scope: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          batch_id?: string
          created_at?: string
          cycle_id?: string
          form_id?: string
          id?: string
          justification?: string
          new_deadline_at?: string | null
          organization_id?: string
          period_label?: string
          previous_deadline_at?: string | null
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_deadline_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_deadline_events_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_deadline_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_reopen_events: {
        Row: {
          actor_user_id: string
          created_at: string
          cycle_id: string
          id: string
          new_deadline_at: string
          previous_deadline_at: string | null
          reason: string
          reopen_number: number
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          cycle_id: string
          id?: string
          new_deadline_at: string
          previous_deadline_at?: string | null
          reason: string
          reopen_number: number
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          cycle_id?: string
          id?: string
          new_deadline_at?: string
          previous_deadline_at?: string | null
          reason?: string
          reopen_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "cycle_reopen_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_reopen_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "form_answer_cycle_read_model"
            referencedColumns: ["cycle_id"]
          },
        ]
      }
      cycle_submission_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          cycle_id: string
          delay_seconds: number
          from_state: Database["public"]["Enums"]["cycle_state"]
          id: string
          response_deadline_at: string | null
          submitted_at: string
          to_state: Database["public"]["Enums"]["cycle_state"]
          was_late: boolean
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          cycle_id: string
          delay_seconds?: number
          from_state: Database["public"]["Enums"]["cycle_state"]
          id?: string
          response_deadline_at?: string | null
          submitted_at: string
          to_state: Database["public"]["Enums"]["cycle_state"]
          was_late: boolean
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          cycle_id?: string
          delay_seconds?: number
          from_state?: Database["public"]["Enums"]["cycle_state"]
          id?: string
          response_deadline_at?: string | null
          submitted_at?: string
          to_state?: Database["public"]["Enums"]["cycle_state"]
          was_late?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cycle_submission_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_submission_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "form_answer_cycle_read_model"
            referencedColumns: ["cycle_id"]
          },
        ]
      }
      cycle_validation_reopen_events: {
        Row: {
          actor_user_id: string
          created_at: string
          cycle_id: string
          from_state: Database["public"]["Enums"]["cycle_state"]
          id: string
          new_cycle_processing_id: string
          previous_cycle_processing_id: string | null
          previous_validated_at: string | null
          reason: string
          reopen_number: number
          to_state: Database["public"]["Enums"]["cycle_state"]
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          cycle_id: string
          from_state: Database["public"]["Enums"]["cycle_state"]
          id?: string
          new_cycle_processing_id: string
          previous_cycle_processing_id?: string | null
          previous_validated_at?: string | null
          reason: string
          reopen_number: number
          to_state: Database["public"]["Enums"]["cycle_state"]
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          cycle_id?: string
          from_state?: Database["public"]["Enums"]["cycle_state"]
          id?: string
          new_cycle_processing_id?: string
          previous_cycle_processing_id?: string | null
          previous_validated_at?: string | null
          reason?: string
          reopen_number?: number
          to_state?: Database["public"]["Enums"]["cycle_state"]
        }
        Relationships: [
          {
            foreignKeyName: "cycle_validation_reopen_event_previous_cycle_processing_id_fkey"
            columns: ["previous_cycle_processing_id"]
            isOneToOne: false
            referencedRelation: "cycle_processings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_validation_reopen_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_validation_reopen_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "form_answer_cycle_read_model"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "cycle_validation_reopen_events_new_cycle_processing_id_fkey"
            columns: ["new_cycle_processing_id"]
            isOneToOne: false
            referencedRelation: "cycle_processings"
            referencedColumns: ["id"]
          },
        ]
      }
      cycles: {
        Row: {
          action_plan_revision: number
          closed_at: string | null
          created_at: string
          cycle_close_at: string | null
          deadline_change_count: number
          deadline_policy: string
          form_version_id: string
          id: string
          organization_id: string
          original_response_deadline_at: string | null
          period_id: string
          period_label: string
          reference_end_year: number | null
          reference_start_year: number | null
          reminder_offsets_days: number[]
          reopen_count: number
          reopened_at: string | null
          response_collection_pause_reason: string | null
          response_collection_paused_at: string | null
          response_deadline_at: string | null
          schedule_revision: number
          starts_at: string | null
          state: Database["public"]["Enums"]["cycle_state"]
          submission_delay_seconds: number | null
          submitted_at: string | null
          submitted_late_at: string | null
          updated_at: string
          validated_at: string | null
          validation_deadline_at: string | null
        }
        Insert: {
          action_plan_revision?: number
          closed_at?: string | null
          created_at?: string
          cycle_close_at?: string | null
          deadline_change_count?: number
          deadline_policy?: string
          form_version_id: string
          id?: string
          organization_id: string
          original_response_deadline_at?: string | null
          period_id: string
          period_label: string
          reference_end_year?: number | null
          reference_start_year?: number | null
          reminder_offsets_days?: number[]
          reopen_count?: number
          reopened_at?: string | null
          response_collection_pause_reason?: string | null
          response_collection_paused_at?: string | null
          response_deadline_at?: string | null
          schedule_revision?: number
          starts_at?: string | null
          state?: Database["public"]["Enums"]["cycle_state"]
          submission_delay_seconds?: number | null
          submitted_at?: string | null
          submitted_late_at?: string | null
          updated_at?: string
          validated_at?: string | null
          validation_deadline_at?: string | null
        }
        Update: {
          action_plan_revision?: number
          closed_at?: string | null
          created_at?: string
          cycle_close_at?: string | null
          deadline_change_count?: number
          deadline_policy?: string
          form_version_id?: string
          id?: string
          organization_id?: string
          original_response_deadline_at?: string | null
          period_id?: string
          period_label?: string
          reference_end_year?: number | null
          reference_start_year?: number | null
          reminder_offsets_days?: number[]
          reopen_count?: number
          reopened_at?: string | null
          response_collection_pause_reason?: string | null
          response_collection_paused_at?: string | null
          response_deadline_at?: string | null
          schedule_revision?: number
          starts_at?: string | null
          state?: Database["public"]["Enums"]["cycle_state"]
          submission_delay_seconds?: number | null
          submitted_at?: string | null
          submitted_late_at?: string | null
          updated_at?: string
          validated_at?: string | null
          validation_deadline_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycles_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycles_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "form_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_snapshots: {
        Row: {
          created_at: string
          cycle_processing_id: string
          evidence_id: string | null
          external_link: string | null
          id: string
          kind: Database["public"]["Enums"]["evidence_kind"]
          link_reason: string | null
          mime_type: string | null
          original_filename: string | null
          question_version_id: string
          response_snapshot_id: string
          sha256: string | null
          size_bytes: number | null
          storage_path: string | null
          text_body: string | null
          title: string | null
          validation_justification: string | null
          validation_status: Database["public"]["Enums"]["evidence_validation_status"]
        }
        Insert: {
          created_at?: string
          cycle_processing_id: string
          evidence_id?: string | null
          external_link?: string | null
          id?: string
          kind: Database["public"]["Enums"]["evidence_kind"]
          link_reason?: string | null
          mime_type?: string | null
          original_filename?: string | null
          question_version_id: string
          response_snapshot_id: string
          sha256?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          text_body?: string | null
          title?: string | null
          validation_justification?: string | null
          validation_status: Database["public"]["Enums"]["evidence_validation_status"]
        }
        Update: {
          created_at?: string
          cycle_processing_id?: string
          evidence_id?: string | null
          external_link?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["evidence_kind"]
          link_reason?: string | null
          mime_type?: string | null
          original_filename?: string | null
          question_version_id?: string
          response_snapshot_id?: string
          sha256?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          text_body?: string | null
          title?: string | null
          validation_justification?: string | null
          validation_status?: Database["public"]["Enums"]["evidence_validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "evidence_snapshots_cycle_processing_id_fkey"
            columns: ["cycle_processing_id"]
            isOneToOne: false
            referencedRelation: "cycle_processings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_snapshots_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_operational_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_snapshots_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_snapshots_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_snapshots_response_context_fkey"
            columns: [
              "response_snapshot_id",
              "cycle_processing_id",
              "question_version_id",
            ]
            isOneToOne: false
            referencedRelation: "response_snapshots"
            referencedColumns: [
              "id",
              "cycle_processing_id",
              "question_version_id",
            ]
          },
          {
            foreignKeyName: "evidence_snapshots_response_snapshot_id_fkey"
            columns: ["response_snapshot_id"]
            isOneToOne: false
            referencedRelation: "response_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_storage_cleanup_queue: {
        Row: {
          attempts: number
          created_at: string
          last_error: string | null
          scheduled_for: string
          storage_path: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          last_error?: string | null
          scheduled_for?: string
          storage_path: string
        }
        Update: {
          attempts?: number
          created_at?: string
          last_error?: string | null
          scheduled_for?: string
          storage_path?: string
        }
        Relationships: []
      }
      evidences: {
        Row: {
          deactivated_at: string | null
          external_link: string | null
          id: string
          kind: Database["public"]["Enums"]["evidence_kind"]
          link_reason: string | null
          file_validation_status: string
          file_validated_at: string | null
          mime_type: string | null
          original_filename: string | null
          response_id: string
          sha256: string | null
          size_bytes: number | null
          storage_path: string | null
          submitted_at: string
          submitted_by: string
          text_body: string | null
          title: string | null
          validated_at: string | null
          validated_by: string | null
          validation_justification: string | null
          validation_status: Database["public"]["Enums"]["evidence_validation_status"]
        }
        Insert: {
          deactivated_at?: string | null
          external_link?: string | null
          id?: string
          kind: Database["public"]["Enums"]["evidence_kind"]
          link_reason?: string | null
          file_validation_status?: string
          file_validated_at?: string | null
          mime_type?: string | null
          original_filename?: string | null
          response_id: string
          sha256?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          submitted_at?: string
          submitted_by: string
          text_body?: string | null
          title?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_justification?: string | null
          validation_status?: Database["public"]["Enums"]["evidence_validation_status"]
        }
        Update: {
          deactivated_at?: string | null
          external_link?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["evidence_kind"]
          link_reason?: string | null
          file_validation_status?: string
          file_validated_at?: string | null
          mime_type?: string | null
          original_filename?: string | null
          response_id?: string
          sha256?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          submitted_at?: string
          submitted_by?: string
          text_body?: string | null
          title?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_justification?: string | null
          validation_status?: Database["public"]["Enums"]["evidence_validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "evidences_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      fami_preliminary_processings: {
        Row: {
          calculated_at: string
          calculated_by: string | null
          calculation_kind: string
          calculation_version: number
          closed_at: string | null
          cycle_id: string
          id: string
          methodology_version: string
          period_end: string
          period_start: string
          quadrimester: number
          reference_year: number
          source_cycle_processing_id: string
          source_policy_version: string
          source_processing_version: number
        }
        Insert: {
          calculated_at?: string
          calculated_by?: string | null
          calculation_kind?: string
          calculation_version: number
          closed_at?: string | null
          cycle_id: string
          id?: string
          methodology_version?: string
          period_end: string
          period_start: string
          quadrimester: number
          reference_year: number
          source_cycle_processing_id: string
          source_policy_version: string
          source_processing_version: number
        }
        Update: {
          calculated_at?: string
          calculated_by?: string | null
          calculation_kind?: string
          calculation_version?: number
          closed_at?: string | null
          cycle_id?: string
          id?: string
          methodology_version?: string
          period_end?: string
          period_start?: string
          quadrimester?: number
          reference_year?: number
          source_cycle_processing_id?: string
          source_policy_version?: string
          source_processing_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fami_preliminary_processings_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fami_preliminary_processings_source_fkey"
            columns: ["source_cycle_processing_id", "cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_processings"
            referencedColumns: ["id", "cycle_id"]
          },
        ]
      }
      fami_preliminary_action_snapshots: {
        Row: {
          action_plan_id: string
          approval_effective_at: string | null
          approved: boolean | null
          captured_at: string
          due_date: string | null
          effective_at: string
          evidence_document_id: string | null
          has_open_adjustment: boolean | null
          has_valid_evidence: boolean | null
          id: string
          preliminary_processing_id: string
          progress_percentage: number
          recommendation_id: string
          revision: number | null
          status: Database["public"]["Enums"]["action_plan_status"]
        }
        Insert: {
          action_plan_id: string
          approval_effective_at?: string | null
          approved?: boolean | null
          captured_at?: string
          due_date?: string | null
          effective_at: string
          evidence_document_id?: string | null
          has_open_adjustment?: boolean | null
          has_valid_evidence?: boolean | null
          id?: string
          preliminary_processing_id: string
          progress_percentage: number
          recommendation_id: string
          revision?: number | null
          status: Database["public"]["Enums"]["action_plan_status"]
        }
        Update: {
          action_plan_id?: string
          approval_effective_at?: string | null
          approved?: boolean | null
          captured_at?: string
          due_date?: string | null
          effective_at?: string
          evidence_document_id?: string | null
          has_open_adjustment?: boolean | null
          has_valid_evidence?: boolean | null
          id?: string
          preliminary_processing_id?: string
          progress_percentage?: number
          recommendation_id?: string
          revision?: number | null
          status?: Database["public"]["Enums"]["action_plan_status"]
        }
        Relationships: [
          {
            foreignKeyName: "fami_preliminary_action_snapshots_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fami_preliminary_action_snapshots_preliminary_processing_id_fkey"
            columns: ["preliminary_processing_id"]
            isOneToOne: false
            referencedRelation: "fami_preliminary_processings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fami_preliminary_action_snapshots_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      fami_preliminary_criterion_results: {
        Row: {
          action_progress_percentage: number
          active_action_count: number
          approved_exception_id: string | null
          axis_id: string
          completed_action_count: number | null
          created_at: string
          criterion_completed: boolean | null
          id: string
          included_in_calculation: boolean
          official_points: number
          points_possible: number
          preliminary_points: number
          preliminary_processing_id: string
          question_version_id: string
          recommendation_id: string | null
          recoverable_gap: number
          recovered_points: number
          section_id: string
        }
        Insert: {
          action_progress_percentage: number
          active_action_count: number
          approved_exception_id?: string | null
          axis_id: string
          completed_action_count?: number | null
          created_at?: string
          criterion_completed?: boolean | null
          id?: string
          included_in_calculation: boolean
          official_points: number
          points_possible: number
          preliminary_points: number
          preliminary_processing_id: string
          question_version_id: string
          recommendation_id?: string | null
          recoverable_gap: number
          recovered_points: number
          section_id: string
        }
        Update: {
          action_progress_percentage?: number
          active_action_count?: number
          approved_exception_id?: string | null
          axis_id?: string
          completed_action_count?: number | null
          created_at?: string
          criterion_completed?: boolean | null
          id?: string
          included_in_calculation?: boolean
          official_points?: number
          points_possible?: number
          preliminary_points?: number
          preliminary_processing_id?: string
          question_version_id?: string
          recommendation_id?: string | null
          recoverable_gap?: number
          recovered_points?: number
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fami_preliminary_criterion_results_preliminary_processing_id_fkey"
            columns: ["preliminary_processing_id"]
            isOneToOne: false
            referencedRelation: "fami_preliminary_processings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fami_preliminary_criterion_results_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      fami_preliminary_results: {
        Row: {
          created_at: string
          cycle_id: string
          id: string
          maturity_level: number | null
          percentage: number
          points_obtained: number
          points_possible: number
          preliminary_processing_id: string
          scope_id: string | null
          scope_type: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          id?: string
          maturity_level?: number | null
          percentage: number
          points_obtained: number
          points_possible: number
          preliminary_processing_id: string
          scope_id?: string | null
          scope_type: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          id?: string
          maturity_level?: number | null
          percentage?: number
          points_obtained?: number
          points_possible?: number
          preliminary_processing_id?: string
          scope_id?: string | null
          scope_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fami_preliminary_results_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fami_preliminary_results_preliminary_processing_id_fkey"
            columns: ["preliminary_processing_id"]
            isOneToOne: false
            referencedRelation: "fami_preliminary_processings"
            referencedColumns: ["id"]
          },
        ]
      }
      fami_results: {
        Row: {
          created_at: string
          cycle_id: string
          cycle_processing_id: string
          id: string
          maturity_level: number | null
          percentage: number
          points_obtained: number
          points_possible: number
          scope_id: string | null
          scope_type: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          cycle_processing_id: string
          id?: string
          maturity_level?: number | null
          percentage: number
          points_obtained: number
          points_possible: number
          scope_id?: string | null
          scope_type: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          cycle_processing_id?: string
          id?: string
          maturity_level?: number | null
          percentage?: number
          points_obtained?: number
          points_possible?: number
          scope_id?: string | null
          scope_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fami_results_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fami_results_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "form_answer_cycle_read_model"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "fami_results_processing_fkey"
            columns: ["cycle_processing_id", "cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_processings"
            referencedColumns: ["id", "cycle_id"]
          },
        ]
      }
      form_periods: {
        Row: {
          created_at: string
          form_version_id: string
          id: string
          label: string
          period_code: string
          response_deadline_at: string | null
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          form_version_id: string
          id?: string
          label: string
          period_code: string
          response_deadline_at?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          form_version_id?: string
          id?: string
          label?: string
          period_code?: string
          response_deadline_at?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_periods_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          form_id: string
          id: string
          organization_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          form_id: string
          id?: string
          organization_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          form_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_assignments_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      form_draft_questions: {
        Row: {
          form_draft_id: string
          order_index: number
          question_id: string
        }
        Insert: {
          form_draft_id: string
          order_index?: number
          question_id: string
        }
        Update: {
          form_draft_id?: string
          order_index?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_draft_questions_form_draft_id_fkey"
            columns: ["form_draft_id"]
            isOneToOne: false
            referencedRelation: "form_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_draft_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_drafts: {
        Row: {
          form_id: string
          id: string
          updated_at: string
        }
        Insert: {
          form_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          form_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_drafts_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: true
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_questions: {
        Row: {
          form_version_id: string
          order_index: number
          question_version_id: string
        }
        Insert: {
          form_version_id: string
          order_index?: number
          question_version_id: string
        }
        Update: {
          form_version_id?: string
          order_index?: number
          question_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_questions_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_questions_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_versions: {
        Row: {
          form_id: string
          id: string
          published_at: string
          published_by: string | null
          state: Database["public"]["Enums"]["form_version_state"]
          version: number
        }
        Insert: {
          form_id: string
          id?: string
          published_at?: string
          published_by?: string | null
          state?: Database["public"]["Enums"]["form_version_state"]
          version: number
        }
        Update: {
          form_id?: string
          id?: string
          published_at?: string
          published_by?: string | null
          state?: Database["public"]["Enums"]["form_version_state"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_versions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string
          created_by: string
          current_form_version_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_form_version_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_form_version_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_current_version_fkey"
            columns: ["current_form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      library_audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          diff: Json | null
          entity: string
          extra: Json | null
          from_status: string | null
          from_version: string | null
          hash: string | null
          id: string
          item_id: string | null
          item_type: string | null
          justification: string | null
          organization_id: string | null
          request_id: string | null
          to_status: string | null
          to_version: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          diff?: Json | null
          entity: string
          extra?: Json | null
          from_status?: string | null
          from_version?: string | null
          hash?: string | null
          id?: string
          item_id?: string | null
          item_type?: string | null
          justification?: string | null
          organization_id?: string | null
          request_id?: string | null
          to_status?: string | null
          to_version?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          diff?: Json | null
          entity?: string
          extra?: Json | null
          from_status?: string | null
          from_version?: string | null
          hash?: string | null
          id?: string
          item_id?: string | null
          item_type?: string | null
          justification?: string | null
          organization_id?: string | null
          request_id?: string | null
          to_status?: string | null
          to_version?: string | null
        }
        Relationships: []
      }
      library_item_versions: {
        Row: {
          created_at: string
          deprecated_at: string | null
          deprecated_by: string | null
          hash: string
          id: string
          item_id: string
          item_type: string
          payload: Json
          previous_version_id: string | null
          published_at: string
          published_by: string | null
          version: string
          version_major: number
          version_minor: number
          version_patch: number
          vigente_ate: string | null
          vigente_de: string
        }
        Insert: {
          created_at?: string
          deprecated_at?: string | null
          deprecated_by?: string | null
          hash: string
          id?: string
          item_id: string
          item_type: string
          payload?: Json
          previous_version_id?: string | null
          published_at?: string
          published_by?: string | null
          version: string
          version_major: number
          version_minor: number
          version_patch: number
          vigente_ate?: string | null
          vigente_de: string
        }
        Update: {
          created_at?: string
          deprecated_at?: string | null
          deprecated_by?: string | null
          hash?: string
          id?: string
          item_id?: string
          item_type?: string
          payload?: Json
          previous_version_id?: string | null
          published_at?: string
          published_by?: string | null
          version?: string
          version_major?: number
          version_minor?: number
          version_patch?: number
          vigente_ate?: string | null
          vigente_de?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_item_versions_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "library_item_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      library_recommendations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          code: string
          created_at: string
          created_by: string | null
          deprecated_at: string | null
          deprecated_by: string | null
          description: string | null
          escopo_aplicacao: string | null
          fundamento_tecnico: string | null
          id: string
          status: Database["public"]["Enums"]["library_item_status"]
          tags: string[]
          texto_base_fixo: string | null
          texto_base_parametrizavel: string | null
          tipo: Database["public"]["Enums"]["recommendation_type"]
          title: string
          updated_at: string
          updated_by: string | null
          variaveis_parametro: Json
          version_major: number
          version_minor: number
          version_patch: number
          vigente_ate: string | null
          vigente_de: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          deprecated_at?: string | null
          deprecated_by?: string | null
          description?: string | null
          escopo_aplicacao?: string | null
          fundamento_tecnico?: string | null
          id?: string
          status?: Database["public"]["Enums"]["library_item_status"]
          tags?: string[]
          texto_base_fixo?: string | null
          texto_base_parametrizavel?: string | null
          tipo?: Database["public"]["Enums"]["recommendation_type"]
          title: string
          updated_at?: string
          updated_by?: string | null
          variaveis_parametro?: Json
          version_major?: number
          version_minor?: number
          version_patch?: number
          vigente_ate?: string | null
          vigente_de?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          deprecated_at?: string | null
          deprecated_by?: string | null
          description?: string | null
          escopo_aplicacao?: string | null
          fundamento_tecnico?: string | null
          id?: string
          status?: Database["public"]["Enums"]["library_item_status"]
          tags?: string[]
          texto_base_fixo?: string | null
          texto_base_parametrizavel?: string | null
          tipo?: Database["public"]["Enums"]["recommendation_type"]
          title?: string
          updated_at?: string
          updated_by?: string | null
          variaveis_parametro?: Json
          version_major?: number
          version_minor?: number
          version_patch?: number
          vigente_ate?: string | null
          vigente_de?: string | null
        }
        Relationships: []
      }
      notification_outbox: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string
          id: string
          kind: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          recipient_email: string | null
          recipient_user_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key: string
          id?: string
          kind: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload: Json
          recipient_email?: string | null
          recipient_user_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string
          id?: string
          kind?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          recipient_email?: string | null
          recipient_user_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          acronym: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          acronym: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          acronym?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pending_evidence_uploads: {
        Row: {
          created_at: string
          cycle_id: string
          expires_at: string
          id: string
          file_validation_status: string
          mime_type: string | null
          organization_id: string
          original_filename: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
          verified_at: string | null
          verified_mime_type: string | null
        }
        Insert: {
          created_at?: string
          cycle_id: string
          expires_at?: string
          id: string
          file_validation_status?: string
          mime_type?: string | null
          organization_id: string
          original_filename: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
          verified_at?: string | null
          verified_mime_type?: string | null
        }
        Update: {
          created_at?: string
          cycle_id?: string
          expires_at?: string
          id?: string
          file_validation_status?: string
          mime_type?: string | null
          organization_id?: string
          original_filename?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string
          verified_at?: string | null
          verified_mime_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_evidence_uploads_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_evidence_uploads_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "form_answer_cycle_read_model"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "pending_evidence_uploads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_waiver_snapshots: {
        Row: {
          created_at: string
          cycle_processing_id: string
          id: string
          question_id: string
          question_version_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          cycle_processing_id: string
          id?: string
          question_id: string
          question_version_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          cycle_processing_id?: string
          id?: string
          question_id?: string
          question_version_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processing_waiver_snapshots_cycle_processing_id_fkey"
            columns: ["cycle_processing_id"]
            isOneToOne: false
            referencedRelation: "cycle_processings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_waiver_snapshots_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_waiver_snapshots_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          organization_id: string | null
          preferences: Json
          role: Database["public"]["Enums"]["app_user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          organization_id?: string | null
          preferences?: Json
          role: Database["public"]["Enums"]["app_user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          organization_id?: string | null
          preferences?: Json
          role?: Database["public"]["Enums"]["app_user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      question_library_binding: {
        Row: {
          bindings: Json
          coverage_score: number
          created_at: string
          metric: Json
          question_id: string
          response_mapping: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bindings?: Json
          coverage_score?: number
          created_at?: string
          metric?: Json
          question_id: string
          response_mapping?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bindings?: Json
          coverage_score?: number
          created_at?: string
          metric?: Json
          question_id?: string
          response_mapping?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_library_binding_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_organization_waivers: {
        Row: {
          id: string
          organization_id: string
          question_id: string
          reason: string | null
          waived_at: string
          waived_by: string
        }
        Insert: {
          id?: string
          organization_id: string
          question_id: string
          reason?: string | null
          waived_at?: string
          waived_by: string
        }
        Update: {
          id?: string
          organization_id?: string
          question_id?: string
          reason?: string | null
          waived_at?: string
          waived_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_organization_waivers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_organization_waivers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_versions: {
        Row: {
          allows_not_applicable: boolean
          applies_to_respondent: boolean
          axis_id: string
          axis_name: string
          created_at: string
          evidence_parameter: Json
          fami_enabled: boolean
          id: string
          library_binding_snapshot: Json
          prompt: string
          question_id: string
          section_id: string
          section_name: string
          section_order: number
          version: number
        }
        Insert: {
          allows_not_applicable?: boolean
          applies_to_respondent: boolean
          axis_id: string
          axis_name: string
          created_at?: string
          evidence_parameter: Json
          fami_enabled: boolean
          id?: string
          library_binding_snapshot?: Json
          prompt: string
          question_id: string
          section_id: string
          section_name: string
          section_order: number
          version: number
        }
        Update: {
          allows_not_applicable?: boolean
          applies_to_respondent?: boolean
          axis_id?: string
          axis_name?: string
          created_at?: string
          evidence_parameter?: Json
          fami_enabled?: boolean
          id?: string
          library_binding_snapshot?: Json
          prompt?: string
          question_id?: string
          section_id?: string
          section_name?: string
          section_order?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_versions_axis_id_fkey"
            columns: ["axis_id"]
            isOneToOne: false
            referencedRelation: "axes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_versions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_versions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          allows_not_applicable: boolean
          applies_to_respondent: boolean
          created_at: string
          evidence_parameter: Json
          fami_enabled: boolean
          id: string
          prompt: string
          section_id: string
          updated_at: string
        }
        Insert: {
          allows_not_applicable?: boolean
          applies_to_respondent?: boolean
          created_at?: string
          evidence_parameter?: Json
          fami_enabled?: boolean
          id?: string
          prompt: string
          section_id: string
          updated_at?: string
        }
        Update: {
          allows_not_applicable?: boolean
          applies_to_respondent?: boolean
          created_at?: string
          evidence_parameter?: Json
          fami_enabled?: boolean
          id?: string
          prompt?: string
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_exceptions: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          motivo: string
          organization_id: string
          prazo: string | null
          question_id: string | null
          recommendation_id: string
          requested_at: string
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          motivo: string
          organization_id: string
          prazo?: string | null
          question_id?: string | null
          recommendation_id: string
          requested_at?: string
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          motivo?: string
          organization_id?: string
          prazo?: string | null
          question_id?: string | null
          recommendation_id?: string
          requested_at?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_exceptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_exceptions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_exceptions_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "current_recommendation_read_model"
            referencedColumns: ["recommendation_id"]
          },
          {
            foreignKeyName: "recommendation_exceptions_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          created_at: string
          cycle_id: string
          cycle_processing_id: string
          id: string
          origin: Json
          question_version_id: string
          source: string
          text: string
          tipo: Database["public"]["Enums"]["recommendation_type"]
        }
        Insert: {
          created_at?: string
          cycle_id: string
          cycle_processing_id: string
          id?: string
          origin?: Json
          question_version_id: string
          source?: string
          text: string
          tipo: Database["public"]["Enums"]["recommendation_type"]
        }
        Update: {
          created_at?: string
          cycle_id?: string
          cycle_processing_id?: string
          id?: string
          origin?: Json
          question_version_id?: string
          source?: string
          text?: string
          tipo?: Database["public"]["Enums"]["recommendation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "form_answer_cycle_read_model"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "recommendations_processing_fkey"
            columns: ["cycle_processing_id", "cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_processings"
            referencedColumns: ["id", "cycle_id"]
          },
          {
            foreignKeyName: "recommendations_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      report_emission_failures: {
        Row: {
          action_plan_revision: number
          attempted_at: string
          attempted_by: string | null
          cycle_id: string
          cycle_processing_id: string
          error_code: string
          error_message: string
          id: string
          resolved_at: string | null
          resolved_report_id: string | null
        }
        Insert: {
          action_plan_revision: number
          attempted_at?: string
          attempted_by?: string | null
          cycle_id: string
          cycle_processing_id: string
          error_code: string
          error_message: string
          id?: string
          resolved_at?: string | null
          resolved_report_id?: string | null
        }
        Update: {
          action_plan_revision?: number
          attempted_at?: string
          attempted_by?: string | null
          cycle_id?: string
          cycle_processing_id?: string
          error_code?: string
          error_message?: string
          id?: string
          resolved_at?: string | null
          resolved_report_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_emission_failures_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_emission_failures_processing_fkey"
            columns: ["cycle_processing_id", "cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_processings"
            referencedColumns: ["id", "cycle_id"]
          },
          {
            foreignKeyName: "report_emission_failures_resolved_report_id_fkey"
            columns: ["resolved_report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          action_plan_revision: number | null
          content_sha256: string | null
          cycle_id: string
          cycle_processing_id: string
          emission_version: number
          file_path: string
          file_sha256: string | null
          file_size_bytes: number | null
          generated_at: string
          generated_by: string | null
          generated_by_name: string | null
          id: string
          reference_end_year: number | null
          reference_start_year: number | null
          reissue_reason: string | null
          status: string
          supersedes_report_id: string | null
        }
        Insert: {
          action_plan_revision?: number | null
          content_sha256?: string | null
          cycle_id: string
          cycle_processing_id: string
          emission_version?: number
          file_path: string
          file_sha256?: string | null
          file_size_bytes?: number | null
          generated_at?: string
          generated_by?: string | null
          generated_by_name?: string | null
          id?: string
          reference_end_year?: number | null
          reference_start_year?: number | null
          reissue_reason?: string | null
          status?: string
          supersedes_report_id?: string | null
        }
        Update: {
          action_plan_revision?: number | null
          content_sha256?: string | null
          cycle_id?: string
          cycle_processing_id?: string
          emission_version?: number
          file_path?: string
          file_sha256?: string | null
          file_size_bytes?: number | null
          generated_at?: string
          generated_by?: string | null
          generated_by_name?: string | null
          id?: string
          reference_end_year?: number | null
          reference_start_year?: number | null
          reissue_reason?: string | null
          status?: string
          supersedes_report_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "form_answer_cycle_read_model"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "reports_processing_fkey"
            columns: ["cycle_processing_id", "cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_processings"
            referencedColumns: ["id", "cycle_id"]
          },
          {
            foreignKeyName: "reports_supersedes_report_id_fkey"
            columns: ["supersedes_report_id"]
            isOneToOne: false
            referencedRelation: "report_history_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_supersedes_report_id_fkey"
            columns: ["supersedes_report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      respondent_profile_details: {
        Row: {
          declaration_text: string | null
          id: string
          organizational_unit: string | null
          position_title: string | null
          registration_number: string | null
          source_name: string
          source_submitted_at: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          declaration_text?: string | null
          id?: string
          organizational_unit?: string | null
          position_title?: string | null
          registration_number?: string | null
          source_name?: string
          source_submitted_at?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          declaration_text?: string | null
          id?: string
          organizational_unit?: string | null
          position_title?: string | null
          registration_number?: string | null
          source_name?: string
          source_submitted_at?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "respondent_profile_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      response_admin_applicability_events: {
        Row: {
          after_json: Json | null
          before_json: Json | null
          cycle_id: string
          decided_at: string
          decided_by: string
          decision: string
          id: string
          justification: string
          original_answer: Database["public"]["Enums"]["answer_value"]
          previous_decision: string | null
          response_id: string
          validation_round: number
        }
        Insert: {
          after_json?: Json | null
          before_json?: Json | null
          cycle_id: string
          decided_at?: string
          decided_by: string
          decision: string
          id?: string
          justification: string
          original_answer: Database["public"]["Enums"]["answer_value"]
          previous_decision?: string | null
          response_id: string
          validation_round?: number
        }
        Update: {
          after_json?: Json | null
          before_json?: Json | null
          cycle_id?: string
          decided_at?: string
          decided_by?: string
          decision?: string
          id?: string
          justification?: string
          original_answer?: Database["public"]["Enums"]["answer_value"]
          previous_decision?: string | null
          response_id?: string
          validation_round?: number
        }
        Relationships: [
          {
            foreignKeyName: "response_admin_applicability_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_admin_applicability_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "form_answer_cycle_read_model"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "response_admin_applicability_events_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      response_admin_proof_events: {
        Row: {
          after_json: Json | null
          before_json: Json | null
          cycle_id: string
          decided_at: string
          decided_by: string
          decision: string
          id: string
          observation: string
          original_answer: Database["public"]["Enums"]["answer_value"]
          previous_decision: string | null
          response_id: string
          validation_round: number
        }
        Insert: {
          after_json?: Json | null
          before_json?: Json | null
          cycle_id: string
          decided_at?: string
          decided_by: string
          decision: string
          id?: string
          observation: string
          original_answer: Database["public"]["Enums"]["answer_value"]
          previous_decision?: string | null
          response_id: string
          validation_round?: number
        }
        Update: {
          after_json?: Json | null
          before_json?: Json | null
          cycle_id?: string
          decided_at?: string
          decided_by?: string
          decision?: string
          id?: string
          observation?: string
          original_answer?: Database["public"]["Enums"]["answer_value"]
          previous_decision?: string | null
          response_id?: string
          validation_round?: number
        }
        Relationships: [
          {
            foreignKeyName: "response_admin_proof_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_admin_proof_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "form_answer_cycle_read_model"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "response_admin_proof_events_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      response_snapshots: {
        Row: {
          admin_applicability_status: string | null
          admin_na_justification: string | null
          admin_proof_observation: string | null
          admin_proof_status: string | null
          answer: Database["public"]["Enums"]["answer_value"]
          created_at: string
          cycle_processing_id: string
          id: string
          is_not_applicable: boolean
          na_justification: string | null
          na_original_justification: string | null
          na_rejection_reason: string | null
          na_validation_status:
            | Database["public"]["Enums"]["na_validation_status"]
            | null
          question_version_id: string
        }
        Insert: {
          admin_applicability_status?: string | null
          admin_na_justification?: string | null
          admin_proof_observation?: string | null
          admin_proof_status?: string | null
          answer: Database["public"]["Enums"]["answer_value"]
          created_at?: string
          cycle_processing_id: string
          id?: string
          is_not_applicable: boolean
          na_justification?: string | null
          na_original_justification?: string | null
          na_rejection_reason?: string | null
          na_validation_status?:
            | Database["public"]["Enums"]["na_validation_status"]
            | null
          question_version_id: string
        }
        Update: {
          admin_applicability_status?: string | null
          admin_na_justification?: string | null
          admin_proof_observation?: string | null
          admin_proof_status?: string | null
          answer?: Database["public"]["Enums"]["answer_value"]
          created_at?: string
          cycle_processing_id?: string
          id?: string
          is_not_applicable?: boolean
          na_justification?: string | null
          na_original_justification?: string | null
          na_rejection_reason?: string | null
          na_validation_status?:
            | Database["public"]["Enums"]["na_validation_status"]
            | null
          question_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "response_snapshots_cycle_processing_id_fkey"
            columns: ["cycle_processing_id"]
            isOneToOne: false
            referencedRelation: "cycle_processings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_snapshots_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          admin_applicability_status: string | null
          admin_na_decided_at: string | null
          admin_na_decided_by: string | null
          admin_na_justification: string | null
          admin_proof_decided_at: string | null
          admin_proof_decided_by: string | null
          admin_proof_observation: string | null
          admin_proof_status: string | null
          answer: Database["public"]["Enums"]["answer_value"]
          created_at: string
          created_by: string
          cycle_id: string
          id: string
          is_not_applicable: boolean
          na_justification: string | null
          na_rejection_reason: string | null
          na_validated_at: string | null
          na_validated_by: string | null
          na_validation_status:
            | Database["public"]["Enums"]["na_validation_status"]
            | null
          notes: string | null
          question_version_id: string
          revision: number
          updated_at: string
        }
        Insert: {
          admin_applicability_status?: string | null
          admin_na_decided_at?: string | null
          admin_na_decided_by?: string | null
          admin_na_justification?: string | null
          admin_proof_decided_at?: string | null
          admin_proof_decided_by?: string | null
          admin_proof_observation?: string | null
          admin_proof_status?: string | null
          answer: Database["public"]["Enums"]["answer_value"]
          created_at?: string
          created_by: string
          cycle_id: string
          id?: string
          is_not_applicable?: boolean
          na_justification?: string | null
          na_rejection_reason?: string | null
          na_validated_at?: string | null
          na_validated_by?: string | null
          na_validation_status?:
            | Database["public"]["Enums"]["na_validation_status"]
            | null
          notes?: string | null
          question_version_id: string
          revision?: number
          updated_at?: string
        }
        Update: {
          admin_applicability_status?: string | null
          admin_na_decided_at?: string | null
          admin_na_decided_by?: string | null
          admin_na_justification?: string | null
          admin_proof_decided_at?: string | null
          admin_proof_decided_by?: string | null
          admin_proof_observation?: string | null
          admin_proof_status?: string | null
          answer?: Database["public"]["Enums"]["answer_value"]
          created_at?: string
          created_by?: string
          cycle_id?: string
          id?: string
          is_not_applicable?: boolean
          na_justification?: string | null
          na_rejection_reason?: string | null
          na_validated_at?: string | null
          na_validated_by?: string | null
          na_validation_status?:
            | Database["public"]["Enums"]["na_validation_status"]
            | null
          notes?: string | null
          question_version_id?: string
          revision?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responses_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "form_answer_cycle_read_model"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "responses_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          axis_id: string
          code: string
          created_at: string
          created_by: string | null
          deprecated_at: string | null
          deprecated_by: string | null
          description: string | null
          id: string
          name: string
          ordem: number
          status: Database["public"]["Enums"]["library_item_status"]
          tags: string[]
          updated_at: string
          updated_by: string | null
          version_major: number
          version_minor: number
          version_patch: number
          vigente_ate: string | null
          vigente_de: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          axis_id: string
          code: string
          created_at?: string
          created_by?: string | null
          deprecated_at?: string | null
          deprecated_by?: string | null
          description?: string | null
          id?: string
          name: string
          ordem?: number
          status?: Database["public"]["Enums"]["library_item_status"]
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
          version_major?: number
          version_minor?: number
          version_patch?: number
          vigente_ate?: string | null
          vigente_de?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          axis_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          deprecated_at?: string | null
          deprecated_by?: string | null
          description?: string | null
          id?: string
          name?: string
          ordem?: number
          status?: Database["public"]["Enums"]["library_item_status"]
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
          version_major?: number
          version_minor?: number
          version_patch?: number
          vigente_ate?: string | null
          vigente_de?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sections_axis_id_fkey"
            columns: ["axis_id"]
            isOneToOne: false
            referencedRelation: "axes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          action_path: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          message: string
          read_at: string | null
          title: string
          user_id: string
          visible_at: string
        }
        Insert: {
          action_path?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          message: string
          read_at?: string | null
          title: string
          user_id: string
          visible_at?: string
        }
        Update: {
          action_path?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          message?: string
          read_at?: string | null
          title?: string
          user_id?: string
          visible_at?: string
        }
        Relationships: []
      }
      validation_analysis_drafts: {
        Row: {
          action: string | null
          applied_at: string | null
          created_at: string
          created_by: string
          cycle_id: string
          evidence_id: string | null
          id: string
          justification: string | null
          notes: string | null
          response_id: string | null
          revision: number
          target_kind: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          action?: string | null
          applied_at?: string | null
          created_at?: string
          created_by: string
          cycle_id: string
          evidence_id?: string | null
          id?: string
          justification?: string | null
          notes?: string | null
          response_id?: string | null
          revision?: number
          target_kind: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          action?: string | null
          applied_at?: string | null
          created_at?: string
          created_by?: string
          cycle_id?: string
          evidence_id?: string | null
          id?: string
          justification?: string | null
          notes?: string | null
          response_id?: string | null
          revision?: number
          target_kind?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_analysis_drafts_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_analysis_drafts_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_analysis_drafts_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_recommendation_read_model: {
        Row: {
          action_plans: Json | null
          axis_id: string | null
          axis_name: string | null
          cycle_id: string | null
          cycle_processing_id: string | null
          cycle_state: Database["public"]["Enums"]["cycle_state"] | null
          form_id: string | null
          form_name: string | null
          form_version: number | null
          has_action_plan: boolean | null
          organization_id: string | null
          organization_name: string | null
          origin: Json | null
          period_label: string | null
          question_id: string | null
          question_order: number | null
          question_prompt: string | null
          question_version_id: string | null
          recommendation_created_at: string | null
          recommendation_id: string | null
          recommendation_status: string | null
          recommendation_text: string | null
          recommendation_type: string | null
          section_id: string | null
          section_name: string | null
          section_order: number | null
          source: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_versions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_versions_axis_id_fkey"
            columns: ["axis_id"]
            isOneToOne: false
            referencedRelation: "axes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_versions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_versions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "form_answer_cycle_read_model"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "recommendations_processing_fkey"
            columns: ["cycle_processing_id", "cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_processings"
            referencedColumns: ["id", "cycle_id"]
          },
          {
            foreignKeyName: "recommendations_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_operational_view: {
        Row: {
          axis_name: string | null
          current_status: string | null
          cycle_id: string | null
          cycle_state: Database["public"]["Enums"]["cycle_state"] | null
          evidence_parameter: Json | null
          external_link: string | null
          form_id: string | null
          form_name: string | null
          form_version: number | null
          id: string | null
          kind: Database["public"]["Enums"]["evidence_kind"] | null
          link_reason: string | null
          organization_id: string | null
          organization_name: string | null
          original_filename: string | null
          period_label: string | null
          question_id: string | null
          question_prompt: string | null
          response_id: string | null
          search_document: string | null
          section_name: string | null
          storage_path: string | null
          submitted_at: string | null
          submitted_by: string | null
          text_body: string | null
          title: string | null
          validated_at: string | null
          validated_by: string | null
          validation_justification: string | null
          validation_status:
            | Database["public"]["Enums"]["evidence_validation_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "cycles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidences_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_versions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_versions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "form_answer_cycle_read_model"
            referencedColumns: ["cycle_id"]
          },
        ]
      }
      form_answer_cycle_read_model: {
        Row: {
          answered_questions: number | null
          contributor_count: number | null
          cycle_id: string | null
          cycle_state: Database["public"]["Enums"]["cycle_state"] | null
          form_id: string | null
          form_version_id: string | null
          last_updated_at: string | null
          organization_id: string | null
          organization_name: string | null
          period_label: string | null
          respondent_status: string | null
          total_questions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cycles_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_versions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      report_emission_summaries: {
        Row: {
          cycle_id: string | null
          cycle_processing_id: string | null
          emission_count: number | null
          latest_emission_version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "form_answer_cycle_read_model"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "reports_processing_fkey"
            columns: ["cycle_processing_id", "cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_processings"
            referencedColumns: ["id", "cycle_id"]
          },
        ]
      }
      report_history_entries: {
        Row: {
          content_sha256: string | null
          current_action_plan_revision: number | null
          current_reference_end_year: number | null
          current_reference_start_year: number | null
          cycle_id: string | null
          cycle_processing_id: string | null
          cycle_state: Database["public"]["Enums"]["cycle_state"] | null
          emission_version: number | null
          fami_policy_version: string | null
          file_path: string | null
          file_sha256: string | null
          file_size_bytes: number | null
          form_id: string | null
          form_name: string | null
          form_version: number | null
          generated_at: string | null
          generated_by: string | null
          generated_by_name: string | null
          id: string | null
          is_current: boolean | null
          latest_emission_version: number | null
          latest_processing_version: number | null
          organization_id: string | null
          period_label: string | null
          processing_version: number | null
          reference_end_year: number | null
          reference_start_year: number | null
          reissue_reason: string | null
          report_action_plan_revision: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cycles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_versions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "form_answer_cycle_read_model"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "reports_processing_fkey"
            columns: ["cycle_processing_id", "cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_processings"
            referencedColumns: ["id", "cycle_id"]
          },
        ]
      }
      report_history_years: {
        Row: {
          calendar_year: number | null
          organization_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      decide_action_plan_deadline_change: {
        Args: {
          p_actor_user_id: string
          p_decision: Database["public"]["Enums"]["action_plan_deadline_change_status"]
          p_decision_reason: string
          p_request_id: string
        }
        Returns: Database["public"]["Tables"]["action_plan_deadline_change_requests"]["Row"]
      }
      admin_change_cycle_response_deadlines: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_batch_id?: string
          p_cycle_ids: string[]
          p_justification: string
          p_new_deadline_at: string | null
          p_scope: string
        }
        Returns: Json
      }
      admin_reopen_cycles_for_responses: {
        Args: {
          p_actor_user_id: string
          p_batch_id?: string
          p_cycle_ids: string[]
          p_justification: string
          p_new_deadline_at: string
          p_question_version_ids?: string[] | null
          p_scope: string
        }
        Returns: Json
      }
      admin_reopen_validation_cycles: {
        Args: {
          p_actor_user_id: string
          p_batch_id?: string
          p_cycle_ids: string[]
          p_justification: string
          p_scope: string
        }
        Returns: Json
      }
      admin_set_cycle_collection_pause: {
        Args: {
          p_actor_user_id: string
          p_batch_id?: string
          p_cycle_ids: string[]
          p_justification: string
          p_pause: boolean
          p_scope: string
        }
        Returns: Json
      }
      advance_historical_cycle_to_validation: {
        Args: {
          p_actor_user_id: string
          p_cycle_id: string
          p_respondent_user_id: string
        }
        Returns: Json
      }
      apply_cycle_reference_period_to_batch_result: {
        Args: {
          p_mutable_statuses: string[]
          p_reference_end_year: number
          p_reference_start_year: number
          p_result: Json
        }
        Returns: Json
      }
      apply_workbench_response: {
        Args: {
          p_actor_user_id: string
          p_answer: Database["public"]["Enums"]["answer_value"]
          p_cycle_id: string
          p_evidence?: Json
          p_expected_revision?: number
          p_notes: string
          p_question_version_id: string
        }
        Returns: Json
      }
      bootstrap_global_admin: {
        Args: { p_full_name?: string; p_user_id: string }
        Returns: undefined
      }
      calculate_live_fami_rows: {
        Args: { p_cycle_id: string }
        Returns: {
          maturity_level: number
          percentage: number
          points_obtained: number
          points_possible: number
          scope_id: string
          scope_type: string
        }[]
      }
      calculate_live_recommendations: {
        Args: { p_cycle_id: string }
        Returns: {
          question_version_id: string
          recommendation_text: string
          recommendation_trigger: string
          tipo: Database["public"]["Enums"]["recommendation_type"]
        }[]
      }
      cancel_cycle_schedule_jobs: {
        Args: { p_cycle_id: string; p_reason: string }
        Returns: number
      }
      cancel_report_emission: {
        Args: { p_report_id: string }
        Returns: undefined
      }
      claim_automation_jobs: {
        Args: {
          p_kinds?: string[]
          p_limit?: number
          p_lock_timeout?: string
          p_worker_id: string
        }
        Returns: {
          attempts: number
          completed_at: string | null
          created_at: string
          dedupe_key: string | null
          error_message: string | null
          executed_by_system: boolean
          id: string
          kind: string
          last_duration_ms: number | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          requested_by: string | null
          result_summary: Json
          scheduled_for: string | null
          started_at: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "automation_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      initialize_action_plan_document_upload: {
        Args: {
          p_actor_user_id: string
          p_expected_revision: number
          p_expires_at: string
          p_mime_type: string
          p_organization_id: string
          p_original_filename: string
          p_pending_upload_id: string
          p_plan_id: string
          p_size_bytes: number
          p_storage_path: string
          p_title: string
        }
        Returns: undefined
      }
      commit_action_plan_document_upload: {
        Args: {
          p_actor_user_id: string
          p_expected_revision: number
          p_organization_id: string
          p_pending_upload_id: string
          p_plan_id: string
          p_verified_mime_type: string
        }
        Returns: {
          action_plan_id: string
          action_revision: number
          created_at: string
          external_link: string | null
          id: string
          kind: string
          file_validation_status: string
          mime_type: string | null
          original_filename: string | null
          size_bytes: number | null
          storage_path: string | null
          title: string
        }[]
      }
      discard_pending_action_plan_document_upload: {
        Args: {
          p_actor_user_id: string
          p_organization_id: string
          p_pending_upload_id: string
          p_plan_id: string
        }
        Returns: {
          storage_path: string | null
        }[]
      }
      deactivate_action_plan_document: {
        Args: {
          p_actor_user_id: string
          p_document_id: string
          p_expected_revision: number
          p_organization_id: string
          p_plan_id: string
          p_reason: string
        }
        Returns: {
          storage_path: string | null
        }[]
      }
      claim_notification_outbox: {
        Args: { p_limit?: number; p_lock_timeout?: string; p_worker_id: string }
        Returns: {
          attempts: number
          created_at: string
          dedupe_key: string
          id: string
          kind: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          recipient_email: string | null
          recipient_user_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_operational_data: { Args: Record<PropertyKey, never>; Returns: Json }
      commit_cycle_transition: {
        Args: {
          p_actor_user_id: string
          p_cycle_id: string
          p_expected_from_state?: Database["public"]["Enums"]["cycle_state"]
          p_fami_rows?: Json
          p_snapshot_payload?: Json
          p_to_state: Database["public"]["Enums"]["cycle_state"]
        }
        Returns: Json
      }
      consume_api_rate_limit: {
        Args: {
          p_bucket_key: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      create_action_plan_supervision_note: {
        Args: {
          p_action_plan_id: string
          p_actor_user_id: string
          p_body: string
          p_note_type: string
          p_recommendation_id: string
        }
        Returns: {
          action_plan_id: string | null
          action_revision: number | null
          action_snapshot: Json
          author_id: string
          author_role: Database["public"]["Enums"]["app_user_role"]
          body: string
          created_at: string
          id: string
          lifecycle_status: Database["public"]["Enums"]["supervision_note_lifecycle_status"]
          note_type: string
          recommendation_id: string
          resolution_body: string | null
          resolved_at: string | null
          resolved_by: string | null
          responded_at: string | null
          responded_by: string | null
          response_body: string | null
        }
        SetofOptions: {
          from: "*"
          to: "action_plan_supervision_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_form_period: {
        Args: {
          p_form_version_id: string
          p_period_code: string
          p_label?: string
          p_starts_at?: string
          p_response_deadline_at?: string
        }
        Returns: {
          created_at: string
          form_version_id: string
          id: string
          label: string
          period_code: string
          response_deadline_at: string | null
          starts_at: string | null
          status: string
          updated_at: string
        }
      }
      create_cycle: {
        Args: {
          p_actor_user_id: string
          p_form_id: string
          p_organization_id: string
          p_period_label: string
          p_response_deadline_at?: string
          p_starts_at?: string
        }
        Returns: Database["public"]["Tables"]["cycles"]["Row"]
        SetofOptions: {
          from: "*"
          to: "cycles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_cycles_batch: {
        Args: {
          p_actor_user_id: string
          p_form_id: string
          p_organization_ids: string[]
          p_period_label: string
          p_response_deadline_at?: string
          p_starts_at?: string
        }
        Returns: Json
      }
      create_cycles_batch_with_reference: {
        Args: {
          p_actor_user_id: string
          p_form_id: string
          p_organization_ids: string[]
          p_period_label: string
          p_reference_end_year: number
          p_reference_start_year: number
          p_response_deadline_at?: string
          p_starts_at?: string
        }
        Returns: Json
      }
      create_form_draft_question: {
        Args: {
          p_actor_user_id: string
          p_evidence_parameter: Json
          p_form_id: string
          p_prompt: string
          p_section_id: string
        }
        Returns: Json
      }
      create_form_with_draft: {
        Args: { p_actor_user_id: string; p_name: string }
        Returns: Json
      }
      create_or_open_cycle: {
        Args: {
          p_actor_user_id: string
          p_form_id: string
          p_organization_id: string
          p_period_label: string
          p_response_deadline_at: string
          p_starts_at: string
        }
        Returns: Json
      }
      create_or_open_cycles_batch: {
        Args: {
          p_actor_user_id: string
          p_form_id: string
          p_organization_ids: string[]
          p_period_label: string
          p_response_deadline_at: string
          p_starts_at: string
        }
        Returns: Json
      }
      create_or_open_cycles_batch_with_reference: {
        Args: {
          p_actor_user_id: string
          p_form_id: string
          p_organization_ids: string[]
          p_period_label: string
          p_reference_end_year: number
          p_reference_start_year: number
          p_response_deadline_at: string
          p_starts_at: string
        }
        Returns: Json
      }
      create_or_open_historical_cycle: {
        Args: {
          p_actor_user_id: string
          p_form_id: string
          p_organization_id: string
          p_period_label: string
        }
        Returns: Json
      }
      create_organization_admin: {
        Args: { p_acronym: string; p_actor_user_id: string; p_name: string }
        Returns: {
          acronym: string
          created_at: string
          id: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_respondent_profile: {
        Args: {
          p_actor_user_id: string
          p_email: string
          p_full_name: string
          p_organization_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      cycle_action_plan_supervision_blockers: {
        Args: { p_cycle_id: string }
        Returns: {
          action_plan_id: string
          blocker: string
          recommendation_id: string
        }[]
      }
      cycle_can_transition: {
        Args: {
          p_from: Database["public"]["Enums"]["cycle_state"]
          p_to: Database["public"]["Enums"]["cycle_state"]
        }
        Returns: boolean
      }
      cycle_has_official_fami: {
        Args: { p_cycle_id: string }
        Returns: boolean
      }
      cycle_has_current_official_report: {
        Args: { p_cycle_id: string }
        Returns: boolean
      }
      cycle_report_lifecycle_status: {
        Args: { p_cycle_id: string }
        Returns: string
      }
      cycle_working_processing: {
        Args: { p_cycle_id: string }
        Returns: string
      }
      deactivate_misplaced_legacy_evidence_link: {
        Args: {
          p_actor_user_id: string
          p_cycle_id: string
          p_external_link: string
          p_reason?: string
        }
        Returns: Json
      }
      decide_action_plan_supervision_request: {
        Args: {
          p_actor_user_id: string
          p_decision: Database["public"]["Enums"]["supervision_note_lifecycle_status"]
          p_note_id: string
          p_resolution_body: string
        }
        Returns: {
          action_plan_id: string | null
          action_revision: number | null
          action_snapshot: Json
          author_id: string
          author_role: Database["public"]["Enums"]["app_user_role"]
          body: string
          created_at: string
          id: string
          lifecycle_status: Database["public"]["Enums"]["supervision_note_lifecycle_status"]
          note_type: string
          recommendation_id: string
          resolution_body: string | null
          resolved_at: string | null
          resolved_by: string | null
          responded_at: string | null
          responded_by: string | null
          response_body: string | null
        }
        SetofOptions: {
          from: "*"
          to: "action_plan_supervision_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_response_without_proof: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_cycle_id: string
          p_expected_decided_at?: string
          p_expected_status?: string
          p_observation: string
          p_response_id: string
        }
        Returns: Json
      }
      delete_respondent_action_plan: {
        Args: {
          p_actor_user_id: string
          p_expected_revision: number
          p_organization_id: string
          p_plan_id: string
          p_recommendation_id: string
        }
        Returns: {
          mode: string
          plan_id: string
          revision: number
        }[]
      }
      delete_unpublished_form: {
        Args: { p_actor_user_id: string; p_form_id: string }
        Returns: undefined
      }
      discard_pending_evidence_upload: {
        Args: {
          p_actor_user_id: string
          p_cycle_id: string
          p_organization_id: string
          p_pending_upload_id: string
        }
        Returns: Json
      }
      dispatch_cycle_deadline_reminder: {
        Args: {
          p_cycle_id: string
          p_expected_schedule_revision: number
          p_job_id: string
          p_offset_days: number
        }
        Returns: Json
      }
      dispatch_evidence_adjustments: {
        Args: { p_actor_user_id: string; p_cycle_id: string }
        Returns: Json
      }
      enqueue_operational_notifications: { Args: Record<PropertyKey, never>; Returns: Json }
      evidence_ui_status: {
        Args: {
          p_cycle_state: Database["public"]["Enums"]["cycle_state"]
          p_validation_status: Database["public"]["Enums"]["evidence_validation_status"]
        }
        Returns: string
      }
      execute_scheduled_cycle_action: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_cycle_id: string
          p_expected_schedule_revision: number
        }
        Returns: Json
      }
      finalize_report_emission: {
        Args: {
          p_content_sha256: string
          p_file_sha256: string
          p_file_size_bytes: number
          p_report_id: string
        }
        Returns: Json
      }
      calendar_bimester_bounds: {
        Args: { p_bimester: number; p_year: number }
        Returns: {
          closes_quadrimester: boolean
          period_end: string
          period_start: string
          quadrimester: number | null
        }[]
      }
      calendar_quadrimester_bounds: {
        Args: { p_quadrimester: number; p_year: number }
        Returns: {
          period_end: string
          period_start: string
        }[]
      }
      close_due_action_plan_bimesters: { Args: Record<PropertyKey, never>; Returns: Json }
      close_due_fami_preliminary_quadrimesters: { Args: Record<PropertyKey, never>; Returns: Json }
      cycle_action_states_at: {
        Args: {
          p_cutoff_exclusive: string
          p_cycle_id: string
          p_source_processing_id: string
        }
        Returns: {
          action_plan_id: string
          action_text: string
          approval_effective_at: string | null
          approved: boolean
          axis_id: string
          due_date: string
          effective_at: string
          evidence_document_id: string | null
          has_open_adjustment: boolean
          has_valid_evidence: boolean
          progress_percentage: number
          question_version_id: string
          recommendation_id: string
          responsible_label: string
          revision: number
          section_id: string
          start_date: string
          status: Database["public"]["Enums"]["action_plan_status"]
        }[]
      }
      fami_preliminary_checkpoint_payload: {
        Args: { p_idempotent?: boolean; p_processing_id: string }
        Returns: Json
      }
      action_plan_bimonthly_report_payload: {
        Args: { p_idempotent?: boolean; p_report_id: string }
        Returns: Json
      }
      materialize_action_plan_bimonthly_report: {
        Args: {
          p_actor_user_id: string | null
          p_bimester: number
          p_cycle_id: string
          p_reference_year: number
        }
        Returns: Json
      }
      materialize_fami_preliminary: {
        Args: {
          p_actor_user_id: string | null
          p_cycle_id: string
          p_quadrimester: number
          p_reference_year: number
        }
        Returns: Json
      }
      finalize_validation_cycle: {
        Args: { p_actor_user_id: string; p_cycle_id: string }
        Returns: Json
      }
      find_validation_queue_page_for_evidence: {
        Args: {
          p_cycle_id: string
          p_evidence_id: string
          p_page_size?: number
          p_section_id?: string
        }
        Returns: Json
      }
      get_action_plan_status_metrics: {
        Args: { p_organization_id?: string }
        Returns: {
          status: Database["public"]["Enums"]["action_plan_status"]
          total: number
        }[]
      }
      get_admin_action_plan_monitoring_page: {
        Args: {
          p_card_filter?: string
          p_cycle_id?: string
          p_form_id?: string
          p_from?: string
          p_layout?: string
          p_organization_id?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_to?: string
          p_view?: string
        }
        Returns: Json
      }
      get_admin_recommendation_monitoring_page: {
        Args: {
          p_axis_id?: string
          p_card_filter?: string
          p_cycle_id?: string
          p_form_id?: string
          p_from?: string
          p_layout?: string
          p_organization_id?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_status?: string
          p_to?: string
        }
        Returns: Json
      }
      get_automation_queue_metrics: {
        Args: Record<PropertyKey, never>
        Returns: {
          average_job_duration_ms: number
          failed_jobs: number
          failed_notifications: number
          oldest_pending_job_at: string
          oldest_pending_notification_at: string
          pending_jobs: number
          pending_notifications: number
          processing_jobs: number
          processing_notifications: number
        }[]
      }
      get_cycle_metrics: {
        Args: {
          p_due_filter?: string
          p_form_id?: string
          p_organization_id?: string
          p_period_label?: string
          p_search?: string
          p_states?: Database["public"]["Enums"]["cycle_state"][]
        }
        Returns: {
          overdue: number
          total: number
        }[]
      }
      get_evidence_metrics: {
        Args: {
          p_axis_name?: string
          p_cycle_id?: string
          p_form_id?: string
          p_from?: string
          p_ids?: string[]
          p_organization_id?: string
          p_pending_only?: boolean
          p_question_id?: string
          p_search?: string
          p_section_name?: string
          p_status?: string
          p_to?: string
        }
        Returns: {
          aguardando_envio: number
          aguardando_validacao: number
          ajuste_solicitado: number
          aprovadas: number
          nao_aprovadas: number
          total: number
        }[]
      }
      get_form_answers_overview: { Args: { p_form_id: string }; Returns: Json }
      get_form_answers_summary: { Args: { p_form_id: string }; Returns: Json }
      get_validation_finalization_readiness: {
        Args: { p_cycle_id: string }
        Returns: Json
      }
      get_validation_form_summary: {
        Args: { p_cycle_id: string }
        Returns: Json
      }
      validation_reopen_impact: {
        Args: { p_cycle_id: string }
        Returns: {
          action_plan_count: number
          exception_count: number
          supervision_note_count: number
        }[]
      }
      get_validation_queue_summary: {
        Args: { p_cycle_id: string }
        Returns: Json
      }
      list_validation_finalization_readiness: {
        Args: { p_cycle_ids: string[] }
        Returns: {
          blockers: Json
          cycle_id: string
          ready: boolean
        }[]
      }
      list_action_plan_recommendations_page: {
        Args: {
          p_cycle_id?: string
          p_due_filter?: string
          p_form_id?: string
          p_limit?: number
          p_offset?: number
          p_organization_id?: string
          p_plan_status?: string
          p_recommendation_id?: string
          p_recommendation_status?: string
          p_responsible_contains?: string
          p_search?: string
          p_view?: string
        }
        Returns: {
          action_plans: Json
          axis_id: string
          axis_name: string
          cycle_id: string
          cycle_state: Database["public"]["Enums"]["cycle_state"]
          form_id: string
          form_name: string
          form_version: number
          organization_id: string
          organization_name: string
          period_label: string
          question_id: string
          question_order: number
          question_prompt: string
          recommendation_created_at: string
          recommendation_id: string
          recommendation_status: string
          recommendation_text: string
          recommendation_type: string
          section_id: string
          section_name: string
          section_order: number
          total_count: number
        }[]
      }
      list_admin_users_page: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_organization_id?: string
          p_role?: Database["public"]["Enums"]["app_user_role"]
          p_search?: string
        }
        Returns: {
          created_at: string
          email: string
          full_name: string
          organization_id: string
          role: Database["public"]["Enums"]["app_user_role"]
          total_count: number
          user_id: string
        }[]
      }
      list_cycles_page: {
        Args: {
          p_due_filter?: string
          p_form_id?: string
          p_limit?: number
          p_offset?: number
          p_organization_id?: string
          p_period_label?: string
          p_search?: string
          p_states?: Database["public"]["Enums"]["cycle_state"][]
        }
        Returns: {
          closed_at: string
          cycle_close_at: string
          form_id: string
          form_name: string
          form_version: number
          form_version_id: string
          id: string
          organization_acronym: string
          organization_id: string
          organization_name: string
          period_label: string
          reference_end_year: number
          reference_start_year: number
          reopen_count: number
          response_deadline_at: string
          starts_at: string
          state: Database["public"]["Enums"]["cycle_state"]
          submission_delay_seconds: number
          submitted_late_at: string
          total_count: number
          validation_deadline_at: string
          working_processing_id: string
          working_processing_version: number
        }[]
      }
      list_evidences_page: {
        Args: {
          p_axis_name?: string
          p_cycle_id?: string
          p_exclude_status?: string
          p_form_id?: string
          p_from?: string
          p_ids?: string[]
          p_limit?: number
          p_offset?: number
          p_organization_id?: string
          p_pending_only?: boolean
          p_question_id?: string
          p_search?: string
          p_section_name?: string
          p_status?: string
          p_to?: string
        }
        Returns: {
          axis_name: string
          current_status: string
          cycle_id: string
          cycle_state: Database["public"]["Enums"]["cycle_state"]
          evidence_parameter: Json
          external_link: string | null
          form_id: string
          form_name: string
          form_version: number
          id: string
          kind: Database["public"]["Enums"]["evidence_kind"]
          link_reason: string | null
          organization_id: string
          organization_name: string
          original_filename: string | null
          period_label: string
          question_id: string
          question_prompt: string
          response_id: string
          section_name: string
          storage_path: string | null
          submitted_at: string
          submitted_by: string
          text_body: string | null
          title: string | null
          total_count: number
          validated_at: string | null
          validated_by: string | null
          validation_justification: string | null
          validation_status: Database["public"]["Enums"]["evidence_validation_status"]
        }[]
      }
      list_form_answer_organization_options: {
        Args: { p_form_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      list_form_answer_respondents_page: {
        Args: {
          p_cursor_cycle_id?: string
          p_cursor_updated_at?: string
          p_form_id: string
          p_from?: string
          p_limit?: number
          p_organization_id?: string
          p_status?: string
          p_to?: string
        }
        Returns: {
          answered_questions: number
          contributor_count: number
          cycle_id: string
          last_updated_at: string
          organization_id: string
          organization_name: string
          period_label: string
          respondent_status: string
          total_questions: number
        }[]
      }
      list_form_assignments_page: {
        Args: { p_form_ids: string[]; p_limit?: number; p_offset?: number }
        Returns: {
          form_id: string
          organization_id: string
          total_count: number
        }[]
      }
      list_forms_page: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_state?: string
        }
        Returns: {
          created_at: string
          id: string
          name: string
          publication_state: string
          published_at: string
          question_count: number
          total_count: number
          version: number
        }[]
      }
      list_open_recommendations_without_plan: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_organization_id?: string
        }
        Returns: {
          id: string
          status: string
          text: string
          total_count: number
        }[]
      }
      list_organization_respondents: {
        Args: { p_organization_id: string }
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      list_organizations_page: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string }
        Returns: {
          acronym: string
          created_at: string
          id: string
          name: string
          respondent_count: number
          total_count: number
          user_count: number
        }[]
      }
      list_recommendation_types: {
        Args: Record<PropertyKey, never>
        Returns: {
          type: string
        }[]
      }
      list_recommendations_page: {
        Args: {
          p_axis_id?: string
          p_cycle_id?: string
          p_form_id?: string
          p_limit?: number
          p_offset?: number
          p_organization_id?: string
          p_recommendation_id?: string
          p_status?: string
          p_type?: string
        }
        Returns: {
          axis_id: string
          axis_name: string
          created_at: string
          cycle_id: string
          cycle_processing_id: string
          cycle_state: Database["public"]["Enums"]["cycle_state"]
          form_id: string
          form_name: string
          form_version: number
          has_action_plan: boolean
          organization_id: string
          organization_name: string
          origin_mode: string
          period_label: string
          question_id: string
          question_prompt: string
          recommendation_id: string
          recommendation_status: string
          recommendation_text: string
          recommendation_type: string
          section_name: string
          source: string
          total_count: number
          trigger: string
        }[]
      }
      list_report_options_page: {
        Args: {
          p_cycle_id?: string
          p_form_ids?: string[]
          p_limit?: number
          p_offset?: number
          p_organization_id: string
          p_search?: string
        }
        Returns: {
          cycle_id: string
          cycle_state: Database["public"]["Enums"]["cycle_state"]
          emission_count: number
          form_id: string
          form_name: string
          form_version: number
          latest_emission_version: number
          period_label: string
          policy_version: string
          processed_at: string
          processing_id: string
          processing_version: number
          reference_end_year: number
          reference_start_year: number
          report_status: string
          total_count: number
        }[]
      }
      list_respondent_evidence_filter_options: {
        Args: { p_organization_id: string }
        Returns: {
          cycle_id: string
          form_id: string
          form_name: string
          period_label: string
        }[]
      }
      list_validation_form_page: {
        Args: {
          p_cycle_id: string
          p_answer?: string
          p_axis_id?: string
          p_decision?: string
          p_limit?: number
          p_mode?: string
          p_offset?: number
          p_proof?: string
          p_scope?: string
          p_search?: string
          p_section_id?: string
          p_situation?: string
        }
        Returns: {
          response_id: string
          total_count: number
        }[]
      }
      list_validation_queue_page: {
        Args: {
          p_cycle_id: string
          p_kind: string
          p_limit?: number
          p_offset?: number
          p_section_id?: string
        }
        Returns: {
          response_id: string
          total_count: number
        }[]
      }
      lock_supervision_cycle: {
        Args: { p_recommendation_id: string }
        Returns: Database["public"]["Enums"]["cycle_state"]
      }
      mark_response_admin_not_applicable: {
        Args: {
          p_actor_user_id: string
          p_cycle_id: string
          p_expected_admin_status?: string
          p_expected_decided_at?: string
          p_justification: string
          p_response_id: string
        }
        Returns: Json
      }
      mark_responses_admin_not_applicable_batch: {
        Args: {
          p_actor_user_id: string
          p_cycle_id: string
          p_justification: string
          p_response_ids: string[]
        }
        Returns: Json
      }
      match_evidence_adjustment_replacements: {
        Args: { p_response_id: string }
        Returns: {
          replacement_evidence_id: string
          requested_evidence_id: string
        }[]
      }
      notify_administrators: {
        Args: {
          p_action_path: string
          p_dedupe_key: string
          p_kind: string
          p_message: string
          p_payload?: Json
          p_title: string
        }
        Returns: number
      }
      notify_organization_respondents: {
        Args: {
          p_action_path: string
          p_dedupe_key: string
          p_kind: string
          p_message: string
          p_organization_id: string
          p_payload?: Json
          p_title: string
        }
        Returns: number
      }
      notify_respondent_open_cycles: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: number
      }
      notify_respondent_user: {
        Args: {
          p_action_path: string
          p_dedupe_key: string
          p_kind: string
          p_message: string
          p_payload?: Json
          p_title: string
          p_user_id: string
        }
        Returns: number
      }
      prepare_cycle_schedule_registration: {
        Args: {
          p_actor_user_id: string
          p_cycle_close_at: string | null
          p_cycle_ids: string[]
          p_reminder_offsets_days: number[]
          p_validation_deadline_at: string | null
        }
        Returns: {
          cycle_id: string
          jobs_created: number
          reminders_created: number
          schedule_revision: number
        }[]
      }
      process_cycles_batch_with_reference: {
        Args: {
          p_actor_user_id: string
          p_cycle_close_at?: string
          p_form_id: string
          p_mode: string
          p_organization_ids: string[]
          p_period_label: string
          p_reference_end_year: number
          p_reference_start_year: number
          p_reminder_offsets_days?: number[]
          p_response_deadline_at?: string
          p_starts_at?: string
          p_validation_deadline_at?: string
        }
        Returns: Json
      }
      publish_form: {
        Args: { p_actor_user_id: string; p_form_id: string }
        Returns: {
          form_id: string
          id: string
          published_at: string
          published_by: string | null
          state: Database["public"]["Enums"]["form_version_state"]
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "form_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reconcile_legacy_evidence_link: {
        Args: {
          p_actor_user_id: string
          p_cycle_id: string
          p_desired_validation_status?: Database["public"]["Enums"]["evidence_validation_status"]
          p_external_link: string
          p_legacy_source_column: number
          p_legacy_source_header?: string
          p_target_question_version_id: string
        }
        Returns: Json
      }
      remove_form_draft_question: {
        Args: {
          p_actor_user_id: string
          p_form_id: string
          p_question_id: string
        }
        Returns: undefined
      }
      remove_workbench_evidence_item: {
        Args: {
          p_actor_user_id: string
          p_cycle_id: string
          p_evidence_id: string
          p_expected_revision: number
          p_question_version_id: string
        }
        Returns: Json
      }
      reopen_cycle: {
        Args: {
          p_actor_user_id: string
          p_cycle_id: string
          p_question_version_ids?: string[] | null
          p_reason: string
          p_response_deadline_at: string
        }
        Returns: Json
      }
      reopen_validation_cycle: {
        Args: { p_actor_user_id: string; p_cycle_id: string; p_reason: string }
        Returns: Json
      }
      repair_cycles_for_manual_fami: {
        Args: {
          p_actor_user_id: string
          p_form_id: string
          p_period_id: string
        }
        Returns: Json
      }
      reorder_form_draft_questions: {
        Args: { p_form_draft_id: string; p_ordered_question_ids: string[] }
        Returns: undefined
      }
      replace_cycle_schedule: {
        Args: { p_actor_user_id: string; p_cycle_id: string }
        Returns: Json
      }
      replace_question_organization_waivers: {
        Args: {
          p_question_id: string
          p_scope_organization_ids: string[]
          p_waived_by: string
          p_waivers: Json
        }
        Returns: undefined
      }
      record_report_emission_failure: {
        Args: {
          p_action_plan_revision: number
          p_attempted_by: string
          p_cycle_id: string
          p_cycle_processing_id: string
          p_error_code: string
          p_error_message: string
        }
        Returns: string
      }
      reserve_report_emission: {
        Args: {
          p_cycle_id: string
          p_cycle_processing_id: string
          p_expected_action_plan_revision: number
          p_generated_at: string
          p_generated_by: string
          p_reissue_reason?: string
        }
        Returns: Json
      }
      respond_to_action_plan_supervision_request: {
        Args: {
          p_actor_user_id: string
          p_note_id: string
          p_response_body: string
        }
        Returns: {
          action_plan_id: string | null
          action_revision: number | null
          action_snapshot: Json
          author_id: string
          author_role: Database["public"]["Enums"]["app_user_role"]
          body: string
          created_at: string
          id: string
          lifecycle_status: Database["public"]["Enums"]["supervision_note_lifecycle_status"]
          note_type: string
          recommendation_id: string
          resolution_body: string | null
          resolved_at: string | null
          resolved_by: string | null
          responded_at: string | null
          responded_by: string | null
          response_body: string | null
        }
        SetofOptions: {
          from: "*"
          to: "action_plan_supervision_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revert_response_admin_not_applicable: {
        Args: {
          p_actor_user_id: string
          p_cycle_id: string
          p_expected_admin_status?: string
          p_expected_decided_at?: string
          p_justification: string
          p_response_id: string
        }
        Returns: Json
      }
      save_question_library_configuration: {
        Args: {
          p_actor_user_id: string
          p_bindings: Json
          p_coverage_score: number
          p_form_id: string
          p_metric: Json
          p_question_id: string
          p_response_mapping: Json
          p_section_id: string
        }
        Returns: undefined
      }
      save_validation_analysis_draft: {
        Args: {
          p_action?: string
          p_actor_user_id: string
          p_cycle_id: string
          p_evidence_id?: string
          p_expected_revision?: number
          p_justification?: string
          p_notes?: string
          p_response_id?: string
          p_target_kind: string
        }
        Returns: Json
      }
      mark_validation_analysis_draft_applied: {
        Args: {
          p_cycle_id: string
          p_evidence_id?: string
          p_response_id?: string
          p_target_kind: string
        }
        Returns: undefined
      }
      request_action_plan_deadline_change: {
        Args: {
          p_actor_user_id: string
          p_expected_revision: number
          p_organization_id: string
          p_plan_id: string
          p_reason: string
          p_recommendation_id: string
          p_requested_due_date: string
        }
        Returns: Database["public"]["Tables"]["action_plan_deadline_change_requests"]["Row"]
      }
      save_respondent_action_plan: {
        Args: {
          p_action_text: string
          p_actor_user_id: string
          p_cancelled?: boolean
          p_due_date: string
          p_execution_notes?: string
          p_expected_revision?: number
          p_organization_id: string
          p_plan_id: string | null
          p_progress_percentage: number
          p_progress_update_description?: string | null
          p_recommendation_id: string
          p_responsible_sector: string
          p_responsible_user_id: string
          p_start_date: string
        }
        Returns: {
          mode: string
          plan_id: string
          revision: number
        }[]
      }
      set_audit_actor: { Args: { p_actor: string }; Returns: undefined }
      set_cycle_reference_period: {
        Args: {
          p_actor_user_id: string
          p_cycle_id: string
          p_reference_end_year: number
          p_reference_start_year: number
        }
        Returns: Database["public"]["Tables"]["cycles"]["Row"]
        SetofOptions: {
          from: "*"
          to: "cycles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sync_form_assignments: {
        Args: {
          p_actor_user_id: string
          p_form_id: string
          p_organization_ids: string[]
        }
        Returns: Json
      }
      update_cycle_schedule: {
        Args: {
          p_actor_user_id: string
          p_cycle_close_at: string
          p_cycle_id: string
          p_response_deadline_at: string
          p_starts_at: string
          p_validation_deadline_at: string
        }
        Returns: Database["public"]["Tables"]["cycles"]["Row"]
        SetofOptions: {
          from: "*"
          to: "cycles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_respondent_profile: {
        Args: {
          p_actor_user_id: string
          p_full_name: string
          p_organization_id: string
          p_target_user_id: string
        }
        Returns: undefined
      }
      upsert_question_organization_waiver: {
        Args: {
          p_actor_user_id: string
          p_organization_id: string
          p_question_id: string
          p_reason: string
        }
        Returns: {
          id: string
          organization_id: string
          question_id: string
          reason: string | null
          waived_at: string
          waived_by: string
        }
        SetofOptions: {
          from: "*"
          to: "question_organization_waivers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_respondent_profile_details: {
        Args: {
          p_actor_user_id: string
          p_declaration_text: string
          p_organizational_unit: string
          p_position_title: string
          p_registration_number: string
          p_source_name: string
          p_source_submitted_at: string
          p_target_user_id: string
        }
        Returns: {
          declaration_text: string | null
          id: string
          organizational_unit: string | null
          position_title: string | null
          registration_number: string | null
          source_name: string
          source_submitted_at: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "respondent_profile_details"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      valid_reminder_offsets: {
        Args: { p_offsets: number[] }
        Returns: boolean
      }
      validate_evidence: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_cycle_id: string
          p_evidence_id: string
          p_expected_status?: string
          p_expected_validated_at?: string
          p_justification?: string
        }
        Returns: Json
      }
      validate_evidences_batch: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_cycle_id: string
          p_items: Json
          p_justification?: string
        }
        Returns: Json
      }
      validate_not_applicable_batch: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_cycle_id: string
          p_items: Json
          p_rejection_reason?: string
        }
        Returns: Json
      }
      validate_not_applicable_response: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_cycle_id: string
          p_expected_status?: string
          p_expected_validated_at?: string
          p_rejection_reason?: string
          p_response_id: string
        }
        Returns: Json
      }
      create_report_emission: {
        Args: {
          p_cycle_id: string
          p_cycle_processing_id: string
          p_file_path: string
          p_generated_at: string
          p_generated_by: string
          p_reissue_reason?: string
        }
        Returns: Json
      }
      notify_cycle_deadline_change: {
        Args: {
          p_action: string
          p_batch_id: string
          p_cycle_id: string
          p_justification: string
          p_new_deadline_at: string
        }
        Returns: number
      }
      supersede_absent_proof_with_evidence: {
        Args: {
          p_actor_user_id: string
          p_cycle_id: string
          p_evidence: Json
          p_response_id: string
        }
        Returns: Json
      }
      validation_form_axis_rank: {
        Args: { p_axis_name: string }
        Returns: number
      }
    }
    Enums: {
      action_plan_deadline_change_status: "pending" | "approved" | "rejected"
      action_plan_status: "todo" | "doing" | "done" | "cancelled"
      answer_value: "yes" | "no" | "not_applicable"
      app_user_role: "admin" | "respondent"
      cycle_processing_status: "working" | "completed"
      cycle_state:
        | "draft"
        | "in_response"
        | "submitted"
        | "in_validation"
        | "awaiting_adjustment"
        | "validated"
        | "completed"
      evidence_kind: "file" | "link" | "text"
      evidence_validation_status:
        | "pending"
        | "approved"
        | "invalidated"
        | "adjustment_requested"
      form_version_state: "published" | "superseded" | "archived"
      library_item_status:
        | "draft"
        | "in_review"
        | "published"
        | "deprecated"
        | "archived"
      na_validation_status: "pending" | "approved" | "rejected"
      recommendation_type:
        | "nao_implementacao"
        | "ausencia_evidencia"
        | "evidencia_insuficiente"
      supervision_note_lifecycle_status:
        | "recorded"
        | "open"
        | "acknowledged"
        | "resolved"
        | "cancelled"
        | "effective"
        | "superseded"
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
      action_plan_deadline_change_status: ["pending", "approved", "rejected"],
      action_plan_status: ["todo", "doing", "done", "cancelled"],
      answer_value: ["yes", "no", "not_applicable"],
      app_user_role: ["admin", "respondent"],
      cycle_processing_status: ["working", "completed"],
      cycle_state: [
        "draft",
        "in_response",
        "submitted",
        "in_validation",
        "awaiting_adjustment",
        "validated",
        "completed",
      ],
      evidence_kind: ["file", "link", "text"],
      evidence_validation_status: [
        "pending",
        "approved",
        "invalidated",
        "adjustment_requested",
      ],
      form_version_state: ["published", "superseded", "archived"],
      library_item_status: [
        "draft",
        "in_review",
        "published",
        "deprecated",
        "archived",
      ],
      na_validation_status: ["pending", "approved", "rejected"],
      recommendation_type: [
        "nao_implementacao",
        "ausencia_evidencia",
        "evidencia_insuficiente",
      ],
      supervision_note_lifecycle_status: [
        "recorded",
        "open",
        "acknowledged",
        "resolved",
        "cancelled",
        "effective",
        "superseded",
      ],
    },
  },
} as const
