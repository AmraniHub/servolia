import type Stripe from "stripe";
import {
  attachDomainToProject, canBuyDomains, currentRenewalUsd, domainOrder, domainQuote, normalizeDomain,
  purchaseDomainForClient, renewalRetailUsd,
} from "@/lib/domainSales";

/**
 * A DOMAIN SOLD ON ITS OWN, TO A CLIENT WHO HAS NO SERVOLIA PLAN.
 *
 * The first case was Ithar Digital (2026-09-24): a site built for him on
 * Vercel, a .com he pays for with his own card, and a Servolia email that
 * tells him it is his. The plan checkout cannot do that (it sells a plan) and
 * the panel add-on cannot either (it needs a subscription), so this is the
 * third door: the operator makes a link on /admin/hosting, the client pays,
 * the webhook buys the name and puts it on the Vercel project.
 *
 * THE RECORD LIVES ON THE STRIPE CUSTOMER, in metadata. Checkout creates one
 * customer per order, so one customer is one domain, and the renewal needs
 * that customer anyway (its saved card). No table and no migration, and
 * nothing that inflates the client counts, which is what a hosting_clients
 * row for a client with no hosting would do.
 *
 * THE CARD IS SAVED FOR NEXT YEAR (setup_future_usage: off_session): the
 * renewal is charged on it by the domain-billing cron, at the price that
 * renewalRetailUsd gives on the day, never lower than what they paid, and
 * never higher than the price the client was told about in advance.
 *
 * STATUSES, in the order a record moves through them:
 *   claimed    -- the webhook is about to call the registrar. Written BEFORE
 *                 the purchase, so a second delivery of the same event can
 *                 see that a purchase may already be under way and stops.
 *   purchasing -- Vercel accepted the order and has not finished it. Vercel
 *                 registers asynchronously; the domain-live cron (every 15
 *                 minutes) settles it with settlePurchasingOrders.
 *   bought     -- registered. Renewed every year by the domain-billing cron.
 *   failed     -- not registered (refused, or a founder test purchase).
 *   stopped    -- the client asked not to renew; set by hand in Stripe.
 */

export const DOMAIN_ORDER_KIND = "domain_order";
/** Days before the renewal date that a price rise is announced. */
export const NOTICE_DAYS = 30;
/** Days before the renewal date that the renewal is charged. */
export const CHARGE_DAYS = 7;
/** How long a Vercel order may stay "purchasing" before the owner is told. */
export const STUCK_AFTER_HOURS = 6;

export type OrderStatus = "claimed" | "purchasing" | "bought" | "failed" | "stopped";
const STATUSES: OrderStatus[] = ["claimed", "purchasing", "bought", "failed", "stopped"];

export interface DomainOrderRecord {
  domain: string;
  status: OrderStatus;
  /** What the client paid for the current year. */
  retailUsd: number;
  lang: "en" | "fr";
  name?: string;
  project?: string;
  /** The project the domain was attached to, once it was. */
  attached?: string;
  orderId?: string;
  /** The Checkout Session that paid for the first year. */
  session?: string;
  boughtAt?: string;
  /** ISO date the next year is due: the anniversary of the purchase. */
  renewsOn?: string;
  /** The renewsOn a price-rise notice was already sent for, so it is sent once. */
  noticedFor?: string;
  /** The price that notice announced: the most the renewal may charge. */
  noticedUsd?: number;
  note?: string;
}

const P = "servolia_domain";
const KEYS: Record<keyof DomainOrderRecord, string> = {
  domain: P, status: `${P}_status`, retailUsd: `${P}_retail`, lang: `${P}_lang`, name: `${P}_name`,
  project: `${P}_project`, attached: `${P}_attached`, orderId: `${P}_order`, session: `${P}_session`,
  boughtAt: `${P}_bought`, renewsOn: `${P}_renews`, noticedFor: `${P}_noticed`, noticedUsd: `${P}_noticed_usd`,
  note: `${P}_note`,
};
const TEXT_FIELDS = ["name", "project", "attached", "orderId", "session", "boughtAt", "renewsOn", "noticedFor", "note"] as const;

