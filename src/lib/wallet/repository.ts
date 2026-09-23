import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  ExtractedDataRow,
  ExtractedPolicyData,
  NewExtractedPolicyDataInput,
  NewPolicyDocumentInput,
  NewWalletPolicyInput,
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

type Client = SupabaseClient<Database>;

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

function rowToExtractedData<TData>(row: ExtractedDataRow): ExtractedPolicyData<TData> {
  return {
    id: row.id,
    policyId: row.policy_id,
    documentId: row.document_id,
    ownerUserId: row.owner_user_id,
    category: row.category,
    schemaVersion: row.schema_version,
    data: row.data as unknown as TData,
    extractionStatus: row.extraction_status,
    extractedBy: row.extracted_by,
    overallConfidence: row.overall_confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
      data: input.data as unknown as Database["public"]["Tables"]["policy_extracted_data"]["Insert"]["data"],
      extraction_status: input.extractionStatus ?? "pending",
      extracted_by: input.extractedBy,
      overall_confidence: input.overallConfidence,
    })
    .select("*")
    .single();
  if (error) throw new WalletRepositoryError("Could not save extracted policy data.", error);
  return rowToExtractedData<TData>(data);
}

/** The most recently saved extraction for a policy, if any. */
export async function getLatestExtractedPolicyData<TData = unknown>(
  supabase: Client,
  policyId: string,
): Promise<ExtractedPolicyData<TData> | null> {
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
  return data ? rowToExtractedData<TData>(data) : null;
}
