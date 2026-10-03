/**
 * Hand-written to match `supabase/migrations/*.sql` exactly as of
 * M3.0. This environment has no network access, so this could not be
 * generated with `supabase gen types typescript` against a real
 * project — once you've applied the migrations, regenerate it for
 * certainty:
 *
 *   npx supabase gen types typescript --project-id <your-project-ref> \
 *     > src/lib/supabase/database.types.ts
 *
 * Until then, this file is the source of truth the rest of M3.0's
 * code is written against, and it's kept in sync with the SQL by
 * hand — both were authored together in this patch.
 */

export type WalletCategory =
  | "auto"
  | "health"
  | "home"
  | "renters"
  | "life"
  | "pet"
  | "motorcycle"
  | "travel"
  | "other";

export type WalletPolicyStatus = "active" | "pending" | "expired" | "cancelled" | "unknown";

export type PremiumFrequency = "monthly" | "quarterly" | "semi_annual" | "annual" | "other";

export type ExtractionStatus = "pending" | "processing" | "complete" | "failed" | "needs_review";

/** `policy_analysis_jobs.status` — a job starts `"queued"` (migration 0006), before any `policy_extracted_data` row exists at all, which is why this is its own type rather than reusing `ExtractionStatus`'s `"pending"`. */
export type AnalysisJobStatus = "queued" | "processing" | "complete" | "failed" | "needs_review";

/** Same recursive shape Supabase's own codegen uses for `jsonb` columns. */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/**
 * Every table below includes `Relationships` — even `[]` for tables
 * with none — because `@supabase/postgrest-js`'s `GenericTable` type
 * requires that key to consider a table's shape valid. Without it,
 * `Database["public"]["Tables"][x]` doesn't structurally satisfy
 * `GenericTable`, and `.insert()`/`.update()` silently infer `never`
 * for their argument instead of the real `Insert`/`Update` type —
 * this was the actual cause of the Vercel build failure this file
 * fixes (`owner_user_id does not exist in type 'never[]'`), not
 * anything wrong with the `Insert` types themselves. Foreign keys to
 * `auth.users` are omitted from every `Relationships` array: that
 * schema isn't modeled in this hand-written `Database` type, so
 * there's no `referencedRelation` to point them at — Supabase's own
 * codegen does the same when a referenced schema isn't included.
 */
