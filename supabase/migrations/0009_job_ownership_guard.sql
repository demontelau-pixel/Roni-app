-- RONI Bloque 1 (corrección) — migration 9: DB-level ownership guard on
-- policy_analysis_jobs.
--
-- WHY THIS EXISTS: `app/api/cron/process-analysis-jobs/route.ts` (the
-- Vercel Cron worker) reads and writes `policy_analysis_jobs` with a
-- Supabase SERVICE-ROLE client (`lib/supabase/service-role.ts`),
-- because a scheduled job has no user session for Row Level Security
-- to scope by. That is a deliberate, documented exception to this
-- app's "RLS + explicit owner check" rule — but it also means RLS
-- itself can no longer be the thing that stops a job row from ever
-- pointing at a policy/document it doesn't actually belong to. Until
-- this migration, nothing enforced that `policy_analysis_jobs.policy_id`,
-- `.document_id`, and `.owner_user_id` were actually consistent with
-- each other and with the real `policies`/`policy_documents` rows —
-- the RLS-scoped insert path (`createAnalysisJob`) only ever wrote
-- consistent values in practice, but "in practice" is not the same
-- claim as "the database itself refuses an inconsistent row."
--
-- This trigger makes that a hard, server-enforced invariant, checked
-- on every insert or update of `owner_user_id`/`policy_id`/`document_id`:
-- a job can only ever reference a document that (a) really exists,
-- (b) really belongs to `policy_id`, and (c) is really owned by
-- `owner_user_id` — and a `policy_id` that is really owned by that same
-- `owner_user_id`. This holds regardless of which client (RLS-scoped or
-- service-role) performs the write, so it's real defense in depth
-- underneath the worker's own application-level check
-- (`lib/services/policy-extraction/job-runner.ts`'s `assertJobOwnership`),
-- not a replacement for it — the app-level check can fail closed with a
-- friendly, recorded `error_reason` before ever touching Storage or the
-- AI provider; this trigger is the backstop that makes the inconsistent
-- row impossible to write at all, even from a bug or a future caller
-- that forgets to check.
--
-- Safe to run more than once.

create or replace function public.policy_analysis_jobs_check_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  document_policy_id uuid;
  document_owner_id uuid;
  policy_owner_id uuid;
begin
  select policy_id, owner_user_id
    into document_policy_id, document_owner_id
    from public.policy_documents
    where id = new.document_id;

  if document_policy_id is null then
    raise exception 'policy_analysis_jobs: document % does not exist', new.document_id;
  end if;

  if document_policy_id <> new.policy_id then
    raise exception 'policy_analysis_jobs: document % belongs to policy %, not %', new.document_id, document_policy_id, new.policy_id;
  end if;

  if document_owner_id <> new.owner_user_id then
    raise exception 'policy_analysis_jobs: document % is not owned by %', new.document_id, new.owner_user_id;
  end if;

  select owner_user_id into policy_owner_id
    from public.policies
    where id = new.policy_id;

  if policy_owner_id is null then
    raise exception 'policy_analysis_jobs: policy % does not exist', new.policy_id;
  end if;

  if policy_owner_id <> new.owner_user_id then
    raise exception 'policy_analysis_jobs: policy % is not owned by %', new.policy_id, new.owner_user_id;
  end if;

  return new;
end;
$$;

comment on function public.policy_analysis_jobs_check_ownership() is
  'Rejects any insert/update of policy_analysis_jobs whose policy_id/document_id/owner_user_id are not mutually consistent with the real policies/policy_documents rows — enforced for every writer, including the service-role cron worker that bypasses RLS.';

drop trigger if exists policy_analysis_jobs_ownership_guard on public.policy_analysis_jobs;
create trigger policy_analysis_jobs_ownership_guard
  before insert or update of owner_user_id, policy_id, document_id
  on public.policy_analysis_jobs
  for each row execute function public.policy_analysis_jobs_check_ownership();
