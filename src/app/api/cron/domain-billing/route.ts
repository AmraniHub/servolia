import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { stripeFor } from "@/lib/stripeMode";
import { excludeTest } from "@/lib/testContext";
import {
  readDomainRecord, writeDomainRecord, currentRenewalUsd, netProfitUsd, DOMAIN_TARGET_PROFIT_USD,
  renewalDecision, readNoticed, writeNoticed, daysBefore, chargeDateFor, NOTICE_DAYS, NOTICE_WINDOW_DAYS,
  domainRegistration, setDomainAutoRenew,
} from "@/lib/domainSales";
import { runDomainOrderRenewals, sweepStoppedOrders, auditDomainOrders, MAX_CHARGE_ATTEMPTS } from "@/lib/domainOrders";
import { sendEmail, domainRenewalEmail } from "@/lib/email";
import { Sends } from "@/lib/notify";
import { langFor, refKeyForEmail } from "@/lib/clientRefs";
import { readExtraDomains, writeExtraDomain } from "@/lib/extraDomains";
import { nextChargeDate } from "@/lib/hosting";
import {
  OWNED_DOMAIN_NOTE, OWNED_RENEWAL_ITEM_KIND, readOwnedDomainNote, writeOwnedDomainNote, renewalDateFrom, renewalCheck, type OwnedDomainNote,
} from "@/lib/ownedDomain";

