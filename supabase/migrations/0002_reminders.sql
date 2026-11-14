-- MediMate reminders (hackathon demo only). Run in the Supabase SQL editor after 0001.
-- Reminders are created and confirmed by the user. MediMate never generates,
-- suggests or changes reminder content, medication timing or doses.
-- In-app list only: no push/SMS/email notifications.

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  category text not null default 'other'
    check (category in ('medication', 'appointment', 'health_log', 'other')),
  notes text check (notes is null or char_length(notes) <= 500),
  remind_at timestamptz not null,
  repeat text not null default 'none' check (repeat in ('none', 'daily', 'weekly')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reminders_profile_remind_at_idx
  on public.reminders (profile_id, remind_at asc);

alter table public.reminders enable row level security;

drop policy if exists "demo reminders access" on public.reminders;
create policy "demo reminders access"
  on public.reminders for all to anon, authenticated
  using (public.is_medimate_demo_profile(profile_id))
  with check (public.is_medimate_demo_profile(profile_id));

-- Synthetic demo reminders (safe to re-run).
insert into public.reminders (id, profile_id, title, category, notes, remind_at, repeat)
values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001',
   'Fill in daily health log', 'health_log', 'Synthetic demo reminder.',
   date_trunc('day', now()) + interval '20 hours', 'daily'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001',
   'GP appointment about recurring back discomfort', 'appointment', 'Bring the printed health summary. Synthetic demo reminder.',
   date_trunc('day', now()) + interval '5 days 10 hours', 'none')
on conflict (id) do nothing;