export function readOrderRecord(meta: Record<string, string> | null | undefined): DomainOrderRecord | null {
  const m = meta ?? {};
  const domain = normalizeDomain(m[KEYS.domain]);
  if (!domain) return null;
  // Anything unrecognised reads as failed: never charged, never bought again.
  const status = STATUSES.includes(m[KEYS.status] as OrderStatus) ? (m[KEYS.status] as OrderStatus) : "failed";
  const rec: DomainOrderRecord = {
    domain,
    status,
    retailUsd: Number(m[KEYS.retailUsd]) || 0,
    lang: m[KEYS.lang] === "fr" ? "fr" : "en",
  };
  for (const k of TEXT_FIELDS) if (m[KEYS[k]]) rec[k] = m[KEYS[k]];
  const noticed = Number(m[KEYS.noticedUsd]);
  if (m[KEYS.noticedUsd] && Number.isFinite(noticed) && noticed > 0) rec.noticedUsd = noticed;
  return rec;
}

/**
 * As Stripe metadata. An absent field is written as "" so that updating a
 * customer CLEARS a stale value (Stripe deletes a metadata key set to "")
 * instead of leaving last year's note in place. Values are capped at 500
 * characters, Stripe's limit.
 */
export function orderRecordMetadata(rec: DomainOrderRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(KEYS) as (keyof DomainOrderRecord)[]) {
    const v = rec[k];
    out[KEYS[k]] = v === undefined || v === null ? "" : String(v).slice(0, 500);
  }
  return out;
}

/** The anniversary a year after an ISO date (2026-09-24 -> 2027-09-24). */
export function nextYear(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/** An ISO date `days` before another. */
export function daysBefore(iso: string, days: number): string {
  return new Date(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
}

/** The day a renewal is charged: CHARGE_DAYS before the renewal date. */
export const chargeDateFor = (renewsOn: string) => daysBefore(renewsOn, CHARGE_DAYS);

/* ── 1. The link ──────────────────────────────────────────────────────────── */

export type LinkResult =
  | { ok: true; url: string; yearlyUsd: number; expiresAt: string }
  | { ok: false; error: string };

/**
 * Quoted on the server at the moment the link is made, never taken from the
 * form: the price in the link is the price the webhook buys against, and a
 * name that is taken or unsold here never becomes a link.
 */
export async function createDomainOrderLink(stripe: Stripe, o: {
  domain: string; email: string; name?: string; project?: string; lang: "en" | "fr"; origin: string;
}): Promise<LinkResult> {
  const domain = normalizeDomain(o.domain);
  if (!domain) return { ok: false, error: "Not a valid domain name." };
  const email = o.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Not a valid email." };
  const project = (o.project ?? "").trim();
  // Vercel project names: lowercase letters, digits, - _ . (up to 100).
  if (project && !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(project)) return { ok: false, error: "Not a valid Vercel project name (lowercase letters, digits, - _ .)." };
  if (!canBuyDomains()) return { ok: false, error: "Domain purchases are not configured (VERCEL_TOKEN, VERCEL_TEAM_ID, DOMAIN_CONTACT_JSON)." };

  const q = await domainQuote(domain);
  if (!q.sellable) {
    const why: Record<string, string> = {
      taken: "That domain is already registered.", unsupported: "Vercel does not sell that ending (.fr, .be, .eu and .lu are refused).",
      "too-expensive": "That ending is above the price we sell at.", "not-configured": "Domain sales are not configured.",
    };
    return { ok: false, error: why[q.reason ?? ""] ?? "Could not price that domain right now. Try again." };
  }

  const fr = o.lang === "fr";
  const name = (o.name ?? "").trim().slice(0, 120);
  // A Checkout Session lives 24 hours at most; say so rather than let an
  // expired link be the client's first impression.
  const expires = Math.floor(Date.now() / 1000) + 23 * 3600;
  const meta = {
    kind: DOMAIN_ORDER_KIND, domain, domain_retail_usd: String(q.yearlyUsd), lang: o.lang,
    ...(name ? { name } : {}), ...(project ? { project } : {}),
  };
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: o.lang,
    customer_email: email,
    customer_creation: "always",
    payment_method_types: ["card"],
    expires_at: expires,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(q.yearlyUsd * 100),
        product_data: {
          name: fr ? `Domaine ${domain} — 12 mois` : `Domain ${domain} — 12 months`,
          description: fr
            ? "Enregistré par Servolia pour vous, avec protection WHOIS. Renouvelé chaque année sur cette carte, prix annoncé 30 jours avant s'il augmente. Il vous appartient."
            : "Registered by Servolia for you, with WHOIS privacy. Renewed yearly on this card, with 30 days' notice of any price rise. Yours to keep.",
        },
      },
    }],
    payment_intent_data: {
      setup_future_usage: "off_session",
      description: `Domain ${domain} — 12 months`,
      metadata: meta,
    },
    metadata: meta,
    success_url: `${o.origin}/hosting/thanks?product=domain&lang=${o.lang}`,
    cancel_url: `${o.origin}${fr ? "/fr" : "/"}`,
  });
  if (!session.url) return { ok: false, error: "Stripe returned no link." };
  return { ok: true, url: session.url, yearlyUsd: q.yearlyUsd, expiresAt: new Date(expires * 1000).toISOString() };
}

