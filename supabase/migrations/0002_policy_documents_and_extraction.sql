-- RONI M3.0 — migration 2 of 3: policy documents & extracted data
--
-- Requires migration 0001 (references public.policies). Safe to run
-- more than once, same conventions as 0001.

-- ---------------------------------------------------------------
-- policy_documents — metadata for a file already uploaded to the
-- private `policy-documents` Storage bucket (see migration 0003).
-- This table does not hold file bytes, only a pointer to them.
-- ---------------------------------------------------------------
create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies (id) on delete cascade,
  -- Denormalized on purpose (also derivable via policy_id -> policies.owner_user_id):
  -- keeps RLS below a simple, fast equality check instead of a join/subquery
  -- on every row, on every table in this file. The service layer
  -- (`src/lib/wallet/repository.ts`) is responsible for keeping this in
  -- sync with the parent policy's owner at insert time.
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  storage_bucket text not null default 'policy-documents',
  storage_path text not null unique,
  original_filename text,
  mime_type text,
  file_size_bytes bigint,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists policy_documents_policy_id_idx on public.policy_documents (policy_id);
create index if not exists policy_documents_owner_user_id_idx on public.policy_documents (owner_user_id);

alter table public.policy_documents enable row level security;

drop policy if exists "policy_documents_select_owner" on public.policy_documents;
create policy "policy_documents_select_owner"
  on public.policy_documents for select
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "policy_documents_insert_owner" on public.policy_documents;
create policy "policy_documents_insert_owner"
  on public.policy_documents for insert
  to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "policy_documents_update_owner" on public.policy_documents;
create policy "policy_documents_update_owner"
  on public.policy_documents for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "policy_documents_delete_owner" on public.policy_documents;
create policy "policy_documents_delete_owner"
  on public.policy_documents for delete
  to authenticated
  using (owner_user_id = auth.uid());

