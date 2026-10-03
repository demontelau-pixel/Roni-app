/**
 * Shared between the upload route (`app/api/wallet/policies/route.ts`)
 * and the `/wallet/upload` client form, so both enforce the exact
 * same rule and never drift (M3.1 spec: "Validate file type and
 * reasonable max size"). Client-side validation is a UX nicety only —
 * the server route re-checks everything itself and is the real gate.
 */

export const ALLOWED_POLICY_DOCUMENT_MIME_TYPES = ["application/pdf"] as const;

/** 15 MB — comfortably above a typical multi-page declarations page + full policy PDF, well under Vercel's request body limits for this MVP. */
export const MAX_POLICY_DOCUMENT_BYTES = 15 * 1024 * 1024;

export interface FileValidationResult {
  ok: boolean;
  reason?: string;
}

/** Validates a file's declared type and size only — never trusts a filename extension alone, since `file.type` is what the browser/OS actually sniffed. */
export function validatePolicyDocumentFile(file: { type: string; size: number; name: string }): FileValidationResult {
  if (!ALLOWED_POLICY_DOCUMENT_MIME_TYPES.includes(file.type as "application/pdf")) {
    return { ok: false, reason: "Please upload a PDF file." };
  }
  if (file.size <= 0) {
    return { ok: false, reason: "That file appears to be empty." };
  }
  if (file.size > MAX_POLICY_DOCUMENT_BYTES) {
    const maxMb = Math.round(MAX_POLICY_DOCUMENT_BYTES / (1024 * 1024));
    return { ok: false, reason: `That file is too large — please upload a PDF under ${maxMb} MB.` };
  }
  return { ok: true };
}