/* ── 2. Paid: buy it, put it on the project ──────────────────────────────── */

/**
 * What the client actually paid, in US cents, or null when the session does
 * not say. With Adaptive Pricing the session's own currency is the CLIENT'S
 * (EUR, MAD...) and the USD figure is under currency_conversion.
 */
export function paidUsdCents(session: Stripe.Checkout.Session): number | null {
  if (session.currency === "usd" && typeof session.amount_total === "number") return session.amount_total;
  const cc = (session as { currency_conversion?: { source_currency?: string; amount_total?: number } | null }).currency_conversion;
  if (cc?.source_currency === "usd" && typeof cc.amount_total === "number") return cc.amount_total;
  return null;
}

export type OrderState = "completed" | "failed" | "purchasing";

/** One Vercel order, read down to this domain's own line. */
export async function orderState(orderId: string, domain: string): Promise<{ state: OrderState; detail?: string }> {
  const res = await domainOrder(orderId);
  if (!res.ok) return { state: "purchasing", detail: `order unreadable: ${res.code ?? res.status}` };
  const line = (res.data.domains ?? []).find((d) => d.domainName === domain);
  const lineStatus = line?.status;
  if (lineStatus === "completed" || (!line && res.data.status === "completed")) return { state: "completed" };
  if (lineStatus === "failed" || lineStatus === "refunded" || lineStatus === "refund-failed" || res.data.status === "failed") {
    const err = (line?.error ?? res.data.error) as { code?: string } | undefined;
    return { state: "failed", detail: `Vercel order ${res.data.status}${lineStatus ? `/${lineStatus}` : ""}${err?.code ? `: ${err.code}` : ""}` };
  }
  return { state: "purchasing" };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FulfilResult {
  domain: string;
  customerEmail: string | null;
  record: DomainOrderRecord;
  /**
   * "done": this delivery did the work. "duplicate": an earlier delivery
   * finished it, nothing to say. "interrupted": an earlier delivery claimed
   * the purchase and never recorded how it ended; nothing was bought now,
   * and the owner must look at Vercel. "conflict": the customer already
   * carries a different domain; nothing was bought.
   */
  outcome: "done" | "duplicate" | "interrupted" | "conflict";
  attach: "done" | "failed" | "none";
  attachDetail?: string;
  cardSaved: boolean;
}

/**
 * Idempotent on the customer: Stripe delivers the same event more than once,
 * and a second delivery must find the record and stop, never try to buy the
 * name a second time. The claim is written BEFORE the registrar is called.
 * `test` never reaches the registrar (and registrar() refuses on its own in
 * a test context too).
 *
 * `pollMs` is how long to wait between reads of an order Vercel is still
 * registering; short, because Stripe is waiting on this response. Whatever is
 * still purchasing afterwards is settled by settlePurchasingOrders.
 */
export async function fulfilDomainOrder(
  stripe: Stripe, session: Stripe.Checkout.Session, test: boolean,
  opts: { pollMs?: number[] } = {},
): Promise<FulfilResult | null> {
  const domain = normalizeDomain(session.metadata?.domain);
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!domain || !customerId) return null;
  const retail = Number(session.metadata?.domain_retail_usd) || 0;
  const lang = session.metadata?.lang === "fr" ? "fr" : "en";
  const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
  const project = session.metadata?.project || undefined;
  const name = session.metadata?.name || undefined;
  const none = { attach: "none" as const, cardSaved: false };

  const customer = await stripe.customers.retrieve(customerId);
  const prior = "deleted" in customer && customer.deleted ? null : readOrderRecord((customer as Stripe.Customer).metadata);
  if (prior && prior.domain !== domain) {
    return { domain, customerEmail, record: prior, outcome: "conflict", ...none };
  }
  if (prior) {
    return { domain, customerEmail, record: prior, outcome: prior.status === "claimed" ? "interrupted" : "duplicate", ...none };
  }

  const today = new Date().toISOString().slice(0, 10);
  const base: DomainOrderRecord = { domain, status: "claimed", retailUsd: retail, lang, name, project, session: session.id };
  await stripe.customers.update(customerId, { metadata: orderRecordMetadata(base) });

  /* The price the webhook buys against is the one in the link; the money
     that arrived must cover it. A mismatch means the session was changed
     after it was made (a coupon, a hand edit): nothing is bought. */
  const paid = paidUsdCents(session);
  const outcome = test
    ? { ok: false as const, reason: "error" as const, detail: "TEST: domain not bought" }
    : paid !== null && paid < Math.round(retail * 100)
      ? { ok: false as const, reason: "error" as const, detail: `paid ${(paid / 100).toFixed(2)} USD, price ${retail.toFixed(2)} USD` }
      : await purchaseDomainForClient(domain, retail);

  let state: OrderState = "failed";
  let stateDetail: string | undefined;
  if (outcome.ok) {
    state = "purchasing";
    for (const ms of opts.pollMs ?? [1000, 1500, 1500]) {
      await sleep(ms);
      const s = await orderState(outcome.orderId, domain);
      state = s.state;
      stateDetail = s.detail;
      if (state !== "purchasing") break;
    }
  }

  let attach: FulfilResult["attach"] = "none";
  let attachDetail: string | undefined;
  if (state === "completed" && project) {
    const res = await attachDomainToProject(project, domain);
    attach = res.ok ? "done" : "failed";
    if (!res.ok) attachDetail = `${res.code ?? res.status}${res.message ? `: ${res.message}` : ""}`;
  }

  /* The card that just paid becomes the one next year's renewal is charged
     to. Without a default payment method an off-session invoice has nothing
     to charge and the renewal fails a year from now. */
  let paymentMethod: string | null = null;
  try {
    const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (piId) {
      const pi = await stripe.paymentIntents.retrieve(piId);
      paymentMethod = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id ?? null;
    }
  } catch { /* recorded below as cardSaved: false */ }

  const placed = outcome.ok && state !== "failed";
  const record: DomainOrderRecord = {
    ...base,
    status: state === "completed" ? "bought" : placed ? "purchasing" : "failed",
    attached: attach === "done" ? project : undefined,
    orderId: outcome.ok ? outcome.orderId : undefined,
    boughtAt: placed ? today : undefined,
    renewsOn: placed ? nextYear(today) : undefined,
    note: !outcome.ok
      ? `${outcome.reason}${outcome.detail ? ` (${outcome.detail})` : ""}`
      : state === "failed" ? stateDetail : undefined,
  };
  await stripe.customers.update(customerId, {
    metadata: orderRecordMetadata(record),
    ...(paymentMethod ? { invoice_settings: { default_payment_method: paymentMethod } } : {}),
  });
  return { domain, customerEmail, record, outcome: "done", attach, attachDetail, cardSaved: Boolean(paymentMethod) };
}

