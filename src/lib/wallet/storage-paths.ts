/**
 * Builds the private Storage path for one policy document, following
 * the convention documented in `supabase/migrations/0003_storage.sql`:
 *
 *   {auth.uid()}/{policy_id}/{document_id}/{filename}
 *
 * The Storage RLS policies there trust ONLY the first segment (the
 * uploader's own id) — this helper's job is to make sure the app
 * always produces that shape anyway, so a path stays self-describing
 * for anyone debugging later, and so `sanitizeFilename` is the one
 * place that ever has to think about `/`, `..`, or other path
 * metacharacters in a person-supplied filename.
 */

/** Strips anything that isn't a safe filename character, so a crafted filename (e.g. containing `../`) can never change which "folder" a file lands in. */
export function sanitizeFilename(originalFilename: string): string {
  const base = originalFilename.split(/[\\/]/).pop() ?? "document";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return cleaned.length > 0 ? cleaned.slice(-140) : "document.pdf";
}

export interface PolicyDocumentPathInput {
  userId: string;
  policyId: string;
  documentId: string;
  filename: string;
}

export function buildPolicyDocumentStoragePath({ userId, policyId, documentId, filename }: PolicyDocumentPathInput): string {
  return `${userId}/${policyId}/${documentId}/${sanitizeFilename(filename)}`;
}
