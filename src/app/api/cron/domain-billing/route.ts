import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";
import { readDomainRecord, writeDomainRecord } from "@/lib/domainSales";
import { nextChargeDate } from "@/lib/hosting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * YEARLY DOMAIN CHARGES FOR MONTHLY PLANS.
 *
 * A domain bought with a yearly plan is a second yearly item on the
 * subscription and renews by itself. A domain bought with a MONTHLY plan
 * cannot be (Stripe will not mix intervals), so its first year is a one-time
 * line at checkout and the record carries the date of the next yearly
 * charge. This job puts that charge on the client's Stripe account a week
 * before the date, as a pending invoice item that lands on the next monthly
 * invoice -- one card, one invoice, no second subscription -- then moves the
 * date a year on.
 *
 * Idempotent twice over: the marker only advances after a successful create,
 * and the Stripe call carries an idempotency key of row + date, so a rerun
 * on the same day cannot charge the year twice. Vercel renews the domain on
 * its own (auto-renew was set at purchase); this is only the money.
 *
 * Scheduled in vercel.json. Auth: Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!db || !key) return NextResponse.json({ error: "not-configured" }, { status: 503 });
  const stripe = new Stripe(key);

  const { data: rows, error } = await db
    .from("hosting_clients")
    .select("id, business, customer_id, billing_period, status, notes")
    .in("status", ["active", "past_due"])
    .eq("billing_period", "monthly")
    .like("notes", "%servolia-domain:%");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const horizon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const charged: string[] = [];
  const failed: string[] = [];

  for (const row of rows ?? []) {
    const rec = readDomainRecord(row.notes);
    if (!rec || rec.status !== "bought" || !rec.nextChargeAt || rec.nextChargeAt > horizon) continue;
    if (!row.customer_id) { failed.push(`${rec.domain}: no Stripe customer on the row`); continue; }
    try {
      await stripe.invoiceItems.create(
        {
          customer: row.customer_id,
          currency: "usd",
          amount: Math.round(rec.retailUsd * 100),
          description: `Domain ${rec.domain} — renewal, 12 months from ${rec.nextChargeAt}`,
        },
        { idempotencyKey: `domain-renewal-${row.id}-${rec.nextChargeAt}` },
      );
      const next = nextChargeDate(new Date(`${rec.nextChargeAt}T00:00:00Z`), "annual").toISOString().slice(0, 10);
      await db.from("hosting_clients")
        .update({ notes: writeDomainRecord(row.notes, { ...rec, nextChargeAt: next }) })
        .eq("id", row.id);
      charged.push(`${rec.domain} $${rec.retailUsd} (${row.business}) — next ${next}`);
    } catch (e) {
      failed.push(`${rec.domain}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (charged.length || failed.length) {
    sendTelegramMessage(
      [
        "Domain renewals (monthly plans)",
        ...charged.map((c) => `charged: ${c}`),
        ...failed.map((f) => `FAILED: ${f}`),
      ].join("\n"),
      undefined,
      { plain: true },
    ).catch(() => {});
  }
  return NextResponse.json({ charged, failed, checked: rows?.length ?? 0 });
}
