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


-- EMAIL SUBSCRIBERS: explicit permission for Servolia marketing campaigns.
-- Keep this separate from CRM leads: an enquiry is not automatic marketing consent.
create table if not exists email_subscribers (
  email           text primary key,
  created_at      timestamptz default now(),
  consented_at    timestamptz not null default now(),
  unsubscribed_at timestamptz,
  source          text not null default 'footer',
  language        text not null default 'en',
  status          text not null default 'active'
);

create index if not exists email_subscribers_status_idx on email_subscribers(status, created_at desc);


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

-- Soft delete, per side. Deleting a chat only clears it from that person's own
-- view (WhatsApp-style) — the row stays in the DB so the admin can restore it
-- for themselves and/or the client from the Trash view. Never hard-deleted.
alter table client_messages add column if not exists deleted_by_admin_at timestamptz;
alter table client_messages add column if not exists deleted_by_client_at timestamptz;

-- Image attachments (Supabase Storage URL — see src/lib/chatAttachments.ts for
-- the magic-byte validation applied before anything is ever uploaded).
alter table client_messages add column if not exists attachment_url text;
alter table client_messages add column if not exists attachment_type text;

-- Per-client Telegram mute — a chatty client's back-and-forth shouldn't page
-- the founder's phone for every message. Muting is per email, admin-controlled,
-- and only affects the Telegram ping — the message still lands in the CRM.
create table if not exists chat_notification_prefs (
  email          text primary key,
  telegram_muted boolean default false,
  updated_at     timestamptz default now()
);

-- SCOPE ACCEPTANCES: the self-built "electronic signature" for a client's
-- scope document (see src/app/scope/[token]/page.tsx). A simple electronic
-- signature (clickwrap: typed name + logged IP/timestamp), not a notarized
-- one — appropriate for fixed-price builds in the hundreds of euros, not a
-- replacement for a real e-signature vendor if Servolia ever needs one for
-- larger contracts. scope_text is frozen at link-creation time so a later
-- pricing change never rewrites a document someone already agreed to.
create table if not exists scope_acceptances (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),

  lead_id      uuid references leads(id) on delete cascade,
  token        text not null unique,

  business_name text not null,
  contact_name  text,
  email         text,
  plan_key      text not null,
  care_plan_key text,
  scope_text    text not null,

  accepted_at        timestamptz,
  accepted_name      text,
  accepted_ip        text,
  accepted_user_agent text
);

create index if not exists scope_acceptances_lead_idx on scope_acceptances(lead_id);
create index if not exists scope_acceptances_token_idx on scope_acceptances(token);


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


-- REACTIVATION CONTACTS: a client's dormant patients/customers, imported via CSV.
-- campaign = 'reactivation' (win-back) or 'review' (Google review request).
create table if not exists reactivation_contacts (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  site_slug   text not null,             -- which client this contact belongs to
  campaign    text not null default 'reactivation',  -- reactivation | review

  name        text,
  phone       text,                      -- digits, international
  email       text,
  last_visit  text,                      -- free text from CSV ("2024-11", "March 2025")
  treatment   text,                      -- last treatment / service

  status      text not null default 'pending',  -- pending, contacted, replied, booked, opted_out
  contacted_at timestamptz,
  booked_value numeric default 0,        -- € booked from this contact (filled when status=booked)
  notes       text
);

create index if not exists reactivation_site_idx   on reactivation_contacts(site_slug, campaign);
create index if not exists reactivation_status_idx on reactivation_contacts(status);

drop trigger if exists reactivation_updated_at on reactivation_contacts;
create trigger reactivation_updated_at before update on reactivation_contacts
  for each row execute function set_updated_at();


-- CLIENT REPORTS: monthly ROI snapshots emailed to each client
create table if not exists client_reports (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),

  site_slug   text not null,
  period      text not null,             -- '2026-06' (year-month)
  metrics     jsonb not null,            -- enquiries, bookings, after_hours, est_value, from_ads...
  emailed_to  text,
  sent_at     timestamptz,

  unique (site_slug, period)
);

create index if not exists client_reports_site_idx on client_reports(site_slug, period);


-- Ad attribution on chatbot conversations (utm params captured from the landing URL)
alter table chat_sessions add column if not exists utm jsonb;


