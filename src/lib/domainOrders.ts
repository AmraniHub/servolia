import type Stripe from "stripe";
import {
  attachDomainToProject, canBuyDomains, currentRenewalUsd, domainOrder, domainQuote, normalizeDomain,
  purchaseDomainForClient, renewalDecision, daysBefore, chargeDateFor, NOTICE_DAYS, NOTICE_WINDOW_DAYS,
  CHARGE_DAYS, tldAllowed, DOMAIN_ORDER_TLDS, projectExists, domainInTeam, setDomainAutoRenew,
} from "@/lib/domainSales";
import { paidSubject, troubleSubject, money, type OwnerNotice } from "@/lib/notify";

export { daysBefore, chargeDateFor, NOTICE_DAYS, CHARGE_DAYS };

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
 * renewal is charged on it by the domain-billing cron (renewalDecision in
 * domainSales.ts: never above what the client was told).
 *
 * STATUSES:
 *   claimed    -- the webhook is about to call the registrar. Written BEFORE
 *                 the purchase, atomically (an idempotency key per Checkout
 *                 Session), so two deliveries of one event cannot both buy.
 *   purchasing -- Vercel accepted the order and has not finished it (Vercel
 *                 registers asynchronously); settled every 15 minutes by
 *                 /api/cron/domain-orders.
 *   bought     -- registered. Renewed every year.
 *   failed     -- not registered, and certainly not: refused, a founder test
 *                 purchase, or money that did not cover the price.
 *   unknown    -- the buy call died (network, Vercel 5xx): it may or may not
 *                 have gone through. Nobody refunds or re-buys before looking
 *                 at Vercel > Domains; the daily audit looks too.
 *   stopped    -- the client asked not to renew. Set from /admin/hosting
 *                 (stopDomainOrder), which also voids any renewal invoice and
 *                 switches Vercel's auto-renew off.
 */

export const DOMAIN_ORDER_KIND = "domain_order";
/** How long a Vercel order may stay "purchasing" before the owner is told. */
export const STUCK_AFTER_HOURS = 6;
/** A claim with no outcome this long after it was written is reported. */
export const CLAIM_STALE_MINUTES = 60;
/** Charge attempts on one renewal invoice before the cron stops retrying. */
export const MAX_CHARGE_ATTEMPTS = 4;
export const RENEWAL_INVOICE_KIND = "domain_order_renewal";

export type OrderStatus = "claimed" | "purchasing" | "bought" | "failed" | "unknown" | "stopped";
const STATUSES: OrderStatus[] = ["claimed", "purchasing", "bought", "failed", "unknown", "stopped"];

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
  /** ISO timestamp the purchase was claimed. */
  claimedAt?: string;
  /** ISO timestamp Vercel accepted the order. */
  placedAt?: string;
  /** ISO date of the registration. */
  boughtAt?: string;
  /** ISO date the next year is due: the anniversary of the purchase. */
  renewsOn?: string;
  /** The renewsOn a price-rise notice was SENT for (recorded after the send). */
  noticedFor?: string;
  /** The price that notice announced: the most the renewal may charge. */
  noticedUsd?: number;
  /** ISO date renewal was switched off (invoices voided, Vercel auto-renew off). */
  renewalOff?: string;
  note?: string;
}

const P = "servolia_domain";
const KEYS: Record<keyof DomainOrderRecord, string> = {
  domain: P, status: `${P}_status`, retailUsd: `${P}_retail`, lang: `${P}_lang`, name: `${P}_name`,
  project: `${P}_project`, attached: `${P}_attached`, orderId: `${P}_order`, session: `${P}_session`,
  claimedAt: `${P}_claimed`, placedAt: `${P}_placed`, boughtAt: `${P}_bought`, renewsOn: `${P}_renews`,
  noticedFor: `${P}_noticed`, noticedUsd: `${P}_noticed_usd`, renewalOff: `${P}_renewal_off`, note: `${P}_note`,
};
const TEXT_FIELDS = ["name", "project", "attached", "orderId", "session", "claimedAt", "placedAt", "boughtAt", "renewsOn", "noticedFor", "renewalOff", "note"] as const;

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