/** What the client's email should say about this order, if anything. */
export type OrderEmailState = "registered" | "processing" | "failed";

/**
 * The owner's Telegram line and the client's email state for one webhook
 * delivery. Pure, so every branch is tested without Stripe or Telegram.
 */
export function describeDomainOrder(res: FulfilResult): { telegram: string | null; email: OrderEmailState | null } {
  const rec = res.record;
  const who = rec.name || res.customerEmail || "?";
  const paid = `$${rec.retailUsd.toFixed(2)}`;
  if (res.outcome === "duplicate") return { telegram: null, email: null };
  if (res.outcome === "conflict") {
    return { telegram: `⚠️ Domain order for ${res.domain} paid, but the Stripe customer already holds ${rec.domain}. Nothing bought. Check it in Stripe.`, email: null };
  }
  if (res.outcome === "interrupted") {
    return {
      telegram: `⚠️ Domain order ${rec.domain} (${who}) delivered again while its purchase was claimed and never recorded. NOTHING was bought this time. ` +
        `Check Vercel > Domains for ${rec.domain}: if it is there, set servolia_domain_status to 'bought' in Stripe; if not, buy it (vercel domains buy ${rec.domain}) or refund. The client has NOT been emailed.`,
      email: null,
    };
  }
  const card = res.cardSaved ? "" : "\nCard NOT saved as default - next year's renewal will fail; set it in Stripe.";
  if (rec.status === "bought") {
    const where = res.attach === "done" ? `Attached to Vercel project ${rec.project}.`
      : res.attach === "failed" ? `NOT attached to ${rec.project} (${res.attachDetail}) - add it in Vercel > ${rec.project} > Domains.`
      : "No Vercel project named - attach it by hand.";
    return { telegram: `🌐 ${who} paid ${paid} and ${rec.domain} is REGISTERED (order ${rec.orderId}). Renews ${rec.renewsOn}.\n${where}${card}`, email: "registered" };
  }
  if (rec.status === "purchasing") {
    return {
      telegram: `🌐 ${who} paid ${paid} for ${rec.domain}. Vercel accepted the order (${rec.orderId}) and is still registering it; ` +
        `the domain check (every 15 min) confirms it${rec.project ? `, attaches it to ${rec.project}` : ""} and emails the client.${card}`,
      email: "processing",
    };
  }
  return {
    telegram: `⚠️ ${who} PAID ${paid} for ${rec.domain} and it was NOT registered (${rec.note}). Buy it by hand (vercel domains buy ${rec.domain}) or refund them. They were told.`,
    email: "failed",
  };
}

