import type {
  Database,
  ExtractionStatus,
  PremiumFrequency,
  WalletCategory,
  WalletPolicyStatus,
} from "@/lib/supabase/database.types";

export type { WalletCategory, WalletPolicyStatus, PremiumFrequency, ExtractionStatus };

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

export type NewPolicyDocumentInput = Omit<PolicyDocument, "id" | "ownerUserId" | "createdAt">;

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
  /** 0–1, when the (future) extraction process reports one. */
  confidence: number | null;
  documentId: string | null;
  pageNumber: number | null;
  /** A short quoted or paraphrased excerpt — not the whole page. */
  snippet: string | null;
  createdAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export type NewExtractedPolicyDataInput<TData = unknown> = Omit<
  ExtractedPolicyData<TData>,
  "id" | "ownerUserId" | "createdAt" | "updatedAt" | "extractionStatus"
> &
  Partial<Pick<ExtractedPolicyData<TData>, "extractionStatus">>;

/** Row shapes as Supabase actually returns them (snake_case) — only `lib/wallet/repository.ts` should see these directly. */
export type PolicyRow = Database["public"]["Tables"]["policies"]["Row"];
export type PolicyDocumentRow = Database["public"]["Tables"]["policy_documents"]["Row"];
export type ExtractedDataRow = Database["public"]["Tables"]["policy_extracted_data"]["Row"];
export type ExtractionEvidenceRow = Database["public"]["Tables"]["policy_extracted_data_evidence"]["Row"];