/** The tag on a plan or panel domain's renewal line (owned domains use OWNED_RENEWAL_ITEM_KIND). */
const PLAN_RENEWAL_ITEM_KIND = "plan_domain_renewal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * YEARLY DOMAIN RENEWALS — every domain Servolia sells. Daily, 11:00 UTC.
 *
 * 1. A MONTHLY plan's domain, and 2. a domain added from the client panel:
 *    Stripe will not mix intervals, so each year goes on the client's
 *    account as a pending invoice item a week before the date (it lands on
 *    the next monthly invoice), then the date moves a year on. Idempotent
 *    twice over: the date only advances after a successful create, and the
 *    create carries an idempotency key of row (+ domain) + date.
 * 3. A domain sold ON ITS OWN (src/lib/domainOrders.ts): a one-line invoice
 *    on the saved card; plus the daily sweep of stopped orders and the audit
 *    of records that need a human (reported here, so at most once a day).
 * 4. The margin watch for an ANNUAL plan's domain, a fixed yearly line on the
 *    subscription that cannot be repriced from here.
 *
 * THE PRICE (renewalDecision, src/lib/domainSales.ts): last year's, unless
 * the registry raised Vercel's price enough to eat the margin. A rise is
 * emailed 44 to 37 days before the renewal date — at least 30 days before
 * the money moves (charge at −7) — and recorded only once the email went; the
 * charge never exceeds what the client was told. A client who bought before
 * the 27.90 floor keeps their price while the margin holds.
 *
 * Every email and the report are awaited and bounded (src/lib/notify.ts).
 * Scheduled in vercel.json. Auth: Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  // The live key (STRIPE_SECRET_KEY), through the seam tests/domain-billing-cron.test.mjs fakes.
  const liveStripe = stripeFor(true);
  if (!db || !liveStripe) return NextResponse.json({ error: "not-configured" }, { status: 503 });
  const stripe = liveStripe; // narrowed once, for the closures below
  const sends = new Sends();
  const today = new Date().toISOString().slice(0, 10);

  const charged: string[] = [];
  const noticed: string[] = [];
  const failed: string[] = [];
  const warnings: string[] = [];
  const checks: string[] = [];
  const was = (price: number, previous: number) => (price > previous + 0.004 ? ` (was $${previous.toFixed(2)})` : "");

  /** One email, awaited (bounded). A failure is on the report: a notice nobody received is a promise broken in silence. */
  async function mail(to: string | null, tpl: { subject: string; html: string }, what: string): Promise<boolean> {
    if (!to) { failed.push(`${what}: no email address - the client was not told`); return false; }
    const ok = (await sends.add(what, sendEmail(to, tpl.subject, tpl.html))) === true;
    if (!ok) failed.push(`${what}: email to ${to} NOT sent - tell them yourself`);
    return ok;
  }

  /**
   * A plan or panel domain, one year: notice, charge, or nothing. `save`
   * writes the new record into the row's notes and returns the database's
   * error, if any; `idem` keys the invoice item.
   */
  async function planDomain(o: {
    row: { id: string; business: string | null; email: string | null; customer_id: string | null };
    domain: string; paidUsd: number; renewsOn: string; noticed?: string; idem: string;
    save: (patch: { retailUsd?: number; nextChargeAt?: string; noticed?: string | undefined }) => Promise<string | null>;
    /** Pin the line to this subscription's next invoice, and tag it (an owned domain's cancellation reads the tag). */
    item?: { subscription?: string | null; metadata?: Record<string, string> };
  }) {
    if (today < daysBefore(o.renewsOn, NOTICE_DAYS + NOTICE_WINDOW_DAYS)) return;
    const d = renewalDecision({ paidUsd: o.paidUsd, vercelRenewalUsd: await currentRenewalUsd(o.domain), renewsOn: o.renewsOn, todayIso: today, ...readNoticed(o.noticed) });
    if (d.kind === "wait") return;
    if (d.kind === "no-price") {
      // Never billed at a guessed figure; reported every day until someone sets it.
      failed.push(`${o.domain} (${o.row.business}): no stored price on the row (retail) — NOT renewed. Set it to what the client pays before ${chargeDateFor(o.renewsOn)}.`);
      return;
    }
    const lang = o.row.email ? langFor(refKeyForEmail(o.row.email)) : "en";
    if (d.kind === "notice") {
      const tpl = domainRenewalEmail({ domain: o.domain, stage: "notice", priceUsd: d.price, previousUsd: o.paidUsd, onIso: o.renewsOn, chargeOnIso: chargeDateFor(o.renewsOn), lang, billed: "invoice" });
      // Recorded only once it went: otherwise it is retried tomorrow, and after the window the rise waits a year.
      if (await mail(o.row.email, tpl, `${o.domain} price-rise notice`)) {
        const err = await o.save({ noticed: writeNoticed(o.renewsOn, d.price) });
        /* The email went but the record did not: the notice does not count
           (the charge stays at last year's price) and it may be sent again
           tomorrow. Said out loud rather than assumed. */
        if (err) failed.push(`${o.domain} (${o.row.business}): price-rise notice SENT but NOT recorded (${err}) — it does not count yet; tomorrow's run may email it again.`);
        else noticed.push(`${o.domain} (${o.row.business}): price-rise notice sent, $${o.paidUsd.toFixed(2)} -> $${d.price.toFixed(2)} from ${o.renewsOn}`);
      }
      return;
    }
    if (!o.row.customer_id) { failed.push(`${o.domain}: no Stripe customer on the row`); return; }
    try {
      /* EVERY renewal line is tagged (kind + domain + year), and looked for
         first: a run that added the line but failed to write the row would
         otherwise add a second one the next day, once the 24-hour
         idempotency key has expired. Found = the row is only brought up to
         date. */
      const tag = o.item?.metadata ?? { kind: PLAN_RENEWAL_ITEM_KIND, domain: o.domain, renews_on: o.renewsOn };
      const already = (await stripe.invoiceItems.list({ customer: o.row.customer_id, limit: 100 })).data.some(
        (i) => i.metadata?.kind === tag.kind && i.metadata?.domain === o.domain && i.metadata?.renews_on === o.renewsOn,
      );
      if (already) {
        checks.push(`${o.domain} (${o.row.business}): the renewal line for ${o.renewsOn} was already on the account (an earlier run); not added again — the row is brought up to date.`);
      } else {
        await stripe.invoiceItems.create(
          {
            customer: o.row.customer_id, currency: "usd", amount: Math.round(d.price * 100), description: `Domain ${o.domain} — renewal, 12 months from ${o.renewsOn}`,
            ...(o.item?.subscription ? { subscription: o.item.subscription } : {}),
            metadata: tag,
          },
          { idempotencyKey: o.idem },
        );
      }
      const next = nextChargeDate(new Date(`${o.renewsOn}T00:00:00Z`), "annual").toISOString().slice(0, 10);
      const err = await o.save({ retailUsd: d.price, nextChargeAt: next, noticed: undefined });
      if (err) {
        /* The line IS on their account, the date did not move: within 24 h
           the idempotency key stops a second line; after that it would not. */
        failed.push(`${o.domain} (${o.row.business}): renewal line ADDED ($${d.price.toFixed(2)}) but the row was NOT updated (${err}). Set its renew date to ${next} today, or tomorrow's run adds a second line.`);
        return;
      }
      charged.push(`${o.domain} $${d.price.toFixed(2)}${was(d.price, o.paidUsd)} (${o.row.business}) — next ${next}`);
      if (d.wanted > d.price + 0.004) warnings.push(`${o.domain} (${o.row.business}): billed $${d.price.toFixed(2)}, not the $${d.wanted.toFixed(2)} Vercel's price now needs — the rise was not announced 30 days ahead. Next year's notice will carry it.`);
      const tpl = domainRenewalEmail({ domain: o.domain, stage: "invoice", priceUsd: d.price, previousUsd: o.paidUsd, onIso: o.renewsOn, lang });
      await mail(o.row.email, tpl, `${o.domain} renewal`);
    } catch (e) {
      failed.push(`${o.domain}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // `is_test is not true` on every read: a founder test row is never
  // charged, renewed or margin-watched (src/lib/testContext.ts).
  const { data: rows, error } = await excludeTest(db, (live) => live(db
    .from("hosting_clients")
    .select("id, business, email, customer_id, billing_period, status, notes")
    .in("status", ["active", "past_due"])
    .eq("billing_period", "monthly")
    .like("notes", "%servolia-domain:%")));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const row of rows ?? []) {
    const rec = readDomainRecord(row.notes);
    if (!rec || rec.status !== "bought" || !rec.nextChargeAt) continue;
    await planDomain({
      row, domain: rec.domain, paidUsd: rec.retailUsd, renewsOn: rec.nextChargeAt, noticed: rec.noticed,
      idem: `domain-renewal-${row.id}-${rec.nextChargeAt}`,
      save: async (patch) => {
        const { data: fresh } = await db.from("hosting_clients").select("notes").eq("id", row.id).maybeSingle();
        const notes = (fresh as { notes?: string | null } | null)?.notes ?? row.notes;
        const cur = readDomainRecord(notes) ?? rec;
        const { error: upErr } = await db.from("hosting_clients").update({ notes: writeDomainRecord(notes, { ...cur, ...patch }) }).eq("id", row.id);
        return upErr ? upErr.message : null;
      },
    });
  }

  /* DOMAINS BOUGHT FROM THE PANEL, AFTER THE PLAN. A different query because
   * they are a different thing: an add-on bought in March belongs to nobody's
   * cycle and is charged on its own date whatever the plan does. Without this
   * the client pays once and we renew it at our own cost every year after. */
  const { data: addonRows } = await excludeTest(db, (live) => live(db
    .from("hosting_clients")
    .select("id, business, email, customer_id, status, notes")
    .in("status", ["active", "past_due"])
    .like("notes", "%servolia-extra-domain:%")));

  for (const row of addonRows ?? []) {
    for (const rec of readExtraDomains(row.notes)) {
      if (!rec.nextChargeAt || rec.failed) continue;
      await planDomain({
        row, domain: rec.domain, paidUsd: rec.retailUsd, renewsOn: rec.nextChargeAt, noticed: rec.noticed,
        // Keyed on the client, the domain AND the date: a second run the same day bills nothing.
        idem: `domain-addon-${row.id}-${rec.domain}-${rec.nextChargeAt}`,
        save: async (patch) => {
          const { data: fresh } = await db.from("hosting_clients").select("notes").eq("id", row.id).maybeSingle();
          const notes = (fresh as { notes?: string | null } | null)?.notes ?? row.notes;
          const cur = readExtraDomains(notes).find((d) => d.domain === rec.domain) ?? rec;
          const { error: upErr } = await db.from("hosting_clients").update({ notes: writeExtraDomain(notes, { ...cur, ...patch }) }).eq("id", row.id);
          return upErr ? upErr.message : null;
        },
      });
    }
  }

  /* A DOMAIN WE ALREADY OWNED, SOLD WITH THE HOSTING (src/lib/ownedDomain.ts:
   * the `servolia-owned-domain:` note). Same rules as every plan domain —
   * last year's price unless the registry moved, a rise emailed 30 days
   * before the charge, no floor raise — and the line goes on THE HOSTING
   * SUBSCRIPTION's next invoice, tagged so a cancellation can find it.
   *   - The year we billed must have been RENEWED by Vercel (expiry > billed)
   *     before the next one is billed; 5 days after it began and still not,
   *     the owner is told every day (renewalCheck) and nothing is billed.
   *   - Vercel's actual expiry is followed only within 30 days of our date;
   *     a bigger gap is reported once and our date stands (renewalDateFrom). */
  const { data: ownedRows } = await excludeTest(db, (live) => live(db
    .from("hosting_clients")
    .select("id, business, email, customer_id, subscription_id, status, notes")
    .in("status", ["active", "past_due"])
    .like("notes", `%${OWNED_DOMAIN_NOTE}%`)));

  for (const row of ownedRows ?? []) {
    const note = readOwnedDomainNote(row.notes);
    // Belt and braces with the query: a hosting that ended is never billed a domain year.
    if (row.status !== "active" && row.status !== "past_due") continue;
    if (!note || !note.renewsOn || note.renewalOff) continue;
    const saveOwned = async (patch: Partial<OwnedDomainNote>): Promise<string | null> => {
      const { data: fresh } = await db.from("hosting_clients").select("notes").eq("id", row.id).maybeSingle();
      const notes = (fresh as { notes?: string | null } | null)?.notes ?? row.notes;
      const cur = readOwnedDomainNote(notes) ?? note;
      const { error: upErr } = await db.from("hosting_clients").update({ notes: writeOwnedDomainNote(notes, { ...cur, ...patch }) }).eq("id", row.id);
      return upErr ? upErr.message : null;
    };
    const reg = await domainRegistration(note.domain);
    const renewed = renewalCheck(note, reg, today);
    if (!renewed.ok) {
      if (renewed.alarm) {
        failed.push(`${note.domain} (${row.business}): the year from ${note.billed} was PAID and NOT renewed by Vercel (${renewed.why}) — renew it by hand in Vercel or refund that year. The next year will not be billed until it is.`);
      }
      continue;
    }
    const dated = renewalDateFrom(note, reg.state === "ok" ? reg.expiry : null);
    if (dated.mismatch) {
      if (note.vercelMismatch !== dated.mismatch) {
        const err = await saveOwned({ vercelMismatch: dated.mismatch });
        checks.push(`${note.domain} (${row.business}): Vercel's registration ends ${dated.mismatch}, far from our renewal date ${note.renewsOn} — NOT followed; check the domain in Vercel and correct the row if ours is wrong${err ? ` (note not saved: ${err})` : ""}. Reported once.`);
      }
    } else if (dated.renewsOn !== note.renewsOn) {
      const err = await saveOwned({ renewsOn: dated.renewsOn, vercelMismatch: undefined });
      (err ? failed : checks).push(`${note.domain} (${row.business}): renewal date ${err ? "NOT " : ""}moved ${note.renewsOn} -> ${dated.renewsOn} to match Vercel's expiry${err ? ` (${err})` : ""}.`);
      if (err) continue;
    }
    const renewsOn = dated.renewsOn;
    await planDomain({
      row, domain: note.domain, paidUsd: note.usd, renewsOn, noticed: note.noticed,
      idem: `owned-domain-${row.id}-${renewsOn}`,
      item: {
        subscription: (row as { subscription_id?: string | null }).subscription_id ?? null,
        metadata: { kind: OWNED_RENEWAL_ITEM_KIND, domain: note.domain, renews_on: renewsOn },
      },
      save: (patch) => saveOwned({
        ...(patch.retailUsd !== undefined ? { usd: patch.retailUsd } : {}),
        // The year just put on the invoice starts on the old date; the next one is due a year on.
        ...(patch.nextChargeAt !== undefined ? { renewsOn: patch.nextChargeAt, billed: renewsOn } : {}),
        noticed: patch.noticed,
      }),
    });
  }

  /* After a cancellation that kept auto-renew on for a year the client had
   * already paid (ownedDomainOnCancel): once that year has started AND
   * Vercel has actually renewed it (expiry > keptUntil), auto-renew goes off.
   * Not renewed 5 days after the date: the owner is told. */
  const { data: churnedOwned } = await excludeTest(db, (live) => live(db
    .from("hosting_clients")
    .select("id, business, notes, status")
    .eq("status", "churned")
    .like("notes", `%${OWNED_DOMAIN_NOTE}%`)));
  for (const row of churnedOwned ?? []) {
    const note = readOwnedDomainNote(row.notes);
    if (!note?.keptUntil || note.renewalOff || today <= note.keptUntil) continue;
    const reg = await domainRegistration(note.domain);
    if (!(reg.state === "ok" && reg.expiry && reg.expiry > note.keptUntil)) {
      const check = renewalCheck({ ...note, billed: note.keptUntil }, reg, today);
      if (!check.ok && check.alarm) failed.push(`${note.domain} (${row.business}, hosting ended): the paid year from ${note.keptUntil} was NOT renewed by Vercel (${check.why}) — renew it by hand or refund that year. Auto-renew left ON.`);
      continue;
    }
    const off = await setDomainAutoRenew(note.domain, false);
    if (!off.ok) { failed.push(`${note.domain} (${row.business}, hosting ended): Vercel auto-renew NOT switched off (${off.code ?? off.status}) — retried tomorrow; or do it in Vercel > Domains.`); continue; }
    const { error: upErr } = await db.from("hosting_clients")
      .update({ notes: writeOwnedDomainNote(row.notes, { ...note, keptUntil: undefined, renewalOff: today }) }).eq("id", row.id);
    checks.push(`${note.domain} (${row.business}, hosting ended): the paid year from ${note.keptUntil} was renewed by Vercel (to ${reg.expiry}); auto-renew switched OFF${upErr ? ` (note NOT updated: ${upErr.message})` : ""}.`);
  }

  /* DOMAINS SOLD ON THEIR OWN (src/lib/domainOrders.ts). */
  let orders: Awaited<ReturnType<typeof runDomainOrderRenewals>> = [];
  try {
    orders = await runDomainOrderRenewals(stripe, today, {
      sendNotice: (o) => mail(o.email, domainRenewalEmail({
        domain: o.domain, stage: "notice", priceUsd: o.priceUsd, previousUsd: o.previousUsd, onIso: o.renewsOn, chargeOnIso: o.chargeOn, lang: o.lang,
      }), `${o.domain} price-rise notice`),
    });
  } catch (e) {
    failed.push(`domain orders: ${e instanceof Error ? e.message : String(e)}`);
  }
  for (const o of orders) {
    const who = o.email ?? o.customer;
    if (o.step === "no-price") {
      failed.push(`${o.domain} (order, ${who}): ${o.detail}`);
    } else if (o.step === "notice-failed") {
      failed.push(`${o.domain} (order, ${who}): price-rise notice NOT sent (${o.detail}); retried tomorrow while the notice window lasts, then the rise waits a year.`);
    } else if (o.step === "noticed") {
      noticed.push(`${o.domain} (order, ${who}): price-rise notice sent, $${o.previousUsd.toFixed(2)} -> $${o.priceUsd.toFixed(2)}, charged ${o.chargeOn}`);
    } else if (o.step === "charge-failed") {
      // Once a day, the only retry there is (auto_advance is off), up to MAX_CHARGE_ATTEMPTS.
      failed.push(`${o.domain} (order, ${who}): $${o.priceUsd.toFixed(2)} NOT charged, attempt ${o.attempts ?? "?"}/${MAX_CHARGE_ATTEMPTS} — ${o.detail}. Retried tomorrow.`);
    } else if (o.step === "gave-up") {
      failed.push(`${o.domain} (order, ${who}): STOPPED RETRYING after ${MAX_CHARGE_ATTEMPTS} declined attempts — ${o.detail}. Vercel auto-renews it on OUR card on ${o.renewsOn}: chase them for a new card, or stop it (/admin/hosting > Existing order > Stop renewing).`);
    } else {
      charged.push(`${o.domain} $${o.priceUsd.toFixed(2)}${was(o.priceUsd, o.previousUsd)} (order, ${who}) — next ${o.nextRenewsOn}`);
      if (o.heldBackUsd) warnings.push(`${o.domain} (order, ${who}): charged $${o.priceUsd.toFixed(2)}, not the $${o.heldBackUsd.toFixed(2)} Vercel's price now needs — the rise was not announced 30 days ahead. Next year's notice will carry it.`);
      await mail(o.email, domainRenewalEmail({
        domain: o.domain, stage: "charged", priceUsd: o.priceUsd, previousUsd: o.previousUsd, onIso: o.renewsOn, nextIso: o.nextRenewsOn, lang: o.lang,
      }), `${o.domain} renewal receipt`);
    }
  }
  try {
    for (const s of await sweepStoppedOrders(stripe)) {
      (s.problems.length ? failed : checks).push(`${s.domain} (order, ${s.customer}) stopped: ${[
        ...s.voided, ...s.problems,
        ...(s.keptUntil ? [`Vercel auto-renew kept ON until ${s.keptUntil} (that year is already paid); switched off after it`] : []),
      ].join("; ") || "renewal switched off"}`);
    }
    checks.push(...(await auditDomainOrders(stripe)));
  } catch (e) {
    failed.push(`domain order sweep/audit: ${e instanceof Error ? e.message : String(e)}`);
  }

  /* THE MARGIN WATCH, for domains that renew WITH AN ANNUAL PLAN: a fixed
   * yearly line on the Stripe subscription that renews by itself. When the
   * gap closes to within a few dollars of the profit target, the operator is
   * told once, with the numbers, to reprice by hand with notice. */
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

  if (charged.length || noticed.length || failed.length || warnings.length || checks.length) {
    sends.alert([
      "Domain billing",
      ...charged.map((c) => `charged: ${c}`),
      ...noticed.map((n) => `notice: ${n}`),
      ...failed.map((f) => `FAILED: ${f}`),
      ...warnings.map((w) => `MARGIN: ${w}`),
      ...checks.map((c) => `CHECK: ${c}`),
    ].join("\n"));
  }
  await sends.settled();
  return NextResponse.json({ charged, noticed, failed, warnings, checks, checked: rows?.length ?? 0, held: held?.length ?? 0, orders: orders.length });
}
