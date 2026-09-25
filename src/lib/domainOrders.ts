import type Stripe from "stripe";
import {
  attachDomainToProject, canBuyDomains, currentRenewalUsd, domainQuote, normalizeDomain,
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
 * renewalRetailUsd gives on the day, never lower than what they paid.
 */

export const DOMAIN_ORDER_KIND = "domain_order";
/** Days before the renewal date that a price rise is announced. */
export const NOTICE_DAYS = 30;
/** Days before the renewal date that the renewal is charged. */
export const CHARGE_DAYS = 7;

export interface DomainOrderRecord {
  domain: string;
  status: "bought" | "failed" | "stopped";
  /** What the client paid for the current year. */
  retailUsd: number;
  lang: "en" | "fr";
  name?: string;
  project?: string;
  orderId?: string;
  boughtAt?: string;
  /** ISO date the next year is due: the anniversary of the purchase. */
  renewsOn?: string;
  /** The renewsOn a price-rise notice was already sent for, so it is sent once. */
  noticedFor?: string;
  note?: string;
}

const P = "servolia_domain";
const KEYS: Record<keyof DomainOrderRecord, string> = {
  domain: P, status: `${P}_status`, retailUsd: `${P}_retail`, lang: `${P}_lang`, name: `${P}_name`,
  project: `${P}_project`, orderId: `${P}_order`, boughtAt: `${P}_bought`, renewsOn: `${P}_renews`,
  noticedFor: `${P}_noticed`, note: `${P}_note`,
};

export function readOrderRecord(meta: Record<string, string> | null | undefined): DomainOrderRecord | null {
  const m = meta ?? {};
  const domain = normalizeDomain(m[KEYS.domain]);
  if (!domain) return null;
  const status = m[KEYS.status] === "bought" || m[KEYS.status] === "stopped" ? m[KEYS.status] : "failed";
  const opt = (k: keyof DomainOrderRecord) => (m[KEYS[k]] ? { [k]: m[KEYS[k]] } : {});
  return {
    domain,
    status: status as DomainOrderRecord["status"],
    retailUsd: Number(m[KEYS.retailUsd]) || 0,
    lang: m[KEYS.lang] === "fr" ? "fr" : "en",
    ...opt("name"), ...opt("project"), ...opt("orderId"), ...opt("boughtAt"),
    ...opt("renewsOn"), ...opt("noticedFor"), ...opt("note"),
  } as DomainOrderRecord;
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
  if (!/.+@.+\..+/.test(o.email)) return { ok: false, error: "Not a valid email." };
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
  const project = (o.project ?? "").trim().slice(0, 100);
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
    customer_email: o.email,
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
            ? "Enregistré par Servolia pour vous, avec protection WHOIS. Renouvelé chaque année sur cette carte, prix annoncé 30 jours avant s'il change. Il vous appartient."
            : "Registered by Servolia for you, with WHOIS privacy. Renewed yearly on this card, with 30 days' notice of any price change. Yours to keep.",
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
    cancel_url: `${o.origin}/`,
  });
  if (!session.url) return { ok: false, error: "Stripe returned no link." };
  return { ok: true, url: session.url, yearlyUsd: q.yearlyUsd, expiresAt: new Date(expires * 1000).toISOString() };
}

/* ── 2. Paid: buy it, put it on the project ──────────────────────────────── */

export interface FulfilResult {
  domain: string;
  customerEmail: string | null;
  record: DomainOrderRecord;
  /** True when this delivery found the order already done (Stripe retries). */
  duplicate: boolean;
  attach: "done" | "failed" | "none";
  attachDetail?: string;
  cardSaved: boolean;
}

/**
 * Idempotent on the customer: Stripe delivers the same event more than once,
 * and a second delivery must find the record and stop, never try to buy the
 * name a second time. `test` never reaches the registrar.
 */
