-- ============================================================================
-- PURGE TEST-CHECKOUT ROWS. Run once in the Supabase SQL editor.
-- Generated 2026-08-13.
--
-- WHY THESE EXIST: /api/checkout used to create a "qualified" lead AND an
-- in-delivery build the moment someone CLICKED the pay button — before any
-- payment. So every test click, and every real visitor who changed their mind,
-- left a phantom lead at full first-year value and a phantom build sitting in
-- delivery. That is why the header read "2 IN DELIVERY" with no clients.
--
-- FIXED IN CODE (2026-08-13): /api/checkout now writes nothing; the lead and
-- build are created by the Stripe webhook when money actually moves, and
-- test-mode events (event.livemode = false) never touch the CRM at all. This
-- file only cleans up what the old behaviour already left behind.
--
-- ⚠️ DELETES ROWS. Read the SELECT first — it shows exactly what will go.
-- ============================================================================

-- ── 1. LOOK FIRST. Run this alone and check the list before deleting. ──────
select b.id, b.business, b.plan_name, b.status, b.deposit_paid, b.created_at
from builds b
where coalesce(b.deposit_paid, 0) = 0        -- nobody ever paid
  and b.status = 'intake'                    -- never progressed
  and b.intake_data is null                  -- no intake was ever submitted
order by b.created_at desc;

select l.id, l.business, l.source, l.stage, l.value_estimate, l.created_at
from leads l
where l.source = 'direct-purchase'
  and l.email is null                        -- a real buyer always has an email
  and not exists (                           -- and never actually paid
    select 1 from builds b
    where b.lead_id = l.id and coalesce(b.deposit_paid, 0) > 0
  )
order by l.created_at desc;


-- ── 2. DELETE. Uncomment the block below once the lists above look right. ──
-- Children first, then parents.

-- begin;
--
-- delete from lead_activities
--  where lead_id in (
--    select l.id from leads l
--     where l.source = 'direct-purchase'
--       and l.email is null
--       and not exists (
--         select 1 from builds b
--          where b.lead_id = l.id and coalesce(b.deposit_paid, 0) > 0
--       )
--  );
--
-- delete from builds
--  where coalesce(deposit_paid, 0) = 0
--    and status = 'intake'
--    and intake_data is null;
--
-- delete from leads l
--  where l.source = 'direct-purchase'
--    and l.email is null
--    and not exists (
--      select 1 from builds b
--       where b.lead_id = l.id and coalesce(b.deposit_paid, 0) > 0
--    );
--
-- commit;


-- ── 3. VERIFY ──────────────────────────────────────────────────────────────
-- select 'leads' as t, count(*) from leads
-- union all select 'builds', count(*) from builds
-- union all select 'clients', count(*) from clients;

-- NOTE: if you also want a completely clean slate (chats, prospects,
-- analytics, portal accounts), use supabase/reset-test-data.sql instead —
-- this file is the surgical version that only removes unpaid checkout debris.
