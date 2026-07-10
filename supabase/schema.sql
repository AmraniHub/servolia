-- ============================================================================
-- Servolia CRM Database Schema
-- Run this in your Supabase SQL editor: https://app.supabase.com/project/_/sql
-- ============================================================================

-- LEADS: every form submission, chatbot enquiry, every audit request
create table if not exists leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  -- Contact info
  name        text,
  email       text,
  phone       text,
  business    text,
  website     text,
  country     text,
  city        text,
  language    text default 'English',

  -- Qualification
  niche       text,                       -- dental, aesthetic, real-estate, home-services, med-spa, etc.
  problems    text[],                     -- multi-select from free-audit
  client_value text,                      -- avg revenue per client (range)
  plan_interest text,                     -- which package they mentioned

  -- Pipeline
  source      text not null default 'unknown',  -- chatbot, free-audit, contact, cold-email, referral
  stage       text not null default 'new',      -- new, audit_sent, qualified, deposit_paid, live, lost
  status      text default 'active',            -- active, archived
  value_estimate numeric default 0,             -- estimated deal size (€ or $)

  -- Activity
  last_contacted_at timestamptz,
  notes       text,

  -- Raw payload for debugging
  raw_data    jsonb
);

create index if not exists leads_stage_idx     on leads(stage);
create index if not exists leads_source_idx    on leads(source);
create index if not exists leads_created_idx   on leads(created_at desc);
create index if not exists leads_email_idx     on leads(email);


-- BUILDS: active client projects (after deposit paid)
create table if not exists builds (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  lead_id     uuid references leads(id) on delete set null,
  business    text not null,
  email       text,

  plan        text not null,            -- starter, growth, pro, landing, mobile, webapp
  plan_name   text,                     -- "Website System", "Booking System", etc.
  total_price numeric not null,
  deposit_paid numeric default 0,
  balance_due numeric default 0,

  -- Status
  status      text not null default 'intake', -- intake, building, review, delivered, live
  started_at  timestamptz,
  delivered_at timestamptz,
  live_at     timestamptz,
  deadline    timestamptz,              -- contractual delivery date

  -- Stripe references
  checkout_session_id text,
  customer_id text,

  -- Intake form snapshot
  intake_data jsonb,

  notes       text
);

create index if not exists builds_status_idx on builds(status);
create index if not exists builds_lead_idx   on builds(lead_id);


-- CLIENTS: live subscriptions (post-delivery)
create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  build_id    uuid references builds(id) on delete set null,
  business    text not null,
  email       text,

  -- Subscription
  plan        text not null,            -- care, growth, scale
  monthly_amount numeric not null,
  status      text not null default 'active',  -- active, paused, churned

  -- Stripe
  customer_id      text,
  subscription_id  text,

  -- Lifecycle
  started_at  timestamptz default now(),
  churned_at  timestamptz,
  churn_reason text,

  -- Performance baseline (for monthly reports)
  baseline_metrics jsonb,

  notes       text
);

create index if not exists clients_status_idx on clients(status);


-- CHAT SESSIONS: every chatbot conversation
create table if not exists chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  session_id  text unique,              -- browser session identifier
  lead_id     uuid references leads(id) on delete set null,

  messages    jsonb not null default '[]',
  message_count int default 0,

  -- Captured info
  visitor_business text,
  visitor_niche    text,
  visitor_intent   text,                -- audit, pricing, demo, support, unknown

  qualified   boolean default false,    -- did the conversation produce a qualified lead
  email_captured text,
  phone_captured text,

  -- Metadata
  page_url    text,
  user_agent  text,
  ip_country  text
);

create index if not exists chat_sessions_lead_idx on chat_sessions(lead_id);
create index if not exists chat_sessions_qualified_idx on chat_sessions(qualified);


-- BLOG POSTS: AI-generated articles, approved via Telegram before publishing
create table if not exists blog_posts (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  slug        text unique not null,
  status      text not null default 'draft',   -- draft, published, rejected

  title       text not null,
  excerpt     text not null,
  category    text not null,
  reading_minutes int default 6,
  meta_title  text not null,
  meta_description text not null,
  cta_headline text,
  cover_image_url text,

  body        jsonb not null default '[]',     -- Block[] — same shape as static posts.ts
  keyword_cluster text,                        -- which cluster generated this (avoids repeats)

  -- Telegram approval tracking
  telegram_chat_id text,
  telegram_message_id text,

  published_at timestamptz
);

