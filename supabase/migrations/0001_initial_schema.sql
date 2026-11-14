-- MediMate hackathon starter schema.
-- IMPORTANT: This is a hackathon-only demo schema, not production security.
-- It intentionally permits access only to one fixed synthetic demo profile.
-- Never add real patient data or reuse this policy design for a real health product.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  age smallint not null check (age between 1 and 120),
  gender text,
  height_cm numeric(5,1) check (height_cm is null or height_cm between 30 and 260),
  weight_kg numeric(5,1) check (weight_kg is null or weight_kg between 1 and 500),
  conditions text[] not null default '{}',
  allergies text[] not null default '{}',
  medications jsonb not null default '[]'::jsonb,
  medical_history text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  logged_at timestamptz not null default now(),
  symptoms text not null,
  pain_location text,
  pain_level smallint check (pain_level is null or pain_level between 0 and 10),
  sleep_duration_minutes integer check (sleep_duration_minutes is null or sleep_duration_minutes between 0 and 1440),
  sleep_quality smallint check (sleep_quality is null or sleep_quality between 1 and 5),
  mood text,
  water_ml integer check (water_ml is null or water_ml between 0 and 20000),
  activity_minutes integer check (activity_minutes is null or activity_minutes between 0 and 1440),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.symptom_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  initial_symptom text not null,
  assessment jsonb,
  urgency_level text check (urgency_level is null or urgency_level in ('routine', 'prompt', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.symptom_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.symptom_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists health_logs_profile_logged_at_idx
  on public.health_logs (profile_id, logged_at desc);

create index if not exists symptom_sessions_profile_created_at_idx
  on public.symptom_sessions (profile_id, created_at desc);

create index if not exists symptom_messages_session_created_at_idx
  on public.symptom_messages (session_id, created_at asc);

-- Demo profile ID is fixed so anonymous access cannot span arbitrary profiles.
-- The app must seed this synthetic profile and must not accept arbitrary profile IDs.
-- Public users can alter this one fictional demo profile; this is NOT suitable for real data.
create or replace function public.is_medimate_demo_profile(candidate_profile_id uuid)
returns boolean
language sql
stable
as $$
  select candidate_profile_id = '00000000-0000-4000-8000-000000000001'::uuid;
$$;

alter table public.profiles enable row level security;
alter table public.health_logs enable row level security;
alter table public.symptom_sessions enable row level security;
alter table public.symptom_messages enable row level security;

create policy "demo profile read"
  on public.profiles for select to anon, authenticated
  using (public.is_medimate_demo_profile(id));

create policy "demo profile update"
  on public.profiles for update to anon, authenticated
  using (public.is_medimate_demo_profile(id))
  with check (public.is_medimate_demo_profile(id));

create policy "demo logs access"
  on public.health_logs for all to anon, authenticated
  using (public.is_medimate_demo_profile(profile_id))
  with check (public.is_medimate_demo_profile(profile_id));

create policy "demo sessions access"
  on public.symptom_sessions for all to anon, authenticated
  using (public.is_medimate_demo_profile(profile_id))
  with check (public.is_medimate_demo_profile(profile_id));

create policy "demo messages read"
  on public.symptom_messages for select to anon, authenticated
  using (
    exists (
      select 1 from public.symptom_sessions s
      where s.id = symptom_messages.session_id
        and public.is_medimate_demo_profile(s.profile_id)
    )
  );

create policy "demo messages insert"
  on public.symptom_messages for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.symptom_sessions s
      where s.id = symptom_messages.session_id
        and public.is_medimate_demo_profile(s.profile_id)
    )
  );

create policy "demo messages delete"
  on public.symptom_messages for delete to anon, authenticated
  using (
    exists (
      select 1 from public.symptom_sessions s
      where s.id = symptom_messages.session_id
        and public.is_medimate_demo_profile(s.profile_id)
    )
  );
