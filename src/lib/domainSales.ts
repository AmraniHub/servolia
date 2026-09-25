/**
 * DOMAINS SOLD THROUGH SERVOLIA, REGISTERED ON VERCEL.
 *
 * A client on the plan chooser can add a domain to their hosting. It is
 * checked and priced live against Vercel's registrar, billed with the plan as
 * a second line (so it renews when the plan renews), bought by the payment
 * webhook the moment the checkout completes -- registered in Servolia's name
 * on the client's behalf, with WHOIS privacy -- and attached to their project
 * once we know which one it is.
 *
 * PRICING IS DERIVED FROM VERCEL'S RENEWAL PRICE, NEVER ITS FIRST-YEAR PRICE.
 * Vercel sells .store for 1.99 and renews it at 44.00, .shop for 2.99 and
 * renews at 38.39. A flat price built on the teaser would lose money from
 * year two on every one of them.
 *
 * THE RULE IS A PROFIT, NOT A PRICE. Abdelali wants at least
 * DOMAIN_TARGET_PROFIT_USD in his pocket per domain per year, after Stripe.
 * So: retail = (renewal + target profit + Stripe's fixed fee) / (1 - Stripe's
 * rate), rounded up, never below DOMAIN_MIN_RETAIL_USD (so a .org is not
 * cheaper than a .com), never above DOMAIN_MAX_RETAIL_USD (not offered). The
 * Stripe rate is set high on purpose -- cards from outside the US and
 * Adaptive Pricing conversions cost more than the headline 2.9 % -- because
 * a margin that is right on the median card is wrong on the worst one.
 * A domain is never bought for more than the client is charged for it.
 *
 * Needs VERCEL_TOKEN (a token for the team), VERCEL_TEAM_ID, and
 * DOMAIN_CONTACT_JSON -- the registrant contact, which is SERVOLIA'S and not
 * the client's, because ICANN emails that address to verify it and suspends
 * the domain if nobody clicks within 15 days. Without the first two the
 * chooser does not offer domains at all; without the third, quotes work but
 * purchases wait for the operator.
 */

import { inTestContext } from "@/lib/testContext";

const API = "https://api.vercel.com";

/** What Abdelali keeps per domain per year, after Stripe. */
export const DOMAIN_TARGET_PROFIT_USD = 13;
/** Stripe, assumed at its worst realistic case: non-US card + currency conversion. */
export const STRIPE_RATE = 0.05;
export const STRIPE_FIXED_USD = 0.3;
/** The floor, his rule (2026-09-24): no domain sells under 27.90 a year. */
export const DOMAIN_MIN_RETAIL_USD = 27.9;
export const DOMAIN_MAX_RETAIL_USD = 80;

export function isDomainSalesConfigured(): boolean {
  return Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID);
}

/** True when a purchase can actually be made, not only quoted. */
export function canBuyDomains(): boolean {
  return isDomainSalesConfigured() && domainContact() !== null;
}

/**
 * "https://www.Example.COM/page" -> "example.com". Null for anything that is
 * not a plain ASCII domain: internationalised names need a language code at
 * purchase and are not offered.
 */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  s = s.split(/[/?#]/)[0].replace(/\.+$/, "");
  if (s.length < 4 || s.length > 253) return null;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(s)) return null;
  return s;
}

/**
 * Every price ends in .90 and is rounded UP to get there: 25.84 needed sells
 * at 27.90 (the floor), 31.20 at 31.90, 31.90 at 31.90. Rounding down to the
 * nearest .90 would put the price under what the profit rule needs.
 */
export function retailYearlyUsd(renewalUsd: number): number {
  return Math.round(Math.max(DOMAIN_MIN_RETAIL_USD, ninetyUp(neededUsd(renewalUsd))) * 100) / 100;
}

/** What the client must pay for the profit rule to hold at this Vercel price. */
function neededUsd(renewalUsd: number): number {
  return (renewalUsd + DOMAIN_TARGET_PROFIT_USD + STRIPE_FIXED_USD) / (1 - STRIPE_RATE);
}

