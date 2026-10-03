import type {
  AnalysisJobStatus,
  Database,
  ExtractionStatus,
  PremiumFrequency,
  WalletCategory,
  WalletPolicyStatus,
} from "@/lib/supabase/database.types";

export type { WalletCategory, WalletPolicyStatus, PremiumFrequency, ExtractionStatus, AnalysisJobStatus };

/**
 * A policy as stored in the Wallet — this is the *record*, not the
 * document. `policyNumber` is the real, unmasked value; anything that
 * displays it to a person should go through `maskPolicyNumber()`
 * (`lib/wallet/mask.ts`) rather than rendering this field directly
 * (M3.0 spec §10).
 */
export interface WalletPolicy {
  id: string;
  ownerUserId: string;
  householdId: string | null;
  category: WalletCategory;
  carrier: string | null;
  policyNumber: string | null;
  status: WalletPolicyStatus;
  effectiveDate: string | null;
  expirationDate: string | null;
  premiumAmount: number | null;
  premiumFrequency: PremiumFrequency | null;
  termPremium: number | null;
  state: string | null;
  monitoringEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** What a caller provides to create a policy — `ownerUserId` is intentionally absent; the repository sets it from the authenticated session, never from caller input. */
export type NewWalletPolicyInput = Omit<
  WalletPolicy,
  "id" | "ownerUserId" | "createdAt" | "updatedAt" | "status" | "monitoringEnabled"
> &
  Partial<Pick<WalletPolicy, "status" | "monitoringEnabled">>;

export type WalletPolicyPatch = Partial<Omit<WalletPolicy, "id" | "ownerUserId" | "createdAt" | "updatedAt">>;

/** Metadata about one uploaded file. The file itself lives in the private `policy-documents` Storage bucket — this row just points at it. */
export interface PolicyDocument {
  id: string;
  policyId: string;
  ownerUserId: string;
  storageBucket: string;
  storagePath: string;
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  uploadedAt: string;
  createdAt: string;
}

/**
 * `id` is optional and normally omitted (Postgres defaults it via
 * `gen_random_uuid()`). M3.1's upload route passes it explicitly —
 * generated with `crypto.randomUUID()` *before* the Storage upload —
 * so the same id can be used in the Storage path convention
 * (`{user_id}/{policy_id}/{document_id}/{filename}`, migration 0003)
 * and this row stays trivially findable from that path.
 */
export type NewPolicyDocumentInput = Omit<PolicyDocument, "id" | "ownerUserId" | "createdAt"> & {
  id?: string;
};

/**
 * One evidence citation for one extracted field — this is what lets a
 * future Wallet UI show:
 *
 *   Collision deductible  $1,000
 *   Source: Auto Policy, Page 6
 *
 * and what lets a future Ask Roni cite the actual document rather
 * than asserting a fact with nothing behind it. `fieldPath` is a
 * dot-path into the sibling `ExtractedPolicyData.data` object (e.g.
 * `"coverages.collision.deductible"`), so a UI or Ask Roni can look up
 * "what backs this specific number" without a bespoke join per field.
 */
export interface ExtractionEvidence {
  id: string;
  extractedDataId: string;
  ownerUserId: string;
  fieldPath: string;
  /** The value as it appeared in/near the source, as text — kept separate from the typed value in `data` so evidence never has to be re-typed per field. */
  valueText: string | null;
  /** 0–1, as declared BY THE MODEL. Never treated as proof of accuracy — see `pageVerified`/`snippetVerified`, which are what this app itself independently confirmed, not what the model claims. */
  confidence: number | null;
  documentId: string | null;
  pageNumber: number | null;
  /** A short quoted or paraphrased excerpt — not the whole page. */
  snippet: string | null;
  /**
   * Set ONLY by server code, after the model has already responded
   * (`lib/services/policy-extraction/verify-evidence.ts`) — never part
   * of what the model itself fills in, so the model cannot mark its own
   * citation "verified." `true` only when `pageNumber` is within this
   * document's real, independently-known page count. `null` when that
   * page count itself couldn't be determined.
   */
  pageVerified: boolean | null;
  /** Same rule as `pageVerified`: `true` only when `snippet` was actually found in this app's own OCR text for that page. `null` when there was no OCR text for that page to check against — not the same as `false`. */
  snippetVerified: boolean | null;
  createdAt: string;
}

/** What a caller provides to record one evidence citation — `ownerUserId` is always derived from the authenticated session, never caller input. */
export type NewExtractionEvidenceInput = Omit<ExtractionEvidence, "id" | "ownerUserId" | "createdAt">;

/**
 * `true` only when BOTH independent checks passed — this is the one
 * function any UI should call to decide whether to show "Verified" vs.
 * "Unverified reference." Never inline this logic elsewhere, and never
 * substitute the model's own `confidence` for either check.
 */
export function isEvidenceVerified(evidence: Pick<ExtractionEvidence, "pageVerified" | "snippetVerified">): boolean {
  return evidence.pageVerified === true && evidence.snippetVerified === true;
}

/**
 * The normalized, structured facts extracted from a policy — the
 * *result* of a future AI pipeline, not the pipeline itself (M3.0
 * builds no extraction). `data`'s shape depends on `category` and
 * `schemaVersion`; see `lib/wallet/schemas/` for the typed shape per
 * category (only `auto.v1` exists today, per the M3.0 brief).
 *
 * CRITICAL CONVENTION, used throughout every schema in
 * `lib/wallet/schemas/`: a boolean-ish fact that RONI doesn't have an
 * answer for must be `null`, never `false`. `false` means "the policy
 * document says this is not included." `null` means "RONI doesn't
 * know" — those are not the same claim, and conflating them would
 * mean RONI could tell someone they lack coverage they actually have
 * (M3.0 spec §3).
 */
export interface ExtractedPolicyData<TData = unknown> {
  id: string;
  policyId: string;
  documentId: string | null;
  ownerUserId: string;
  category: WalletCategory;
  schemaVersion: string;
  data: TData;
  extractionStatus: ExtractionStatus;
  /** e.g. `"manual"`, or later `"ai:claude-..."` — never fabricated, always says where a value came from. */
  extractedBy: string | null;
  overallConfidence: number | null;
  /**
   * A plain-language, factual summary derived only from this row's
   * `data` — AI analysis, not a policy fact (M3.2 principle 2 / M3.3
   * §2). Deliberately its own column, not a field inside `data` — see
   * `supabase/migrations/0005_policy_extraction_summary.sql` for why
   * that separation matters. `null` when no extraction has produced
   * one (e.g. a manual-entry row, or a provider that returned no
   * facts to summarize).
   */
  roniSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewExtractedPolicyDataInput<TData = unknown> = Omit<
  ExtractedPolicyData<TData>,
  "id" | "ownerUserId" | "createdAt" | "updatedAt" | "extractionStatus" | "roniSummary"
> &
  Partial<Pick<ExtractedPolicyData<TData>, "extractionStatus" | "roniSummary">>;

/**
 * A durable, database-backed record of one analysis attempt (migration
 * 0006) — created BEFORE the AI provider is ever called, so a
 * serverless function that dies mid-analysis (timeout, deploy, cold
 * start eviction) still leaves a real, inspectable row behind
 * (`status: "processing"`, `finishedAt: null`) instead of vanishing
 * with no trace. See `lib/services/policy-extraction/job-runner.ts`,
 * the one place that creates/advances these.
 */
export interface PolicyAnalysisJob {
  id: string;
  policyId: string;
  documentId: string;
  ownerUserId: string;
  status: AnalysisJobStatus;
  attemptNumber: number;
  extractedDataId: string | null;
  errorReason: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Row shapes as Supabase actually returns them (snake_case) — only `lib/wallet/repository.ts` should see these directly. */
export type PolicyRow = Database["public"]["Tables"]["policies"]["Row"];
export type PolicyDocumentRow = Database["public"]["Tables"]["policy_documents"]["Row"];
export type ExtractedDataRow = Database["public"]["Tables"]["policy_extracted_data"]["Row"];
export type ExtractionEvidenceRow = Database["public"]["Tables"]["policy_extracted_data_evidence"]["Row"];
export type PolicyAnalysisJobRow = Database["public"]["Tables"]["policy_analysis_jobs"]["Row"];
