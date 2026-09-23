-- RONI M3.0 — migration 1 of 3: core tables
--
-- Safe to run more than once: every statement is guarded (IF NOT
-- EXISTS / DROP POLICY IF EXISTS + CREATE POLICY / OR REPLACE). No
-- DROP TABLE anywhere in this milestone.
--
-- Apply this in the Supabase SQL Editor, or via the Supabase CLI
-- (`supabase db push`), BEFORE migration 2 and 3 — later files
-- reference tables created here.

-- ---------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------
-- Shared trigger: keep `updated_at` current on every UPDATE
-- ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- profiles — one row per auth.users row, auto-created on signup
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever someone signs up, so the app
-- never has to handle "user exists but profile doesn't." Runs as the
-- table owner (SECURITY DEFINER) specifically so it can insert into
-- `profiles` on the new user's behalf during signup, before that
-- user's own session/RLS context exists yet.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No insert/delete policy for regular users on purpose: rows are
-- created only by the trigger above (as the table owner) and this
-- milestone doesn't support self-service account deletion yet.

-- ---------------------------------------------------------------
-- households — MVP: owner-based, extensible to member-based sharing
-- ---------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists households_created_by_idx on public.households (created_by);

drop trigger if exists set_households_updated_at on public.households;
create trigger set_households_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

alter table public.households enable row level security;

-- SIMPLIFIED FOR M3.0 (owner-only — see the corrective note below):
-- households are visible only to their creator. This table's RLS no
-- longer references household_members at all, which is what removes
-- the circular dependency described below.
drop policy if exists "households_select_owner" on public.households;
create policy "households_select_owner"
  on public.households for select
  to authenticated
  using (created_by = auth.uid());

drop policy if exists "households_insert_own" on public.households;
create policy "households_insert_own"
  on public.households for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "households_update_owner" on public.households;
create policy "households_update_owner"
  on public.households for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "households_delete_owner" on public.households;
create policy "households_delete_owner"
  on public.households for delete
  to authenticated
  using (created_by = auth.uid());

-- ---------------------------------------------------------------
-- household_members — a member may or may not have their own account
-- (`user_id` is nullable: e.g. a spouse recorded by name only, who
-- hasn't signed up yet). Membership is managed only by the household
-- creator in this milestone — see the M3.0 setup doc for why.
-- ---------------------------------------------------------------
create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  relationship text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists household_members_household_id_idx on public.household_members (household_id);
create index if not exists household_members_user_id_idx on public.household_members (user_id);

drop trigger if exists set_household_members_updated_at on public.household_members;
create trigger set_household_members_updated_at
  before update on public.household_members
  for each row execute function public.set_updated_at();

alter table public.household_members enable row level security;

-- CORRECTIVE NOTE (post-review): the original version of this file had
-- `households` querying `household_members` (to let a member see their
-- household) AND `household_members` querying `households` (to let the
-- creator manage membership) — a circular RLS dependency between the
-- two tables, which Postgres can evaluate incorrectly or reject
-- outright. Per review, this is now one-directional only:
-- `household_members` policies check `households.created_by`, and
-- `households` policies (above) no longer reference
-- `household_members` at all. Household sharing (a member seeing
-- their own household) is deferred — see the EXTENSION PATH comment
-- near the end of this file.
drop policy if exists "households_select_owner_or_member" on public.households;

drop policy if exists "household_members_select_owner_or_self" on public.household_members;
drop policy if exists "household_members_select_owner" on public.household_members;
create policy "household_members_select_owner"
  on public.household_members for select
  to authenticated
  using (
    exists (
      select 1 from public.households h
      where h.id = household_members.household_id
        and h.created_by = auth.uid()
    )
  );

drop policy if exists "household_members_insert_owner" on public.household_members;
create policy "household_members_insert_owner"
  on public.household_members for insert
  to authenticated
  with check (
    exists (
      select 1 from public.households h
      where h.id = household_members.household_id
        and h.created_by = auth.uid()
    )
  );

drop policy if exists "household_members_update_owner" on public.household_members;
create policy "household_members_update_owner"
  on public.household_members for update
  to authenticated
  using (
    exists (
      select 1 from public.households h
      where h.id = household_members.household_id
        and h.created_by = auth.uid()
    )
  );

drop policy if exists "household_members_delete_owner" on public.household_members;
create policy "household_members_delete_owner"
  on public.household_members for delete
  to authenticated
  using (
    exists (
      select 1 from public.households h
      where h.id = household_members.household_id
        and h.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------
-- policies — the core Wallet entity. Owner-based RLS only for this
-- milestone (see the extension-path comment below the RLS block).
-- ---------------------------------------------------------------
create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  category text not null check (
    category in ('auto', 'health', 'home', 'renters', 'life', 'pet', 'motorcycle', 'travel', 'other')
  ),
  carrier text,
  policy_number text,
  status text not null default 'unknown' check (
    status in ('active', 'pending', 'expired', 'cancelled', 'unknown')
  ),
  effective_date date,
  expiration_date date,
  premium_amount numeric(12, 2),
  premium_frequency text check (
    premium_frequency in ('monthly', 'quarterly', 'semi_annual', 'annual', 'other')
  ),
  term_premium numeric(12, 2),
  state text,
  monitoring_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists policies_owner_user_id_idx on public.policies (owner_user_id);
create index if not exists policies_household_id_idx on public.policies (household_id);
create index if not exists policies_category_idx on public.policies (category);

drop trigger if exists set_policies_updated_at on public.policies;
create trigger set_policies_updated_at
  before update on public.policies
  for each row execute function public.set_updated_at();

alter table public.policies enable row level security;

drop policy if exists "policies_select_owner" on public.policies;
create policy "policies_select_owner"
  on public.policies for select
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "policies_insert_owner" on public.policies;
create policy "policies_insert_owner"
  on public.policies for insert
  to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "policies_update_owner" on public.policies;
create policy "policies_update_owner"
  on public.policies for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "policies_delete_owner" on public.policies;
create policy "policies_delete_owner"
  on public.policies for delete
  to authenticated
  using (owner_user_id = auth.uid());

-- EXTENSION PATH (not enabled in M3.0 — documented per the brief §7):
-- once household sharing is actually designed (who can view vs. edit
-- a family member's policy, how invitations work, etc.), a household
-- member could be granted READ access to policies tied to a shared
-- household with something like:
--
--   create policy "policies_select_household_member"
--     on public.policies for select
--     to authenticated
--     using (
--       household_id is not null
--       and exists (
--         select 1 from public.household_members hm
--         where hm.household_id = policies.household_id
--           and hm.user_id = auth.uid()
--       )
--     );
--
-- Deliberately not enabled yet: it needs product decisions (can a
-- member edit? see premium history? see documents?) this milestone
-- isn't scoped to make. Owner-only access is the safe default until
-- those decisions are made explicitly.
--
-- If/when a member needs to see the *household* record itself (not
-- just its policies), re-add a households SELECT policy referencing
-- household_members — but keep it one-directional: household_members'
-- own policies must keep checking households.created_by only, never
-- the other way around, or the circular dependency this patch removed
-- comes back. A SECURITY DEFINER helper function that looks up
-- membership without re-triggering RLS is the standard safe way to do
-- this in Postgres/Supabase when that day comes — not implemented
-- here, per this review's explicit instruction not to add one just to
-- preserve sharing.