/** Every customer whose record is in `status`, all pages. */
async function customersIn(stripe: Stripe, status: OrderStatus): Promise<Stripe.Customer[]> {
  const out: Stripe.Customer[] = [];
  let page: string | undefined;
  do {
    const res = await stripe.customers.search({ query: `metadata['${KEYS.status}']:'${status}'`, limit: 100, ...(page ? { page } : {}) });
    out.push(...res.data);
    page = res.has_more && res.next_page ? res.next_page : undefined;
  } while (page);
  return out;
}

/** What the owner is told to do to close an order finished by hand. */
export function handFinishLine(domain: string, customerId: string): string {
  return `To close it once registered: /admin/hosting > New domain link > "Existing order" > ${domain} > Mark bought ` +
    `(checks Vercel, then writes the record and emails the client). By hand instead: Stripe > customer ${customerId} > metadata: ` +
    `${KEYS.status}=bought, ${KEYS.boughtAt}=YYYY-MM-DD (the purchase date), ${KEYS.renewsOn}=the same date a year later.`;
}

/* ── 1. The link ──────────────────────────────────────────────────────────── */

export type LinkResult =
  | { ok: true; url: string; yearlyUsd: number; expiresAt: string }
  | { ok: false; error: string };

/**
 * Quoted on the server at the moment the link is made, never taken from the
 * form: the price in the link is the price the webhook buys against, and a
 * name that is taken, an ending we do not sell, or a Vercel project that does
 * not exist never becomes a link.
 */
