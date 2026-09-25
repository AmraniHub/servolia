-- Hosting setup tracker: one jsonb column on hosting_clients. (2026-09-25)
--
-- Holds what src/lib/hostingSetupRun.ts records about a hosting client's
-- setup: when their site details arrived, the founder's ticks on the hand
-- steps, the last live check (DNS, certificate, HTTP), the first time each
-- step was seen done, and the stamps that make each milestone email go out
-- ONCE (mail.dns, mail.live, owner.*). Shape: see SetupState in
-- src/lib/hostingSetup.ts.
--
-- WHAT THIS DOES TO EXISTING DATA: NOTHING BEYOND ADDING THE COLUMN.
-- No default, no backfill: every existing row reads setup = null, which the
-- code treats as "never checked". The first check of an existing client
-- records what is already true WITHOUT emailing anyone (a baseline), so a
-- client hosted for months is never told "your domain now points to us".
--
-- Until this has run, the account page still shows the checklist (computed
-- live on each visit), but nothing is stored: no milestone email is sent,
-- the cron's setup pass reports "setup column missing", and the founder's
-- ticks on /admin/hosting/<id> answer "run the SQL first".
--
-- Idempotent: safe to run twice. Run in the Supabase SQL editor.

alter table hosting_clients add column if not exists setup jsonb;

-- Check (read-only): expect every row to show setup_rows = 0 right after the
-- first run.
select count(*) filter (where setup is not null) as setup_rows, count(*) as all_rows from hosting_clients;