create index if not exists blog_posts_status_idx on blog_posts(status);
create index if not exists blog_posts_slug_idx   on blog_posts(slug);


-- LINKEDIN DRAFTS: AI-generated posts, approved via Telegram before publishing/copying
create table if not exists linkedin_drafts (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),

  status      text not null default 'draft',   -- draft, posted, rejected
  topic       text not null,
  body        text not null,
  image_prompt text,
  linked_post_slug text,                       -- blog post referenced in first comment

  telegram_chat_id text,
  telegram_message_id text,

  posted_at   timestamptz
);

create index if not exists linkedin_drafts_status_idx on linkedin_drafts(status);


-- CLIENT SITES: productized live sites + AI receptionist config per client
create table if not exists client_sites (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  slug        text unique not null,       -- public url: /sites/{slug}
  build_id    uuid references builds(id) on delete set null,
  business    text not null,
  niche       text,

  config      jsonb not null,             -- the full ClientSiteConfig
  status      text not null default 'draft',  -- draft, published

  notes       text
);

create index if not exists client_sites_status_idx on client_sites(status);
create index if not exists client_sites_build_idx  on client_sites(build_id);

-- Tie chatbot conversations to a client site (patient/customer leads for that client)
alter table chat_sessions add column if not exists site_slug text;
create index if not exists chat_sessions_site_idx on chat_sessions(site_slug);


-- CLIENT MESSAGES: two-way thread between a paying client (portal) and the founder (CRM)
create table if not exists client_messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),

  email       text not null,              -- the client's login email (ties thread to them)
  build_id    uuid references builds(id) on delete set null,

  sender      text not null,              -- 'client' | 'admin'
  body        text not null,

  read_by_admin  boolean default false,
  read_by_client boolean default false
);

create index if not exists client_messages_email_idx on client_messages(email, created_at);
create index if not exists client_messages_build_idx on client_messages(build_id);


-- LEAD ACTIVITIES: timeline of every interaction with a lead
create table if not exists lead_activities (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),

  lead_id     uuid references leads(id) on delete cascade,
  type        text not null,            -- created, stage_change, note, email_sent, audit_sent, payment, message
  description text not null,
  metadata    jsonb
);

create index if not exists lead_activities_lead_idx on lead_activities(lead_id, created_at desc);


-- AUTO-UPDATE TIMESTAMPS
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_updated_at on leads;
create trigger leads_updated_at before update on leads
  for each row execute function set_updated_at();

drop trigger if exists builds_updated_at on builds;
create trigger builds_updated_at before update on builds
  for each row execute function set_updated_at();

drop trigger if exists clients_updated_at on clients;
create trigger clients_updated_at before update on clients
  for each row execute function set_updated_at();

drop trigger if exists chat_sessions_updated_at on chat_sessions;
create trigger chat_sessions_updated_at before update on chat_sessions
  for each row execute function set_updated_at();

drop trigger if exists client_sites_updated_at on client_sites;
create trigger client_sites_updated_at before update on client_sites
  for each row execute function set_updated_at();

drop trigger if exists blog_posts_updated_at on blog_posts;
create trigger blog_posts_updated_at before update on blog_posts
  for each row execute function set_updated_at();


-- AUTO-LOG ACTIVITY when stage changes
create or replace function log_stage_change() returns trigger as $$
begin
  if new.stage is distinct from old.stage then
    insert into lead_activities (lead_id, type, description, metadata)
    values (new.id, 'stage_change',
            'Stage: ' || old.stage || ' → ' || new.stage,
            jsonb_build_object('from', old.stage, 'to', new.stage));
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_log_stage on leads;
create trigger leads_log_stage after update on leads
  for each row execute function log_stage_change();


-- HELPFUL VIEWS for admin dashboard
create or replace view crm_kpis as
select
  (select count(*) from leads where created_at > now() - interval '30 days') as leads_30d,
  (select count(*) from leads where created_at > now() - interval '7 days')  as leads_7d,
  (select count(*) from leads where stage = 'audit_sent')      as awaiting_response,
  (select count(*) from leads where stage = 'qualified')       as qualified,
  (select count(*) from builds where status in ('building','review')) as active_builds,
  (select count(*) from clients where status = 'active')       as live_clients,
  (select coalesce(sum(monthly_amount), 0) from clients where status = 'active') as mrr,
  (select coalesce(sum(deposit_paid), 0) from builds where created_at > now() - interval '30 days') as deposits_30d;