export async function createDomainOrderLink(stripe: Stripe, o: {
  domain: string; email: string; name?: string; project?: string; lang: "en" | "fr"; origin: string;
}): Promise<LinkResult> {
  const domain = normalizeDomain(o.domain);
  if (!domain) return { ok: false, error: "Not a valid domain name." };
  if (!tldAllowed(domain)) return { ok: false, error: `Only these endings are sold on their own: .${DOMAIN_ORDER_TLDS.join(", .")}.` };
  const email = o.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Not a valid email." };
  const project = (o.project ?? "").trim();
  // Vercel project names: lowercase letters, digits, - _ . (up to 100).
  if (project && !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(project)) return { ok: false, error: "Not a valid Vercel project name (lowercase letters, digits, - _ .)." };
  if (!canBuyDomains()) return { ok: false, error: "Domain purchases are not configured (VERCEL_TOKEN, VERCEL_TEAM_ID, DOMAIN_CONTACT_JSON)." };
  if (project) {
    const exists = await projectExists(project);
    if (exists === false) return { ok: false, error: `No Vercel project named "${project}" in the team. Check the name in Vercel.` };
    if (exists === null) return { ok: false, error: "Could not check the Vercel project right now. Try again." };
  }

  const q = await domainQuote(domain);
  if (!q.sellable) {
    const why: Record<string, string> = {
      taken: "That domain is already registered.", unsupported: "Vercel does not sell that ending.",
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
  customerId: string;
  customerEmail: string | null;
  record: DomainOrderRecord;
  /**
   * "done": this delivery did the work. "duplicate": an earlier delivery
   * finished it. "concurrent": another delivery of the same event holds the
   * claim right now. Neither of those two says anything. "interrupted": an
   * earlier delivery claimed the purchase and never recorded how it ended;
   * nothing was bought now, and the owner must look at Vercel. "conflict":
   * the customer already carries a different domain; nothing was bought.
   */
  outcome: "done" | "duplicate" | "concurrent" | "interrupted" | "conflict";
  attach: "done" | "failed" | "none";
  attachDetail?: string;
  cardSaved: boolean;
}

function isIdempotencyClash(err: unknown): boolean {
  const e = err as { statusCode?: number; type?: string; code?: string } | null;
  return e?.statusCode === 409 || e?.type === "StripeIdempotencyError" || e?.type === "idempotency_error" || e?.code === "idempotency_key_in_use";
}

/**
 * Idempotent on the customer, and the claim is ATOMIC: it is written with
 * the idempotency key `domain-claim-<session id>`. Stripe answers a second
 * request with that key as a replay (Idempotent-Replayed: true) or, while
 * the first is still in flight, with a 409 — either way this delivery is not
 * the one that buys, and it stops. Two deliveries racing through the read
 * above therefore make one registrar call between them.
 *
 * `test` never reaches the registrar (and registrar() refuses on its own in
 * a test context too). `pollMs`: the waits between reads of an order Vercel
 * is still registering — short, because Stripe is waiting on this response.
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
  const none = { customerId, customerEmail, attach: "none" as const, cardSaved: false };

  const customer = await stripe.customers.retrieve(customerId);
  const prior = "deleted" in customer && customer.deleted ? null : readOrderRecord((customer as Stripe.Customer).metadata);
  if (prior && prior.domain !== domain) return { ...none, domain, record: prior, outcome: "conflict" };
  if (prior) return { ...none, domain, record: { ...prior, name: prior.name ?? name }, outcome: prior.status === "claimed" ? "interrupted" : "duplicate" };

  const base: DomainOrderRecord = {
    domain, status: "claimed", retailUsd: retail, lang, name, project, session: session.id, claimedAt: new Date().toISOString(),
  };
  try {
    const claimed = await stripe.customers.update(customerId, { metadata: orderRecordMetadata(base) }, { idempotencyKey: `domain-claim-${session.id}` });
    if (claimed.lastResponse?.headers?.["idempotent-replayed"] === "true") return { ...none, domain, record: base, outcome: "concurrent" };
  } catch (err) {
    if (isIdempotencyClash(err)) return { ...none, domain, record: base, outcome: "concurrent" };
    throw err;
  }

  /* The price the webhook buys against is the one in the link; the money
     that arrived must cover it, in USD. An amount the session does not state
     is not assumed: nothing is bought. */
  const paid = paidUsdCents(session);
  const outcome = test
    ? { ok: false as const, reason: "error" as const, detail: "TEST: domain not bought" }
    : paid === null
      ? { ok: false as const, reason: "error" as const, detail: `payment amount unreadable (${session.currency ?? "no currency"}); nothing bought` }
      : paid < Math.round(retail * 100)
        ? { ok: false as const, reason: "error" as const, detail: `paid ${(paid / 100).toFixed(2)} USD, price ${retail.toFixed(2)} USD` }
        : await purchaseDomainForClient(domain, retail);

  let state: OrderState = "failed";
  let stateDetail: string | undefined;
  const placedAt = outcome.ok ? new Date().toISOString() : undefined;
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

  const today = new Date().toISOString().slice(0, 10);
  const placed = outcome.ok && state !== "failed";
  const status: OrderStatus = state === "completed" ? "bought"
    : placed ? "purchasing"
    : !outcome.ok && outcome.reason === "unknown" ? "unknown"
    : "failed";
  const record: DomainOrderRecord = {
    ...base,
    status,
    attached: attach === "done" ? project : undefined,
    orderId: outcome.ok ? outcome.orderId : undefined,
    placedAt,
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
  return { domain, customerId, customerEmail, record, outcome: "done", attach, attachDetail, cardSaved: Boolean(paymentMethod) };
}

/** What the client's email should say about this order, if anything. */
export type OrderEmailState = "registered" | "processing" | "failed";

const ADMIN_LINK = "https://servolia.com/admin/hosting";

/**
 * The owner's notice (Telegram + email, src/lib/notify.ts) and the client's
 * email state for one webhook delivery. Pure, so every branch is tested
 * without Stripe, Telegram or Resend. Money that arrived and a name that is
 * registered (or being registered) is a "Paid:" notice; anything the owner
 * must act on is a "⚠️" one.
 */
export function describeDomainOrder(res: FulfilResult): { owner: OwnerNotice | null; email: OrderEmailState | null } {
  const rec = res.record;
  const who = rec.name || res.customerEmail || res.customerId;
  const paid = money(rec.retailUsd, "USD");
  if (res.outcome === "duplicate" || res.outcome === "concurrent") return { owner: null, email: null };
  if (res.outcome === "conflict") {
    return {
      owner: {
        subject: troubleSubject("Domain order conflict", res.domain, who),
        lines: [`A domain order for ${res.domain} was paid, but Stripe customer ${res.customerId} already holds ${rec.domain}. Nothing was bought.`, "Next: check both in Stripe; buy by hand or refund."],
        link: ADMIN_LINK,
      },
      email: null,
    };
  }
  if (res.outcome === "interrupted") {
    return {
      owner: {
        subject: troubleSubject("Domain order interrupted", rec.domain, who),
        lines: [
          `${rec.domain} was delivered again while its purchase was claimed (${rec.claimedAt ?? "?"}) and never recorded. NOTHING was bought this time, and the client has NOT been emailed.`,
          `Next: look in Vercel > Domains for ${rec.domain}. There: mark it bought. Not there: buy it (vercel domains buy ${rec.domain}) and mark it bought, or refund.`,
          handFinishLine(rec.domain, res.customerId),
        ],
        link: ADMIN_LINK,
      },
      email: null,
    };
  }
  const card = res.cardSaved ? null : "Card NOT saved as default — next year's renewal will fail; set it in Stripe.";
  if (rec.status === "bought") {
    const where = res.attach === "done" ? `Attached to Vercel project ${rec.project}.`
      : res.attach === "failed" ? `NOT attached to ${rec.project} (${res.attachDetail}).`
      : "No Vercel project named.";
    return {
      owner: {
        subject: paidSubject(`Domain ${rec.domain}`, rec.retailUsd, "USD", who),
        lines: [
          `${rec.domain} is REGISTERED (Vercel order ${rec.orderId}) — ${paid}/year, renews ${rec.renewsOn}.`, where, card,
          `Next: ${[
            res.attach === "failed" && `add it in Vercel > ${rec.project} > Domains`,
            res.attach === "none" && "attach it to the client's project by hand",
            card && "set the card as default in Stripe",
            "click ICANN's verification email when it arrives (15 days)",
          ].filter(Boolean).join("; ")}.`,
        ],
        link: ADMIN_LINK,
      },
      email: "registered",
    };
  }
  if (rec.status === "purchasing") {
    return {
      owner: {
        subject: paidSubject(`Domain ${rec.domain}`, rec.retailUsd, "USD", who),
        lines: [
          `Vercel accepted the order (${rec.orderId}) for ${rec.domain} and is still registering it — ${paid}/year.`, card,
          `Next: nothing now — the 15-minute domain-order check confirms it${rec.project ? `, attaches it to ${rec.project}` : ""} and emails the client.`,
        ],
        link: ADMIN_LINK,
      },
      email: "processing",
    };
  }
  if (rec.status === "unknown") {
    return {
      owner: {
        subject: troubleSubject("Domain purchase unknown", `${rec.domain} — ${paid} paid`, who),
        lines: [
          `The buy call for ${rec.domain} died (${rec.note}): it MAY have gone through. Do not buy again or refund before checking.`,
          `Next: look in Vercel > Domains for ${rec.domain}. There: mark it bought. Not there: buy it (vercel domains buy ${rec.domain}) and mark it bought, or refund.`,
          handFinishLine(rec.domain, res.customerId),
        ],
        link: ADMIN_LINK,
      },
      email: "failed",
    };
  }
  return {
    owner: {
      subject: troubleSubject("Domain NOT registered", `${rec.domain} — ${paid} paid`, who),
      lines: [
        `${who} paid ${paid} for ${rec.domain} and it was NOT registered (${rec.note}). They were told it is being finished by hand or refunded.`,
        `Next: buy it (vercel domains buy ${rec.domain}) and mark it bought, or refund the payment in Stripe.`,
        handFinishLine(rec.domain, res.customerId),
      ],
      link: ADMIN_LINK,
    },
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
 * /api/cron/domain-orders every 15 minutes: a completed order is attached to
 * its project and reported (the caller emails the client), a failed one is
 * marked failed and reported, and one still purchasing STUCK_AFTER_HOURS
 * after Vercel accepted it is reported once. The record is written before
 * the caller's email, so no run sends a second one.
 */
export async function settlePurchasingOrders(stripe: Stripe, now = new Date()): Promise<SettleReport[]> {
  const out: SettleReport[] = [];
  for (const c of await customersIn(stripe, "purchasing")) {
    const rec = readOrderRecord(c.metadata);
    if (!rec || rec.status !== "purchasing" || !rec.orderId) continue;
    const s = await orderState(rec.orderId, rec.domain);
    const base = { domain: rec.domain, customer: c.id, email: c.email ?? null, attach: "none" as const };
    if (s.state === "purchasing") {
      const since = Date.parse(rec.placedAt ?? `${rec.boughtAt ?? now.toISOString().slice(0, 10)}T00:00:00Z`);
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
  return out;
}

/* ── 2c. The owner's hand: mark bought, stop renewing ─────────────────────── */

/** The customer carrying `domain`, or a reason there is not exactly one. */
async function customerFor(stripe: Stripe, domain: string, customerId?: string): Promise<{ customer: Stripe.Customer; record: DomainOrderRecord } | { error: string }> {
  if (customerId) {
    const c = await stripe.customers.retrieve(customerId);
    const rec = "deleted" in c && c.deleted ? null : readOrderRecord((c as Stripe.Customer).metadata);
    if (!rec || rec.domain !== domain) return { error: `Customer ${customerId} holds no order for ${domain}.` };
    return { customer: c as Stripe.Customer, record: rec };
  }
  const res = await stripe.customers.search({ query: `metadata['${P}']:'${domain}'`, limit: 10 });
  const found = res.data.map((c) => ({ customer: c, record: readOrderRecord(c.metadata) })).filter((x): x is { customer: Stripe.Customer; record: DomainOrderRecord } => x.record !== null);
  if (found.length === 0) return { error: `No domain order for ${domain} in Stripe.` };
  if (found.length > 1) return { error: `${found.length} Stripe customers hold ${domain} (${found.map((f) => `${f.customer.id}: ${f.record.status}`).join(", ")}). Give the customer id.` };
  return found[0];
}

export type MarkResult =
  | { ok: true; record: DomainOrderRecord; customer: string; email: string | null; attach: "done" | "failed" | "none"; attachDetail?: string }
  | { ok: false; error: string };

/**
 * An order finished by hand (failed, unknown, interrupted, stuck) is marked
 * bought — but only once Vercel says the name really is in our team, so a
 * wrong click cannot start charging a client for a domain nobody owns. The
 * purchase date is Vercel's when it has one, the renewal a year after it;
 * the domain is attached to the recorded project. The caller emails the
 * client.
 */
export async function markDomainOrderBought(stripe: Stripe, domainInput: string, customerId?: string): Promise<MarkResult> {
  const domain = normalizeDomain(domainInput);
  if (!domain) return { ok: false, error: "Not a valid domain name." };
  const found = await customerFor(stripe, domain, customerId);
  if ("error" in found) return { ok: false, error: found.error };
  const { customer, record } = found;
  if (record.status === "bought") return { ok: false, error: `${domain} is already marked bought (renews ${record.renewsOn ?? "?"}).` };
  if (record.status === "stopped") return { ok: false, error: `${domain} was stopped at the client's request.` };
  const team = await domainInTeam(domain);
  if (team.inTeam === false) return { ok: false, error: `${domain} is NOT in our Vercel team. Buy it first (vercel domains buy ${domain}), then mark it bought.` };
  if (team.inTeam === null) return { ok: false, error: "Could not check Vercel right now. Try again." };
  const boughtAt = (team.boughtAt ?? new Date().toISOString()).slice(0, 10);
  let attach: "done" | "failed" | "none" = "none";
  let attachDetail: string | undefined;
  if (record.project && record.attached !== record.project) {
    const a = await attachDomainToProject(record.project, domain);
    attach = a.ok ? "done" : "failed";
    if (!a.ok) attachDetail = `${a.code ?? a.status}${a.message ? `: ${a.message}` : ""}`;
  }
  const next: DomainOrderRecord = {
    ...record, status: "bought", boughtAt, renewsOn: nextYear(boughtAt),
    attached: attach === "done" ? record.project : record.attached, note: "marked bought by hand",
  };
  await stripe.customers.update(customer.id, { metadata: orderRecordMetadata(next) });
  return { ok: true, record: next, customer: customer.id, email: customer.email ?? null, attach, attachDetail };
}

/**
 * Switch a domain's renewal off: every draft renewal invoice deleted, every
 * open one voided, Vercel's auto-renew set off. Idempotent; records the day
 * it all succeeded so the daily sweep does not repeat it.
 */
async function switchRenewalOff(stripe: Stripe, customerId: string, rec: DomainOrderRecord): Promise<{ record: DomainOrderRecord; voided: string[]; problems: string[] }> {
  const voided: string[] = [];
  const problems: string[] = [];
  const invoices = (await stripe.invoices.list({ customer: customerId, limit: 20 })).data.filter((i) => i.metadata?.kind === RENEWAL_INVOICE_KIND);
  for (const inv of invoices) {
    try {
      if (inv.status === "draft") { await stripe.invoices.del(inv.id!); voided.push(`${inv.id} deleted`); }
      else if (inv.status === "open") { await stripe.invoices.voidInvoice(inv.id!); voided.push(`${inv.id} voided`); }
    } catch (e) {
      problems.push(`${inv.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const off = await setDomainAutoRenew(rec.domain, false);
  if (!off.ok) problems.push(`Vercel auto-renew still ON (${off.code ?? off.status}${off.message ? `: ${off.message}` : ""})`);
  const record: DomainOrderRecord = problems.length ? rec : { ...rec, renewalOff: new Date().toISOString().slice(0, 10) };
  if (!problems.length) await stripe.customers.update(customerId, { metadata: orderRecordMetadata(record) });
  return { record, voided, problems };
}

export type StopResult =
  | { ok: true; record: DomainOrderRecord; voided: string[]; problems: string[] }
  | { ok: false; error: string };

/** The client asked not to renew: status stopped, then switchRenewalOff. */
export async function stopDomainOrder(stripe: Stripe, domainInput: string, customerId?: string): Promise<StopResult> {
  const domain = normalizeDomain(domainInput);
  if (!domain) return { ok: false, error: "Not a valid domain name." };
  const found = await customerFor(stripe, domain, customerId);
  if ("error" in found) return { ok: false, error: found.error };
  const stopped: DomainOrderRecord = { ...found.record, status: "stopped", noticedFor: undefined, noticedUsd: undefined };
  await stripe.customers.update(found.customer.id, { metadata: orderRecordMetadata(stopped) });
  const r = await switchRenewalOff(stripe, found.customer.id, stopped);
  return { ok: true, ...r };
}

/** Daily: any stopped order whose renewal is not yet switched off (set by hand in Stripe, or a Vercel call that failed). */
export async function sweepStoppedOrders(stripe: Stripe): Promise<{ domain: string; customer: string; voided: string[]; problems: string[] }[]> {
  const out: { domain: string; customer: string; voided: string[]; problems: string[] }[] = [];
  for (const c of await customersIn(stripe, "stopped")) {
    const rec = readOrderRecord(c.metadata);
    if (!rec || rec.renewalOff) continue;
    const r = await switchRenewalOff(stripe, c.id, rec);
    out.push({ domain: rec.domain, customer: c.id, voided: r.voided, problems: r.problems });
  }
  return out;
}

/**
 * Daily, from the domain-billing cron (so at most once a day): records that
 * need a human. A bought record with no renewal date is never renewed; a
 * failed or unknown record whose name IS in our Vercel team is a domain we
 * pay for and nobody is charged for; a claim with no outcome is a purchase
 * that stopped half way.
 */
export async function auditDomainOrders(stripe: Stripe, now = new Date()): Promise<string[]> {
  const lines: string[] = [];
  for (const c of await customersIn(stripe, "bought")) {
    const rec = readOrderRecord(c.metadata);
    if (rec && !rec.renewsOn) lines.push(`${rec.domain} (${c.id}) is bought with NO renewal date: it will never be renewed. Set ${KEYS.renewsOn}=YYYY-MM-DD in Stripe.`);
  }
  for (const status of ["failed", "unknown"] as const) {
    for (const c of await customersIn(stripe, status)) {
      const rec = readOrderRecord(c.metadata);
      if (!rec) continue;
      const team = await domainInTeam(rec.domain);
      if (team.inTeam) lines.push(`${rec.domain} (${c.id}) is recorded ${status} but IS registered in our Vercel team. ${handFinishLine(rec.domain, c.id)}`);
      else if (status === "unknown") lines.push(`${rec.domain} (${c.id}): purchase outcome still unknown and not in our Vercel team${team.inTeam === null ? " (Vercel unreadable)" : ""}. Buy it and mark it bought, or refund.`);
    }
  }
  for (const c of await customersIn(stripe, "claimed")) {
    const rec = readOrderRecord(c.metadata);
    if (rec && (!rec.claimedAt || now.getTime() - Date.parse(rec.claimedAt) > CLAIM_STALE_MINUTES * 60000)) {
      lines.push(`${rec.domain} (${c.id}): purchase claimed ${rec.claimedAt ?? "at an unknown time"} and never finished. Look in Vercel > Domains. ${handFinishLine(rec.domain, c.id)}`);
    }
  }
  return lines;
}

/* ── 3. A year later: notice, then charge ────────────────────────────────── */

/**
 * What the cron does today for one record (renewalDecision, domainSales.ts).
 * A record that is not bought, or was stopped at the client's request, is
 * never noticed or charged.
 */
export function renewalStep(rec: DomainOrderRecord, todayIso: string, vercelRenewalUsd: number | null) {
  if (rec.status !== "bought" || !rec.renewsOn) return { kind: "wait" as const };
  return renewalDecision({
    paidUsd: rec.retailUsd, vercelRenewalUsd, renewsOn: rec.renewsOn, todayIso,
    noticedFor: rec.noticedFor, noticedUsd: rec.noticedUsd,
  });
}

export interface RenewalReport {
  domain: string;
  customer: string;
  email: string | null;
  lang: "en" | "fr";
  step: "noticed" | "notice-failed" | "charged" | "charge-failed" | "gave-up";
  priceUsd: number;
  previousUsd: number;
  renewsOn: string;
  /** The day the renewal is charged (for the notice email). */
  chargeOn: string;
  nextRenewsOn?: string;
  /** Set when the charge was held under Vercel's new price for want of notice. */
  heldBackUsd?: number;
  attempts?: number;
  detail?: string;
}

/**
 * Every domain order due today.
 *
 * NOTICE: `sendNotice` is called first and the notice is recorded on the
 * customer ONLY if it returns true — a notice nobody received cannot
 * authorise a higher charge. A failed send is retried the next day while the
 * notice window lasts.
 *
 * CHARGE: a one-line invoice on the saved card, auto_advance OFF — this cron
 * is its only collector, once a day, at most MAX_CHARGE_ATTEMPTS times, the
 * attempt count kept on the invoice. The invoice is found again by its
 * metadata (Stripe's idempotency keys last 24 hours, retries span days). A
 * draft that is still empty after its line was added is deleted, never
 * finalised at 0. The record's date only moves after a successful payment.
 */
export async function runDomainOrderRenewals(
  stripe: Stripe, todayIso: string,
  hooks: { sendNotice: (r: RenewalReport) => Promise<boolean> },
): Promise<RenewalReport[]> {
  const out: RenewalReport[] = [];
  for (const c of await customersIn(stripe, "bought")) {
    const rec = readOrderRecord(c.metadata);
    if (!rec || !rec.renewsOn) continue;
    // Vercel is only asked when something could happen: from the first notice day.
    if (todayIso < daysBefore(rec.renewsOn, NOTICE_DAYS + NOTICE_WINDOW_DAYS)) continue;
    const vercel = await currentRenewalUsd(rec.domain);
    const step = renewalStep(rec, todayIso, vercel);
    if (step.kind === "wait") continue;
    const base = {
      domain: rec.domain, customer: c.id, email: c.email ?? null, lang: rec.lang, priceUsd: step.price,
      previousUsd: rec.retailUsd, renewsOn: rec.renewsOn, chargeOn: chargeDateFor(rec.renewsOn),
    };

    if (step.kind === "notice") {
      const report: RenewalReport = { ...base, step: "noticed" };
      if (!c.email || !(await hooks.sendNotice(report))) {
        out.push({ ...base, step: "notice-failed", detail: c.email ? "email not sent" : "no email on the customer" });
        continue;
      }
      await stripe.customers.update(c.id, { metadata: orderRecordMetadata({ ...rec, noticedFor: rec.renewsOn, noticedUsd: step.price }) });
      out.push(report);
      continue;
    }

    const key = `domain-order-${c.id}-${rec.renewsOn}`;
    let attempts = 0;
    try {
      const existing = (await stripe.invoices.list({ customer: c.id, limit: 20 })).data.find(
        (i) => i.metadata?.kind === RENEWAL_INVOICE_KIND && i.metadata?.renews_on === rec.renewsOn && i.status !== "void",
      );
      attempts = Number(existing?.metadata?.attempts ?? 0) || 0;
      if (existing?.metadata?.gave_up) continue; // reported once, when it gave up
      let inv = existing ?? await stripe.invoices.create({
        customer: c.id,
        collection_method: "charge_automatically",
        auto_advance: false,
        pending_invoice_items_behavior: "exclude",
        description: `Domain ${rec.domain} — renewal, 12 months from ${rec.renewsOn}`,
        metadata: { kind: RENEWAL_INVOICE_KIND, domain: rec.domain, renews_on: rec.renewsOn, attempts: "0" },
      }, { idempotencyKey: `${key}-invoice` });
      if (inv.status === "draft" && !((inv.total ?? 0) > 0)) {
        await stripe.invoiceItems.create({
          customer: c.id,
          invoice: inv.id,
          currency: "usd",
          amount: Math.round(step.price * 100),
          description: `Domain ${rec.domain} — 12 months from ${rec.renewsOn}`,
        }, { idempotencyKey: `${key}-item` });
        inv = await stripe.invoices.retrieve(inv.id!);
        if (inv.status === "draft" && !((inv.total ?? 0) > 0)) {
          await stripe.invoices.del(inv.id!);
          throw new Error(`invoice ${inv.id} was still empty after its line was added; deleted, retried tomorrow`);
        }
      }
      if (inv.status === "draft") inv = await stripe.invoices.finalizeInvoice(inv.id!, { auto_advance: false });
      if (inv.status === "open") {
        try {
          inv = await stripe.invoices.pay(inv.id!);
        } catch (e) {
          attempts += 1;
          const gaveUp = attempts >= MAX_CHARGE_ATTEMPTS;
          await stripe.invoices.update(inv.id!, { metadata: { attempts: String(attempts), ...(gaveUp ? { gave_up: new Date().toISOString().slice(0, 10) } : {}) } });
          throw Object.assign(e instanceof Error ? e : new Error(String(e)), { gaveUp });
        }
      }
      if (inv.status !== "paid") throw new Error(`invoice ${inv.id} is ${inv.status}`);
      if (!((inv.amount_paid ?? 0) > 0)) throw new Error(`invoice ${inv.id} was paid for 0 — check it in Stripe`);
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
      const gaveUp = Boolean((e as { gaveUp?: boolean }).gaveUp);
      out.push({ ...base, step: gaveUp ? "gave-up" : "charge-failed", attempts, detail: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
