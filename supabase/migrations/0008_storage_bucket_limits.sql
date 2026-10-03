-- RONI Bloque 1 (corrección) — migration 8: enforce upload limits in Storage itself
--
-- WHY THIS EXISTS: fix #1 moves the actual file bytes out of the Vercel
-- function entirely (browser -> Supabase Storage directly, via a signed
-- upload URL from `POST /api/wallet/policies`). That means the app's own
-- `validatePolicyDocumentFile` (`lib/wallet/upload-validation.ts`) —
-- which only ever ran against what the CLIENT declared before this fix,
-- and now runs against declared metadata even earlier, before any bytes
-- exist anywhere — is no longer the only thing standing between a
-- request and the bucket. This migration makes Supabase Storage itself
-- reject an oversized or wrong-type object on the actual upload,
-- regardless of what any client claims about it beforehand.
--
-- Safe to run more than once.

update storage.buckets
set
  file_size_limit = 15 * 1024 * 1024, -- matches MAX_POLICY_DOCUMENT_BYTES (lib/wallet/upload-validation.ts) — keep these two in sync if either changes.
  allowed_mime_types = array['application/pdf']
where id = 'policy-documents';