/* ── 2b. Vercel finished (or not): settle what is still purchasing ───────── */

export interface SettleReport {
  domain: string;
  customer: string;
  email: string | null;
  record: DomainOrderRecord;
  step: "registered" | "failed" | "stuck";
  attach: "done" | "failed" | "none";
  attachDetail?: string;
  detail?: string;
}

/**
 * Every order Vercel was still registering when the webhook answered. Run by
 * the domain-live cron every 15 minutes: a completed order is attached to its
 * project and reported (the caller emails the client), a failed one is marked
 * failed and reported, and one still purchasing after STUCK_AFTER_HOURS is
 * reported once.
 */
export async function settlePurchasingOrders(stripe: Stripe, now = new Date()): Promise<SettleReport[]> {
  const out: SettleReport[] = [];
  let page: string | undefined;
  do {
    const res = await stripe.customers.search({
      query: `metadata['${KEYS.status}']:'purchasing'`,
      limit: 100,
      ...(page ? { page } : {}),
    });
    for (const c of res.data) {
      const rec = readOrderRecord(c.metadata);
      if (!rec || rec.status !== "purchasing" || !rec.orderId) continue;
      const s = await orderState(rec.orderId, rec.domain);
      const base = { domain: rec.domain, customer: c.id, email: c.email ?? null, attach: "none" as const };
      if (s.state === "purchasing") {
        const since = Date.parse(`${rec.boughtAt ?? now.toISOString().slice(0, 10)}T00:00:00Z`);
        if (rec.note !== "stuck-reported" && now.getTime() - since > STUCK_AFTER_HOURS * 3600000) {
          const next = { ...rec, note: "stuck-reported" };
          await stripe.customers.update(c.id, { metadata: orderRecordMetadata(next) });
          out.push({ ...base, record: next, step: "stuck", detail: s.detail });
        }
        continue;
      }
      if (s.state === "failed") {
        const next: DomainOrderRecord = { ...rec, status: "failed", renewsOn: undefined, note: s.detail };
        await stripe.customers.update(c.id, { metadata: orderRecordMetadata(next) });
        out.push({ ...base, record: next, step: "failed", detail: s.detail });
        continue;
      }
      let attach: SettleReport["attach"] = "none";
      let attachDetail: string | undefined;
      if (rec.project) {
        const a = await attachDomainToProject(rec.project, rec.domain);
        attach = a.ok ? "done" : "failed";
        if (!a.ok) attachDetail = `${a.code ?? a.status}${a.message ? `: ${a.message}` : ""}`;
      }
      const next: DomainOrderRecord = { ...rec, status: "bought", attached: attach === "done" ? rec.project : undefined, note: undefined };
      await stripe.customers.update(c.id, { metadata: orderRecordMetadata(next) });
      out.push({ ...base, record: next, step: "registered", attach, attachDetail });
    }
    page = res.has_more && res.next_page ? res.next_page : undefined;
  } while (page);
  return out;
}

