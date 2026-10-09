-- RONI Bloque 1 — persistent, owner-scoped Ask Roni conversation turns.
--
-- Each row contains one user question and one server-created answer. The PDF
-- itself, provider key, signed URL, and raw provider response are never stored
-- here. `answer` is the shaped UI response only (sections and short citations).

create table if not exists public.policy_chat_turns (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  question text not null check (char_length(question) between 1 and 1000),
  answer jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists policy_chat_turns_policy_created_idx
  on public.policy_chat_turns (policy_id, created_at asc);
create index if not exists policy_chat_turns_owner_user_id_idx
  on public.policy_chat_turns (owner_user_id);

-- A row cannot point at another person's policy even if a future privileged
-- writer accidentally supplies mismatched values. RLS protects normal app
-- calls; this trigger protects every writer, including service-role code.
create or replace function public.policy_chat_turns_check_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  policy_owner uuid;
begin
  select owner_user_id into policy_owner from public.policies where id = new.policy_id;
  if policy_owner is null then
    raise exception 'policy_chat_turns: policy % does not exist', new.policy_id;
  end if;
  if policy_owner <> new.owner_user_id then
    raise exception 'policy_chat_turns: policy % is not owned by %', new.policy_id, new.owner_user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists policy_chat_turns_ownership_guard on public.policy_chat_turns;
create trigger policy_chat_turns_ownership_guard
  before insert or update on public.policy_chat_turns
  for each row execute function public.policy_chat_turns_check_ownership();

alter table public.policy_chat_turns enable row level security;

drop policy if exists "policy_chat_turns_select_owner" on public.policy_chat_turns;
create policy "policy_chat_turns_select_owner"
  on public.policy_chat_turns for select
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "policy_chat_turns_insert_owner" on public.policy_chat_turns;
create policy "policy_chat_turns_insert_owner"
  on public.policy_chat_turns for insert
  to authenticated
  with check (owner_user_id = auth.uid());

-- Deliberately no update/delete policy: the history is an audit trail. A
-- future deletion/privacy feature should define retention and user controls
-- explicitly instead of silently making these records mutable.
grant select, insert on public.policy_chat_turns to authenticated;
