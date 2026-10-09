import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { PolicyQAAnswer } from "@/lib/services/policy-qa/types";
import type { Database, Json } from "@/lib/supabase/database.types";
import { sanitizeAutoPolicyFacts } from "@/lib/wallet/validate-auto-policy-facts";
import { mergeAutoPolicyFacts } from "@/lib/wallet/merge-auto-policy-facts";
import type { AutoPolicyFacts } from "@/lib/wallet/schemas/auto-policy";
import type {
  AnalysisJobStatus,
  ExtractedDataRow,
  ExtractedPolicyData,
  ExtractionEvidence,
  ExtractionEvidenceRow,
  NewExtractedPolicyDataInput,
  NewExtractionEvidenceInput,
  NewPolicyDocumentInput,
  NewWalletPolicyInput,
  PolicyAnalysisJob,
  PolicyAnalysisJobRow,
  PolicyChatTurn,
  PolicyChatTurnRow,
  PolicyDocument,
  PolicyDocumentRow,
  PolicyRow,
  WalletPolicy,
  WalletPolicyPatch,
} from "@/lib/wallet/types";

/**
 * The Wallet's data/service layer (M3.0 spec §9). Every function here
 * takes a Supabase client explicitly rather than importing one at
 * module scope — a server client is request-scoped (it closes over
 * that request's cookies/session), so a shared singleton would leak
 * one user's session into another's request. Pass the client from
 * `lib/supabase/server.ts` in a Server Component/Route Handler, or a
 * test double in tests.
 *
 * No UI calls any of this yet — the current `/wallet` page still
 * shows its M1 placeholder. Wiring these into real screens is M3.1+.
 *
 * SECURITY NOTE: every function below both (a) relies on Row Level
 * Security to make cross-user access impossible at the database
 * level, and (b) adds its own explicit `owner_user_id` filter/value
 * as a second, redundant layer — RLS should never be the *only* thing
 * standing between one person's insurance documents and another's.
 */

export class WalletRepositoryError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "WalletRepositoryError";
  }
}

/**
 * The Supabase client type every function below accepts. Deliberately
 * NOT reconstructed as `SupabaseClient<Database>` from
 * `@supabase/supabase-js`'s own exported type — with `@supabase/ssr`
 * and `@supabase/supabase-js` as separate dependencies (and no
 * committed lockfile pinning them to a single resolved copy), npm can
 * install two separate copies of `@supabase/supabase-js` in the
 * dependency tree; `SupabaseClient` is a class with private fields, so
 * TypeScript treats two same-named classes from two different
 * installed copies as different types even when every public member
 * matches. Deriving `Client` directly from `createClient`'s own actual
 * return type sidesteps that entirely: this is mechanically the exact
 * type every caller already has after `await createClient()`, by
 * construction, not a second, independently-declared approximation of
 * it.
 */
type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * The service-role client type — see `lib/supabase/service-role.ts` for
 * why this exists at all and the one route allowed to use it. Every
 * function below that takes a `ServiceClient` instead of `Client` is
 * marked as such in its own doc comment and grouped at the bottom of
 * this file; none of them call `currentUserId` (there is no session to
 * read one from), so each one takes an explicit `ownerUserId` or
 * operates on rows this app's own RLS-scoped code already created.
 */
type ServiceClient = ReturnType<typeof createServiceRoleClient>;

async function currentUserId(supabase: Client): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new WalletRepositoryError("No authenticated user for this Wallet operation.", error);
  }
  return user.id;
}

function rowToWalletPolicy(row: PolicyRow): WalletPolicy {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    householdId: row.household_id,
    category: row.category,
    carrier: row.carrier,
    policyNumber: row.policy_number,
    status: row.status,
    effectiveDate: row.effective_date,
    expirationDate: row.expiration_date,
    premiumAmount: row.premium_amount,
    premiumFrequency: row.premium_frequency,
    termPremium: row.term_premium,
    state: row.state,
    monitoringEnabled: row.monitoring_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToPolicyDocument(row: PolicyDocumentRow): PolicyDocument {
  return {
    id: row.id,
    policyId: row.policy_id,
    ownerUserId: row.owner_user_id,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    uploadedAt: row.uploaded_at,
    createdAt: row.created_at,
  };
}

function rowToExtractionEvidence(row: ExtractionEvidenceRow): ExtractionEvidence {
  return {
    id: row.id,
    extractedDataId: row.extracted_data_id,
    ownerUserId: row.owner_user_id,
    fieldPath: row.field_path,
    valueText: row.value_text,
    confidence: row.confidence,
    documentId: row.document_id,
    pageNumber: row.page_number,
    snippet: row.snippet,
    // Set only by server code, after the model has responded — see
    // migration 0007 and `lib/services/policy-extraction/verify-evidence.ts`.
    // Never sourced from anything the model itself claimed.
    pageVerified: row.page_verified,
    snippetVerified: row.snippet_verified,
    createdAt: row.created_at,
  };
}

function rowToPolicyAnalysisJob(row: PolicyAnalysisJobRow): PolicyAnalysisJob {
  return {
    id: row.id,
    policyId: row.policy_id,
    documentId: row.document_id,
    ownerUserId: row.owner_user_id,
    status: row.status,
    attemptNumber: row.attempt_number,
    extractedDataId: row.extracted_data_id,
    errorReason: row.error_reason,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safePolicyQAAnswer(value: Json): PolicyQAAnswer {
  const fallback = "I couldn't determine that from the saved conversation.";
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { answerText: fallback, policyStatement: null, generalExplanation: null, notDetermined: fallback, citations: [], grounded: false };
  }
  const raw = value as Record<string, unknown>;
  const stringOrNull = (item: unknown): string | null => (typeof item === "string" && item.trim().length > 0 ? item : null);
  const citations = Array.isArray(raw.citations)
    ? raw.citations.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const citation = item as Record<string, unknown>;
        const label = stringOrNull(citation.label);
        const pageNumber = typeof citation.pageNumber === "number" && Number.isInteger(citation.pageNumber) && citation.pageNumber > 0 ? citation.pageNumber : null;
        if (!label) return [];
        return [{ label, pageNumber, snippet: stringOrNull(citation.snippet), verified: citation.verified === true }];
      })
    : [];
  const answerText = stringOrNull(raw.answerText) ?? fallback;
  return {
    answerText,
    policyStatement: stringOrNull(raw.policyStatement),
    generalExplanation: stringOrNull(raw.generalExplanation),
    notDetermined: stringOrNull(raw.notDetermined),
    citations,
    grounded: raw.grounded === true && citations.length > 0,
  };
}

