-- RONI M3.0 — migration 3 of 3: private Storage bucket for policy documents
--
-- Safe to run more than once. Requires migrations 0001/0002 only in
-- the sense that they're part of the same milestone — this file
-- doesn't reference any table from them.
--
-- PATH CONVENTION every uploader must follow:
--
--   {auth.uid()}/{policy_id}/{document_id}/{filename}
--
-- e.g. 3fa1.../7c2b.../9e01.../auto-policy.pdf
--
-- The RLS policies below trust ONLY the first path segment (the
-- uploader's own user id) — everything after it is free-form, but the
-- app should always follow this shape so a document's storage path
-- lines up with its `policy_documents` row for humans debugging later.
-- The client SDK is responsible for sanitizing `filename` (no `/`, no
-- `..`) before upload; this migration doesn't validate that, only
-- which *user* a path belongs to.

insert into storage.buckets (id, name, public)
values ('policy-documents', 'policy-documents', false)
on conflict (id) do nothing;

-- Belt and suspenders: if the bucket already existed (e.g. created by
-- hand in the Dashboard before this migration ran), make sure it's
-- still private.
update storage.buckets set public = false where id = 'policy-documents';

drop policy if exists "policy_documents_storage_select_own" on storage.objects;
create policy "policy_documents_storage_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'policy-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "policy_documents_storage_insert_own" on storage.objects;
create policy "policy_documents_storage_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'policy-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "policy_documents_storage_update_own" on storage.objects;
create policy "policy_documents_storage_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'policy-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'policy-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "policy_documents_storage_delete_own" on storage.objects;
create policy "policy_documents_storage_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'policy-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No policy grants access to the `anon` role or to any other user's
-- folder under any circumstance — this bucket has no public read path
-- of any kind (M3.0 spec §6).
