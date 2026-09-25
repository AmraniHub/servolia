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
 * Since 2026-09-25 it also REPRICES each renewal (renewalRetailUsd: never
 * below last year, up when Vercel's renewal price rose), emails the client
 * the price, and runs the renewals of domains sold on their own
 * (src/lib/domainOrders.ts: notice 30 days out, charge 7 days out).
 *
 * Scheduled in vercel.json. Auth: Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
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
  /* Each resolves to null when sent, or to a line for the owner when not:
     a renewal notice nobody received is a promise broken in silence. */
  const mails: Promise<string | null>[] = [];
  function mail(to: string, tpl: { subject: string; html: string }, what: string) {
    mails.push(sendEmail(to, tpl.subject, tpl.html)
      .then((ok) => (ok ? null : `${what}: email to ${to} NOT sent - tell them yourself`))
      .catch(() => `${what}: email to ${to} NOT sent - tell them yourself`));
  }
  function tellClient(email: string | null, domain: string, price: number, previous: number, fromIso: string) {
    if (!email) { failed.push(`${domain}: renewal put on the invoice, but no email on the row to tell the client`); return; }
    const tpl = domainRenewalEmail({
      domain, stage: "invoice", priceUsd: price, previousUsd: previous, onIso: fromIso,
      lang: langFor(refKeyForEmail(email)),
    });
    mail(email, tpl, `${domain} renewal`);
  }
  const was = (price: number, previous: number) => (price > previous + 0.004 ? ` (was $${previous.toFixed(2)})` : "");
  const noticed: string[] = [];
  const warnings: string[] = [];

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
      charged.push(`${rec.domain} $${price.toFixed(2)}${was(price, rec.retailUsd)} (${row.business}) — next ${next}`);
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
        charged.push(`${rec.domain} $${price.toFixed(2)}${was(price, rec.retailUsd)} (${row.business}) — next ${next}`);
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
    const who = o.email ?? o.customer;
    if (o.step === "charge-failed") {
      // Every day until it is resolved: the invoice stays open and is retried.
      failed.push(`${o.domain} (order, ${who}): $${o.priceUsd.toFixed(2)} NOT charged — ${o.detail}. Vercel auto-renews it on our card on ${o.renewsOn}: chase them, or set servolia_domain_status to 'stopped' in Stripe and switch auto-renew off in Vercel.`);
      continue;
    }
    if (o.step === "charged") {
      charged.push(`${o.domain} $${o.priceUsd.toFixed(2)}${was(o.priceUsd, o.previousUsd)} (order, ${who}) — next ${o.nextRenewsOn}`);
      if (o.heldBackUsd) warnings.push(`${o.domain} (order, ${who}): charged $${o.priceUsd.toFixed(2)}, not the $${o.heldBackUsd.toFixed(2)} Vercel's price now needs, because the rise was not announced 30 days ahead. Next year's notice will carry it.`);
    } else {
      noticed.push(`${o.domain} (order, ${who}): price-rise notice sent, $${o.previousUsd.toFixed(2)} -> $${o.priceUsd.toFixed(2)}, charged ${o.chargeOn}`);
    }
    if (!o.email) { failed.push(`${o.domain} (order, ${o.customer}): no email on the Stripe customer - the client was not told`); continue; }
    const tpl = domainRenewalEmail({
      domain: o.domain, stage: o.step === "charged" ? "charged" : "notice", priceUsd: o.priceUsd, previousUsd: o.previousUsd,
      onIso: o.renewsOn, chargeOnIso: o.chargeOn, nextIso: o.nextRenewsOn, lang: o.lang,
    });
    mail(o.email, tpl, `${o.domain} ${o.step === "charged" ? "renewal receipt" : "price-rise notice"}`);
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

  for (const m of await Promise.all(mails)) if (m) failed.push(m);
  if (charged.length || noticed.length || failed.length || warnings.length) {
    await sendTelegramMessage(
      [
        "Domain billing",
        ...charged.map((c) => `charged: ${c}`),
        ...noticed.map((n) => `notice: ${n}`),
        ...failed.map((f) => `FAILED: ${f}`),
        ...warnings.map((w) => `MARGIN: ${w}`),
      ].join("\n"),
      undefined,
      { plain: true },
    ).catch(() => {});
  }
  return NextResponse.json({ charged, failed, warnings, checked: rows?.length ?? 0, held: held?.length ?? 0, orders: orders.length });
}
