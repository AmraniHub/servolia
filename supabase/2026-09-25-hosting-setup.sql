-- Hosting setup tracker + an atomic rate limit. (2026-09-25)
-- Run once in the Supabase SQL editor. Idempotent: safe to run twice.
--
-- WHAT THIS DOES TO EXISTING DATA: NOTHING.
-- 1. Adds one nullable column. No default, no backfill, no update: every
--    existing row reads setup = null. Clients whose row was created before
--    2026-09-25 are ESTABLISHED (SETUP_TRACKER_SINCE in src/lib/hostingSetup.ts):
--    the code never writes this column for them, never emails them about
--    setup, and shows them no checklist.
-- 2. Adds one function. It writes only to rate_limits (the table the admin
--    login limiter already uses), and only when called.
--
-- Until this has run: the checklist still shows for new clients (measured on
-- each visit) but nothing is stored and no setup email is sent; the founder's
-- ticks answer "run the SQL first"; the cron Telegrams once a day; and
-- "Email me my link" on /hosting/account REFUSES every request, because its
-- limiter fails closed without the function.

-- 1. The tracker's state for a hosting client created on or after the
--    cutover: details received, the founder's ticks, the last live check, and
--    the once-only stamps for each milestone email. Shape: SetupState in
--    src/lib/hostingSetup.ts.
alter table hosting_clients add column if not exists setup jsonb;

-- 2. Needed by the function below; already present if the admin security SQL
--    (supabase/schema.sql, security block) has run. Creates nothing otherwise.
create table if not exists rate_limits (
  key          text primary key,
  count        int not null default 0,
  window_start timestamptz not null default now()
);

-- Row level security ON, with NO policies: the public anon key can neither
-- read nor write the limiter's counters. The server is unaffected — every
-- reader and writer of this table (src/lib/security.ts rateLimited, used by
-- the admin login, and the function below) uses the service-role client,
-- which bypasses RLS. Enabling it twice is a no-op.
alter table rate_limits enable row level security;

-- 3. Count one hit on `p_key` and return the new count, in ONE statement, so
--    parallel requests each get their own number (src/lib/atomicLimit.ts).
--    A window older than p_window_seconds starts again at 1.
create or replace function servolia_rate_hit(p_key text, p_window_seconds int)
returns int
language sql
security invoker
set search_path = public
as $$
  insert into rate_limits as r (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    count = case
      when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else r.count + 1
    end,
    window_start = case
      when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else r.window_start
    end
  returning r.count;
$$;

-- Only the server (service role) may call it; not the public anon key.
revoke all on function servolia_rate_hit(text, int) from public;
revoke all on function servolia_rate_hit(text, int) from anon, authenticated;
grant execute on function servolia_rate_hit(text, int) to service_role;

-- 4. Check (read-only). Expect setup_rows = 0 right after the first run.
select count(*) filter (where setup is not null) as setup_rows, count(*) as all_rows from hosting_clients;