export async function fulfilDomainOrder(stripe: Stripe, session: Stripe.Checkout.Session, test: boolean): Promise<FulfilResult | null> {
  const domain = normalizeDomain(session.metadata?.domain);
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!domain || !customerId) return null;
  const retail = Number(session.metadata?.domain_retail_usd) || 0;
  const lang = session.metadata?.lang === "fr" ? "fr" : "en";
  const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;

  const customer = await stripe.customers.retrieve(customerId);
  const prior = "deleted" in customer && customer.deleted ? null : readOrderRecord((customer as Stripe.Customer).metadata);
  if (prior && prior.domain === domain) {
    return { domain, customerEmail, record: prior, duplicate: true, attach: "none", cardSaved: false };
  }

  const today = new Date().toISOString().slice(0, 10);
  const outcome = test
    ? { ok: false as const, reason: "error" as const, detail: "TEST: domain not bought" }
    : await purchaseDomainForClient(domain, retail);

  const project = session.metadata?.project || undefined;
  let attach: FulfilResult["attach"] = "none";
  let attachDetail: string | undefined;
  if (outcome.ok && project) {
    const res = await attachDomainToProject(project, domain);
    attach = res.ok ? "done" : "failed";
    if (!res.ok) attachDetail = `${res.code ?? res.status}${res.message ? `: ${res.message}` : ""}`;
  }

  /* The card that just paid becomes the one next year's renewal is charged
     to. Without a default payment method an off-session invoice has nothing
     to charge and the renewal fails silently a year from now. */
  let paymentMethod: string | null = null;
  try {
    const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (piId) {
      const pi = await stripe.paymentIntents.retrieve(piId);
      paymentMethod = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id ?? null;
    }
  } catch { /* recorded below as cardSaved: false */ }

  const record: DomainOrderRecord = {
    domain,
    status: outcome.ok ? "bought" : "failed",
    retailUsd: retail,
    lang,
    name: session.metadata?.name || undefined,
    project,
    orderId: outcome.ok ? outcome.orderId : undefined,
    boughtAt: outcome.ok ? today : undefined,
    renewsOn: outcome.ok ? nextYear(today) : undefined,
    note: outcome.ok ? undefined : `${outcome.reason}${outcome.detail ? ` (${outcome.detail})` : ""}`,
  };
  await stripe.customers.update(customerId, {
    metadata: orderRecordMetadata(record),
    ...(paymentMethod ? { invoice_settings: { default_payment_method: paymentMethod } } : {}),
  });
  return { domain, customerEmail, record, duplicate: false, attach, attachDetail, cardSaved: Boolean(paymentMethod) };
}

/* ── 3. A year later: notice, then charge ────────────────────────────────── */

export type RenewalStep =
  | { kind: "notice"; price: number }
  | { kind: "charge"; price: number }
  | { kind: "wait" };

/**
 * What the cron does today for one record. Pure, so the dates are tested
 * without Stripe: a rise is announced once from NOTICE_DAYS out; the charge
 * happens from CHARGE_DAYS out. A record that is not bought, or was stopped
 * at the client's request, is never charged.
 */
export function renewalStep(rec: DomainOrderRecord, todayIso: string, vercelRenewalUsd: number | null): RenewalStep {
  if (rec.status !== "bought" || !rec.renewsOn) return { kind: "wait" };
  const price = renewalRetailUsd(rec.retailUsd, vercelRenewalUsd);
  if (todayIso >= daysBefore(rec.renewsOn, CHARGE_DAYS)) return { kind: "charge", price };
  const rises = price > rec.retailUsd + 0.004;
  if (rises && rec.noticedFor !== rec.renewsOn && todayIso >= daysBefore(rec.renewsOn, NOTICE_DAYS)) return { kind: "notice", price };
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
  nextRenewsOn?: string;
  detail?: string;
}

/**
 * Every domain order due today. The invoice is a one-line invoice charged at
 * once on the saved card — not an invoice item left pending, because this
 * customer has no subscription to carry one. Idempotency keys are the
 * customer plus the renewal date, so a cron that runs twice cannot charge a
 * year twice; the record's date only moves after a successful payment.
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
      const base = { domain: rec.domain, customer: c.id, email: c.email ?? null, lang: rec.lang, priceUsd: step.price, previousUsd: rec.retailUsd, renewsOn: rec.renewsOn };

      if (step.kind === "notice") {
        await stripe.customers.update(c.id, { metadata: orderRecordMetadata({ ...rec, noticedFor: rec.renewsOn }) });
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
        let inv = existing;
        if (!inv) {
          inv = await stripe.invoices.create({
            customer: c.id,
            collection_method: "charge_automatically",
            auto_advance: true,
            pending_invoice_items_behavior: "exclude",
            description: `Domain ${rec.domain} — renewal, 12 months from ${rec.renewsOn}`,
            metadata: { kind: "domain_order_renewal", domain: rec.domain, renews_on: rec.renewsOn },
          }, { idempotencyKey: `${key}-invoice` });
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
        // The price actually charged, for the record and the email: an invoice
        // made on an earlier run carries that run's figure.
        step.price = (inv.amount_paid ?? Math.round(step.price * 100)) / 100;
        base.priceUsd = step.price;
        const next = nextYear(rec.renewsOn);
        await stripe.customers.update(c.id, {
          metadata: orderRecordMetadata({ ...rec, retailUsd: step.price, renewsOn: next, noticedFor: undefined }),
        });
        out.push({ ...base, step: "charged", nextRenewsOn: next });
      } catch (e) {
        out.push({ ...base, step: "charge-failed", detail: e instanceof Error ? e.message : String(e) });
      }
    }
    page = res.has_more && res.next_page ? res.next_page : undefined;
  } while (page);
  return out;
}
