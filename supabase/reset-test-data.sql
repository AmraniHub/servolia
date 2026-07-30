-- ============================================================================
-- SERVOLIA — RESET TEST DATA. Start from a clean slate before the first
-- real client. Generated 2026-07-30.
--
-- ⚠️  THIS DELETES ROWS AND CANNOT BE UNDONE. Read the two sections before
--     running. Take a Supabase backup first if you want a way back
--     (Supabase → Database → Backups).
--
-- What it does NOT touch:
--   • the schema itself — no table is dropped, only emptied
--   • the three bundled demo sites (demo-metay, demo-lumea, demo-bardin) —
--     those live in code (src/lib/clientSites.ts), not in the database, so
--     they keep working after this runs
--   • your admin login, env vars, Stripe, or anything outside Postgres
--   • crm_kpis — it's a VIEW, so it recomputes to zeros automatically
--
-- After running, every dashboard reads empty and every counter starts at 0.
-- ============================================================================


-- ── SECTION 1: OPERATIONAL DATA ─────────────────────────────────────────────
-- Leads, builds, clients, chats, prospects, portal accounts, analytics.
-- This is the "fresh dashboards" section — run all of it.
--
-- Order matters: children before parents, because of foreign keys.
-- TRUNCATE is used where there are no inbound FKs; DELETE where cascade
-- ordering is clearer to read.

begin;

-- Children of leads / clients / builds first
delete from lead_activities;
delete from pay_per_booking_invoices;
delete from client_reports;
delete from scope_acceptances;
delete from custom_requests;
delete from reactivation_contacts;

-- Client relationship + portal
delete from client_messages;
delete from chat_notification_prefs;
delete from client_auth;
delete from client_profiles;
delete from portal_ai_chats;      -- created by pending-migration.sql

-- Generated sites (DB rows only — bundled demos are in code and unaffected)
delete from client_sites;

-- Core pipeline
delete from builds;
delete from clients;
delete from leads;
delete from prospects;
delete from bookings;

-- AI + analytics
delete from chat_sessions;
delete from page_views;

-- Throttling counters and broadcast history — harmless to clear
delete from rate_limits;
delete from email_campaigns;

commit;


-- ── SECTION 2: CONTENT — READ BEFORE RUNNING ───────────────────────────────
-- These are NOT dashboard data. Deleting them destroys work that may be
-- earning you something. Left commented ON PURPOSE — uncomment only the
-- lines you actually mean.
--
--  • blog_posts: published articles are indexed by Google. Deleting them
--    removes live SEO pages and the backlinks pointing at them. Almost
--    certainly keep. If you only want to clear unpublished drafts, use the
--    narrower statement below instead of the full delete.
--
--  • case_studies: admin-created proof shown on /case-studies. If these are
--    test rows, clear them — but note the illustrative scenarios on that page
--    are hardcoded in the page file, not in this table.
--
--  • email_subscribers: anyone who gave you an email address. If any are
--    real people, deleting loses a list you cannot rebuild.
--
--  • linkedin_drafts: queued post drafts. Safe either way.

-- delete from blog_posts where status <> 'published';   -- drafts only (safer)
-- delete from blog_posts;                               -- ALL articles, incl. live SEO pages
-- delete from case_studies;
-- delete from email_subscribers;
-- delete from linkedin_drafts;


-- ── VERIFY ──────────────────────────────────────────────────────────────────
-- Run this after, to confirm everything reads zero.
select 'leads' as t, count(*) from leads
union all select 'builds',        count(*) from builds
union all select 'clients',       count(*) from clients
union all select 'client_sites',  count(*) from client_sites
union all select 'chat_sessions', count(*) from chat_sessions
union all select 'prospects',     count(*) from prospects
union all select 'page_views',    count(*) from page_views
union all select 'client_messages', count(*) from client_messages
order by 1;