-- BOOKINGS: discovery / demo calls booked by prospects from /call
create table if not exists bookings (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  name        text not null,
  email       text not null,
  phone       text,
  business    text,
  city        text,
  message     text,

  slot_start  timestamptz not null,     -- the chosen 30-min slot (Europe/Paris)
  status      text not null default 'confirmed',  -- confirmed, completed, no_show, cancelled
  source      text default 'website',   -- website, demo, prospect
  lead_id     uuid references leads(id) on delete set null,
  notes       text
);

create index if not exists bookings_slot_idx   on bookings(slot_start);
create index if not exists bookings_status_idx on bookings(status);

drop trigger if exists bookings_updated_at on bookings;
create trigger bookings_updated_at before update on bookings
  for each row execute function set_updated_at();


-- PROSPECTS: cold outbound targets (dental clinics) + mystery-shop pipeline
create table if not exists prospects (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  business    text not null,
  owner_name  text,
  city        text,
  niche       text default 'dental',
  phone       text,
  email       text,
  instagram   text,
  website     text,

  -- Pipeline: to_contact → mystery_shopped → demo_sent → followup_1
  --           → followup_2 → replied → call_booked → won / lost
  status      text not null default 'to_contact',
  demo_slug   text,                     -- links to a generated /sites/demo-... site
  mystery_shop_notes text,              -- what happened when you DM'd/called them
  last_touch_at timestamptz,
  touch_count int default 0,
  next_action_at date,                  -- when to follow up next
  value_estimate numeric default 0,
  notes       text
);

create index if not exists prospects_status_idx on prospects(status);
create index if not exists prospects_city_idx   on prospects(city);
create index if not exists prospects_next_idx   on prospects(next_action_at);

drop trigger if exists prospects_updated_at on prospects;
create trigger prospects_updated_at before update on prospects
  for each row execute function set_updated_at();


-- CASE STUDIES: real client results, shown on /case-studies
create table if not exists case_studies (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  slug        text unique not null,
  published   boolean default false,
  featured    boolean default false,
  sort        int default 0,

  business    text not null,
  niche       text,
  city        text,
  logo_url    text,
  accent      text default '#36671E',

  headline    text not null,            -- "How Cabinet X filled 40 chairs in 60 days"
  summary     text,                     -- one-liner under the headline
  challenge   text,                     -- the before
  solution    text,                     -- what Servolia did
  metrics     jsonb default '[]',       -- [{label, value}] e.g. {"label":"Booked consultations","value":"+38/mo"}
  quote       text,
  quote_author text,                    -- "Dr. Marie Dupont, Owner"

  plan        text                      -- which Servolia plan they're on
);

create index if not exists case_studies_pub_idx on case_studies(published, sort);


-- CLIENT AUTH: optional password login for the portal (magic-link still works).
-- Passwords are bcrypt-hashed; the plaintext is never stored.
create table if not exists client_auth (
  email         text primary key,
  password_hash text not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

drop trigger if exists client_auth_updated_at on client_auth;
create trigger client_auth_updated_at before update on client_auth
  for each row execute function set_updated_at();


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


-- CUSTOM REQUESTS: personalized/extra work a client asks for beyond their plan.
-- Records both the ask (data) and the one-off payment for it.
create table if not exists custom_requests (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),

  build_id    uuid references builds(id) on delete cascade,
  email       text,                       -- who to bill (snapshot of build.email)

  title       text not null,              -- "Add a second language", "Custom booking rules"
  description text,                       -- the full ask, in the client's words
  amount_eur  numeric not null default 0, -- one-off price quoted for this work

  status      text not null default 'quoted', -- quoted, paid, done
  checkout_session_id text,
  payment_url text,                       -- Stripe link to send the client
  paid_at     timestamptz,
  done_at     timestamptz
);

create index if not exists custom_requests_build_idx on custom_requests(build_id);
create index if not exists custom_requests_status_idx on custom_requests(status);


-- EMAIL CAMPAIGNS: record of every broadcast sent from the admin.
create table if not exists email_campaigns (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),

  subject     text not null,
  body_html   text not null,
  audience    text not null,              -- subscribers, leads
  sent_count  int default 0,
  failed_count int default 0,
  skipped_count int default 0             -- unsubscribed / no email
);

create index if not exists email_campaigns_created_idx on email_campaigns(created_at desc);
