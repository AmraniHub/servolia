-- Phase D (2026-09-23): drop pay_per_booking_invoices.
--
-- Pay-per-booking was retired on 2026-08-13 (one model: installation + a
-- monthly plan). No code reads or writes this table any more; it only kept
-- the schema describing a billing model we no longer sell.
--
-- Guarded: if the table holds ANY row, this stops with an error and drops
-- nothing, so a real invoice can never be lost by running it. Run it in the
-- Supabase SQL editor. Safe to run twice.
--
-- Kept on purpose: clients.billing_mode, clients.per_booking_rate_eur and
-- chat_sessions.billed_at (columns, not a table; removing them is part of
-- the later client-table merge, D1).

do $$
begin
  if to_regclass('public.pay_per_booking_invoices') is null then
    raise notice 'pay_per_booking_invoices is already gone - nothing to do';
    return;
  end if;
  if exists (select 1 from pay_per_booking_invoices limit 1) then
    raise exception 'pay_per_booking_invoices has rows - NOT dropped. Export them first.';
  end if;
  drop table pay_per_booking_invoices;
  raise notice 'pay_per_booking_invoices dropped (it was empty)';
end $$;
