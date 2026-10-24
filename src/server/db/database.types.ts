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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_profile_versions: {
        Row: {
          id: string
          payload: Json
          version: number
        }
        Insert: {
          id: string
          payload: Json
          version: number
        }
        Update: {
          id?: string
          payload?: Json
          version?: number
        }
        Relationships: []
      }
      ai_explanation_cache: {
        Row: {
          cache_key: string
          comparison_id: string
          created_at: string
          expires_at: string
          owner_id: string
          selection: Json
        }
        Insert: {
          cache_key: string
          comparison_id: string
          created_at?: string
          expires_at: string
          owner_id: string
          selection: Json
        }
        Update: {
          cache_key?: string
          comparison_id?: string
          created_at?: string
          expires_at?: string
          owner_id?: string
          selection?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_explanation_cache_comparison_id_fkey"
            columns: ["comparison_id"]
            isOneToOne: false
            referencedRelation: "comparisons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_explanation_cache_comparison_id_owner_id_fkey"
            columns: ["comparison_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "comparisons"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      ai_runs: {
        Row: {
          attempt: number
          created_at: string
          finished_at: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          model: string
          output_tokens: number | null
          policy_digest: string
          prompt_version: string
          provider: string
          request_id: string
          schema_version: number
          state: string
          task_id: string
          total_tokens: number | null
        }
        Insert: {
          attempt: number
          created_at?: string
          finished_at?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model: string
          output_tokens?: number | null
          policy_digest: string
          prompt_version: string
          provider: string
          request_id: string
          schema_version?: number
          state?: string
          task_id: string
          total_tokens?: number | null
        }
        Update: {
          attempt?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string
          output_tokens?: number | null
          policy_digest?: string
          prompt_version?: string
          provider?: string
          request_id?: string
          schema_version?: number
          state?: string
          task_id?: string
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "ai_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tasks: {
        Row: {
          actor_hash: string
          client_key: string | null
          created_at: string
          deadline: string
          fingerprint: string | null
          finished_at: string | null
          id: string
          owner_id: string | null
          policy_digest: string
          role: string
          state: string
        }
        Insert: {
          actor_hash: string
          client_key?: string | null
          created_at?: string
          deadline: string
          fingerprint?: string | null
          finished_at?: string | null
          id?: string
          owner_id?: string | null
          policy_digest: string
          role: string
          state?: string
        }
        Update: {
          actor_hash?: string
          client_key?: string | null
          created_at?: string
          deadline?: string
          fingerprint?: string | null
          finished_at?: string | null
          id?: string
          owner_id?: string | null
          policy_digest?: string
          role?: string
          state?: string
        }
        Relationships: []
      }
      comparisons: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          owner_id: string
          payload: Json
          snapshot_hash: string
          snapshot_id: string
          version: number
        }
        Insert: {
          created_at: string
          expires_at: string
          id?: string
          owner_id: string
          payload: Json
          snapshot_hash: string
          snapshot_id: string
          version?: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          owner_id?: string
          payload?: Json
          snapshot_hash?: string
          snapshot_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "comparisons_snapshot_id_snapshot_hash_fkey"
            columns: ["snapshot_id", "snapshot_hash"]
            isOneToOne: false
            referencedRelation: "grid_snapshots"
            referencedColumns: ["id", "digest"]
          },
        ]
      }
      completion_reports: {
        Row: {
          created_at: string
          document: Json
          id: string
          kind: string
          owner_id: string
          plan_id: string
          prior_report_id: string | null
          profile_still_applicable: boolean | null
          reason: string
          reported_start: string | null
          sequence: number
        }
        Insert: {
          created_at: string
          document: Json
          id: string
          kind: string
          owner_id: string
          plan_id: string
          prior_report_id?: string | null
          profile_still_applicable?: boolean | null
          reason: string
          reported_start?: string | null
          sequence: number
        }
        Update: {
          created_at?: string
          document?: Json
          id?: string
          kind?: string
          owner_id?: string
          plan_id?: string
          prior_report_id?: string | null
          profile_still_applicable?: boolean | null
          reason?: string
          reported_start?: string | null
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "completion_reports_plan_id_owner_id_fkey"
            columns: ["plan_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "completion_reports_prior_report_id_plan_id_owner_id_fkey"
            columns: ["prior_report_id", "plan_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "completion_reports"
            referencedColumns: ["id", "plan_id", "owner_id"]
          },
        ]
      }
      grid_snapshots: {
        Row: {
          created_at: string
          digest: string
          id: string
          payload_text: string
          retrieved_at: string
          snapshot: Json | null
        }
        Insert: {
          created_at?: string
          digest: string
          id: string
          payload_text: string
          retrieved_at: string
          snapshot?: Json | null
        }
        Update: {
          created_at?: string
          digest?: string
          id?: string
          payload_text?: string
          retrieved_at?: string
          snapshot?: Json | null
        }
        Relationships: []
      }
      ledger_operations: {
        Row: {
          attempts: number
          block_hash: string | null
          block_number: number | null
          checked_at: string | null
          created_at: string
          expected_hash: string
          failure_code: string | null
          id: string
          kind: string
          publication_id: string
          result_id: string | null
          status: string
          transaction_hash: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          block_hash?: string | null
          block_number?: number | null
          checked_at?: string | null
          created_at?: string
          expected_hash: string
          failure_code?: string | null
          id?: string
          kind: string
          publication_id: string
          result_id?: string | null
          status?: string
          transaction_hash?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          block_hash?: string | null
          block_number?: number | null
          checked_at?: string | null
          created_at?: string
          expected_hash?: string
          failure_code?: string | null
          id?: string
          kind?: string
          publication_id?: string
          result_id?: string | null
          status?: string
          transaction_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_operations_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_operations_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: true
            referencedRelation: "published_results"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_signed_transactions: {
        Row: {
          chain_id: number
          created_at: string
          nonce: number
          operation_id: string
          raw_transaction: string
          signer: string
          transaction_hash: string
        }
        Insert: {
          chain_id: number
          created_at?: string
          nonce: number
          operation_id: string
          raw_transaction: string
          signer: string
          transaction_hash: string
        }
        Update: {
          chain_id?: number
          created_at?: string
          nonce?: number
          operation_id?: string
          raw_transaction?: string
          signer?: string
          transaction_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_signed_transactions_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: true
            referencedRelation: "ledger_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_worker_leases: {
        Row: {
          expires_at: string
          fence: number
          holder: string
          scope: string
        }
        Insert: {
          expires_at: string
          fence?: number
          holder: string
          scope: string
        }
        Update: {
          expires_at?: string
          fence?: number
          holder?: string
          scope?: string
        }
        Relationships: []
      }
      lifecycle_mutations: {
        Row: {
          expires_at: string
          key: string
          owner_id: string
          request_digest: string
          response: Json
          scope: string
        }
        Insert: {
          expires_at?: string
          key: string
          owner_id: string
          request_digest: string
          response: Json
          scope: string
        }
        Update: {
          expires_at?: string
          key?: string
          owner_id?: string
          request_digest?: string
          response?: Json
          scope?: string
        }
        Relationships: []
      }
      mutation_keys: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          owner_id: string
          request_digest: string
          response_reference: string
          scope: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          key: string
          owner_id: string
          request_digest: string
          response_reference: string
          scope: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          owner_id?: string
          request_digest?: string
          response_reference?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "mutation_keys_response_reference_fkey"
            columns: ["response_reference"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          accepted_at: string
          accepted_payload: Json
          comparison_id: string
          id: string
          mode: string
          owner_id: string
          status: string
          version: number
        }
        Insert: {
          accepted_at?: string
          accepted_payload: Json
          comparison_id: string
          id?: string
          mode?: string
          owner_id: string
          status?: string
          version?: number
        }
        Update: {
          accepted_at?: string
          accepted_payload?: Json
          comparison_id?: string
          id?: string
          mode?: string
          owner_id?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "plans_comparison_id_owner_id_fkey"
            columns: ["comparison_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "comparisons"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      publication_identities: {
        Row: {
          contract_address: string
          nonce: string
          owner_id: string
          plan_id: string
          receipt_id: string
        }
        Insert: {
          contract_address: string
          nonce: string
          owner_id: string
          plan_id: string
          receipt_id: string
        }
        Update: {
          contract_address?: string
          nonce?: string
          owner_id?: string
          plan_id?: string
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_identities_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_previews: {
        Row: {
          canonical_text: string
          consent_version: string
          created_at: string
          expires_at: string
          id: string
          kind: string
          manifest: Json
          manifest_hash: string
          owner_id: string
          plan_id: string
          plan_version: number
          private_result_id: string | null
        }
        Insert: {
          canonical_text: string
          consent_version?: string
          created_at?: string
          expires_at: string
          id?: string
          kind: string
          manifest: Json
          manifest_hash: string
          owner_id: string
          plan_id: string
          plan_version: number
          private_result_id?: string | null
        }
        Update: {
          canonical_text?: string
          consent_version?: string
          created_at?: string
          expires_at?: string
          id?: string
          kind?: string
          manifest?: Json
          manifest_hash?: string
          owner_id?: string
          plan_id?: string
          plan_version?: number
          private_result_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publication_previews_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_previews_private_result_id_fkey"
            columns: ["private_result_id"]
            isOneToOne: false
            referencedRelation: "result_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          canonical_text: string
          consent_version: string
          consented_at: string
          id: string
          manifest: Json
          manifest_hash: string
          owner_id: string | null
          plan_id: string | null
          receipt_id: string
          schedule_id: string | null
        }
        Insert: {
          canonical_text: string
          consent_version: string
          consented_at?: string
          id?: string
          manifest: Json
          manifest_hash: string
          owner_id?: string | null
          plan_id?: string | null
          receipt_id: string
          schedule_id?: string | null
        }
        Update: {
          canonical_text?: string
          consent_version?: string
          consented_at?: string
          id?: string
          manifest?: Json
          manifest_hash?: string
          owner_id?: string | null
          plan_id?: string | null
          receipt_id?: string
          schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publications_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: true
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      published_results: {
        Row: {
          canonical_text: string
          consent_version: string
          consented_at: string
          id: string
          manifest: Json
          manifest_hash: string
          private_vector_digest: string | null
          public_sequence: number
          publication_id: string
          result_revision_id: string | null
        }
        Insert: {
          canonical_text: string
          consent_version: string
          consented_at?: string
          id?: string
          manifest: Json
          manifest_hash: string
          private_vector_digest?: string | null
          public_sequence: number
          publication_id: string
          result_revision_id?: string | null
        }
        Update: {
          canonical_text?: string
          consent_version?: string
          consented_at?: string
          id?: string
          manifest?: Json
          manifest_hash?: string
          private_vector_digest?: string | null
          public_sequence?: number
          publication_id?: string
          result_revision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "published_results_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_results_result_revision_id_fkey"
            columns: ["result_revision_id"]
            isOneToOne: false
            referencedRelation: "result_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      result_revisions: {
        Row: {
          actual_snapshot_id: string | null
          created_at: string
          document: Json
          id: string
          owner_id: string
          plan_id: string
          report_id: string
          semantic_digest: string
          sequence: number
        }
        Insert: {
          actual_snapshot_id?: string | null
          created_at: string
          document: Json
          id: string
          owner_id: string
          plan_id: string
          report_id: string
          semantic_digest: string
          sequence: number
        }
        Update: {
          actual_snapshot_id?: string | null
          created_at?: string
          document?: Json
          id?: string
          owner_id?: string
          plan_id?: string
          report_id?: string
          semantic_digest?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "result_revisions_actual_snapshot_id_fkey"
            columns: ["actual_snapshot_id"]
            isOneToOne: false
            referencedRelation: "grid_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_revisions_plan_id_owner_id_fkey"
            columns: ["plan_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "result_revisions_report_id_plan_id_owner_id_fkey"
            columns: ["report_id", "plan_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "completion_reports"
            referencedColumns: ["id", "plan_id", "owner_id"]
          },
        ]
      }
      schedule_comparisons: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          owner_id: string
          payload: Json
        }
        Insert: {
          created_at: string
          expires_at: string
          id: string
          owner_id: string
          payload: Json
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          owner_id?: string
          payload?: Json
        }
        Relationships: []
      }
      schedule_explanation_cache: {
        Row: {
          cache_key: string
          expires_at: string
          owner_id: string
          schedule_id: string
          selection: Json
        }
        Insert: {
          cache_key: string
          expires_at: string
          owner_id: string
          schedule_id: string
          selection: Json
        }
        Update: {
          cache_key?: string
          expires_at?: string
          owner_id?: string
          schedule_id?: string
          selection?: Json
        }
        Relationships: [
          {
            foreignKeyName: "schedule_explanation_cache_schedule_id_owner_id_fkey"
            columns: ["schedule_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      schedule_lifecycle_keys: {
        Row: {
          created_at: string
          digest: string
          key: string
          owner_id: string
          response: Json
          schedule_id: string
          scope: string
        }
        Insert: {
          created_at?: string
          digest: string
          key: string
          owner_id: string
          response: Json
          schedule_id: string
          scope: string
        }
        Update: {
          created_at?: string
          digest?: string
          key?: string
          owner_id?: string
          response?: Json
          schedule_id?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_lifecycle_keys_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_mutation_keys: {
        Row: {
          created_at: string
          key: string
          owner_id: string
          request_digest: string
          response_reference: string
          scope: string
        }
        Insert: {
          created_at?: string
          key: string
          owner_id: string
          request_digest: string
          response_reference: string
          scope: string
        }
        Update: {
          created_at?: string
          key?: string
          owner_id?: string
          request_digest?: string
          response_reference?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_mutation_keys_response_reference_fkey"
            columns: ["response_reference"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_publication_previews: {
        Row: {
          canonical_text: string
          consent_version: string
          created_at: string
          expires_at: string
          id: string
          kind: string
          manifest: Json
          manifest_hash: string
          owner_id: string
          private_vector: Json | null
          schedule_id: string
        }
        Insert: {
          canonical_text: string
          consent_version?: string
          created_at?: string
          expires_at: string
          id?: string
          kind: string
          manifest: Json
          manifest_hash: string
          owner_id: string
          private_vector?: Json | null
          schedule_id: string
        }
        Update: {
          canonical_text?: string
          consent_version?: string
          created_at?: string
          expires_at?: string
          id?: string
          kind?: string
          manifest?: Json
          manifest_hash?: string
          owner_id?: string
          private_vector?: Json | null
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_publication_previews_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_receipt_identities: {
        Row: {
          contract_address: string
          nonce: string
          owner_id: string
          receipt_id: string
          schedule_id: string
        }
        Insert: {
          contract_address: string
          nonce: string
          owner_id: string
          receipt_id: string
          schedule_id: string
        }
        Update: {
          contract_address?: string
          nonce?: string
          owner_id?: string
          receipt_id?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_receipt_identities_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: true
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_reports: {
        Row: {
          id: string
          owner_id: string
          payload: Json
          previous_report_id: string | null
          schedule_id: string
          sequence: number
          task_id: string
        }
        Insert: {
          id: string
          owner_id: string
          payload: Json
          previous_report_id?: string | null
          schedule_id: string
          sequence: number
          task_id: string
        }
        Update: {
          id?: string
          owner_id?: string
          payload?: Json
          previous_report_id?: string | null
          schedule_id?: string
          sequence?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_reports_previous_report_id_schedule_id_task_id_fkey"
            columns: ["previous_report_id", "schedule_id", "task_id"]
            isOneToOne: false
            referencedRelation: "schedule_reports"
            referencedColumns: ["id", "schedule_id", "task_id"]
          },
          {
            foreignKeyName: "schedule_reports_schedule_id_task_id_owner_id_fkey"
            columns: ["schedule_id", "task_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "schedule_tasks"
            referencedColumns: ["schedule_id", "task_id", "owner_id"]
          },
        ]
      }
      schedule_results: {
        Row: {
          id: string
          owner_id: string
          payload: Json
          report_id: string
          schedule_id: string
          semantic_digest: string
          sequence: number
          task_id: string
        }
        Insert: {
          id: string
          owner_id: string
          payload: Json
          report_id: string
          schedule_id: string
          semantic_digest: string
          sequence: number
          task_id: string
        }
        Update: {
          id?: string
          owner_id?: string
          payload?: Json
          report_id?: string
          schedule_id?: string
          semantic_digest?: string
          sequence?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_results_report_id_schedule_id_task_id_fkey"
            columns: ["report_id", "schedule_id", "task_id"]
            isOneToOne: false
            referencedRelation: "schedule_reports"
            referencedColumns: ["id", "schedule_id", "task_id"]
          },
          {
            foreignKeyName: "schedule_results_schedule_id_task_id_owner_id_fkey"
            columns: ["schedule_id", "task_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "schedule_tasks"
            referencedColumns: ["schedule_id", "task_id", "owner_id"]
          },
        ]
      }
      schedule_tasks: {
        Row: {
          owner_id: string
          payload: Json
          schedule_id: string
          task_id: string
        }
        Insert: {
          owner_id: string
          payload: Json
          schedule_id: string
          task_id: string
        }
        Update: {
          owner_id?: string
          payload?: Json
          schedule_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_tasks_schedule_id_owner_id_fkey"
            columns: ["schedule_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      schedules: {
        Row: {
          accepted_at: string
          accepted_payload: Json
          comparison_id: string
          id: string
          option_index: number
          owner_id: string
        }
        Insert: {
          accepted_at?: string
          accepted_payload: Json
          comparison_id: string
          id?: string
          option_index: number
          owner_id: string
        }
        Update: {
          accepted_at?: string
          accepted_payload?: Json
          comparison_id?: string
          id?: string
          option_index?: number
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_comparison_id_owner_id_fkey"
            columns: ["comparison_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "schedule_comparisons"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      service_leases: {
        Row: {
          cooldown_until: string | null
          expires_at: string | null
          failure_started_at: string | null
          failures: number
          fencing: number
          holder: string | null
          scope: string
        }
        Insert: {
          cooldown_until?: string | null
          expires_at?: string | null
          failure_started_at?: string | null
          failures?: number
          fencing?: number
          holder?: string | null
          scope: string
        }
        Update: {
          cooldown_until?: string | null
          expires_at?: string | null
          failure_started_at?: string | null
          failures?: number
          fencing?: number
          holder?: string | null
          scope?: string
        }
        Relationships: []
      }
      usage_buckets: {
        Row: {
          bucket_type: string
          count: number
          subject_hash: string
          window_start: string
        }
        Insert: {
          bucket_type: string
          count: number
          subject_hash: string
          window_start: string
        }
        Update: {
          bucket_type?: string
          count?: number
          subject_hash?: string
          window_start?: string
        }
        Relationships: []
      }
      usage_reservations: {
        Row: {
          amount: number
          bucket_hash: string
          created_at: string
          expires_at: string
          id: number
          metric: string
          operation_id: string
        }
        Insert: {
          amount: number
          bucket_hash: string
          created_at?: string
          expires_at: string
          id?: never
          metric: string
          operation_id: string
        }
        Update: {
          amount?: number
          bucket_hash?: string
          created_at?: string
          expires_at?: string
          id?: never
          metric?: string
          operation_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cs_accept_plan: {
        Args: {
          p_comparison: string
          p_key: string
          p_owner: string
          p_request_digest: string
          p_version: number
        }
        Returns: {
          accepted_at: string
          accepted_payload: Json
          comparison_id: string
          id: string
          mode: string
          owner_id: string
          status: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cs_accept_schedule: {
        Args: {
          p_comparison: string
          p_digest: string
          p_key: string
          p_option: number
          p_owner: string
        }
        Returns: string
      }
      cs_ai_begin_task: {
        Args: {
          p_actor: string
          p_buckets: Json
          p_fingerprint: string
          p_key: string
          p_owner: string
          p_policy: string
          p_role: string
          p_seconds: number
        }
        Returns: Json
      }
      cs_ai_cache_key: {
        Args: {
          p_actor: string
          p_fingerprint: string
          p_key: string
          p_owner: string
          p_policy: string
        }
        Returns: Json
      }
      cs_ai_finish_attempt: {
        Args: {
          p_latency: number
          p_outcome: string
          p_retry: number
          p_run: string
          p_scopes: string[]
          p_usage: Json
        }
        Returns: undefined
      }
      cs_ai_finish_task: {
        Args: { p_success: boolean; p_task: string }
        Returns: undefined
      }
      cs_ai_prune: { Args: never; Returns: undefined }
      cs_ai_reserve_attempt: {
        Args: {
          p_buckets: Json
          p_model: string
          p_prompt: string
          p_provider: string
          p_request: string
          p_scopes: string[]
          p_task: string
        }
        Returns: Json
      }
      cs_ai_retention_preview: { Args: never; Returns: Json }
      cs_comparison_quota: { Args: { p_subject: string }; Returns: boolean }
      cs_create_comparison: {
        Args: {
          p_id: string
          p_owner: string
          p_payload: Json
          p_snapshot_hash: string
          p_snapshot_id: string
          p_snapshot_text: string
        }
        Returns: string
      }
      cs_create_schedule_comparison: {
        Args: { p_owner: string; p_payload: Json }
        Returns: string
      }
      cs_ledger_assert_lease: {
        Args: { p_fence: number; p_holder: string; p_scope: string }
        Returns: undefined
      }
      cs_ledger_lease: {
        Args: { p_holder: string; p_scope: string }
        Returns: number
      }
      cs_ledger_observe: {
        Args: {
          p_block: number
          p_block_hash: string
          p_code: string
          p_fence: number
          p_holder: string
          p_operation: string
          p_scope: string
          p_status: string
        }
        Returns: undefined
      }
      cs_ledger_persist_signed: {
        Args: {
          p_fence: number
          p_hash: string
          p_holder: string
          p_nonce: number
          p_operation: string
          p_raw: string
          p_scope: string
        }
        Returns: boolean
      }
      cs_ledger_prepare: {
        Args: {
          p_fence: number
          p_holder: string
          p_operation: string
          p_scope: string
        }
        Returns: boolean
      }
      cs_ledger_release: {
        Args: { p_fence: number; p_holder: string; p_scope: string }
        Returns: undefined
      }
      cs_lifecycle_commit: {
        Args: {
          p_action: string
          p_digest: string
          p_expected_version: number
          p_key: string
          p_owner: string
          p_plan: string
          p_report: Json
          p_result: Json
          p_semantic: string
          p_snapshot_hash: string
          p_snapshot_text: string
        }
        Returns: Json
      }
      cs_lifecycle_replay: {
        Args: {
          p_action: string
          p_digest: string
          p_key: string
          p_owner: string
          p_plan: string
        }
        Returns: Json
      }
      cs_prune_lifecycle_mutations: { Args: never; Returns: number }
      cs_prune_private_snapshots: {
        Args: { p_ids: string[] }
        Returns: undefined
      }
      cs_publication_consent: {
        Args: {
          p_consent: string
          p_digest: string
          p_hash: string
          p_key: string
          p_owner: string
          p_plan: string
          p_preview: string
          p_revision: number
        }
        Returns: Json
      }
      cs_publication_identity: {
        Args: {
          p_contract: string
          p_nonce: string
          p_owner: string
          p_plan: string
          p_receipt: string
        }
        Returns: Json
      }
      cs_publication_preview: {
        Args: {
          p_hash: string
          p_manifest: string
          p_owner: string
          p_plan: string
          p_result: string
          p_version: number
        }
        Returns: Json
      }
      cs_read_private_plan: { Args: { p_plan: string }; Returns: Json }
      cs_read_private_plan_page: {
        Args: { p_before_id?: string; p_before_time?: string; p_limit: number }
        Returns: Json
      }
      cs_reserve_usage: {
        Args: { p_buckets: Json; p_operation: string }
        Returns: Json
      }
      cs_retention: { Args: { p_apply?: boolean }; Returns: Json }
      cs_schedule_history: { Args: { p_schedule: string }; Returns: Json }
      cs_schedule_publication_consent: {
        Args: {
          p_digest: string
          p_hash: string
          p_key: string
          p_owner: string
          p_preview: string
          p_schedule: string
        }
        Returns: Json
      }
      cs_schedule_publication_preview: {
        Args: {
          p_hash: string
          p_owner: string
          p_schedule: string
          p_text: string
          p_vector: Json
        }
        Returns: Json
      }
      cs_schedule_receipt_identity: {
        Args: {
          p_contract: string
          p_nonce: string
          p_owner: string
          p_receipt: string
          p_schedule: string
        }
        Returns: Json
      }
      cs_schedule_report_commit: {
        Args: {
          p_action: string
          p_digest: string
          p_expected: number
          p_key: string
          p_owner: string
          p_report: Json
          p_result: Json
          p_schedule: string
          p_semantic: string
          p_task: string
        }
        Returns: Json
      }
      cs_schedule_vector: { Args: { p_schedule: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