/* ── 3. A year later: notice, then charge ────────────────────────────────── */

export type RenewalStep =
  | { kind: "notice"; price: number }
  | { kind: "charge"; price: number; wanted: number }
  | { kind: "wait" };

/**
 * What the cron does today for one record. Pure, so the dates are tested
 * without Stripe: a rise is announced once from NOTICE_DAYS out; the charge
 * happens from CHARGE_DAYS out. A record that is not bought, or was stopped
 * at the client's request, is never charged.
 *
 * THE CHARGE NEVER EXCEEDS WHAT THE CLIENT WAS TOLD. The terms promise a
 * price rise is emailed at least 30 days before; so the charge is capped at
 * the noticed price, or at last year's when no notice went out (a rise that
 * appeared inside the window, or a cron that did not run). `wanted` is the
 * uncapped figure, so the owner can see a margin that was held back.
 */
export function renewalStep(rec: DomainOrderRecord, todayIso: string, vercelRenewalUsd: number | null): RenewalStep {
  if (rec.status !== "bought" || !rec.renewsOn) return { kind: "wait" };
  const wanted = renewalRetailUsd(rec.retailUsd, vercelRenewalUsd);
  if (todayIso >= chargeDateFor(rec.renewsOn)) {
    const noticed = rec.noticedFor === rec.renewsOn && rec.noticedUsd ? rec.noticedUsd : 0;
    const cap = Math.max(rec.retailUsd, noticed) || wanted;
    return { kind: "charge", price: Math.min(wanted, cap), wanted };
  }
  const rises = wanted > rec.retailUsd + 0.004;
  if (rises && rec.noticedFor !== rec.renewsOn && todayIso >= daysBefore(rec.renewsOn, NOTICE_DAYS)) return { kind: "notice", price: wanted };
  return { kind: "wait" };
}

export interface RenewalReport {
  domain: string;
  customer: string;
  email: string | null;
  lang: "en" | "fr";
  step: "noticed" | "charged" | "charge-failed";
  priceUsd: number;
  previousUsd: number;
  renewsOn: string;
  /** The day the renewal is charged (for the notice email). */
  chargeOn: string;
  nextRenewsOn?: string;
  /** Set when the charge was held under Vercel's new price for want of notice. */
  heldBackUsd?: number;
  detail?: string;
}

/**
 * Every domain order due today. The invoice is a one-line invoice charged at
 * once on the saved card — not an invoice item left pending, because this
 * customer has no subscription to carry one. The record's date only moves
 * after a successful payment.
 */
