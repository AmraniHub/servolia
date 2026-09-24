-- Founder test mode: the is_test tag. (2026-09-24)
--
-- The live site accepts Stripe TEST-mode purchases from the admin's own
-- browser (src/lib/testMode.ts). Every row such a purchase writes is tagged
-- is_test = true and kept out of every number, alert and cron.
--
-- WHAT THIS DOES TO EXISTING DATA: NOTHING BEYOND ADDING THE COLUMN.
-- No update, no delete, no backfill. `default false` means every row that
-- already exists reads is_test = false — a real row, counted exactly as it
-- is today. The code excludes test rows with `is_test is not true`, which
-- keeps false AND null rows, so no existing row can ever drop out.
--
-- Until this has run, the Stripe webhook REFUSES every test event (nothing
-- written, a Telegram "TEST MODE: run supabase/2026-09-24-test-mode.sql
-- first"), and every query runs without the filter, exactly as before.
--
-- Idempotent: safe to run twice. Run in the Supabase SQL editor.

-- 1. The tag, on every table a purchase writes a row into.
alter table clients         add column if not exists is_test boolean not null default false;
alter table builds          add column if not exists is_test boolean not null default false;
alter table hosting_clients add column if not exists is_test boolean not null default false;
alter table leads           add column if not exists is_test boolean not null default false;

-- 2. The dashboard header numbers (/admin, /api/admin/kpis) without test rows.
--    A VIEW DEFINITION, not a data change: it touches no row. Identical to
--    the live definition (supabase/pending-migration.sql §5, schema.sql)
--    except for the added `is_test is not true` on each subquery. Must stay
--    after step 1: the view names the column.
create or replace view crm_kpis as
select
  (select count(*) from leads where created_at >= now() - interval '30 days' and is_test is not true)   as leads_30d,
  (select count(*) from leads where created_at >= now() - interval '7 days' and is_test is not true)    as leads_7d,
  -- Stages are: new, audit_sent, qualified, deposit_paid, live, lost.
  -- "Awaiting response" = they came in and we owe them the next move.
  (select count(*) from leads where stage in ('new', 'audit_sent') and is_test is not true)             as awaiting_response,
  (select count(*) from leads where stage = 'qualified' and is_test is not true)                        as qualified,
  (select count(*) from builds where status in ('intake', 'building', 'review') and is_test is not true) as active_builds,
  (select count(*) from clients where status = 'active' and is_test is not true)                        as live_clients,
  (select coalesce(sum(monthly_amount), 0) from clients where status = 'active' and is_test is not true) as mrr,
  (select coalesce(sum(deposit_paid), 0) from builds
     where created_at >= now() - interval '30 days' and is_test is not true)                            as deposits_30d;

-- 3. Check (read-only): how many test rows exist. Expect all zeros right after
--    the first run.
select 'clients' as t, count(*) filter (where is_test) as test_rows, count(*) as all_rows from clients
union all select 'builds', count(*) filter (where is_test), count(*) from builds
union all select 'hosting_clients', count(*) filter (where is_test), count(*) from hosting_clients
union all select 'leads', count(*) filter (where is_test), count(*) from leads;
