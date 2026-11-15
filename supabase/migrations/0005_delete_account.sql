-- MediMate 0005: let a signed-in user delete their own account (hackathon demo only).
-- Run in the Supabase SQL editor after 0004. Safe to re-run.
--
-- delete_medimate_account():
-- * deletes the caller's own profile; health logs, assistant sessions, messages
--   and reminders go with it (on delete cascade);
-- * the shared synthetic demo profile is never deleted: it is only unlinked, so
--   the demo Gmail can sign in again later and get the same demo data back;
-- * deletes the caller's Supabase Auth user (this also ends their sessions), which
--   frees one of the 5 sign-up places.
-- It only ever touches auth.uid(): a user cannot delete anyone else.
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

  update public.profiles set user_id = null, updated_at = now()
    where id = demo_id and user_id = caller;
  delete from public.profiles where user_id = caller and id <> demo_id;
  delete from auth.users where id = caller;
end;
$$;

revoke all on function public.delete_medimate_account() from public, anon;
grant execute on function public.delete_medimate_account() to authenticated;
