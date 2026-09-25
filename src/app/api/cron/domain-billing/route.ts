import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { excludeTest } from "@/lib/testContext";
import { sendTelegramMessage } from "@/lib/telegram";
import {
  readDomainRecord, writeDomainRecord, currentRenewalUsd, netProfitUsd, renewalRetailUsd, DOMAIN_TARGET_PROFIT_USD,
} from "@/lib/domainSales";
import { runDomainOrderRenewals } from "@/lib/domainOrders";
import { sendEmail, domainRenewalEmail } from "@/lib/email";
import { langFor, refKeyForEmail } from "@/lib/clientRefs";
import { readExtraDomains, writeExtraDomain } from "@/lib/extraDomains";
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

  // `is_test is not true` on all three reads: a founder test row is never
  // charged, renewed or margin-watched (src/lib/testContext.ts).
  const { data: rows, error } = await excludeTest(db, (live) => live(db
    .from("hosting_clients")
    .select("id, business, email, customer_id, billing_period, status, notes")
    .in("status", ["active", "past_due"])
    .eq("billing_period", "monthly")
    .like("notes", "%servolia-domain:%")));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const horizon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const charged: string[] = [];
  const failed: string[] = [];
  /* The client hears about the renewal the day it goes on their account. It
     is an invoice item, so the money moves on the NEXT monthly invoice, days
     or weeks later: this email is the notice before the charge, and it names
     the rise when there is one. Awaited at the end, not fire-and-forget: a
     serverless function can be frozen the moment it returns. */
  const mails: Promise<unknown>[] = [];
  function tellClient(email: string | null, domain: string, price: number, previous: number, fromIso: string) {
    if (!email) return;
    const tpl = domainRenewalEmail({
      domain, stage: "invoice", priceUsd: price, previousUsd: previous, onIso: fromIso,
      lang: langFor(refKeyForEmail(email)),
    });
    mails.push(sendEmail(email, tpl.subject, tpl.html).catch(() => false));
  }

  for (const row of rows ?? []) {
    const rec = readDomainRecord(row.notes);
    if (!rec || rec.status !== "bought" || !rec.nextChargeAt || rec.nextChargeAt > horizon) continue;
    if (!row.customer_id) { failed.push(`${rec.domain}: no Stripe customer on the row`); continue; }
    // Repriced from Vercel's renewal price today, never below last year's.
    const price = renewalRetailUsd(rec.retailUsd, await currentRenewalUsd(rec.domain));
    try {
      await stripe.invoiceItems.create(
        {
          customer: row.customer_id,
          currency: "usd",
          amount: Math.round(price * 100),
          description: `Domain ${rec.domain} — renewal, 12 months from ${rec.nextChargeAt}`,
        },
        { idempotencyKey: `domain-renewal-${row.id}-${rec.nextChargeAt}` },
      );
      const next = nextChargeDate(new Date(`${rec.nextChargeAt}T00:00:00Z`), "annual").toISOString().slice(0, 10);
      await db.from("hosting_clients")
        .update({ notes: writeDomainRecord(row.notes, { ...rec, retailUsd: price, nextChargeAt: next }) })
        .eq("id", row.id);
      charged.push(`${rec.domain} $${price.toFixed(2)}${price > rec.retailUsd ? ` (was $${rec.retailUsd})` : ""} (${row.business}) — next ${next}`);
      tellClient(row.email, rec.domain, price, rec.retailUsd, rec.nextChargeAt);
    } catch (e) {
      failed.push(`${rec.domain}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /* DOMAINS BOUGHT FROM THE PANEL, AFTER THE PLAN.
   *
   * A different query because they are a different thing. The plan's domain
   * belongs to the plan — on an annual subscription it renews with it, which
   * is why the pass above only looks at monthly clients. An add-on bought in
   * March belongs to nobody's cycle: it carries its own date and is charged on
   * it whatever the plan does, so this pass ignores billing_period entirely.
   *
   * Without this the client pays once, keeps the domain, and we renew it at
   * our own cost every year afterwards. */
  const { data: addonRows } = await excludeTest(db, (live) => live(db
    .from("hosting_clients")
    .select("id, business, email, customer_id, status, notes")
    .in("status", ["active", "past_due"])
    .like("notes", "%servolia-extra-domain:%")));

  for (const row of addonRows ?? []) {
    for (const rec of readExtraDomains(row.notes)) {
      if (!rec.nextChargeAt || rec.failed || rec.nextChargeAt > horizon) continue;
      if (!row.customer_id) { failed.push(`${rec.domain}: no Stripe customer on the row`); continue; }
      const price = renewalRetailUsd(rec.retailUsd, await currentRenewalUsd(rec.domain));
      try {
        await stripe.invoiceItems.create(
          {
            customer: row.customer_id,
            currency: "usd",
            amount: Math.round(price * 100),
            description: `Domain ${rec.domain} — renewal, 12 months from ${rec.nextChargeAt}`,
          },
          /* Keyed on the client, the domain AND the date, so a cron that runs
             twice in a day cannot bill the same renewal twice. */
          { idempotencyKey: `domain-addon-${row.id}-${rec.domain}-${rec.nextChargeAt}` },
        );
        const next = nextChargeDate(new Date(`${rec.nextChargeAt}T00:00:00Z`), "annual").toISOString().slice(0, 10);
        const { data: fresh } = await db.from("hosting_clients").select("notes").eq("id", row.id).maybeSingle();
        await db.from("hosting_clients")
          .update({ notes: writeExtraDomain((fresh as { notes?: string | null } | null)?.notes ?? row.notes, { ...rec, retailUsd: price, nextChargeAt: next }) })
          .eq("id", row.id);
        charged.push(`${rec.domain} $${price.toFixed(2)}${price > rec.retailUsd ? ` (was $${rec.retailUsd})` : ""} (${row.business}) — next ${next}`);
        tellClient(row.email, rec.domain, price, rec.retailUsd, rec.nextChargeAt);
      } catch (e) {
        failed.push(`${rec.domain}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  /* DOMAINS SOLD ON THEIR OWN (src/lib/domainOrders.ts): no plan, no row
   * here — the record is on the Stripe customer. A price rise is emailed 30
   * days out; the renewal is charged on the saved card 7 days out. */
  const today = new Date().toISOString().slice(0, 10);
  let orders: Awaited<ReturnType<typeof runDomainOrderRenewals>> = [];
  try {
    orders = await runDomainOrderRenewals(stripe, today);
  } catch (e) {
    failed.push(`domain orders: ${e instanceof Error ? e.message : String(e)}`);
  }
  for (const o of orders) {
    if (o.step === "charge-failed") {
      failed.push(`${o.domain} (order, ${o.email ?? o.customer}): $${o.priceUsd.toFixed(2)} NOT charged — ${o.detail}. Vercel auto-renews it on our card: chase them or switch auto-renew off.`);
      continue;
    }
    if (o.step === "charged") charged.push(`${o.domain} $${o.priceUsd.toFixed(2)}${o.priceUsd > o.previousUsd ? ` (was $${o.previousUsd})` : ""} (order, ${o.email ?? o.customer}) — next ${o.nextRenewsOn}`);
    else charged.push(`${o.domain}: price-rise notice sent, $${o.previousUsd} -> $${o.priceUsd.toFixed(2)} on ${o.renewsOn}`);
    if (!o.email) continue;
    const tpl = domainRenewalEmail({
      domain: o.domain, stage: o.step === "charged" ? "charged" : "notice", priceUsd: o.priceUsd, previousUsd: o.previousUsd,
      onIso: o.renewsOn, nextIso: o.nextRenewsOn, lang: o.lang,
    });
    mails.push(sendEmail(o.email, tpl.subject, tpl.html).catch(() => false));
  }

  /* THE MARGIN WATCH, for domains that renew WITH AN ANNUAL PLAN.
   *
   * Every other domain is repriced at its renewal by renewalRetailUsd (above
   * and in domainOrders.ts). An annual plan's domain is a fixed yearly line
   * on the Stripe subscription and renews by itself at that price, so it
   * cannot be repriced from here: when the gap closes to within a few dollars
   * of the profit target, the operator is told once -- with the numbers --
   * so it can be repriced by hand, with notice, never mid-term. */
  const { data: held } = await excludeTest(db, (live) => live(db
    .from("hosting_clients")
    .select("id, business, billing_period, notes")
    .in("status", ["active", "past_due"])
    .like("notes", "%servolia-domain:%")));
  const warnings: string[] = [];
  for (const row of held ?? []) {
    if (row.billing_period === "monthly") continue;
    const rec = readDomainRecord(row.notes);
    if (!rec || rec.status !== "bought") continue;
    const renewal = await currentRenewalUsd(rec.domain);
    if (renewal === null) continue;
    const net = netProfitUsd(rec.retailUsd, renewal);
    const key = renewal.toFixed(2);
    if (net < DOMAIN_TARGET_PROFIT_USD - 3 && rec.warnedAt !== key) {
      warnings.push(`${rec.domain} (${row.business}): Vercel now renews at $${key}, client pays $${rec.retailUsd}/yr -> you keep ~$${net.toFixed(2)} (target $${DOMAIN_TARGET_PROFIT_USD}). Reprice at the next renewal, with notice.`);
      await db.from("hosting_clients")
        .update({ notes: writeDomainRecord(row.notes, { ...rec, warnedAt: key }) })
        .eq("id", row.id);
    }
  }

  await Promise.all(mails);
  if (charged.length || failed.length || warnings.length) {
    await sendTelegramMessage(
      [
        "Domain billing",
        ...charged.map((c) => `charged: ${c}`),
        ...failed.map((f) => `FAILED: ${f}`),
        ...warnings.map((w) => `MARGIN: ${w}`),
      ].join("\n"),
      undefined,
      { plain: true },
    ).catch(() => {});
  }
  return NextResponse.json({ charged, failed, warnings, checked: rows?.length ?? 0, held: held?.length ?? 0, orders: orders.length });
}