function rowToPolicyChatTurn(row: PolicyChatTurnRow): PolicyChatTurn {
  return {
    id: row.id,
    policyId: row.policy_id,
    ownerUserId: row.owner_user_id,
    question: row.question,
    answer: safePolicyQAAnswer(row.answer),
    createdAt: row.created_at,
  };
}

/**
 * Maps a raw `policy_extracted_data` row to the application shape —
 * deliberately NOT generic over `TData`. `row.data` is a `Json` value
 * (whatever's actually sitting in the `jsonb` column); there is no
 * runtime information in this function that could tell TypeScript, or
 * verify, that it matches some caller-chosen `TData`. Previously this
 * asserted `row.data as unknown as TData` — a blind cast that would
 * happily "type" a stale `auto.v1` row, a hand-edited row, or a bug's
 * malformed JSON as if it were already a valid `AutoPolicyFacts`.
 *
 * Instead this returns `data: unknown` (a `Json` value is always
 * validly assignable to `unknown` — no cast operator needed at all),
 * and every caller that wants a concrete, trusted shape runs it
 * through a real runtime validator first: `sanitizeAutoPolicyFacts`
 * (`lib/wallet/validate-auto-policy-facts.ts`), the same function this
 * app already uses at every other read of Auto policy data. That's
 * what actually earns the concrete type — not an assertion.
 */
