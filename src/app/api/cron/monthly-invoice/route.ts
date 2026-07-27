import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";
import { PAY_PER_BOOKING } from "@/lib/pricing";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Pay-per-booking monthly invoicing — runs on the 1st, bills the previous
 * month. Mirrors /api/cron/monthly-report's shape, but invoices instead of
 * reporting.
 *
 * For each active clients row with billing_mode 'per_booking':
 *   1. Find their site slugs (clients.build_id → client_sites.build_id).
 *   2. Count unbilled qualified bookings up to the end of the previous month
 *      (qualified=true, billed_at null — includes stragglers from earlier).
 *   3. Write ONE pay_per_booking_invoices ledger row per client per period
 *      and stamp those chat_sessions billed_at (never double-charged).
 *   4. If the client has a Stripe customer_id: create a real Stripe invoice
 *      (send_invoice, 7 days to pay — Stripe emails it and charges the saved
 *      card automatically if one exists). Ledger row → 'invoiced'.
 *      No customer_id → row stays 'pending' and Telegram flags it for manual
 *      follow-up.
 *
 * ATTENDANCE: "attended" can't be detected automatically. We bill captured
 * qualified bookings; the founder voids/adjusts line items in the Stripe
 * dashboard for no-shows before the 7-day due date. The Telegram summary is
 * the review prompt for that.
 */

interface PpbClient {
  id: string;
  business: string;
  email: string | null;
  build_id: string | null;
  customer_id: string | null;
  per_booking_rate_eur: number | null;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, reason: "DB not configured" });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const stripe = stripeKey ? new Stripe(stripeKey) : null;

  // Previous calendar month.
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const period = monthStart.toISOString().slice(0, 7); // "2026-06"

  const { data: clientRows, error: clientsErr } = await db.from("clients")
    .select("id, business, email, build_id, customer_id, per_booking_rate_eur")
    .eq("billing_mode", "per_booking")
    .eq("status", "active");
  if (clientsErr) {
    // Most likely the schema block hasn't been run yet — report, don't crash.
    return NextResponse.json({ ok: false, reason: clientsErr.message });
  }

  const results: { client: string; bookings: number; amount: number; invoiced: boolean }[] = [];

  for (const c of (clientRows ?? []) as PpbClient[]) {
    if (!c.build_id) continue;

    const { data: sites } = await db.from("client_sites").select("slug").eq("build_id", c.build_id);
    const slugs = ((sites ?? []) as { slug: string }[]).map((s) => s.slug);
    if (!slugs.length) continue;

    // Unbilled qualified bookings up to the end of the billed month.
    const { data: sessions } = await db.from("chat_sessions")
      .select("id")
      .in("site_slug", slugs)
      .eq("qualified", true)
      .is("billed_at", null)
      .lt("created_at", monthEnd.toISOString());
    const ids = ((sessions ?? []) as { id: string }[]).map((s) => s.id);
    if (!ids.length) continue;

    const rate = Number(c.per_booking_rate_eur) || PAY_PER_BOOKING.perBookingEur;
    const amount = ids.length * rate;

    // One ledger row per client per period — unique(client_id, period) makes
    // a re-run of the cron a no-op instead of a double charge.
    const { data: ledger, error: ledgerErr } = await db.from("pay_per_booking_invoices")
      .insert({ client_id: c.id, period, booking_count: ids.length, rate_eur: rate, amount_eur: amount })
      .select("id").single();
    if (ledgerErr) {
      console.error(`PPB ledger insert failed for ${c.business} (already billed ${period}?):`, ledgerErr.message);
      continue;
    }

    await db.from("chat_sessions").update({ billed_at: new Date().toISOString() }).in("id", ids);

    // Create the actual Stripe invoice when we can.
    let invoiced = false;
    if (stripe && c.customer_id) {
      try {
        await stripe.invoiceItems.create({
          customer: c.customer_id,
          amount: Math.round(amount * 100),
          currency: "eur",
          description: `Servolia — ${ids.length} consultation${ids.length > 1 ? "s" : ""} réservée${ids.length > 1 ? "s" : ""} par l'IA (${period}) × ${rate} €`,
        });
        const inv = await stripe.invoices.create({
          customer: c.customer_id,
          collection_method: "send_invoice",
          days_until_due: 7,
          auto_advance: true,
        });
        if (inv.id) {
          await stripe.invoices.finalizeInvoice(inv.id);
          await stripe.invoices.sendInvoice(inv.id);
        }
        await db.from("pay_per_booking_invoices")
          .update({ stripe_invoice_id: inv.id, status: "invoiced" })
          .eq("id", ledger!.id);
        invoiced = true;
      } catch (err) {
        console.error(`Stripe invoice failed for ${c.business}:`, err);
        await db.from("pay_per_booking_invoices").update({ status: "failed" }).eq("id", ledger!.id);
      }
    }

    results.push({ client: c.business, bookings: ids.length, amount, invoiced });
  }

  if (results.length) {
    const lines = results.map((r) =>
      `• ${r.client}: ${r.bookings} × booking = €${r.amount.toLocaleString()} ${r.invoiced ? "→ invoiced ✅" : "→ PENDING (no Stripe customer) ⚠️"}`);
    await sendTelegramMessage(
      `🧾 *Pay-per-booking invoices — ${period}*\n${lines.join("\n")}\n\n` +
      `Review for no-shows and void/adjust in the Stripe dashboard within 7 days.`
    );
  }

  return NextResponse.json({ ok: true, period, invoiced: results });
}
