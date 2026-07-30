-- ============================================================================
-- SERVOLIA — PENDING MIGRATION, run once in the Supabase SQL editor
-- Generated 2026-07-30. Safe to run on a live database and safe to re-run:
-- every statement is `if not exists` / `create or replace`, so nothing is
-- dropped and no existing row is touched.
--
-- Everything below is already referenced by deployed code. Until it runs the
-- app degrades quietly rather than erroring — this migration just switches
-- the affected features on.
-- ============================================================================
-- 1 ────────────────────────────────────────────────────────────────────────
-- SECURITY: cross-instance rate limiting (admin login, portal magic links).
-- One row per limiter key; the window resets when window_start ages out.
-- src/lib/security.ts falls back to per-instance memory if this table is
-- missing, so running this block just upgrades protection from "per lambda"
-- to "global".
create table if not exists rate_limits (
  key          text primary key,
  count        int not null default 0,
  window_start timestamptz not null default now()
);

-- 2 ────────────────────────────────────────────────────────────────────────
-- PAY-PER-BOOKING BILLING: aesthetic/med-spa clients only (see
-- payPerBookingEligible() in src/lib/pricing.ts) — charge per attended
-- AI-booked consultation instead of a flat Care plan. Never enable this
-- billing_mode for a dental/medical client without a French lawyer's
-- sign-off on "compérage" rules (see roadmap.ts).

-- Which clients are billed this way, and at what rate. Most clients stay
-- billing_mode = 'flat' (existing Care plan, monthly_amount as-is).
alter table clients add column if not exists billing_mode text not null default 'flat';
alter table clients add column if not exists per_booking_rate_eur numeric;
  -- Snapshot of PAY_PER_BOOKING.perBookingEur at signup, so a later price
  -- change in pricing.ts doesn't retroactively re-price an existing client.

create index if not exists clients_billing_mode_idx on clients(billing_mode);

-- Marks a booking as already billed, so the monthly cron never charges the
-- same booking twice. Set the moment it's rolled into a
-- pay_per_booking_invoices row below.
alter table chat_sessions add column if not exists billed_at timestamptz;

create index if not exists chat_sessions_site_unbilled_idx on chat_sessions(site_slug) where billed_at is null;

-- One row per client per billed period — the invoice ledger. Mirrors the
-- client_reports pattern (one row per client per period) so it's easy to
-- read in the admin CRM.
create table if not exists pay_per_booking_invoices (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),

  client_id     uuid not null references clients(id) on delete cascade,
  period        text not null,                    -- "2026-07"
  booking_count int not null,
  rate_eur      numeric not null,                  -- rate actually applied this period
  amount_eur    numeric not null,                  -- booking_count * rate_eur

  stripe_invoice_id text,                          -- Stripe Invoice id, once created
  status        text not null default 'pending',   -- pending, invoiced, paid, failed

  unique (client_id, period)
);

create index if not exists ppb_invoices_client_idx on pay_per_booking_invoices(client_id, period desc);

-- 3 ────────────────────────────────────────────────────────────────────────
-- PAYMENT DUNNING: when a Stripe subscription invoice fails, mark the client
-- past_due and give them a 14-day grace window. If they don't pay before
-- suspend_at, the site + AI receptionist go into a "suspended for non-payment"
-- state. Reset back to 'ok' when Stripe reports invoice.paid.
alter table clients add column if not exists payment_status text not null default 'ok';
  -- 'ok' | 'past_due' | 'suspended'
alter table clients add column if not exists past_due_since timestamptz;
alter table clients add column if not exists suspend_at timestamptz;      -- grace deadline
alter table clients add column if not exists suspended_at timestamptz;    -- when we actually shut the site off
alter table clients add column if not exists last_payment_failure_reason text;
alter table clients add column if not exists open_invoice_url text;        -- Stripe hosted invoice, so the portal deep-links to Pay

create index if not exists clients_payment_status_idx on clients(payment_status) where payment_status <> 'ok';

-- 4 ────────────────────────────────────────────────────────────────────────
-- PORTAL ASSISTANT TRANSCRIPTS (2026-07-30)
-- What clients ask the in-portal AI assistant. The assistant works without
-- this table — clients still get answers — but /admin/assistant has nothing
-- to read, and you lose the signal it exists for: a question asked three
-- times is a missing button, not a bad answer.
-- ============================================================================
create table if not exists portal_ai_chats (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  business text,
  messages jsonb not null default '[]',
  message_count int default 0,
  lang text default 'en',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists portal_ai_chats_email_idx on portal_ai_chats (email);
create index if not exists portal_ai_chats_updated_idx on portal_ai_chats (updated_at desc);

-- 5 ────────────────────────────────────────────────────────────────────────
-- CRM KPIS — the admin dashboard's header numbers.
-- A VIEW, not a table: every figure is derived, so it can never drift from
-- the rows it counts. Selected with .single() by /admin and /api/admin/kpis,
-- which is why it must always return exactly one row.
-- ============================================================================
create or replace view crm_kpis as
select
  (select count(*) from leads where created_at >= now() - interval '30 days')          as leads_30d,
  (select count(*) from leads where created_at >= now() - interval '7 days')           as leads_7d,
  -- Stages are: new, audit_sent, qualified, deposit_paid, live, lost.
  -- "Awaiting response" = they came in and we owe them the next move.
  (select count(*) from leads where stage in ('new', 'audit_sent'))                    as awaiting_response,
  (select count(*) from leads where stage = 'qualified')                               as qualified,
  (select count(*) from builds where status in ('intake', 'building', 'review'))       as active_builds,
  (select count(*) from clients where status = 'active')                               as live_clients,
  (select coalesce(sum(monthly_amount), 0) from clients where status = 'active')       as mrr,
  (select coalesce(sum(deposit_paid), 0) from builds
     where created_at >= now() - interval '30 days')                                   as deposits_30d;

-- ============================================================================
-- CLIENT LEAD PIPELINE (portal "My leads" statuses + private notes)
-- ============================================================================
alter table chat_sessions add column if not exists client_status text;
alter table chat_sessions add column if not exists client_note text;