-- ---------------------------------------------------------------
-- policy_extracted_data — normalized, structured facts about a
-- policy, as JSONB rather than hundreds of nullable columns (M3.0
-- spec §3). One policy can have several rows over time (e.g. a
-- re-extraction after a better document is uploaded); the service
-- layer reads the most recent by `created_at` as "current" — there is
-- no `is_current` flag, on purpose, to keep this table simple for the
-- MVP. `data`'s shape is versioned by (`category`, `schema_version`);
-- see `src/lib/wallet/schemas/` for the TypeScript shape per version
-- (only `auto.v1` exists today).
--
-- CONVENTION enforced at the application layer, not by a DB
-- constraint (JSONB can't easily express this): inside `data`, a
-- boolean-ish fact RONI doesn't have an answer for must be JSON
-- `null`, never `false`. `false` means the policy document says a
-- coverage is NOT included; `null` means RONI doesn't know. See the
-- file-level comment in `src/lib/wallet/schemas/auto-policy.ts`.
-- ---------------------------------------------------------------
create table if not exists public.policy_extracted_data (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies (id) on delete cascade,
  document_id uuid references public.policy_documents (id) on delete set null,
  owner_user_id uuid not null references auth.users (id) on delete cascade, -- denormalized, see note above
  category text not null check (
    category in ('auto', 'health', 'home', 'renters', 'life', 'pet', 'motorcycle', 'travel', 'other')
  ),
  schema_version text not null,
  data jsonb not null default '{}'::jsonb,
  extraction_status text not null default 'pending' check (
    extraction_status in ('pending', 'processing', 'complete', 'failed', 'needs_review')
  ),
  -- e.g. 'manual', or later 'ai:claude-...' — provenance of the
  -- extraction itself, distinct from per-field evidence below.
  extracted_by text,
  overall_confidence numeric(3, 2) check (overall_confidence is null or (overall_confidence >= 0 and overall_confidence <= 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists policy_extracted_data_policy_id_idx on public.policy_extracted_data (policy_id);
create index if not exists policy_extracted_data_owner_user_id_idx on public.policy_extracted_data (owner_user_id);
create index if not exists policy_extracted_data_document_id_idx on public.policy_extracted_data (document_id);
-- Speeds up "give me the most recent extraction for this policy",
-- the one query pattern this table is actually read by today.
create index if not exists policy_extracted_data_policy_created_idx
  on public.policy_extracted_data (policy_id, created_at desc);

drop trigger if exists set_policy_extracted_data_updated_at on public.policy_extracted_data;
create trigger set_policy_extracted_data_updated_at
  before update on public.policy_extracted_data
  for each row execute function public.set_updated_at();

alter table public.policy_extracted_data enable row level security;

drop policy if exists "policy_extracted_data_select_owner" on public.policy_extracted_data;
create policy "policy_extracted_data_select_owner"
  on public.policy_extracted_data for select
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "policy_extracted_data_insert_owner" on public.policy_extracted_data;
create policy "policy_extracted_data_insert_owner"
  on public.policy_extracted_data for insert
  to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "policy_extracted_data_update_owner" on public.policy_extracted_data;
create policy "policy_extracted_data_update_owner"
  on public.policy_extracted_data for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "policy_extracted_data_delete_owner" on public.policy_extracted_data;
create policy "policy_extracted_data_delete_owner"
  on public.policy_extracted_data for delete
  to authenticated
  using (owner_user_id = auth.uid());

-- ---------------------------------------------------------------
-- policy_extracted_data_evidence — one row per cited fact, so a
-- future Wallet UI can show "Collision deductible $1,000 — Source:
-- Auto Policy, Page 6" and Ask Roni can cite the real document
-- instead of asserting a number with nothing behind it (M3.0 §5).
-- `field_path` is a dot-path into the sibling extracted_data row's
-- `data` JSON (e.g. 'coverages.collision.deductible') — deliberately
-- a plain string rather than a rigid column-per-field structure, so
-- new fields/schema versions don't require a migration here too.
-- ---------------------------------------------------------------
create table if not exists public.policy_extracted_data_evidence (
  id uuid primary key default gen_random_uuid(),
  extracted_data_id uuid not null references public.policy_extracted_data (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade, -- denormalized, see note above
  field_path text not null,
  value_text text,
  confidence numeric(3, 2) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  document_id uuid references public.policy_documents (id) on delete set null,
  page_number integer check (page_number is null or page_number > 0),
  snippet text,
  created_at timestamptz not null default now()
);

create index if not exists policy_extracted_data_evidence_extracted_data_id_idx
  on public.policy_extracted_data_evidence (extracted_data_id);
create index if not exists policy_extracted_data_evidence_owner_user_id_idx
  on public.policy_extracted_data_evidence (owner_user_id);
-- Speeds up "give me the evidence for this one field" — the lookup
-- the future Wallet UI's "Source: ..." link performs per field shown.
create index if not exists policy_extracted_data_evidence_field_path_idx
  on public.policy_extracted_data_evidence (extracted_data_id, field_path);

alter table public.policy_extracted_data_evidence enable row level security;

drop policy if exists "policy_extracted_data_evidence_select_owner" on public.policy_extracted_data_evidence;
create policy "policy_extracted_data_evidence_select_owner"
  on public.policy_extracted_data_evidence for select
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "policy_extracted_data_evidence_insert_owner" on public.policy_extracted_data_evidence;
create policy "policy_extracted_data_evidence_insert_owner"
  on public.policy_extracted_data_evidence for insert
  to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "policy_extracted_data_evidence_update_owner" on public.policy_extracted_data_evidence;
create policy "policy_extracted_data_evidence_update_owner"
  on public.policy_extracted_data_evidence for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "policy_extracted_data_evidence_delete_owner" on public.policy_extracted_data_evidence;
create policy "policy_extracted_data_evidence_delete_owner"
  on public.policy_extracted_data_evidence for delete
  to authenticated
  using (owner_user_id = auth.uid());