/** Up to the next .90 (31.20 -> 31.90, 31.90 -> 31.90, 31.91 -> 32.90). */
function ninetyUp(n: number): number {
  return Math.round((Math.ceil(Math.round((n - 0.9) * 100) / 100) + 0.9) * 100) / 100;
}

/**
 * WHAT A RENEWAL COSTS THE CLIENT: last year's price, unless the REGISTRY
 * raised Vercel's price enough that last year's figure no longer leaves the
 * target profit — then the lowest .90 price that restores it.
 *
 * Deliberately not "today's retail price": a client who bought before the
 * 27.90 floor or the .90 rounding existed (a plan domain at 26) keeps their
 * price for as long as the margin holds. The floor and the rounding apply to
 * NEW sales; a renewal only ever moves because the registry did, which is
 * the one reason the emails give ("the registry raised its price").
 * Unknown Vercel price (API down) = last year's price, because a renewal is
 * not the moment to guess upward.
 */
export function renewalRetailUsd(paidUsd: number, vercelRenewalUsd: number | null): number {
  const paid = Number.isFinite(paidUsd) && paidUsd > 0 ? paidUsd : DOMAIN_MIN_RETAIL_USD;
  if (vercelRenewalUsd === null || !Number.isFinite(vercelRenewalUsd)) return paid;
  if (netProfitUsd(paid, vercelRenewalUsd) >= DOMAIN_TARGET_PROFIT_USD - 0.005) return paid;
  return Math.max(paid, ninetyUp(neededUsd(vercelRenewalUsd)));
}

/* ── The renewal calendar, shared by every domain we sell ────────────────
 *
 * THE PROMISE IS 30 DAYS BEFORE THE MONEY MOVES (owner decision,
 * 2026-09-25). The card is charged CHARGE_DAYS (7) before the renewal date,
 * so a price rise is announced by email between 44 and 37 days before the
 * renewal date — at least 30 days before we charge — and never later. The
 * charge NEVER exceeds what the client was told: the announced price, or
 * last year's when no notice went out (a rise that appeared too late waits
 * a year). */

/** Latest day a price rise may be announced: the renewal date minus this (30 days before the charge + CHARGE_DAYS). */
export const NOTICE_DAYS = 37;
/** Earliest day it may be announced: NOTICE_DAYS + this, so a missed cron day is not a missed notice. */
export const NOTICE_WINDOW_DAYS = 7;
/** Days before the renewal date that the renewal is charged. */
export const CHARGE_DAYS = 7;

