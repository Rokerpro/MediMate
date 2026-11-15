-- MediMate 0003: Google sign-in accounts (hackathon demo only).
-- Run in the Supabase SQL editor after 0001 and 0002. Safe to re-run.
--
-- What changes:
-- * Each profile can be owned by one Supabase Auth user (profiles.user_id).
-- * RLS becomes "your own profile only". The anon role (signed-out visitors)
--   can no longer read or write ANY row, including the synthetic demo profile.
-- * The synthetic demo profile is linked to ONE demo Google account, chosen by
--   the owner in medimate_settings (never committed to the repo).
-- * Everyone else gets an empty profile; only the first 5 such sign-ups are
--   accepted (the demo account does not count).
--
-- After running this file, set the demo account (replace the placeholder):
--   insert into public.medimate_settings (key, value)
--   values ('demo_owner_email', 'your-demo-account@gmail.com')
--   on conflict (key) do update set value = excluded.value;
--
-- Still synthetic data only. This is not a production security design.

-- 1. Ownership ---------------------------------------------------------------
alter table public.profiles
  add column if not exists user_id uuid unique references auth.users(id) on delete set null;

-- New accounts start empty: age is unknown until the user enters it.
alter table public.profiles alter column age drop not null;

-- 2. Private settings (no policies: only the SQL editor and the security-definer
--    functions below can read it; the API roles get nothing).
create table if not exists public.medimate_settings (
  key text primary key,
  value text not null
);
alter table public.medimate_settings enable row level security;
revoke all on public.medimate_settings from anon, authenticated;

-- 3. Access rule used by every existing policy (0001, 0002).
--    Kept under its old name so all policies switch at once; it now means
--    "this profile belongs to the signed-in user". auth.uid() is null for anon,
--    so signed-out requests match nothing. SECURITY DEFINER avoids RLS
--    recursion when the profiles policy calls it.
create or replace function public.is_medimate_demo_profile(candidate_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = candidate_profile_id
      and p.user_id is not null
      and p.user_id = auth.uid()
  );
$$;

revoke all on function public.is_medimate_demo_profile(uuid) from public;
grant execute on function public.is_medimate_demo_profile(uuid) to anon, authenticated;

-- Policies: signed-in users only (anon removed). Same rule, recreated.
drop policy if exists "demo profile read" on public.profiles;
create policy "demo profile read"
  on public.profiles for select to authenticated
  using (public.is_medimate_demo_profile(id));

drop policy if exists "demo profile update" on public.profiles;
create policy "demo profile update"
  on public.profiles for update to authenticated
  using (public.is_medimate_demo_profile(id))
  with check (public.is_medimate_demo_profile(id));

drop policy if exists "demo logs access" on public.health_logs;
create policy "demo logs access"
  on public.health_logs for all to authenticated
  using (public.is_medimate_demo_profile(profile_id))
  with check (public.is_medimate_demo_profile(profile_id));

drop policy if exists "demo sessions access" on public.symptom_sessions;
create policy "demo sessions access"
  on public.symptom_sessions for all to authenticated
  using (public.is_medimate_demo_profile(profile_id))
  with check (public.is_medimate_demo_profile(profile_id));

drop policy if exists "demo messages read" on public.symptom_messages;
create policy "demo messages read"
  on public.symptom_messages for select to authenticated
  using (exists (
    select 1 from public.symptom_sessions s
    where s.id = symptom_messages.session_id and public.is_medimate_demo_profile(s.profile_id)
  ));

drop policy if exists "demo messages insert" on public.symptom_messages;
create policy "demo messages insert"
  on public.symptom_messages for insert to authenticated
  with check (exists (
    select 1 from public.symptom_sessions s
    where s.id = symptom_messages.session_id and public.is_medimate_demo_profile(s.profile_id)
  ));

drop policy if exists "demo messages delete" on public.symptom_messages;
create policy "demo messages delete"
  on public.symptom_messages for delete to authenticated
  using (exists (
    select 1 from public.symptom_sessions s
    where s.id = symptom_messages.session_id and public.is_medimate_demo_profile(s.profile_id)
  ));

drop policy if exists "demo reminders access" on public.reminders;
create policy "demo reminders access"
  on public.reminders for all to authenticated
  using (public.is_medimate_demo_profile(profile_id))
  with check (public.is_medimate_demo_profile(profile_id));

-- Users may edit their profile's fields but never move it to another account.
-- (A column-level REVOKE would not help: Supabase grants table-level UPDATE.)
create or replace function public.medimate_keep_profile_owner()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id and current_user in ('anon', 'authenticated') then
    raise exception 'profile owner cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists medimate_keep_profile_owner on public.profiles;
create trigger medimate_keep_profile_owner
  before update on public.profiles
  for each row execute function public.medimate_keep_profile_owner();

-- No insert policy on profiles: claim_medimate_profile() is the only way in.

-- 4. Sign-in: link or create the caller's profile ------------------------------
-- Returns the caller's profile id. Raises SQLSTATE 'MMCAP' when sign-ups are closed.
create or replace function public.claim_medimate_profile()
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  demo_id constant uuid := '00000000-0000-4000-8000-000000000001';
  max_signups constant integer := 5;
  demo_email text;
  existing uuid;
  created uuid;
begin
  if caller is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select id into existing from public.profiles where user_id = caller;
  if existing is not null then
    return existing;
  end if;

  select lower(value) into demo_email from public.medimate_settings where key = 'demo_owner_email';
  if demo_email is not null and demo_email <> '' and caller_email = demo_email then
    update public.profiles set user_id = caller, updated_at = now()
      where id = demo_id and user_id is null
      returning id into existing;
    if existing is not null then
      return existing;
    end if;
  end if;

  -- Serialise concurrent sign-ups so the cap cannot be exceeded.
  lock table public.profiles in share row exclusive mode;
  if (select count(*) from public.profiles where user_id is not null and id <> demo_id) >= max_signups then
    raise exception 'MediMate sign-ups are closed' using errcode = 'MMCAP';
  end if;

  insert into public.profiles (user_id, display_name, age, conditions, allergies, medications, medical_history)
    values (caller, 'New user', null, '{}', '{}', '[]'::jsonb, null)
    returning id into created;
  return created;
end;
$$;

revoke all on function public.claim_medimate_profile() from public, anon;
grant execute on function public.claim_medimate_profile() to authenticated;
