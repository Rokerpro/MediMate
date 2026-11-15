-- MediMate 0006: medicine-reminder notifications (hackathon demo only).
-- Run in the Supabase SQL editor after 0005. Safe to re-run.
--
-- How it works:
-- * Every minute, pg_cron runs medimate_dispatch_reminders(). For each active
--   *medication* reminder that has just become due it creates a dose row.
-- * A dose is notified up to 3 times, 5 minutes apart, until the user confirms
--   they took it. 5 minutes after the 3rd notification it becomes 'missed'.
-- * A pending or missed dose can be confirmed up to 1 hour after it was due.
-- * The database does not send anything itself: it posts the due notifications
--   (title, notes, push subscriptions, email address) to MediMate's
--   /api/notifications/dispatch route with a shared secret. That route sends a
--   web push to each subscribed device, or an email when no device is
--   subscribed or every push failed. No Supabase admin key is used anywhere.
-- MediMate only repeats the user's own wording. It never generates, suggests or
-- checks medicines, timing or doses.
--
-- One-time setup (values are NOT committed to the repo):
--   insert into public.medimate_settings (key, value) values
--     ('reminder_dispatch_url', 'https://<your-app>/api/notifications/dispatch'),
--     ('reminder_dispatch_secret', '<same value as REMINDER_DISPATCH_SECRET on Vercel>')
--   on conflict (key) do update set value = excluded.value;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- 1. Devices that agreed to receive push notifications (Web Push subscriptions).
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique
    check (char_length(endpoint) <= 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

-- Users can see and remove their own devices. Adding goes through
-- save_push_subscription() so a browser that switches accounts moves cleanly.
drop policy if exists "own push subscriptions read" on public.push_subscriptions;
create policy "own push subscriptions read"
  on public.push_subscriptions for select to authenticated
  using (public.is_medimate_demo_profile(profile_id));

drop policy if exists "own push subscriptions delete" on public.push_subscriptions;
create policy "own push subscriptions delete"
  on public.push_subscriptions for delete to authenticated
  using (public.is_medimate_demo_profile(profile_id));

-- 2. One row per due occurrence of a medication reminder.
create table if not exists public.reminder_doses (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'taken', 'missed')),
  notify_count smallint not null default 0 check (notify_count between 0 and 3),
  last_notified_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reminder_id, due_at)
);

create index if not exists reminder_doses_profile_due_idx on public.reminder_doses (profile_id, due_at desc);
create index if not exists reminder_doses_pending_idx on public.reminder_doses (status, due_at) where status = 'pending';

alter table public.reminder_doses enable row level security;

-- Read-only for users; confirming goes through confirm_reminder_dose().
drop policy if exists "own reminder doses read" on public.reminder_doses;
create policy "own reminder doses read"
  on public.reminder_doses for select to authenticated
  using (public.is_medimate_demo_profile(profile_id));

-- 3. Save the caller's device (max 5 per user; the oldest is dropped).
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  caller_profile uuid;
begin
  select id into caller_profile from public.profiles where user_id = auth.uid() limit 1;
  if auth.uid() is null or caller_profile is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth)
    values (caller_profile, p_endpoint, p_p256dh, p_auth);
  delete from public.push_subscriptions
    where id in (
      select id from public.push_subscriptions
      where profile_id = caller_profile
      order by created_at desc
      offset 5
    );
end;
$$;

revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- 4. Confirm a dose as taken: only the owner, only while pending or missed,
--    and only until 1 hour after it was due. Returns the updated row id, or
--    raises P0002 (not found) / P0001 'confirm window closed'.
create or replace function public.confirm_reminder_dose(p_dose_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  dose public.reminder_doses%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select * into dose from public.reminder_doses
    where id = p_dose_id and public.is_medimate_demo_profile(profile_id)
    for update;
  if not found then
    raise exception 'dose not found' using errcode = 'P0002';
  end if;
  if dose.status = 'taken' then
    return dose.id;
  end if;
  if now() > dose.due_at + interval '1 hour' then
    raise exception 'confirm window closed' using errcode = 'P0001';
  end if;

  update public.reminder_doses
    set status = 'taken', confirmed_at = now()
    where id = dose.id;
  return dose.id;
end;
$$;

revoke all on function public.confirm_reminder_dose(uuid) from public, anon;
grant execute on function public.confirm_reminder_dose(uuid) to authenticated;

-- 5. Called by the dispatch route to remove devices the push service says are gone.
create or replace function public.prune_push_subscriptions(p_secret text, p_endpoints text[])
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  expected text;
  removed integer;
begin
  select value into expected from public.medimate_settings where key = 'reminder_dispatch_secret';
  if expected is null or char_length(expected) < 32 or p_secret is distinct from expected then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = any(p_endpoints);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.prune_push_subscriptions(text, text[]) from public;
grant execute on function public.prune_push_subscriptions(text, text[]) to anon, authenticated;

-- 6. The every-minute job. Not callable through the API.
create or replace function public.medimate_dispatch_reminders()
returns integer
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  dispatch_url text;
  dispatch_secret text;
  payload jsonb;
begin
  select value into dispatch_url from public.medimate_settings where key = 'reminder_dispatch_url';
  select value into dispatch_secret from public.medimate_settings where key = 'reminder_dispatch_secret';
  if dispatch_url is null or dispatch_secret is null then
    return 0;
  end if;

  -- a) Create a dose for each medication reminder occurrence that became due in
  --    the last 10 minutes (older occurrences are never back-filled).
  insert into public.reminder_doses (reminder_id, profile_id, due_at)
  select r.id, r.profile_id, occurrence.due_at
  from public.reminders r
  cross join lateral (
    select case r.repeat
      when 'daily' then r.remind_at
        + floor(extract(epoch from now() - r.remind_at) / 86400) * interval '1 day'
      when 'weekly' then r.remind_at
        + floor(extract(epoch from now() - r.remind_at) / 604800) * interval '7 days'
      else r.remind_at
    end as due_at
  ) occurrence
  where r.active
    and r.category = 'medication'
    and r.remind_at <= now()
    and occurrence.due_at <= now()
    and occurrence.due_at > now() - interval '10 minutes'
  on conflict (reminder_id, due_at) do nothing;

  -- b) 5 minutes after the 3rd notification, an unconfirmed dose is missed.
  update public.reminder_doses
    set status = 'missed'
    where status = 'pending'
      and notify_count >= 3
      and last_notified_at <= now() - interval '4 minutes 30 seconds';

  -- c) Claim the doses to notify now: first notification, or 5 minutes after the last.
  with due as (
    update public.reminder_doses d
      set notify_count = d.notify_count + 1, last_notified_at = now()
      where d.status = 'pending'
        and d.notify_count < 3
        and d.due_at <= now()
        and (d.last_notified_at is null or d.last_notified_at <= now() - interval '4 minutes 30 seconds')
        and exists (select 1 from public.reminders r where r.id = d.reminder_id and r.active)
      returning d.id, d.reminder_id, d.profile_id, d.due_at, d.notify_count
  )
  select jsonb_agg(jsonb_build_object(
      'doseId', due.id,
      'title', r.title,
      'notes', r.notes,
      'dueAt', to_char(due.due_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'attempt', due.notify_count,
      'email', u.email,
      'subscriptions', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from public.push_subscriptions s where s.profile_id = due.profile_id
      ), '[]'::jsonb)
    ))
    into payload
  from due
  join public.reminders r on r.id = due.reminder_id
  join public.profiles p on p.id = due.profile_id
  left join auth.users u on u.id = p.user_id;

  if payload is null then
    return 0;
  end if;

  perform net.http_post(
    url := dispatch_url,
    body := jsonb_build_object('notifications', payload),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || dispatch_secret
    ),
    timeout_milliseconds := 20000
  );
  return jsonb_array_length(payload);
end;
$$;

revoke all on function public.medimate_dispatch_reminders() from public, anon, authenticated;

-- 7. Run it every minute (re-running this file updates the same job).
select cron.schedule('medimate-reminder-notifications', '* * * * *', 'select public.medimate_dispatch_reminders()');

-- 8. Account deletion: also forget the devices linked to the shared demo
--    profile, which is unlinked rather than deleted (other rows cascade).
create or replace function public.delete_medimate_account()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  demo_id constant uuid := '00000000-0000-4000-8000-000000000001';
begin
  if caller is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if exists (select 1 from public.profiles where id = demo_id and user_id = caller) then
    delete from public.push_subscriptions where profile_id = demo_id;
  end if;
  update public.profiles set user_id = null, updated_at = now()
    where id = demo_id and user_id = caller;
  delete from public.profiles where user_id = caller and id <> demo_id;
  delete from auth.users where id = caller;
end;
$$;

revoke all on function public.delete_medimate_account() from public, anon;
grant execute on function public.delete_medimate_account() to authenticated;