/** An ISO date `days` before another. */
export function daysBefore(iso: string, days: number): string {
  return new Date(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
}

/** The day a renewal is charged: CHARGE_DAYS before the renewal date. */
export const chargeDateFor = (renewsOn: string) => daysBefore(renewsOn, CHARGE_DAYS);

export type RenewalDecision =
  | { kind: "notice"; price: number }
  | { kind: "charge"; price: number; wanted: number }
  | { kind: "wait" };

/**
 * What to do today for one domain. Pure.
 *  - charge: from CHARGE_DAYS out, at min(wanted, what the client was told);
 *    `wanted` is the uncapped figure, so a held-back margin can be reported.
 *  - notice: a rise, not yet announced for this renewal date, inside the
 *    window [renewsOn − 44, renewsOn − 37] (at least 30 days before the
 *    charge on renewsOn − 7). Recorded by the caller ONLY once
 *    the email went out, so a failed send is retried the next day while the
 *    window lasts, and after it the rise simply waits a year.
 */
export function renewalDecision(o: {
  paidUsd: number; vercelRenewalUsd: number | null; renewsOn: string; todayIso: string;
  noticedFor?: string; noticedUsd?: number;
}): RenewalDecision {
  const wanted = renewalRetailUsd(o.paidUsd, o.vercelRenewalUsd);
  const paid = Number.isFinite(o.paidUsd) && o.paidUsd > 0 ? o.paidUsd : wanted;
  if (o.todayIso >= chargeDateFor(o.renewsOn)) {
    const noticed = o.noticedFor === o.renewsOn && o.noticedUsd ? o.noticedUsd : 0;
    return { kind: "charge", price: Math.min(wanted, Math.max(paid, noticed)), wanted };
  }
  const rises = wanted > paid + 0.004;
  const inWindow = o.todayIso >= daysBefore(o.renewsOn, NOTICE_DAYS + NOTICE_WINDOW_DAYS) && o.todayIso <= daysBefore(o.renewsOn, NOTICE_DAYS);
  if (rises && o.noticedFor !== o.renewsOn && inWindow) return { kind: "notice", price: wanted };
  return { kind: "wait" };
}

/** "2027-09-24=35.9" <-> { noticedFor, noticedUsd }: the notice marker kept in a notes line. */
export function readNoticed(v: string | undefined): { noticedFor?: string; noticedUsd?: number } {
  const m = /^(\d{4}-\d{2}-\d{2})=(\d+(?:\.\d+)?)$/.exec(v ?? "");
  return m ? { noticedFor: m[1], noticedUsd: Number(m[2]) } : {};
}
export const writeNoticed = (renewsOn: string, price: number) => `${renewsOn}=${price}`;

/**
 * The endings a domain-only link may be made for: the common ones Vercel
 * registers with the plain registrant contact (no extra per-registry data).
 * The live quote still has the last word; this keeps the admin from sending
 * a link for an ending the webhook would then fail to buy.
 */
export const DOMAIN_ORDER_TLDS = ["com", "org", "net", "co", "fr", "ma", "uk", "io"] as const;
export function tldAllowed(domain: string): boolean {
  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  return (DOMAIN_ORDER_TLDS as readonly string[]).includes(tld);
}

/** What is left after Vercel's renewal and Stripe's worst case -- for the admin's eyes. */
export function netProfitUsd(retailUsd: number, renewalUsd: number): number {
  return Math.round((retailUsd * (1 - STRIPE_RATE) - STRIPE_FIXED_USD - renewalUsd) * 100) / 100;
}

export type QuoteReason = "unsupported" | "taken" | "too-expensive" | "not-configured" | "error";

/**
 * What the browser is told. Vercel's own numbers stay on the server.
 *
 * A domain is priced PER YEAR, whatever the plan's rhythm: a domain is a
 * yearly thing wherever it is bought, and a "$3 a month" domain would have
 * been a fiction over a yearly registration. On a monthly plan the year is
 * paid up front and again on each anniversary invoice.
 */
export interface DomainQuote {
  domain: string;
  sellable: boolean;
  reason?: QuoteReason;
  yearlyUsd: number;
}

export interface FullQuote extends DomainQuote {
  available: boolean;
  purchaseUsd: number;
  renewalUsd: number;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code?: string; message?: string };

/** Exported for C2 (src/lib/siteDomain.ts): the same client, token and team. */
export async function registrar<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  // Founder test mode (src/lib/testContext.ts): no registrar call at all — a
  // test purchase must never buy, renew or attach a real domain.
  if (inTestContext()) return { ok: false, status: 0, code: "test_mode", message: "TEST: domain not bought" };
  const token = process.env.VERCEL_TOKEN;
  const team = process.env.VERCEL_TEAM_ID;
  if (!token || !team) return { ok: false, status: 0, code: "not_configured" };
  const sep = path.includes("?") ? "&" : "?";
  try {
    const res = await fetch(`${API}${path}${sep}teamId=${encodeURIComponent(team)}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (res.status === 204) return { ok: true, data: undefined as T };
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = (body.error as Record<string, unknown> | undefined) ?? body;
      return {
        ok: false,
        status: res.status,
        code: typeof err.code === "string" ? err.code : undefined,
        message: typeof err.message === "string" ? err.message : undefined,
      };
    }
    return { ok: true, data: body as T };
  } catch (e) {
    return { ok: false, status: 0, code: "network", message: e instanceof Error ? e.message : String(e) };
  }
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

export async function domainQuote(domain: string): Promise<FullQuote> {
  const none: FullQuote = {
    domain, sellable: false, yearlyUsd: 0, available: false, purchaseUsd: 0, renewalUsd: 0,
  };
  if (!isDomainSalesConfigured()) return { ...none, reason: "not-configured" };

  const enc = encodeURIComponent(domain);
  const [price, avail] = await Promise.all([
    registrar<{ years: number; purchasePrice: unknown; renewalPrice: unknown }>(`/v1/registrar/domains/${enc}/price`),
    registrar<{ available: boolean }>(`/v1/registrar/domains/${enc}/availability`),
  ]);

  if (!price.ok) {
    if (price.code === "tld_not_supported" || price.status === 404) return { ...none, reason: "unsupported" };
    return { ...none, reason: "error" };
  }
  if (!avail.ok) {
    if (avail.status === 404) return { ...none, reason: "unsupported" };
    return { ...none, reason: "error" };
  }

  const purchaseUsd = num(price.data.purchasePrice);
  const renewalUsd = num(price.data.renewalPrice);
  if (!Number.isFinite(purchaseUsd) || !Number.isFinite(renewalUsd)) return { ...none, reason: "error" };

  // Priced off whichever year costs more: a .co is bought at 29.99 and
  // renewed at 24.80, so a price built on the renewal alone shortchanges the
  // first year.
  const yearlyUsd = retailYearlyUsd(Math.max(purchaseUsd, renewalUsd));
  const base = { ...none, available: avail.data.available, purchaseUsd, renewalUsd, yearlyUsd };

  if (!avail.data.available) return { ...base, reason: "taken" };
  // Never sell what would be bought at a loss, and never offer a price that
  // makes the hosting look like the cheap part.
  if (yearlyUsd > DOMAIN_MAX_RETAIL_USD || purchaseUsd > yearlyUsd) return { ...base, reason: "too-expensive" };
  return { ...base, sellable: true };
}

/**
 * The same name under the common endings, for when the one they typed is
 * taken. Only endings we would actually sell come back, priced, at most
 * three -- a wall of options is worse than a short list.
 */
export async function alternativesFor(domain: string): Promise<{ domain: string; yearlyUsd: number }[]> {
  const i = domain.indexOf(".");
  if (i <= 0) return [];
  const label = domain.slice(0, i);
  const current = domain.slice(i + 1);
  const endings = ["com", "org", "net", "co"].filter((t) => t !== current);
  const quotes = await Promise.all(endings.map((t) => domainQuote(`${label}.${t}`)));
  return quotes.filter((q) => q.sellable).map((q) => ({ domain: q.domain, yearlyUsd: q.yearlyUsd })).slice(0, 3);
}

/* ── Registrant contact ──────────────────────────────────────────────────── */

export interface DomainContact {
  firstName: string; lastName: string; email: string; phone: string;
  address1: string; address2?: string; city: string; state: string; zip: string; country: string;
  companyName?: string;
}

const REQUIRED: (keyof DomainContact)[] = ["firstName", "lastName", "email", "phone", "address1", "city", "state", "zip", "country"];

/** Parsed from DOMAIN_CONTACT_JSON; null when absent or not usable as a registrant. */
export function domainContact(): DomainContact | null {
  const raw = process.env.DOMAIN_CONTACT_JSON;
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Record<string, unknown>;
    for (const k of REQUIRED) if (typeof c[k] !== "string" || !(c[k] as string).trim()) return null;
    if (!/^\+[1-9]\d{6,14}$/.test(c.phone as string)) return null;
    if (!/^[A-Z]{2}$/.test(c.country as string)) return null;
    if (!/.+@.+\..+/.test(c.email as string)) return null;
    return c as unknown as DomainContact;
  } catch {
    return null;
  }
}

/* ── Purchase, renewal, attachment ───────────────────────────────────────── */

export async function buyDomain(domain: string, expectedPrice: number): Promise<ApiResult<{ orderId: string }>> {
  const contact = domainContact();
  if (!contact) return { ok: false, status: 0, code: "no_contact" };
  return registrar<{ orderId: string }>(`/v1/registrar/domains/${encodeURIComponent(domain)}/buy`, {
    method: "POST",
    body: JSON.stringify({ autoRenew: true, years: 1, expectedPrice, contactInformation: contact }),
  });
}

export interface DomainOrder {
  orderId: string;
  status: "draft" | "purchasing" | "completed" | "failed";
  domains: { domainName: string; status: string; price?: number; error?: unknown }[];
  error?: { code: string; details?: unknown };
}

export async function domainOrder(orderId: string): Promise<ApiResult<DomainOrder>> {
  return registrar<DomainOrder>(`/v1/registrar/orders/${encodeURIComponent(orderId)}`);
}

export async function setDomainAutoRenew(domain: string, autoRenew: boolean): Promise<ApiResult<void>> {
  return registrar<void>(`/v1/registrar/domains/${encodeURIComponent(domain)}/auto-renew`, {
    method: "PATCH",
    body: JSON.stringify({ autoRenew }),
  });
}

/**
 * Put the domain on the client's project: apex serves, www redirects to it.
 * A domain registered with Vercel is on Vercel DNS already, so this is the
 * whole job -- no records to add.
 */
export async function attachDomainToProject(project: string, domain: string): Promise<ApiResult<void>> {
  const path = `/v10/projects/${encodeURIComponent(project)}/domains`;
  const apex = await registrar<unknown>(path, { method: "POST", body: JSON.stringify({ name: domain }) });
  if (!apex.ok && apex.code !== "domain_already_in_use") return apex;
  const www = await registrar<unknown>(path, {
    method: "POST",
    body: JSON.stringify({ name: `www.${domain}`, redirect: domain, redirectStatusCode: 308 }),
  });
  if (!www.ok && www.code !== "domain_already_in_use") return www;
  return { ok: true, data: undefined };
}

export type PurchaseOutcome =
  | { ok: true; orderId: string; costUsd: number }
  | { ok: false; reason: "not-configured" | "no-contact" | "taken" | "unsupported" | "over-retail" | "error" | "unknown"; detail?: string };

/**
 * The guarded purchase: quoted again at the moment of buying, refused if the
 * name has gone or if Vercel now wants more than the client paid us, and
 * only ever one year with auto-renew on.
 *
 * Two failures that are NOT "refused":
 *  - the quote itself failed (Vercel down, rate-limited): reason "error",
 *    "could not check" — never "taken", which would send the owner looking
 *    for a competitor who does not exist;
 *  - the BUY call died on the network or with a 5xx: reason "unknown". The
 *    order may well have gone through; nobody may refund or re-buy until
 *    Vercel > Domains has been looked at.
 */
export async function purchaseDomainForClient(domain: string, retailYearlyUsd: number): Promise<PurchaseOutcome> {
  if (!isDomainSalesConfigured()) return { ok: false, reason: "not-configured" };
  if (!domainContact()) return { ok: false, reason: "no-contact" };
  const q = await domainQuote(domain);
  if (q.reason === "unsupported") return { ok: false, reason: "unsupported" };
  if (q.reason === "error" || q.reason === "not-configured") return { ok: false, reason: "error", detail: "could not check the name with Vercel (quote failed); nothing was bought" };
  if (!q.available) return { ok: false, reason: "taken" };
  if (!(retailYearlyUsd > 0) || q.purchaseUsd > retailYearlyUsd) {
    return { ok: false, reason: "over-retail", detail: `Vercel asks ${q.purchaseUsd}, client paid ${retailYearlyUsd}` };
  }
  const res = await buyDomain(domain, q.purchaseUsd);
  if (!res.ok) {
    const detail = `${res.code ?? res.status}${res.message ? `: ${res.message}` : ""}`;
    return { ok: false, reason: res.status === 0 || res.status >= 500 ? "unknown" : "error", detail };
  }
  return { ok: true, orderId: res.data.orderId, costUsd: q.purchaseUsd };
}

/**
 * Is this name registered in OUR Vercel team? 200 = yes (with Vercel's
 * purchase date when it was bought there), 404 = no, anything else = could
 * not tell. How a hand-finished purchase is verified before a record is
 * marked bought, and how the daily audit finds a "failed" order that was in
 * fact registered.
 */
export async function domainInTeam(domain: string): Promise<{ inTeam: boolean | null; boughtAt?: string }> {
  const res = await registrar<{ domain?: { boughtAt?: number | null } }>(`/v5/domains/${encodeURIComponent(domain)}`);
  if (res.ok) {
    const b = res.data.domain?.boughtAt;
    return { inTeam: true, ...(typeof b === "number" ? { boughtAt: new Date(b).toISOString() } : {}) };
  }
  return { inTeam: res.status === 404 ? false : null };
}

/** Does a project of this name exist in our team? null = could not tell. */
export async function projectExists(name: string): Promise<boolean | null> {
  const res = await registrar<unknown>(`/v9/projects/${encodeURIComponent(name)}`);
  if (res.ok) return true;
  return res.status === 404 ? false : null;
}

/* ── The record, kept in hosting_clients.notes ───────────────────────────
 *
 * One line, machine-readable, that survives the client's handover text
 * being written around it. A column would be cleaner; a column needs a
 * migration run by hand before this can deploy, and a feature that 500s
 * until someone remembers a migration loses the client's order on the day
 * they paid.
 */

export interface DomainRecord {
  domain: string;
  status: "bought" | "pending" | "failed";
  retailUsd: number;
  orderId?: string;
  boughtAt?: string;
  /** Monthly plans only: the day the next yearly domain charge goes on the invoice. */
  nextChargeAt?: string;
  attached?: string;
  note?: string;
  /** The Vercel renewal price the margin watch last warned about, so it warns once per change. */
  warnedAt?: string;
  /** "<renewal date>=<price>": the price rise announced for that renewal (writeNoticed). */
  noticed?: string;
}

/**
 * Vercel's CURRENT renewal price for a registered name. Registrars raise
 * renewal prices over the years (the .com registry alone is allowed ~7 % a
 * year); a retail price fixed at purchase quietly loses margin unless
 * somebody looks. The domain-billing cron looks.
 */
export async function currentRenewalUsd(domain: string): Promise<number | null> {
  const res = await registrar<{ renewalPrice: unknown }>(`/v1/registrar/domains/${encodeURIComponent(domain)}/price`);
  if (!res.ok) return null;
  const n = num(res.data.renewalPrice);
  return Number.isFinite(n) ? n : null;
}

const MARKER = "servolia-domain:";

export function readDomainRecord(notes: string | null | undefined): DomainRecord | null {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith(MARKER));
  if (!line) return null;
  const [domainPart, ...rest] = line.slice(MARKER.length).split(" | ");
  const domain = domainPart.trim();
  if (!domain) return null;
  const kv: Record<string, string> = {};
  for (const p of rest) {
    const i = p.indexOf(":");
    if (i > 0) kv[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  const status = kv.status === "bought" || kv.status === "failed" ? kv.status : "pending";
  return {
    domain,
    status,
    retailUsd: Number(kv.retail) || 0,
    orderId: kv.order && kv.order !== "-" ? kv.order : undefined,
    boughtAt: kv.bought && kv.bought !== "-" ? kv.bought : undefined,
    nextChargeAt: kv.renew && kv.renew !== "-" ? kv.renew : undefined,
    attached: kv.attached && kv.attached !== "-" ? kv.attached : undefined,
    warnedAt: kv.warned && kv.warned !== "-" ? kv.warned : undefined,
    ...(kv.noticed && kv.noticed !== "-" ? { noticed: kv.noticed } : {}),
    note: kv.note && kv.note !== "-" ? kv.note : undefined,
  };
}

export function writeDomainRecord(notes: string | null | undefined, rec: DomainRecord): string {
  const kept = (notes ?? "").split("\n").filter((l) => !l.startsWith(MARKER) && l.trim() !== "");
  const line = [
    `${MARKER} ${rec.domain}`,
    `status: ${rec.status}`,
    `retail: ${rec.retailUsd}`,
    `order: ${rec.orderId ?? "-"}`,
    `bought: ${rec.boughtAt ?? "-"}`,
    `renew: ${rec.nextChargeAt ?? "-"}`,
    `attached: ${rec.attached ?? "-"}`,
    `warned: ${rec.warnedAt ?? "-"}`,
    // Only written when present, so a record that never had a notice keeps its old shape.
    ...(rec.noticed ? [`noticed: ${rec.noticed}`] : []),
    `note: ${(rec.note ?? "-").replace(/\s*\|\s*/g, "/").replace(/\n/g, " ")}`,
  ].join(" | ");
  return [...kept, line].join("\n");
}