export interface Database {
  /**
   * Present in every `supabase gen types typescript` output on current
   * Supabase CLI versions (it was NOT in this hand-written file, since
   * it predates that codegen convention). Added here to match, but —
   * see the investigation notes in the accompanying report — this is a
   * belt-and-suspenders alignment with the real codegen shape, not the
   * fix for the `never[]` symptom: a from-scratch reproduction of
   * `@supabase/supabase-js@2.117.2`'s actual generic-resolution logic
   * (verified with `tsc`, not assumed) resolves `Tables["policies"]["Insert"]`
   * correctly for this `Database` shape with or without this field.
   */
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        // profiles.id -> auth.users.id only — auth schema not modeled here.
        Relationships: [];
      };
      households: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["households"]["Insert"]>;
        // households.created_by -> auth.users.id only — auth schema not modeled here.
        Relationships: [];
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string | null;
          display_name: string;
          relationship: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id?: string | null;
          display_name: string;
          relationship?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["household_members"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
        // household_members.user_id -> auth.users.id — auth schema not modeled here.
      };
      policies: {
        Row: {
          id: string;
          owner_user_id: string;
          household_id: string | null;
          category: WalletCategory;
          carrier: string | null;
          policy_number: string | null;
          status: WalletPolicyStatus;
          effective_date: string | null;
          expiration_date: string | null;
          premium_amount: number | null;
          premium_frequency: PremiumFrequency | null;
          term_premium: number | null;
          state: string | null;
          monitoring_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          household_id?: string | null;
          category: WalletCategory;
          carrier?: string | null;
          policy_number?: string | null;
          status?: WalletPolicyStatus;
          effective_date?: string | null;
          expiration_date?: string | null;
          premium_amount?: number | null;
          premium_frequency?: PremiumFrequency | null;
          term_premium?: number | null;
          state?: string | null;
          monitoring_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["policies"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "policies_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
        // policies.owner_user_id -> auth.users.id — auth schema not modeled here.
      };
      policy_documents: {
        Row: {
          id: string;
          policy_id: string;
          owner_user_id: string;
          storage_bucket: string;
          storage_path: string;
          original_filename: string | null;
          mime_type: string | null;
          file_size_bytes: number | null;
          uploaded_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          policy_id: string;
          owner_user_id: string;
          storage_bucket?: string;
          storage_path: string;
          original_filename?: string | null;
          mime_type?: string | null;
          file_size_bytes?: number | null;
          uploaded_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["policy_documents"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "policy_documents_policy_id_fkey";
            columns: ["policy_id"];
            isOneToOne: false;
            referencedRelation: "policies";
            referencedColumns: ["id"];
          },
        ];
        // policy_documents.owner_user_id -> auth.users.id — auth schema not modeled here.
      };
      policy_extracted_data: {
        Row: {
          id: string;
          policy_id: string;
          document_id: string | null;
          owner_user_id: string;
          category: WalletCategory;
          schema_version: string;
          data: Json;
          extraction_status: ExtractionStatus;
          extracted_by: string | null;
          overall_confidence: number | null;
          roni_summary: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          policy_id: string;
          document_id?: string | null;
          owner_user_id: string;
          category: WalletCategory;
          schema_version: string;
          data?: Json;
          extraction_status?: ExtractionStatus;
          extracted_by?: string | null;
          overall_confidence?: number | null;
          roni_summary?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["policy_extracted_data"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "policy_extracted_data_policy_id_fkey";
            columns: ["policy_id"];
            isOneToOne: false;
            referencedRelation: "policies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "policy_extracted_data_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "policy_documents";
            referencedColumns: ["id"];
          },
        ];
        // policy_extracted_data.owner_user_id -> auth.users.id — auth schema not modeled here.
      };
      policy_extracted_data_evidence: {
        Row: {
          id: string;
          extracted_data_id: string;
          owner_user_id: string;
          field_path: string;
          value_text: string | null;
          confidence: number | null;
          document_id: string | null;
          page_number: number | null;
          snippet: string | null;
          /** Set only by server code, after the model responds — see migration 0007. `null` = couldn't be checked (not the same as verified-false). */
          page_verified: boolean | null;
          snippet_verified: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          extracted_data_id: string;
          owner_user_id: string;
          field_path: string;
          value_text?: string | null;
          confidence?: number | null;
          document_id?: string | null;
          page_number?: number | null;
          snippet?: string | null;
          page_verified?: boolean | null;
          snippet_verified?: boolean | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["policy_extracted_data_evidence"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "policy_extracted_data_evidence_extracted_data_id_fkey";
            columns: ["extracted_data_id"];
            isOneToOne: false;
            referencedRelation: "policy_extracted_data";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "policy_extracted_data_evidence_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "policy_documents";
            referencedColumns: ["id"];
          },
        ];
        // policy_extracted_data_evidence.owner_user_id -> auth.users.id — auth schema not modeled here.
      };
      policy_analysis_jobs: {
        Row: {
          id: string;
          policy_id: string;
          document_id: string;
          owner_user_id: string;
          status: AnalysisJobStatus;
          attempt_number: number;
          extracted_data_id: string | null;
          error_reason: string | null;
          started_at: string | null;
          finished_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          policy_id: string;
          document_id: string;
          owner_user_id: string;
          status?: AnalysisJobStatus;
          attempt_number?: number;
          extracted_data_id?: string | null;
          error_reason?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["policy_analysis_jobs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "policy_analysis_jobs_policy_id_fkey";
            columns: ["policy_id"];
            isOneToOne: false;
            referencedRelation: "policies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "policy_analysis_jobs_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "policy_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "policy_analysis_jobs_extracted_data_id_fkey";
            columns: ["extracted_data_id"];
            isOneToOne: false;
            referencedRelation: "policy_extracted_data";
            referencedColumns: ["id"];
          },
        ];
        // policy_analysis_jobs.owner_user_id -> auth.users.id — auth schema not modeled here.
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
