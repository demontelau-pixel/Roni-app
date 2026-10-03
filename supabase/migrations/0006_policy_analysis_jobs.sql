-- RONI Bloque 1 (corrección) — migration 6: durable analysis jobs
--
-- WHY THIS EXISTS: the previous upload route ran extraction in-memory,
-- inline in the same request that received the file. That has two real
-- problems the reviewer flagged: (1) it ties analysis to whatever
-- happened to be true of the upload request (including its body size —
-- see migration 0003's bucket and `lib/wallet/storage-paths.ts`, now
-- bypassed entirely by direct-to-Storage upload), and (2) if the
-- serverless function is killed mid-analysis (timeout, cold-start
-- eviction, deploy), nothing durable records that an attempt was ever
-- made — a retry has no way to know a previous attempt is stuck rather
-- than simply slow, and two retries fired close together could both
-- call the AI provider for the same document at the same time.
--
-- This table is the durable, database-backed job record: every
-- analysis attempt (initial or retry) is a row here BEFORE the AI
-- provider is ever called, so a request that never returns still left
-- a real, inspectable trace (`status = 'processing'`, `started_at` set,
-- `finished_at` still null) instead of silently vanishing.
--
-- DUPLICATE PREVENTION (not just an application-level check-then-act,
-- which races): the partial unique index below makes Postgres itself
-- reject a second `queued`/`processing` row for the same document — a
-- concurrent double-click or a retry fired while one is already running
-- gets a unique-violation, which the service layer
-- (`lib/services/policy-extraction/job-runner.ts`) turns into "already
-- in progress," never a second AI call and never a duplicate charge.
--
-- Safe to run more than once — every statement below is idempotent.

create table if not exists public.policy_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies (id) on delete cascade,
  document_id uuid not null references public.policy_documents (id) on delete cascade,
  -- Denormalized, same convention as every other Wallet table here —
  -- keeps RLS a simple equality check instead of a join.
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'complete', 'failed', 'needs_review')
  ),
  attempt_number integer not null default 1 check (attempt_number > 0),
  -- Filled in once the job actually finishes (successfully or not) —
  -- the resulting `policy_extracted_data` row this attempt produced,
  -- when it got that far.
  extracted_data_id uuid references public.policy_extracted_data (id) on delete set null,
  -- Short, safe-to-display reason for a `failed` job — never a raw
  -- provider error, stack trace, or document contents (same rule as
  -- every other error surface in this app).
  error_reason text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists policy_analysis_jobs_policy_id_idx on public.policy_analysis_jobs (policy_id);
create index if not exists policy_analysis_jobs_document_id_idx on public.policy_analysis_jobs (document_id);
create index if not exists policy_analysis_jobs_owner_user_id_idx on public.policy_analysis_jobs (owner_user_id);

-- THE actual duplicate-prevention mechanism: at most one active
-- (queued or processing) job per document, enforced by Postgres, not
-- by application code racing itself.
drop index if exists policy_analysis_jobs_one_active_per_document;
create unique index policy_analysis_jobs_one_active_per_document
  on public.policy_analysis_jobs (document_id)
  where status in ('queued', 'processing');

drop trigger if exists set_policy_analysis_jobs_updated_at on public.policy_analysis_jobs;
create trigger set_policy_analysis_jobs_updated_at
  before update on public.policy_analysis_jobs
  for each row execute function public.set_updated_at();

alter table public.policy_analysis_jobs enable row level security;

drop policy if exists "policy_analysis_jobs_select_owner" on public.policy_analysis_jobs;
create policy "policy_analysis_jobs_select_owner"
  on public.policy_analysis_jobs for select
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "policy_analysis_jobs_insert_owner" on public.policy_analysis_jobs;
create policy "policy_analysis_jobs_insert_owner"
  on public.policy_analysis_jobs for insert
  to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "policy_analysis_jobs_update_owner" on public.policy_analysis_jobs;
create policy "policy_analysis_jobs_update_owner"
  on public.policy_analysis_jobs for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- No delete policy — a job row is a durable audit trail of what was
-- attempted and when; nothing in this app deletes one.

grant select, insert, update on public.policy_analysis_jobs to authenticated;
