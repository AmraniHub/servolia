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

const API = "https://api.vercel.com";

/** What Abdelali keeps per domain per year, after Stripe. */
export const DOMAIN_TARGET_PROFIT_USD = 13;
/** Stripe, assumed at its worst realistic case: non-US card + currency conversion. */
export const STRIPE_RATE = 0.05;
export const STRIPE_FIXED_USD = 0.3;
export const DOMAIN_MIN_RETAIL_USD = 26;
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

export function retailYearlyUsd(renewalUsd: number): number {
  const needed = (renewalUsd + DOMAIN_TARGET_PROFIT_USD + STRIPE_FIXED_USD) / (1 - STRIPE_RATE);
  return Math.max(DOMAIN_MIN_RETAIL_USD, Math.ceil(needed));
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

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code?: string; message?: string };

async function registrar<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
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
  | { ok: false; reason: "not-configured" | "no-contact" | "taken" | "unsupported" | "over-retail" | "error"; detail?: string };

/**
 * The guarded purchase: quoted again at the moment of buying, refused if the
 * name has gone or if Vercel now wants more than the client paid us, and
 * only ever one year with auto-renew on.
 */
export async function purchaseDomainForClient(domain: string, retailYearlyUsd: number): Promise<PurchaseOutcome> {
  if (!isDomainSalesConfigured()) return { ok: false, reason: "not-configured" };
  if (!domainContact()) return { ok: false, reason: "no-contact" };
  const q = await domainQuote(domain);
  if (q.reason === "unsupported") return { ok: false, reason: "unsupported" };
  if (!q.available) return { ok: false, reason: "taken" };
  if (!(retailYearlyUsd > 0) || q.purchaseUsd > retailYearlyUsd) {
    return { ok: false, reason: "over-retail", detail: `Vercel asks ${q.purchaseUsd}, client paid ${retailYearlyUsd}` };
  }
  const res = await buyDomain(domain, q.purchaseUsd);
  if (!res.ok) return { ok: false, reason: "error", detail: `${res.code ?? res.status}${res.message ? `: ${res.message}` : ""}` };
  return { ok: true, orderId: res.data.orderId, costUsd: q.purchaseUsd };
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
    `note: ${(rec.note ?? "-").replace(/\s*\|\s*/g, "/").replace(/\n/g, " ")}`,
  ].join(" | ");
  return [...kept, line].join("\n");
}
