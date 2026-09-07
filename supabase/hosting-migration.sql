-- ============================================================================
-- SERVOLIA — HOSTING CLIENTS, run once in the Supabase SQL editor
-- Generated 2026-09-07. Safe to run on a live database and safe to re-run:
-- every statement is `if not exists`, so nothing is dropped and no existing
-- row is touched.
--
-- WHY A SEPARATE TABLE AND NOT A `line` COLUMN ON clients
--
-- Hosting is a different business from the Servolia subscription: no
-- installation fee, no AI-conversation quota, priced in USD rather than EUR,
-- and sold to a different market. It must not appear in Servolia's plan
-- metrics.
--
-- The obvious approach — add `line` to clients and filter it out — was
-- rejected. Twenty-two places query that table and at least five of them
-- compute money: the data-room MRR tile, the revenue page, crmSnapshot(),
-- the monthly-invoice cron and the client-reports cron. Every one would need
-- an exclusion added, and a missed exclusion fails SILENTLY: MRR quietly
-- includes hosting and the number looks plausible.
--
-- A separate table needs zero edits to those queries. The only addition is one
-- branch in the Stripe webhook, and if that is wrong it fails LOUDLY — the row
-- simply is not created. Prefer the failure you can see.
-- ============================================================================

create table if not exists hosting_clients (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),

  -- who
  business      text not null,
  contact_name  text,
  email         text,

  -- what is hosted. site_root exists because a repo does not always deploy
  -- from its root: goodscochina.com deploys from web/, and the suspension
  -- gate writes files that must land where the site actually serves them.
  site_url      text,
  repo          text,                              -- e.g. AmraniHub/yiwugoodsco-com
  branch        text default 'main',
  site_root     text,                              -- e.g. 'web', null = repo root
  vercel_project text,

  -- money. USD, unlike Servolia's EUR plans — that difference is exactly why
  -- this is not sharing the clients table.
  plan            text not null default 'hosting',
  monthly_usd     numeric not null,
  billing_period  text not null default 'monthly', -- monthly | annual
  status          text not null default 'active',  -- active | past_due | suspended | churned

  -- Stripe. Same account as Servolia; separated by metadata.kind = 'hosting'.
  customer_id      text,
  subscription_id  text,

  -- dunning, mirroring the columns clients already uses so the webhook logic
  -- reads the same way in both branches
  payment_status  text not null default 'ok',      -- ok | past_due
  past_due_since  timestamptz,
  suspend_at      timestamptz,                     -- grace deadline
  open_invoice_url text,

  started_at    timestamptz default now(),
  churned_at    timestamptz,
  churn_reason  text,
  notes         text
);

create index if not exists hosting_clients_status_idx
  on hosting_clients(status);

create index if not exists hosting_clients_subscription_idx
  on hosting_clients(subscription_id)
  where subscription_id is not null;

create index if not exists hosting_clients_customer_idx
  on hosting_clients(customer_id)
  where customer_id is not null;

-- One hosting subscription per Stripe subscription. Without this a replayed
-- webhook could insert the same client twice; Stripe retries on any non-2xx.
create unique index if not exists hosting_clients_subscription_uniq
  on hosting_clients(subscription_id)
  where subscription_id is not null;
