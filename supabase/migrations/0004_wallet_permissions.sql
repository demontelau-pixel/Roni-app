-- RONI M3.1–M3.4 — migration 4: Wallet table-level privileges
--
-- FIXES: "permission denied for table policies" (and the same error
-- would occur for the other three tables below) when an authenticated
-- user opens /wallet.
--
-- ROOT CAUSE: Postgres checks table-level ACL privileges (GRANT)
-- BEFORE it ever evaluates Row Level Security. RLS can only narrow
-- down which ROWS a role sees within a table it already has the
-- privilege to touch — it is not a substitute for that privilege, and
-- it never grants one. "permission denied for table X" is Postgres's
-- specific, unambiguous signature for a missing table-level GRANT: a
-- SELECT blocked purely by an RLS policy instead returns an empty
-- result set, and an INSERT/UPDATE blocked by RLS instead raises "new
-- row violates row-level security policy" — neither of those is the
-- error being reported here. Migrations 0001 and 0002 create
-- `policies`, `policy_documents`, `policy_extracted_data`, and
-- `policy_extracted_data_evidence` and enable + define RLS on all
-- four, but never contain an explicit GRANT statement for any of
-- them — they rely entirely on this Supabase project's automatic
-- default privileges for newly created tables in the `public` schema
-- having applied to these four. This migration stops relying on that
-- and grants the privilege explicitly, so `/wallet` (and the rest of
-- the M3.1–M3.4 Wallet flow) no longer depends on how or by which
-- role these tables happened to get created.
--
-- SECURITY: RLS stays exactly as migrations 0001/0002 defined it and
-- is NOT weakened by this file. Every policy on these four tables is
-- already scoped `to authenticated` and filtered by
-- `owner_user_id = auth.uid()` (or, for
-- `policy_extracted_data_evidence`, by its own `owner_user_id`) — this
-- migration only grants the `authenticated` role permission to
-- ATTEMPT a statement against these tables at all; RLS is still what
-- decides which rows that statement can see or affect. Nothing is
-- granted to `anon` or `public` — an unauthenticated request still
-- has no privilege on any of these four tables, exactly as before.
-- No `service_role` grant is added or needed: `service_role` already
-- bypasses RLS by Postgres/Supabase convention and is never used from
-- the browser or from any Wallet code path (every Wallet query in
-- `src/lib/wallet/repository.ts` runs through the request-scoped,
-- cookie-authenticated server client, never a service-role client).
--
-- Safe to run more than once — GRANT is idempotent in Postgres;
-- re-granting a privilege a role already has is a no-op.

-- Usage on the schema itself. Almost certainly already granted
-- project-wide (a missing schema-level grant would have broken every
-- table in `public`, including `profiles`, not just the Wallet
-- tables) — included anyway because the brief asks this to be
-- verified explicitly, and because it costs nothing to state
-- explicitly rather than assume.
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.policies to authenticated;
grant select, insert, update, delete on public.policy_documents to authenticated;
grant select, insert, update, delete on public.policy_extracted_data to authenticated;
grant select, insert, update, delete on public.policy_extracted_data_evidence to authenticated;

-- No DELETE is currently issued by `src/lib/wallet/repository.ts` for
-- any of these tables, and no UI exposes deleting a policy or
-- document yet — DELETE is still granted here (rather than narrowed
-- to just SELECT/INSERT/UPDATE) because every one of these tables
-- already has a `..._delete_owner` RLS policy defined for it in
-- migrations 0001/0002. Granting DELETE now, consistent with the RLS
-- that already exists for it, avoids a second silent "permission
-- denied" surprise the day a delete flow is actually wired up, and
-- RLS's owner check is what keeps it safe in the meantime.
