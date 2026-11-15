-- MediMate 0004: optional free-text location on the profile (hackathon demo only).
-- Run in the Supabase SQL editor after 0003. Safe to re-run.
-- Entered by the user during onboarding or on the Profile page. It is shown on
-- the profile and health summary only and is never sent to the AI model.
alter table public.profiles
  add column if not exists location text check (location is null or char_length(location) <= 100);