export async function runDomainOrderRenewals(stripe: Stripe, todayIso: string): Promise<RenewalReport[]> {
  const out: RenewalReport[] = [];
  let page: string | undefined;
  do {
    const res = await stripe.customers.search({
      query: `metadata['${KEYS.status}']:'bought'`,
      limit: 100,
      ...(page ? { page } : {}),
    });
    for (const c of res.data) {
      const rec = readOrderRecord(c.metadata);
      if (!rec || !rec.renewsOn) continue;
      const vercel = await currentRenewalUsd(rec.domain);
      const step = renewalStep(rec, todayIso, vercel);
      if (step.kind === "wait") continue;
      const base = {
        domain: rec.domain, customer: c.id, email: c.email ?? null, lang: rec.lang, priceUsd: step.price,
        previousUsd: rec.retailUsd, renewsOn: rec.renewsOn, chargeOn: chargeDateFor(rec.renewsOn),
      };

      if (step.kind === "notice") {
        await stripe.customers.update(c.id, { metadata: orderRecordMetadata({ ...rec, noticedFor: rec.renewsOn, noticedUsd: step.price }) });
        out.push({ ...base, step: "noticed" });
        continue;
      }

      const key = `domain-order-${c.id}-${rec.renewsOn}`;
      try {
        /* THIS YEAR'S INVOICE, IF A PREVIOUS RUN ALREADY MADE IT. Stripe keeps
           an idempotency key for 24 hours only, so a card that failed today
           and is retried tomorrow would get a SECOND invoice from the same
           key — and Stripe's own retries may pay the first. The invoice is
           found by its metadata instead, and a paid one just moves the date. */
        const existing = (await stripe.invoices.list({ customer: c.id, limit: 20 })).data.find(
          (i) => i.metadata?.kind === "domain_order_renewal" && i.metadata?.renews_on === rec.renewsOn && i.status !== "void",
        );
        let inv = existing ?? await stripe.invoices.create({
          customer: c.id,
          collection_method: "charge_automatically",
          auto_advance: true,
          pending_invoice_items_behavior: "exclude",
          description: `Domain ${rec.domain} — renewal, 12 months from ${rec.renewsOn}`,
          metadata: { kind: "domain_order_renewal", domain: rec.domain, renews_on: rec.renewsOn },
        }, { idempotencyKey: `${key}-invoice` });
        /* A draft with nothing on it is a run that died between creating the
           invoice and adding its line. Found again by the lookup above, it
           must get its line now: finalised empty, it would read as "paid"
           for 0 and move the year on for free. */
        if (inv.status === "draft" && !((inv.total ?? 0) > 0)) {
          await stripe.invoiceItems.create({
            customer: c.id,
            invoice: inv.id,
            currency: "usd",
            amount: Math.round(step.price * 100),
            description: `Domain ${rec.domain} — 12 months from ${rec.renewsOn}`,
          }, { idempotencyKey: `${key}-item` });
        }
        if (inv.status === "draft") inv = await stripe.invoices.finalizeInvoice(inv.id!);
        if (inv.status === "open") inv = await stripe.invoices.pay(inv.id!);
        if (inv.status !== "paid") throw new Error(`invoice ${inv.id} is ${inv.status}`);
        if (!((inv.amount_paid ?? 0) > 0)) throw new Error(`invoice ${inv.id} was paid for 0 — check it in Stripe`);
        // The price actually charged, for the record and the email: an invoice
        // made on an earlier run carries that run's figure.
        const charged = (inv.amount_paid ?? 0) / 100;
        const next = nextYear(rec.renewsOn);
        await stripe.customers.update(c.id, {
          metadata: orderRecordMetadata({ ...rec, retailUsd: charged, renewsOn: next, noticedFor: undefined, noticedUsd: undefined }),
        });
        out.push({
          ...base, priceUsd: charged, step: "charged", nextRenewsOn: next,
          ...(step.wanted > charged + 0.004 ? { heldBackUsd: step.wanted } : {}),
        });
      } catch (e) {
        out.push({ ...base, step: "charge-failed", detail: e instanceof Error ? e.message : String(e) });
      }
    }
    page = res.has_more && res.next_page ? res.next_page : undefined;
  } while (page);
  return out;
}
