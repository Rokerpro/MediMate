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
  ARRAY['Seasonal hay fever']::text[],
  ARRAY['Penicillin (rash as a child)']::text[],
  '["Cetirizine when needed for hay fever"]'::jsonb,
  'Synthetic demonstration profile. No real patient information.'
) on conflict (id) do update set
  display_name = excluded.display_name,
  age = excluded.age,
  updated_at = now();

-- Sample observations are fictional and do not establish a diagnosis or cause.
-- 30 fictional, hand-written logs: today (n = 0) and the 29 days before.
-- Patterns for the demo (associations only, never causes): lower-back
-- discomfort on long desk days with little activity, headaches on short-sleep
-- or low-water days, a right-knee ache after runs, and one cold.
insert into public.health_logs (
  profile_id, logged_at, symptoms, pain_location, pain_level,
  sleep_duration_minutes, sleep_quality, mood, water_ml, activity_minutes, notes
)
select
  '00000000-0000-4000-8000-000000000001'::uuid,
  (current_date - (v.n || ' days')::interval) + v.at::interval,
  v.symptoms, v.pain_location, v.pain_level::smallint,
  v.sleep_min, v.sleep_q::smallint, v.mood, v.water_ml, v.activity_min, v.notes
from (values
  (0,  '07:45', 'No specific symptom reported', null, null, 420, 3, 'Okay', 400, 0, 'Synthetic demo log. Morning check-in before work.'),
  (1,  '21:10', 'Lower back stiffness after work', 'Lower back', 4, 400, 3, 'Okay', 1300, 10, 'Synthetic note: about 9 hours at the desk with few breaks.'),
  (2,  '20:30', 'No specific symptom reported', null, null, 450, 4, 'Good', 2000, 45, 'Synthetic note: 30-minute walk at lunch.'),
  (3,  '21:00', 'Mild lower back discomfort', 'Lower back', 3, 390, 3, 'Okay', 1500, 15, 'Synthetic note: long period of sitting, worked through lunch.'),
  (4,  '19:40', 'Headache in the afternoon', 'Forehead', 4, 330, 2, 'Low', 900, 20, 'Synthetic note: slept about 5.5 hours and drank less water than usual.'),
  (5,  '20:15', 'No specific symptom reported', null, null, 480, 4, 'Good', 2100, 60, 'Synthetic note: gym session, stretching.'),
  (6,  '21:20', 'Lower back ache when standing up', 'Lower back', 5, 380, 2, 'Low', 1200, 10, 'Synthetic note: deadline day, about 10 hours sitting.'),
  (7,  '20:00', 'No specific symptom reported', null, null, 510, 4, 'Good', 1800, 90, 'Synthetic note: rest day, long walk in the park.'),
  (8,  '21:05', 'Mild lower back discomfort', 'Lower back', 3, 420, 3, 'Okay', 1400, 20, 'Synthetic note: long period of sitting.'),
  (9,  '19:30', 'Headache behind the eyes', 'Forehead', 3, 345, 2, 'Low', 1000, 15, 'Synthetic note: late night, screen work most of the day.'),
  (10, '20:45', 'No specific symptom reported', null, null, 450, 4, 'Good', 1900, 40, 'Synthetic note: cycled to work.'),
  (11, '21:15', 'Lower back stiffness', 'Lower back', 4, 400, 3, 'Okay', 1300, 10, 'Synthetic note: long train journey and desk work.'),
  (12, '19:50', 'Right knee ache after a run', 'Right knee', 3, 460, 4, 'Good', 2200, 50, 'Synthetic note: 5 km run, ache eased by the evening.'),
  (13, '20:20', 'No specific symptom reported', null, null, 430, 3, 'Okay', 1700, 30, 'Synthetic demo log.'),
  (14, '21:00', 'Mild lower back discomfort', 'Lower back', 2, 440, 3, 'Okay', 1500, 25, 'Synthetic note: long period of sitting, short walk after dinner.'),
  (15, '19:35', 'Tension-type headache in the evening', 'Forehead', 4, 320, 2, 'Low', 800, 10, 'Synthetic note: slept badly, skipped lunch, little water.'),
  (16, '20:10', 'No specific symptom reported', null, null, 490, 4, 'Good', 2000, 70, 'Synthetic note: weekend hike.'),
  (17, '21:25', 'Lower back stiffness and tight shoulders', 'Lower back', 4, 390, 3, 'Okay', 1200, 10, 'Synthetic note: about 9 hours at the laptop on the sofa.'),
  (18, '20:00', 'No specific symptom reported', null, null, 450, 3, 'Okay', 1600, 35, 'Synthetic demo log.'),
  (19, '20:40', 'Sore throat and runny nose', 'Throat', 2, 480, 3, 'Low', 2200, 0, 'Synthetic note: cold symptoms, stayed in and rested.'),
  (20, '20:30', 'Sore throat easing', 'Throat', 1, 500, 4, 'Okay', 2000, 15, 'Synthetic note: feeling better than yesterday.'),
  (21, '21:10', 'Mild lower back discomfort', 'Lower back', 3, 410, 3, 'Okay', 1400, 15, 'Synthetic note: long period of sitting.'),
  (22, '19:45', 'Headache in the afternoon', 'Forehead', 3, 340, 2, 'Low', 1000, 20, 'Synthetic note: about 5.5 hours of sleep.'),
  (23, '20:15', 'No specific symptom reported', null, null, 470, 4, 'Good', 1900, 45, 'Synthetic note: walked to work.'),
  (24, '21:00', 'Lower back stiffness in the morning', 'Lower back', 3, 420, 3, 'Okay', 1500, 20, 'Synthetic note: long desk day the day before.'),
  (25, '20:05', 'No specific symptom reported', null, null, 460, 4, 'Good', 1800, 60, 'Synthetic note: gym session.'),
  (26, '19:55', 'Right knee ache after a run', 'Right knee', 2, 450, 4, 'Good', 2100, 40, 'Synthetic note: 4 km run on a hilly route.'),
  (27, '21:05', 'Mild lower back discomfort', 'Lower back', 2, 430, 3, 'Okay', 1400, 20, 'Synthetic note: long period of sitting.'),
  (28, '20:20', 'No specific symptom reported', null, null, 480, 4, 'Good', 1700, 50, 'Synthetic demo log.'),
  (29, '20:30', 'No specific symptom reported', null, null, 450, 3, 'Okay', 1600, 30, 'Synthetic demo log.')
) as v(n, at, symptoms, pain_location, pain_level, sleep_min, sleep_q, mood, water_ml, activity_min, notes)
where not exists (
  select 1 from public.health_logs h
  where h.profile_id = '00000000-0000-4000-8000-000000000001'::uuid
    and h.logged_at::date = (current_date - (v.n || ' days')::interval)::date
);
