-- MediMate demo reset. Run in the Supabase SQL editor JUST BEFORE the demo.
-- DESTRUCTIVE for the demo profile only: deletes ALL its chat sessions/messages,
-- health logs and reminders, then restores the synthetic seed data re-dated to
-- today. Synthetic data only. Never run this against a project with real data.
begin;

update public.profiles set
  display_name = 'Alex Demo',
  age = 24,
  gender = null,
  height_cm = 175,
  weight_kg = 70,
  conditions = ARRAY[]::text[],
  allergies = ARRAY[]::text[],
  medications = '[]'::jsonb,
  medical_history = 'Synthetic demonstration profile. No real patient information.',
  updated_at = now()
where id = '00000000-0000-4000-8000-000000000001';

-- Messages are removed by ON DELETE CASCADE.
delete from public.symptom_sessions where profile_id = '00000000-0000-4000-8000-000000000001';
delete from public.health_logs where profile_id = '00000000-0000-4000-8000-000000000001';
delete from public.reminders where profile_id = '00000000-0000-4000-8000-000000000001';

-- Same 14 fictional logs as supabase/seed.sql (today and the 13 days before).
insert into public.health_logs (
  profile_id, logged_at, symptoms, pain_location, pain_level,
  sleep_duration_minutes, sleep_quality, mood, water_ml, activity_minutes, notes
)
select
  '00000000-0000-4000-8000-000000000001'::uuid,
  (current_date - (n || ' days')::interval) + interval '09:00',
  case when n in (1, 3, 7, 10, 13) then 'Mild lower back discomfort' else 'No specific symptom reported' end,
  case when n in (1, 3, 7, 10, 13) then 'Lower back' else null end,
  case when n in (1, 3, 7, 10, 13) then (2 + (n % 3))::smallint else null end,
  case when n in (2, 5, 9, 12) then 360 else 420 + (n % 3) * 30 end,
  case when n in (2, 5, 9, 12) then 2 else 3 + (n % 2) end,
  case when n in (2, 5, 9) then 'tired' else 'okay' end,
  1400 + (n % 4) * 200,
  case when n in (1, 3, 7, 10, 13) then 15 else 30 + (n % 3) * 10 end,
  case when n in (1, 3, 7, 10, 13) then 'Synthetic note: reported a long period of sitting.' else 'Synthetic demo log.' end
from generate_series(0, 13) as n;

-- Same 2 fictional reminders as 0002_reminders.sql.
insert into public.reminders (id, profile_id, title, category, notes, remind_at, repeat)
values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001',
   'Fill in daily health log', 'health_log', 'Synthetic demo reminder.',
   date_trunc('day', now()) + interval '20 hours', 'daily'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001',
   'GP appointment about recurring back discomfort', 'appointment', 'Bring the printed health summary. Synthetic demo reminder.',
   date_trunc('day', now()) + interval '5 days 10 hours', 'none');

commit;

-- Expected afterwards: profile "Alex Demo", 14 logs, 2 reminders, 0 sessions.
select
  (select display_name from public.profiles where id = '00000000-0000-4000-8000-000000000001') as profile,
  (select count(*) from public.health_logs where profile_id = '00000000-0000-4000-8000-000000000001') as logs,
  (select count(*) from public.reminders where profile_id = '00000000-0000-4000-8000-000000000001') as reminders,
  (select count(*) from public.symptom_sessions where profile_id = '00000000-0000-4000-8000-000000000001') as sessions;
