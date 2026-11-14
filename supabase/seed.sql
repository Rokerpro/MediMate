-- Fictional demo patient only. Never load real health data into this seed.
insert into public.profiles (
  id, display_name, age, gender, height_cm, weight_kg, conditions, allergies, medications, medical_history
) values (
  '00000000-0000-4000-8000-000000000001',
  'Alex Demo',
  24,
  null,
  175,
  70,
  ARRAY[]::text[],
  ARRAY[]::text[],
  '[]'::jsonb,
  'Synthetic demonstration profile. No real patient information.'
) on conflict (id) do update set
  display_name = excluded.display_name,
  age = excluded.age,
  updated_at = now();

-- Sample observations are fictional and do not establish a diagnosis or cause.
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
from generate_series(0, 13) as n
where not exists (
  select 1 from public.health_logs h
  where h.profile_id = '00000000-0000-4000-8000-000000000001'::uuid
    and h.logged_at::date = (current_date - (n || ' days')::interval)::date
);