function rowToExtractedData(row: ExtractedDataRow): ExtractedPolicyData<unknown> {
  return {
    id: row.id,
    policyId: row.policy_id,
    documentId: row.document_id,
    ownerUserId: row.owner_user_id,
    category: row.category,
    schemaVersion: row.schema_version,
    data: row.data,
    extractionStatus: row.extraction_status,
    extractedBy: row.extracted_by,
    overallConfidence: row.overall_confidence,
    roniSummary: row.roni_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Normalizes an application-level value into a genuine `Json`-shaped
 * value before it's written to a `jsonb` column — via a REAL
 * stringify/parse round trip, not a type assertion. This is the same
 * transformation Postgres's own JSONB storage effectively applies
 * (functions, `undefined`, symbols, and anything else that isn't
 * actually representable as JSON don't survive it), so the value
 * hitting the database is genuinely JSON-shaped, not merely asserted
 * to be. `JSON.parse`'s return is `any` by TypeScript's own built-in
 * types — assigning it to this function's declared `Json` return type
 * needs no cast, `as`, or suppression of any kind; it's simply what a
 * from-scratch JSON round trip's result type is.
 */
function toJsonValue(value: unknown): Json {
  return JSON.parse(JSON.stringify(value));
}

/** All policies belonging to the signed-in user, most recently updated first. */
export async function getPolicies(supabase: Client): Promise<WalletPolicy[]> {
  const userId = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("policies")
    .select("*")
    .eq("owner_user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new WalletRepositoryError("Could not load policies.", error);
  return (data ?? []).map(rowToWalletPolicy);
}

/** One policy by id, or `null` if it doesn't exist or isn't owned by the signed-in user. */
export async function getPolicy(supabase: Client, policyId: string): Promise<WalletPolicy | null> {
  const userId = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("policies")
    .select("*")
    .eq("id", policyId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) throw new WalletRepositoryError("Could not load that policy.", error);
  return data ? rowToWalletPolicy(data) : null;
}

/** Creates a policy owned by the signed-in user. `input.ownerUserId` is never accepted — it's always the authenticated user. */
export async function createPolicy(supabase: Client, input: NewWalletPolicyInput): Promise<WalletPolicy> {
  const userId = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("policies")
    .insert({
      owner_user_id: userId,
      household_id: input.householdId,
      category: input.category,
      carrier: input.carrier,
      policy_number: input.policyNumber,
      status: input.status ?? "unknown",
      effective_date: input.effectiveDate,
      expiration_date: input.expirationDate,
      premium_amount: input.premiumAmount,
      premium_frequency: input.premiumFrequency,
      term_premium: input.termPremium,
      state: input.state,
      monitoring_enabled: input.monitoringEnabled ?? true,
    })
    .select("*")
    .single();
  if (error) throw new WalletRepositoryError("Could not create that policy.", error);
  return rowToWalletPolicy(data);
}

/** Updates a policy — scoped to the signed-in user both by RLS and by the explicit `.eq` below. */
export async function updatePolicy(supabase: Client, policyId: string, patch: WalletPolicyPatch): Promise<WalletPolicy> {
  const userId = await currentUserId(supabase);
  const update: Database["public"]["Tables"]["policies"]["Update"] = {};
  if ("householdId" in patch) update.household_id = patch.householdId;
  if ("category" in patch) update.category = patch.category;
  if ("carrier" in patch) update.carrier = patch.carrier;
  if ("policyNumber" in patch) update.policy_number = patch.policyNumber;
  if ("status" in patch) update.status = patch.status;
  if ("effectiveDate" in patch) update.effective_date = patch.effectiveDate;
  if ("expirationDate" in patch) update.expiration_date = patch.expirationDate;
  if ("premiumAmount" in patch) update.premium_amount = patch.premiumAmount;
  if ("premiumFrequency" in patch) update.premium_frequency = patch.premiumFrequency;
  if ("termPremium" in patch) update.term_premium = patch.termPremium;
  if ("state" in patch) update.state = patch.state;
  if ("monitoringEnabled" in patch) update.monitoring_enabled = patch.monitoringEnabled;

  const { data, error } = await supabase
    .from("policies")
    .update(update)
    .eq("id", policyId)
    .eq("owner_user_id", userId)
    .select("*")
    .single();
  if (error) throw new WalletRepositoryError("Could not update that policy.", error);
  return rowToWalletPolicy(data);
}

/**
 * Records a document that was already uploaded to the private
 * `policy-documents` Storage bucket (uploading the file itself is a
 * client-side Storage call against that bucket's own RLS policies —
 * not this function's job; see the M3.0 setup doc for the expected
 * path shape). This just creates the metadata row pointing at it.
 */
export async function createPolicyDocument(supabase: Client, input: NewPolicyDocumentInput): Promise<PolicyDocument> {
  const userId = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("policy_documents")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      policy_id: input.policyId,
      owner_user_id: userId,
      storage_bucket: input.storageBucket,
      storage_path: input.storagePath,
      original_filename: input.originalFilename,
      mime_type: input.mimeType,
      file_size_bytes: input.fileSizeBytes,
      uploaded_at: input.uploadedAt,
    })
    .select("*")
    .single();
  if (error) throw new WalletRepositoryError("Could not save that document's record.", error);
  return rowToPolicyDocument(data);
}

/** All documents uploaded for one policy, most recently uploaded first. Scoped to the signed-in user like everything else here. */
export async function getPolicyDocuments(supabase: Client, policyId: string): Promise<PolicyDocument[]> {
  const userId = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("policy_documents")
    .select("*")
    .eq("policy_id", policyId)
    .eq("owner_user_id", userId)
    .order("uploaded_at", { ascending: false });
  if (error) throw new WalletRepositoryError("Could not load that policy's documents.", error);
  return (data ?? []).map(rowToPolicyDocument);
}

/** One document by id, or `null` if it doesn't exist or isn't owned by the signed-in user. Used to resolve a Storage path before issuing a signed URL. */
export async function getPolicyDocument(supabase: Client, documentId: string): Promise<PolicyDocument | null> {
  const userId = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("policy_documents")
    .select("*")
    .eq("id", documentId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) throw new WalletRepositoryError("Could not load that document.", error);
  return data ? rowToPolicyDocument(data) : null;
}

/**
 * Downloads one document's actual bytes from private Storage,
 * server-side only (M3.3 §1/§11: "keep document access server-side,"
 * "do not expose private Storage URLs permanently"). This is what lets
 * extraction be re-run on an already-uploaded document — a retry, or a
 * future re-extraction with a newer schema/provider — WITHOUT asking
 * the person to upload the PDF again (M3.2 principle 5, "extraction
 * must be re-runnable"): the upload route already has the bytes in
 * memory from the multipart request itself, but anything running
 * later (a retry button, a future background job) only has the
 * `documentId`, and needs to go back to Storage for the bytes exactly
 * once, right before re-processing — never to persist them anywhere
 * else, and never to hand a URL to the browser (contrast with
 * `signed-url/route.ts`, which intentionally DOES return a short-lived
 * URL for the person to open the file themselves).
 *
 * Ownership is checked twice, same as every other read here: RLS on
 * `policy_documents` resolves the row (so a `documentId` belonging to
 * another user resolves to nothing), and the Storage download itself
 * is subject to the bucket's own RLS policies (migration 0003) keyed
 * off the same `{auth.uid()}/...` path prefix — a caller can't use
 * this function to reach a file it doesn't already have a legitimate
 * row for.
 */
export async function getPolicyDocumentBytes(supabase: Client, documentId: string): Promise<{ document: PolicyDocument; bytes: Buffer } | null> {
  const document = await getPolicyDocument(supabase, documentId);
  if (!document) return null;

  const { data, error } = await supabase.storage.from(document.storageBucket).download(document.storagePath);
  if (error || !data) throw new WalletRepositoryError("Could not read that document from storage.", error);

  const arrayBuffer = await data.arrayBuffer();
  return { document, bytes: Buffer.from(arrayBuffer) };
}

/**
 * Saves one version of a policy's extracted, structured facts.
 * Inserts a new row rather than overwriting a previous extraction —
 * `getLatestExtractedPolicyData` below reads the most recent one, but
 * earlier versions stay in place for a future audit trail. No AI
 * extraction runs here; the caller supplies `data` (e.g. from a
 * future extraction pipeline, or from manual entry).
 */
export async function saveExtractedPolicyData<TData = unknown>(
  supabase: Client,
  input: NewExtractedPolicyDataInput<TData>,
): Promise<ExtractedPolicyData<TData>> {
  const userId = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("policy_extracted_data")
    .insert({
      policy_id: input.policyId,
      document_id: input.documentId,
      owner_user_id: userId,
      category: input.category,
      schema_version: input.schemaVersion,
      data: toJsonValue(input.data),
      extraction_status: input.extractionStatus ?? "pending",
      extracted_by: input.extractedBy,
      overall_confidence: input.overallConfidence,
      roni_summary: input.roniSummary ?? null,
    })
    .select("*")
    .single();
  if (error) throw new WalletRepositoryError("Could not save extracted policy data.", error);
  // `input.data` is already a real, statically-known `TData` — the
  // exact value just asked to be stored. Using it directly for the
  // returned object's `data` field (rather than re-trusting whatever
  // JSON the round trip echoes back through `rowToExtractedData`,
  // which only ever promises `unknown`) needs no cast at all: it's
  // still exactly `TData`, at zero additional trust cost.
  return { ...rowToExtractedData(data), data: input.data };
}

/**
 * The most recently saved extraction for a policy, if any. Returns
 * `data: unknown` — deliberately not generic (see `rowToExtractedData`)
 * — because nothing here actually knows the row's real shape. Callers
 * that need a trusted, concrete shape validate it first; see
 * `getLatestAutoPolicyFacts` below. A caller that only needs metadata
 * (`extractionStatus`, `roniSummary`, etc.), like the Wallet list page,
 * never needs to touch `.data` at all.
 */
export async function getLatestExtractedPolicyData(
  supabase: Client,
  policyId: string,
): Promise<ExtractedPolicyData<unknown> | null> {
  const userId = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("policy_extracted_data")
    .select("*")
    .eq("policy_id", policyId)
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new WalletRepositoryError("Could not load extracted policy data.", error);
  return data ? rowToExtractedData(data) : null;
}

/**
 * The Auto-specific, ALWAYS-VALIDATED way to read a policy's latest
 * extraction (M3.2 brief, "VALIDATION" — applied at every read, not
 * just at save time). Every caller that displays or reasons about
 * Auto policy facts (the Policy Dashboard, the manual-entry form, Ask
 * Roni, Compare My Policy) should use this instead of calling
 * `getLatestExtractedPolicyData<AutoPolicyFacts>` directly: a raw
 * `<AutoPolicyFacts>` type parameter is a compile-time-only promise —
 * it doesn't re-check that a stored JSONB blob (which could be an
 * older `auto.v1` row, or, in principle, a row a since-changed
 * provider wrote in a slightly wrong shape) still matches the current
 * schema. This passes every row's `data` through
 * `sanitizeAutoPolicyFacts` before anything else ever sees it, so a
 * malformed or outdated row degrades to honest `null`s instead of a
 * runtime shape mismatch reaching the UI.
 *
 * Kept in `lib/wallet/repository.ts` (not `lib/wallet/schemas/`)
 * because it's a data-access function like its sibling
 * `getLatestExtractedPolicyData`, just narrowed to one category — the
 * natural place for a future `getLatestHomePolicyFacts`, etc. to sit
 * alongside it without touching this one.
 */
export async function getLatestAutoPolicyFacts(
  supabase: Client,
  policyId: string,
): Promise<ExtractedPolicyData<AutoPolicyFacts> | null> {
  const latest = await getLatestExtractedPolicyData(supabase, policyId);
  if (!latest) return null;
  return { ...latest, data: sanitizeAutoPolicyFacts(latest.data) };
}

/** The most recently saved row with `extractedBy: "manual"` for a policy, if the person has ever used "Add policy details" — always validated the same way as `getLatestAutoPolicyFacts`. */
export async function getLatestManualAutoPolicyFacts(
  supabase: Client,
  policyId: string,
): Promise<ExtractedPolicyData<AutoPolicyFacts> | null> {
  const userId = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("policy_extracted_data")
    .select("*")
    .eq("policy_id", policyId)
    .eq("owner_user_id", userId)
    .eq("extracted_by", "manual")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new WalletRepositoryError("Could not load manually-entered policy data.", error);
  if (!data) return null;
  const row = rowToExtractedData(data);
  return { ...row, data: sanitizeAutoPolicyFacts(row.data) };
}

/** Latest non-manual auto extraction. Kept separate so a newer manual save never hides prior extracted arrays or fields. */
export async function getLatestAutomaticAutoPolicyFacts(
  supabase: Client,
  policyId: string,
): Promise<ExtractedPolicyData<AutoPolicyFacts> | null> {
  const userId = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("policy_extracted_data")
    .select("*")
    .eq("policy_id", policyId)
    .eq("owner_user_id", userId)
    .neq("extracted_by", "manual")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new WalletRepositoryError("Could not load automatically extracted policy data.", error);
  if (!data) return null;
  const row = rowToExtractedData(data);
  return { ...row, data: sanitizeAutoPolicyFacts(row.data) };
}

/**
 * What the Policy Dashboard, Ask Roni, and Compare My Policy should
 * ALWAYS read instead of `getLatestAutoPolicyFacts` directly (M3.3 §7:
 * "If there is a conflict between a manual verified value and a new
 * AI extraction, the manual verified value must win"): the latest
 * extraction's metadata (status, confidence, RONI Summary, evidence)
 * describes the current extraction pass as-is, but its `data` is
 * field-by-field merged with the person's latest manual corrections,
 * if any, via `mergeAutoPolicyFacts` — so a manually-verified VIN or
 * deductible survives a later "retry extraction" instead of being
 * silently overwritten by whatever the next automatic pass found (or
 * didn't find) for that same field.
 *
 * Nothing is written back to the database here — this is a read-time
 * merge over two existing, independently-saved rows, matching the
 * brief's "do not destroy previously verified/manual user data when
 * re-extracting."
 */
export async function getEffectiveAutoPolicyFacts(
  supabase: Client,
  policyId: string,
): Promise<ExtractedPolicyData<AutoPolicyFacts> | null> {
  const [latest, manual, automatic] = await Promise.all([
    getLatestAutoPolicyFacts(supabase, policyId),
    getLatestManualAutoPolicyFacts(supabase, policyId),
    getLatestAutomaticAutoPolicyFacts(supabase, policyId),
  ]);
  if (!manual) return latest;
  if (!automatic) return manual;
  // Keep the automatic row's metadata and evidence attached to the merged
  // view. A newer manual row has no document evidence of its own; returning it
  // here would make valid citations for untouched extracted facts disappear.
  // Manual values still win field-by-field in the data payload.
  return { ...automatic, data: mergeAutoPolicyFacts(automatic.data, manual.data) };
}

/**
 * Records the evidence citations for one extraction (M3.2/M3.3 —
 * `policy_extracted_data_evidence`, see migration 0002). Takes a
 * batch rather than one-at-a-time: an extraction run produces its
 * evidence list all at once, and inserting it as one statement avoids
 * partial-evidence states if the request is interrupted partway
 * through. Passing an empty array is a no-op — the dev/demo
 * extraction fallback (M3.2) has no real evidence to cite and calls
 * this with `[]` rather than skipping the call, so the code path is
 * exercised the same way a real provider's would be.
 *
 * `item.pageVerified`/`item.snippetVerified` are accepted here exactly
 * as the caller computed them — this function never derives, defaults,
 * or infers either value itself. The one legitimate caller is the job
 * runner, AFTER it has run `verify-evidence.ts` against this app's own
 * independent page count/OCR text; nothing here re-derives that from
 * `item.confidence` or anything else the model supplied. A caller that
 * hasn't verified yet must pass `null` for both, never `true`.
 */
export async function saveExtractionEvidence(
  supabase: Client,
  items: NewExtractionEvidenceInput[],
): Promise<ExtractionEvidence[]> {
  if (items.length === 0) return [];
  const userId = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("policy_extracted_data_evidence")
    .insert(
      items.map((item) => ({
        extracted_data_id: item.extractedDataId,
        owner_user_id: userId,
        field_path: item.fieldPath,
        value_text: item.valueText,
        confidence: item.confidence,
        document_id: item.documentId,
        page_number: item.pageNumber,
        snippet: item.snippet,
        page_verified: item.pageVerified,
        snippet_verified: item.snippetVerified,
      })),
    )
    .select("*");
  if (error) throw new WalletRepositoryError("Could not save extraction evidence.", error);
  return (data ?? []).map(rowToExtractionEvidence);
}

/** All evidence citations for one extraction (M3.3 reads this to ground Ask Roni's citations and the Policy Dashboard's "Source: ..." links). */
export async function getExtractionEvidence(
  supabase: Client,
  extractedDataId: string,
): Promise<ExtractionEvidence[]> {
  const userId = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("policy_extracted_data_evidence")
    .select("*")
    .eq("extracted_data_id", extractedDataId)
    .eq("owner_user_id", userId);
  if (error) throw new WalletRepositoryError("Could not load extraction evidence.", error);
  return (data ?? []).map(rowToExtractionEvidence);
}

/** Persistent Ask Roni history, scoped by RLS and owner id to one policy owner. */
export async function getPolicyChatTurns(supabase: Client, policyId: string): Promise<PolicyChatTurn[]> {
  const userId = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("policy_chat_turns")
    .select("*")
    .eq("policy_id", policyId)
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new WalletRepositoryError("Could not load Ask Roni history.", error);
  return (data ?? []).map(rowToPolicyChatTurn);
}

/** Saves only the shaped answer shown to the owner; no PDF bytes, URLs, or provider response is retained. */
export async function savePolicyChatTurn(
  supabase: Client,
  input: { policyId: string; question: string; answer: PolicyQAAnswer },
): Promise<PolicyChatTurn> {
  const userId = await currentUserId(supabase);
  const question = input.question.trim();
  if (question.length === 0 || question.length > 1_000) throw new WalletRepositoryError("Could not save that Ask Roni question.");

  const { data, error } = await supabase
    .from("policy_chat_turns")
    .insert({
      policy_id: input.policyId,
      owner_user_id: userId,
      question,
      answer: toJsonValue(input.answer),
    })
    .select("*")
    .single();
  if (error) throw new WalletRepositoryError("Could not save Ask Roni history.", error);
  return rowToPolicyChatTurn(data);
}

// ---------------------------------------------------------------------------
// Durable analysis jobs (migration 0006). These are the ONLY functions that
// should ever touch `policy_analysis_jobs` — `job-runner.ts` is the only
// intended caller, so every state transition an analysis attempt goes
// through has exactly one, auditable code path.
// ---------------------------------------------------------------------------

/** Postgres's SQLSTATE for a unique-constraint violation — this is how a second concurrent job attempt shows up when it hits `policy_analysis_jobs_one_active_per_document` (migration 0006). */
const POSTGRES_UNIQUE_VIOLATION = "23505";

export type CreateAnalysisJobResult =
  | { outcome: "created"; job: PolicyAnalysisJob }
  | { outcome: "already_in_progress"; job: PolicyAnalysisJob };

/**
 * Creates a new analysis job row with `status: "queued"`, BEFORE
 * anything analyzes anything — this is what makes the job durable and
 * genuinely independent of any one HTTP request: the row exists (and is
 * visible to the Wallet UI via `getActiveAnalysisJob`/`getLatestAnalysisJob`)
 * the moment this returns, whether or not the Vercel Cron worker that
 * will actually process it (`app/api/cron/process-analysis-jobs/route.ts`,
 * `claimQueuedAnalysisJobs` below) has run yet. `started_at` is left
 * `null` until that worker actually claims it — a `queued` job that's
 * never been started is a different, honest state from one that's
 * `processing` and stuck.
 *
 * Duplicate prevention is NOT a check-then-insert here (that races): this
 * always attempts the insert, and relies on
 * `policy_analysis_jobs_one_active_per_document` (a Postgres partial unique
 * index) to reject a second concurrent attempt for the same document with a
 * real unique-violation error, which is then turned into
 * `{ outcome: "already_in_progress" }` rather than a thrown error — a
 * caller (the analyze route, or the retry action) should treat that as "an
 * analysis is already running for this document," not as a failure.
 */
export async function createAnalysisJob(
  supabase: Client,
  input: { policyId: string; documentId: string },
): Promise<CreateAnalysisJobResult> {
  const userId = await currentUserId(supabase);

  const { count, error: countError } = await supabase
    .from("policy_analysis_jobs")
    .select("id", { count: "exact", head: true })
    .eq("document_id", input.documentId)
    .eq("owner_user_id", userId);
  if (countError) throw new WalletRepositoryError("Could not check this document's previous analysis attempts.", countError);
  const attemptNumber = (count ?? 0) + 1;

  const { data, error } = await supabase
    .from("policy_analysis_jobs")
    .insert({
      policy_id: input.policyId,
      document_id: input.documentId,
      owner_user_id: userId,
      status: "queued",
      attempt_number: attemptNumber,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      const active = await getActiveAnalysisJob(supabase, input.documentId);
      if (active) return { outcome: "already_in_progress", job: active };
      // Extremely unlikely race: the conflicting job finished between the
      // insert failing and this re-read. Surfacing this as a real error
      // (rather than silently retrying) keeps retry policy entirely in the
      // caller's hands, matching "reintentos limitados" — retries are a
      // job-runner concern, not something the repository layer decides on
      // its own.
      throw new WalletRepositoryError(
        "Could not start analysis — a conflicting job was detected but could not be read back.",
        error,
      );
    }
    throw new WalletRepositoryError("Could not create an analysis job.", error);
  }
  return { outcome: "created", job: rowToPolicyAnalysisJob(data) };
}

/** The current `queued`/`processing` job for a document, if any — what `createAnalysisJob` falls back to reading, and what a status endpoint can poll. */
export async function getActiveAnalysisJob(supabase: Client, documentId: string): Promise<PolicyAnalysisJob | null> {
  const userId = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("policy_analysis_jobs")
    .select("*")
    .eq("document_id", documentId)
    .eq("owner_user_id", userId)
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new WalletRepositoryError("Could not check for an in-progress analysis job.", error);
  return data ? rowToPolicyAnalysisJob(data) : null;
}

/** The most recent job for a document regardless of status — used to recover/report on an interrupted attempt (`status: "processing"` with a stale `started_at`) and to show the person the outcome of their last analysis attempt. */
export async function getLatestAnalysisJob(supabase: Client, documentId: string): Promise<PolicyAnalysisJob | null> {
  const userId = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("policy_analysis_jobs")
    .select("*")
    .eq("document_id", documentId)
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new WalletRepositoryError("Could not load the latest analysis job.", error);
  return data ? rowToPolicyAnalysisJob(data) : null;
}

/**
 * Advances a job to its next state — the ONLY way `status`,
 * `extractedDataId`, `errorReason`, or `finishedAt` ever change after
 * creation. The job-runner calls this exactly once more after
 * `createAnalysisJob`, with the final outcome, whatever it was (`complete`,
 * `failed`, or `needs_review`) — never left at `processing` once the
 * attempt is actually done, since a stuck `processing` row is what a
 * "recover interrupted jobs" pass looks for.
 */
export async function updateAnalysisJob(
  supabase: Client,
  jobId: string,
  patch: {
    status?: AnalysisJobStatus;
    extractedDataId?: string | null;
    errorReason?: string | null;
    finishedAt?: string | null;
  },
): Promise<PolicyAnalysisJob> {
  const userId = await currentUserId(supabase);
  const update: Database["public"]["Tables"]["policy_analysis_jobs"]["Update"] = {};
  if ("status" in patch) update.status = patch.status;
  if ("extractedDataId" in patch) update.extracted_data_id = patch.extractedDataId;
  if ("errorReason" in patch) update.error_reason = patch.errorReason;
  if ("finishedAt" in patch) update.finished_at = patch.finishedAt;

  const { data, error } = await supabase
    .from("policy_analysis_jobs")
    .update(update)
    .eq("id", jobId)
    .eq("owner_user_id", userId)
    .select("*")
    .single();
  if (error) throw new WalletRepositoryError("Could not update that analysis job.", error);
  return rowToPolicyAnalysisJob(data);
}

// ---------------------------------------------------------------------------
// SERVICE-ROLE FUNCTIONS (RONI Bloque 1 — corrección, fix #2)
//
// Used ONLY by `app/api/cron/process-analysis-jobs/route.ts`, the
// Vercel Cron worker that actually runs a queued analysis job
// independently of the HTTP request that enqueued it — see
// `lib/supabase/service-role.ts` for why a service-role client is
// necessary here and nowhere else. Every function below either takes
// an explicit `ownerUserId` (there is no session to derive one from)
// or operates only on rows this app's own RLS-scoped code already
// created — none of them accept or trust a caller-asserted ownership
// claim.
// ---------------------------------------------------------------------------

/**
 * Atomically claims up to `limit` queued jobs, oldest first. "Atomic"
 * here means each claim is its own `UPDATE ... WHERE id = ? AND status
 * = 'queued'` — if two cron invocations somehow overlap (Vercel
 * doesn't guarantee a cron trigger can't overlap a slow previous run),
 * whichever one's UPDATE runs second matches zero rows for a job the
 * first already claimed, and simply doesn't get it back. This is the
 * same spirit as the partial unique index that prevents two ENQUEUED
 * jobs for one document — this is what prevents two WORKERS from ever
 * processing the same queued job.
 */
export async function claimQueuedAnalysisJobs(supabase: ServiceClient, limit: number): Promise<PolicyAnalysisJob[]> {
  const { data: candidates, error } = await supabase
    .from("policy_analysis_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new WalletRepositoryError("Could not list queued analysis jobs.", error);

  const claimed: PolicyAnalysisJob[] = [];
  for (const row of candidates ?? []) {
    const { data, error: claimError } = await supabase
      .from("policy_analysis_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "queued")
      .select("*")
      .maybeSingle();
    if (claimError || !data) continue; // Lost the race to another worker, or a transient error — not fatal, just skip it this run.
    claimed.push(rowToPolicyAnalysisJob(data));
  }
  return claimed;
}

/**
 * The automatic-recovery half of fix #2: finds every `processing` job
 * across every user whose `started_at` is older than `staleBeforeIso`
 * and marks it `failed` (`error_reason: "timed_out"`) — the worker
 * that claimed it almost certainly died without ever reaching its own
 * final `updateAnalysisJobService` call. Called at the start of every
 * cron invocation (`app/api/cron/process-analysis-jobs/route.ts`), so
 * recovery runs automatically, on a schedule, regardless of whether
 * anyone ever opens the Wallet again for that policy — this is the
 * actual difference from this app's previous, request-triggered
 * recovery (which only ran when a person happened to click "Retry").
 */
export async function recoverStaleProcessingJobs(supabase: ServiceClient, staleBeforeIso: string): Promise<number> {
  const { data, error } = await supabase
    .from("policy_analysis_jobs")
    .update({ status: "failed", error_reason: "timed_out", finished_at: new Date().toISOString() })
    .eq("status", "processing")
    .lt("started_at", staleBeforeIso)
    .select("id");
  if (error) throw new WalletRepositoryError("Could not recover stale analysis jobs.", error);
  return data?.length ?? 0;
}

/**
 * Service-role read of one policy by id, with NO owner filter. Exists
 * for exactly one caller: `assertJobOwnership`
 * (`lib/services/policy-extraction/job-runner.ts`), which uses it to
 * independently confirm — AGAIN, in application code, even though
 * migration 0009 already enforces this at the database level — that
 * the policy a claimed job names is actually owned by that job's own
 * `owner_user_id`, before the worker does anything with it.
 */
export async function getPolicyService(supabase: ServiceClient, policyId: string): Promise<WalletPolicy | null> {
  const { data, error } = await supabase.from("policies").select("*").eq("id", policyId).maybeSingle();
  if (error) throw new WalletRepositoryError("Could not load that policy.", error);
  return data ? rowToWalletPolicy(data) : null;
}

/** Service-role read of one document by id, with NO owner filter — safe only because the cron worker only ever looks up a `documentId` it already read off a job row this app's own RLS-scoped code created (`createAnalysisJob`), and re-validates against that job's own fields via `assertJobOwnership` before using it for anything. */
export async function getPolicyDocumentService(supabase: ServiceClient, documentId: string): Promise<PolicyDocument | null> {
  const { data, error } = await supabase.from("policy_documents").select("*").eq("id", documentId).maybeSingle();
  if (error) throw new WalletRepositoryError("Could not load that document.", error);
  return data ? rowToPolicyDocument(data) : null;
}

/**
 * Service-role download of one ALREADY-RESOLVED document's bytes. Takes
 * the `PolicyDocument` itself, not a bare id — the one caller
 * (`processQueuedJob`) must resolve and ownership-check the document
 * via `assertJobOwnership` first, so there is no code path here that
 * can download bytes for a document this app hasn't already confirmed
 * belongs to the job asking for them.
 */
export async function downloadPolicyDocumentBytesService(supabase: ServiceClient, document: PolicyDocument): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(document.storageBucket).download(document.storagePath);
  if (error || !data) throw new WalletRepositoryError("Could not read that document from storage.", error);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Service-role equivalent of `saveExtractedPolicyData` — takes `ownerUserId` explicitly instead of reading it from a session (there is none). */
export async function saveExtractedPolicyDataService<TData = unknown>(
  supabase: ServiceClient,
  ownerUserId: string,
  input: NewExtractedPolicyDataInput<TData>,
): Promise<ExtractedPolicyData<TData>> {
  const { data, error } = await supabase
    .from("policy_extracted_data")
    .insert({
      policy_id: input.policyId,
      document_id: input.documentId,
      owner_user_id: ownerUserId,
      category: input.category,
      schema_version: input.schemaVersion,
      data: toJsonValue(input.data),
      extraction_status: input.extractionStatus ?? "pending",
      extracted_by: input.extractedBy,
      overall_confidence: input.overallConfidence,
      roni_summary: input.roniSummary ?? null,
    })
    .select("*")
    .single();
  if (error) throw new WalletRepositoryError("Could not save extracted policy data.", error);
  return { ...rowToExtractedData(data), data: input.data };
}

/** Service-role equivalent of `saveExtractionEvidence` — takes `ownerUserId` explicitly, same verified-fields contract as the RLS-scoped version. */
export async function saveExtractionEvidenceService(
  supabase: ServiceClient,
  ownerUserId: string,
  items: NewExtractionEvidenceInput[],
): Promise<ExtractionEvidence[]> {
  if (items.length === 0) return [];
  const { data, error } = await supabase
    .from("policy_extracted_data_evidence")
    .insert(
      items.map((item) => ({
        extracted_data_id: item.extractedDataId,
        owner_user_id: ownerUserId,
        field_path: item.fieldPath,
        value_text: item.valueText,
        confidence: item.confidence,
        document_id: item.documentId,
        page_number: item.pageNumber,
        snippet: item.snippet,
        page_verified: item.pageVerified,
        snippet_verified: item.snippetVerified,
      })),
    )
    .select("*");
  if (error) throw new WalletRepositoryError("Could not save extraction evidence.", error);
  return (data ?? []).map(rowToExtractionEvidence);
}

/** Service-role equivalent of `updateAnalysisJob` — no owner filter (see `getPolicyDocumentService`'s note; the same reasoning applies here). */
export async function updateAnalysisJobService(
  supabase: ServiceClient,
  jobId: string,
  patch: {
    status?: AnalysisJobStatus;
    extractedDataId?: string | null;
    errorReason?: string | null;
    finishedAt?: string | null;
  },
): Promise<PolicyAnalysisJob> {
  const update: Database["public"]["Tables"]["policy_analysis_jobs"]["Update"] = {};
  if ("status" in patch) update.status = patch.status;
  if ("extractedDataId" in patch) update.extracted_data_id = patch.extractedDataId;
  if ("errorReason" in patch) update.error_reason = patch.errorReason;
  if ("finishedAt" in patch) update.finished_at = patch.finishedAt;

  const { data, error } = await supabase.from("policy_analysis_jobs").update(update).eq("id", jobId).select("*").single();
  if (error) throw new WalletRepositoryError("Could not update that analysis job.", error);
  return rowToPolicyAnalysisJob(data);
}
