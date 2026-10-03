import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";
import { WalletRepositoryError, createPolicy, createPolicyDocument } from "@/lib/wallet/repository";
import { validatePolicyDocumentFile } from "@/lib/wallet/upload-validation";
import { buildPolicyDocumentStoragePath } from "@/lib/wallet/storage-paths";

/**
 * RONI Bloque 1 (corrección) — issues a direct-to-Storage upload target.
 *
 * WHY THIS CHANGED: this route used to receive the file itself as the
 * body of this same POST request, running as a Vercel serverless
 * function — but Vercel's default request body limit for a serverless
 * function (~4.5 MB) is well under this app's own 15 MB PDF limit
 * (`MAX_POLICY_DOCUMENT_BYTES`), so a real ~5-14 MB policy PDF would be
 * rejected before it ever reached this code. The reviewer's note:
 * "El archivo permite PDFs de 15 MB, pero los envía por una función de
 * Vercel con límite de entrada de 4,5 MB."
 *
 * The fix: this route now receives only a small JSON description of the
 * file (name/type/size) — never the file's bytes — and hands back a
 * short-lived Supabase Storage signed upload URL for a SERVER-CHOSEN
 * path (`buildPolicyDocumentStoragePath`, reusing the exact convention
 * migration 0003's Storage RLS policies already trust). The browser then
 * uploads the actual bytes directly to Supabase Storage
 * (`UploadPolicyForm.tsx`, via `uploadToSignedUrl`) — those bytes never
 * pass through this or any other Vercel function, so the 15 MB limit
 * is only ever checked against Supabase Storage's own bucket limit
 * (`supabase/migrations/0008_storage_bucket_limits.sql`), not against
 * a request body limit that was never meant to hold a whole file.
 *
 * AUTHORIZATION: the signed upload URL is scoped to one exact,
 * server-chosen path under `{auth.uid()}/...` — never a path the client
 * supplies — so even though the browser talks to Storage directly, it
 * can only ever write to the one object this route just created for it.
 * `category` stays fixed to `"auto"`, same as before this fix (Bloque 1
 * scope, no new categories added here).
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: { code: "unauthenticated", message: "Please sign in." } }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: "invalid_request", message: "Invalid request." } }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const filename = payload.filename;
  const mimeType = payload.mimeType;
  const fileSize = payload.fileSize;
  if (typeof filename !== "string" || filename.trim().length === 0 || typeof mimeType !== "string" || typeof fileSize !== "number") {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_request", message: "Missing file name, type, or size." } },
      { status: 400 },
    );
  }

  // Same validation the old route ran AFTER receiving the file — now
  // run against the client's DECLARED metadata, before anything is
  // uploaded anywhere. This is a real gate (nothing can be analyzed
  // without a `policy_documents` row this route controls), but it is
  // not the last word on the actual bytes: the Storage bucket itself
  // also enforces a size/type limit (migration 0008) on the real
  // upload, and the job-runner re-reads the real file before ever
  // sending it to an AI provider.
  const validation = validatePolicyDocumentFile({ type: mimeType, size: fileSize, name: filename });
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: { code: "invalid_file", message: validation.reason } }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    // 1. Create the policy record this document belongs to — same "one
    // upload, one new policy" behavior as before this fix (M3.1 scope;
    // attaching to an existing policy is a reasonable follow-up but not
    // required here).
    const policy = await createPolicy(supabase, {
      householdId: null,
      category: "auto",
      carrier: null,
      policyNumber: null,
      effectiveDate: null,
      expirationDate: null,
      premiumAmount: null,
      premiumFrequency: null,
      termPremium: null,
      state: null,
    });

    // 2. Reserve the document id and its Storage path up front, exactly
    // as before — the id is generated here so the path convention
    // (migration 0003) and the `policy_documents.id` we create below
    // can share it.
    const documentId = randomUUID();
    const storagePath = buildPolicyDocumentStoragePath({
      userId: user.id,
      policyId: policy.id,
      documentId,
      filename,
    });

    // 3. Ask Storage for a short-lived, single-use upload target for
    // EXACTLY this path — the browser gets a token that only works for
    // this one object, never a general-purpose credential.
    const { data: signed, error: signError } = await supabase.storage
      .from("policy-documents")
      .createSignedUploadUrl(storagePath);
    if (signError || !signed) {
      return NextResponse.json(
        { ok: false, error: { code: "storage_error", message: "Could not prepare that upload. Please try again." } },
        { status: 502 },
      );
    }

    // 4. Record the document now, from the declared (not yet verified)
    // metadata. If the browser never completes the actual upload, this
    // row simply points at a Storage object that doesn't exist yet —
    // the job-runner's own Storage read fails safely in that case
    // (`extractionStatus: "failed"`, `error_reason: "storage-read-failed"`),
    // never a crash and never a fabricated result.
    const document = await createPolicyDocument(supabase, {
      id: documentId,
      policyId: policy.id,
      storageBucket: "policy-documents",
      storagePath,
      originalFilename: filename,
      mimeType,
      fileSizeBytes: fileSize,
      uploadedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      data: {
        policyId: policy.id,
        documentId: document.id,
        storagePath,
        uploadToken: signed.token,
      },
    });
  } catch (error) {
    const message = error instanceof WalletRepositoryError ? error.message : "Something went wrong while preparing that upload.";
    return NextResponse.json({ ok: false, error: { code: "upload_failed", message } }, { status: 500 });
  }
}
