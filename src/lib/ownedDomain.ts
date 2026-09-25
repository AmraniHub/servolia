import type Stripe from "stripe";
import { registrar } from "@/lib/domainSales";
import { stripeFor } from "@/lib/stripeMode";
import { brandWrapper } from "@/lib/email";
import { usd } from "@/lib/hosting";

/**
 * A HOSTING LINK FOR A DOMAIN WE ALREADY OWN, WITH FREE DAYS FIRST.
 *
 * The shape (first client: Ithar Digital, 2026-09-25): the domain was bought
 * on our Vercel team and attached to the client's project BEFORE they paid.
 * They pay the domain's first year today, get N days of hosting free, and the
 * hosting subscription then charges itself; a failed charge runs the normal
 * hosting dunning (invoice.payment_failed -> past_due -> cron suspends).
 *
 * NOTHING IS BOUGHT. The domain-purchase path in the Stripe webhook keys on
 * metadata `domain` / `domain_retail_usd`; this link never sets either. It
 * carries `owned_domain`, `owned_domain_usd` and `trial_days` instead, and the
 * webhook also refuses to buy when `owned_domain` is present, whatever else
 * the session says.
 *
 * THE DOMAIN PRICE IS TYPED BY THE ADMIN, not computed: 10-80 and ending in
 * .90. retailYearlyUsd (src/lib/domainSales.ts) gives the house price for a
 * new sale (.90, floor 27.90) and is the figure to type; the renewals that
 * follow are priced by renewalDecision from what the client paid.
 *
 * AFTER THE FIRST YEAR (domain-sales branch): the domain-billing cron renews
 * it on the hosting subscription's invoice, and a cancellation switches its
 * Vercel auto-renew off — see the section at the end of this file.
 *
 * The email template lives here rather than in src/lib/email.ts only to keep
 * this change clear of two branches that are rewriting email.ts right now.
 */

export const MAX_TRIAL_DAYS = 30;
export const OWNED_DOMAIN_MIN_USD = 10;
export const OWNED_DOMAIN_MAX_USD = 80;
/** A domain sold as "first year" must stay registered at least this long (~11 months). */
export const MIN_FIRST_YEAR_DAYS = 335;

/** Line prefix in hosting_clients.notes. Deliberately NOT "servolia-domain:",
 *  which readDomainRecord owns: that record is for domains we bought for the
 *  client, and the domain-billing cron acts on it. */
export const OWNED_DOMAIN_NOTE = "servolia-owned-domain:";

const HOSTNAME = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

export interface OwnedDomainLink {
  trialDays: number;
  /** Null for a free-days link with no domain on it. */
  owned: { domain: string; usd: number } | null;
}

export type ParseResult = { ok: true; value: OwnedDomainLink } | { ok: false; error: string };

const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** Validates the admin's optional fields. Pure. */
export function parseOwnedDomainLink(body: Record<string, unknown>): ParseResult {
  let trialDays = 0;
  if (!blank(body.trialDays)) {
    const raw = typeof body.trialDays === "string" ? body.trialDays.trim() : body.trialDays;
    const n = typeof raw === "number" ? raw : /^\d+$/.test(String(raw)) ? Number(raw) : NaN;
    if (!Number.isInteger(n) || n < 0 || n > MAX_TRIAL_DAYS) {
      return { ok: false, error: `Free days must be a whole number from 0 to ${MAX_TRIAL_DAYS}.` };
    }
    trialDays = n;
  }

  if (blank(body.ownedDomain)) {
    if (!blank(body.domainUsd)) return { ok: false, error: "A domain price was given without a domain." };
    return { ok: true, value: { trialDays, owned: null } };
  }

  const domain = String(body.ownedDomain).trim().toLowerCase();
  if (!HOSTNAME.test(domain)) {
    return { ok: false, error: `"${String(body.ownedDomain).trim()}" is not a domain name. Type it bare, like example.com.` };
  }
  /* The confirmation email for this link describes one shape: domain today,
     hosting after the free days. With no free days the hosting would be
     charged today as well, and that email would be wrong. */
  if (trialDays < 1) {
    return { ok: false, error: "A domain you already own goes with free days (1-30): the domain is paid today, the hosting after them." };
  }
  if (blank(body.vercelProject)) {
    return { ok: false, error: "A domain you already own needs the Vercel project it is attached to." };
  }
  const price = typeof body.domainUsd === "number" ? body.domainUsd : Number(String(body.domainUsd ?? "").trim());
  const cents = Math.round(price * 100);
  if (
    blank(body.domainUsd) || !Number.isFinite(price) || Math.abs(price * 100 - cents) > 1e-6 ||
    price < OWNED_DOMAIN_MIN_USD || price > OWNED_DOMAIN_MAX_USD || cents % 100 !== 90
  ) {
    return { ok: false, error: `Domain price must be ${OWNED_DOMAIN_MIN_USD}-${OWNED_DOMAIN_MAX_USD} USD and end in .90 (e.g. 27.90).` };
  }
  return { ok: true, value: { trialDays, owned: { domain, usd: cents / 100 } } };
}

/**
 * Is `domain` in OUR Vercel team, and attached to `project`? Same client,
 * token and team as the registrar calls (VERCEL_TOKEN, VERCEL_TEAM_ID).
 * Anything but a clear yes refuses the link.
 */
export async function verifyOwnedDomain(domain: string, project: string, now = Date.now()): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const inTeam = await registrar<{ domain?: { name?: string; boughtAt?: number | null; expiresAt?: number | null } }>(`/v5/domains/${encodeURIComponent(domain)}`);
  if (!inTeam.ok) {
    if (inTeam.code === "not_configured") return { ok: false, status: 503, error: "VERCEL_TOKEN / VERCEL_TEAM_ID are not set, so the domain cannot be checked." };
    if (inTeam.status === 404) return { ok: false, status: 400, error: `${domain} is not a domain in our Vercel team. Nothing was created.` };
    return { ok: false, status: 502, error: `Could not check ${domain} with Vercel (${inTeam.code ?? inTeam.status}${inTeam.message ? `: ${inTeam.message}` : ""}). Try again.` };
  }
  /* OURS means REGISTERED THROUGH OUR TEAM (Vercel's boughtAt is a number),
     the same rule as domainInTeam in domainSales.ts. A client's own domain
     merely added to a project answers 200 with boughtAt null: selling its
     "first year" would bill for a registration we never made, and its
     renewal would be charged for a name Vercel does not renew for us. */
  if (typeof inTeam.data.domain?.boughtAt !== "number") {
    return { ok: false, status: 400, error: `${domain} is in our Vercel team but was NOT registered through Vercel (no purchase date), so it is not ours to sell a year of. Nothing was created.` };
  }
  /* A "first year" must be a real year: the client pays today for twelve
     months, and the renewal is billed a year on. A registration that ends
     sooner would leave them paying for months Vercel does not cover. */
  const exp = inTeam.data.domain?.expiresAt;
  if (typeof exp !== "number" || exp < now + MIN_FIRST_YEAR_DAYS * 86_400_000) {
    const when = typeof exp === "number" ? new Date(exp).toISOString().slice(0, 10) : "an unknown date";
    return { ok: false, status: 400, error: `${domain}'s registration ends ${when}, less than ${MIN_FIRST_YEAR_DAYS} days away: a "first year" sold today would not be a year. Renew it at Vercel first, or sell it as a domain order. Nothing was created.` };
  }
  const attached = await registrar<{ name?: string }>(
    `/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(domain)}`,
  );
  if (!attached.ok) {
    if (attached.status === 404) {
      return { ok: false, status: 400, error: `${domain} is in our team but is not attached to Vercel project "${project}" (or that project does not exist). Nothing was created.` };
    }
    return { ok: false, status: 502, error: `Could not check project "${project}" with Vercel (${attached.code ?? attached.status}${attached.message ? `: ${attached.message}` : ""}). Try again.` };
  }
  if (attached.data?.name && attached.data.name.toLowerCase() !== domain) {
    return { ok: false, status: 400, error: `Vercel answered for ${attached.data.name}, not ${domain}. Nothing was created.` };
  }
  return { ok: true };
}

/**
 * The hosting session, extended: free days on the subscription, and the
 * domain's year as a ONE-TIME line. In a subscription-mode Checkout a
 * one-time price goes on the initial invoice only, and with a trial Stripe
 * still invoices it at once ("Stripe automatically generates an invoice for
 * the one-time charge, even though the trial hasn't ended yet" -- Billing >
 * Trials > Combining trials with add_invoice_items).
 */
export function applyOwnedDomainLink(
  params: Stripe.Checkout.SessionCreateParams,
  link: OwnedDomainLink,
): Stripe.Checkout.SessionCreateParams {
  const out: Stripe.Checkout.SessionCreateParams = { ...params, metadata: { ...(params.metadata ?? {}) } };
  if (link.trialDays > 0) {
    out.subscription_data = { ...(params.subscription_data ?? {}), trial_period_days: link.trialDays };
    out.metadata!.trial_days = String(link.trialDays);
  }
  if (link.owned) {
    out.line_items = [
      ...(params.line_items ?? []),
      {
        price_data: {
          currency: "usd",
          product_data: { name: `Domain ${link.owned.domain} — first year` },
          unit_amount: Math.round(link.owned.usd * 100),
        },
        quantity: 1,
      },
    ];
    out.metadata!.owned_domain = link.owned.domain;
    out.metadata!.owned_domain_usd = usd(link.owned.usd);
  }
  return out;
}

/** The link's facts, read back off a completed session. Null for any other session. */
export function readOwnedDomainMeta(meta: Record<string, string> | null | undefined): { domain: string | null; usd: number; trialDays: number } | null {
  if (!meta) return null;
  const domain = meta.owned_domain && HOSTNAME.test(meta.owned_domain) ? meta.owned_domain : null;
  const trialDays = Number(meta.trial_days) || 0;
  if (!domain && trialDays <= 0) return null;
  return { domain, usd: domain ? Number(meta.owned_domain_usd) || 0 : 0, trialDays };
}

/**
 * When the free days end, from Stripe's own subscription (trial_end). Falls
 * back to purchase time + trial days if Stripe cannot be read in 5 s, so the
 * receipt is late by nothing but the webhook is never held up.
 */
export async function trialEndFor(subscriptionId: string | null, livemode: boolean, from: Date, trialDays: number): Promise<{ iso: string; fromStripe: boolean }> {
  const fallback = { iso: new Date(from.getTime() + trialDays * 86_400_000).toISOString(), fromStripe: false };
  const stripe = subscriptionId ? stripeFor(livemode) : null;
  if (!stripe || !subscriptionId) return fallback;
  try {
    const sub = await Promise.race([
      stripe.subscriptions.retrieve(subscriptionId),
      new Promise<null>((r) => setTimeout(() => r(null), 5000)),
    ]);
    const end = sub && typeof sub.trial_end === "number" ? sub.trial_end : null;
    return end ? { iso: new Date(end * 1000).toISOString(), fromStripe: true } : fallback;
  } catch {
    return fallback;
  }
}

export interface OwnedDomainNote {
  domain: string;
  usd: number;
  project: string | null;
  /** YYYY-MM-DD: the day the domain's next year is due (the domain-billing cron moves it on). */
  renewsOn: string;
  paidOn: string;
  /* Written by the renewal work only when set, so a note that never renewed
     keeps exactly the line the hosting link wrote. */
  /** YYYY-MM-DD: the start of the last year put on the client's invoice. */
  billed?: string;
  /** "<renewsOn>=<price>": a price rise announced for that renewal (domainSales.writeNoticed). */
  noticed?: string;
  /** YYYY-MM-DD: after a cancellation, Vercel auto-renew stays on until this date (a paid year starts then). */
  keptUntil?: string;
  /** YYYY-MM-DD: the day Vercel auto-renew was switched off after the hosting ended. */
  renewalOff?: string;
  /** YYYY-MM-DD: a Vercel expiry too far from our date to follow; recorded so it is reported once. */
  vercelMismatch?: string;
}

export function readOwnedDomainNote(notes: string | null | undefined): OwnedDomainNote | null {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith(OWNED_DOMAIN_NOTE));
  if (!line) return null;
  const [head, ...rest] = line.slice(OWNED_DOMAIN_NOTE.length).split(" | ");
  const kv: Record<string, string> = {};
  for (const p of rest) {
    const i = p.indexOf(":");
    if (i > 0) kv[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  return {
    domain: head.trim(),
    usd: Number(kv.price) || 0,
    project: kv.project && kv.project !== "-" ? kv.project : null,
    renewsOn: kv.renews ?? "",
    paidOn: kv.paid ?? "",
    ...(kv.billed ? { billed: kv.billed } : {}),
    ...(kv.noticed ? { noticed: kv.noticed } : {}),
    ...(kv.kept ? { keptUntil: kv.kept } : {}),
    ...(kv["renewal-off"] ? { renewalOff: kv["renewal-off"] } : {}),
    ...(kv["vercel-expiry"] ? { vercelMismatch: kv["vercel-expiry"] } : {}),
  };
}

/** Replaces any earlier line for the same row, so a Stripe retry writes it once. */
export function writeOwnedDomainNote(notes: string | null | undefined, rec: OwnedDomainNote): string {
  const kept = (notes ?? "").split("\n").filter((l) => !l.startsWith(OWNED_DOMAIN_NOTE) && l.trim() !== "");
  const line = [
    `${OWNED_DOMAIN_NOTE} ${rec.domain}`,
    `price: ${usd(rec.usd)}`,
    `paid: ${rec.paidOn}`,
    `renews: ${rec.renewsOn}`,
    `project: ${rec.project ?? "-"}`,
    `bought: no (already ours)`,
    ...(rec.billed ? [`billed: ${rec.billed}`] : []),
    ...(rec.noticed ? [`noticed: ${rec.noticed}`] : []),
    ...(rec.keptUntil ? [`kept: ${rec.keptUntil}`] : []),
    ...(rec.renewalOff ? [`renewal-off: ${rec.renewalOff}`] : []),
    ...(rec.vercelMismatch ? [`vercel-expiry: ${rec.vercelMismatch}`] : []),
  ].join(" | ");
  return [...kept, line].join("\n");
}

/* ── The owned domain's life after the first year (domain-sales branch) ──── */

export const OWNED_RENEWAL_ITEM_KIND = "owned_domain_renewal";
/** Vercel's expiry is followed only when it is this close to our own date. */
export const EXPIRY_FOLLOW_DAYS = 30;
/** Days after a billed year starts before "Vercel did not renew it" is an alarm. */
export const RENEWAL_GRACE_DAYS = 5;

const dayMs = 86_400_000;
const daysBetween = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / dayMs;
const plusDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * dayMs).toISOString().slice(0, 10);

/**
 * The next date a year must be billed for, given Vercel's actual expiry
 * (null when unreadable). Pure.
 *  - Vercel's date is followed only when it is within EXPIRY_FOLLOW_DAYS of
 *    ours: that corrects a note dated from the client's payment for a domain
 *    registered days earlier. A date further off is not a small correction
 *    (a manual renewal, a wrong domain): our date stands and `mismatch` asks
 *    for it to be reported (once — the caller records vercelMismatch).
 *  - While the year we billed has not been renewed yet (expiry <= billed),
 *    our date stands: that case is renewalCheck's to judge, never a reason
 *    to drag the date back and bill the year again.
 */
export function renewalDateFrom(note: OwnedDomainNote, vercelExpiry: string | null): { renewsOn: string; mismatch?: string } {
  if (!vercelExpiry || vercelExpiry === note.renewsOn) return { renewsOn: note.renewsOn };
  if (note.billed && vercelExpiry <= note.billed) return { renewsOn: note.renewsOn };
  if (!note.renewsOn || daysBetween(vercelExpiry, note.renewsOn) <= EXPIRY_FOLLOW_DAYS) return { renewsOn: vercelExpiry };
  return { renewsOn: note.renewsOn, mismatch: vercelExpiry };
}

/**
 * Was the year we last billed actually renewed by Vercel? The next year is
 * never billed until it was (expiry > billed). `alarm` once RENEWAL_GRACE_DAYS
 * have passed since that year began and it still has not: the client paid
 * for a year Vercel did not give them. Pure; `registration` is what Vercel
 * says ("gone" = no longer in our team, "unreadable" = could not ask).
 */
export function renewalCheck(
  note: OwnedDomainNote,
  registration: { state: "ok"; expiry: string | null } | { state: "gone" } | { state: "unreadable" },
  todayIso: string,
): { ok: true } | { ok: false; alarm: boolean; why: string } {
  if (!note.billed) return { ok: true };
  if (registration.state === "ok" && registration.expiry && registration.expiry > note.billed) return { ok: true };
  const why = registration.state === "gone" ? "the domain is no longer in our Vercel team"
    : registration.state === "unreadable" ? "Vercel could not be read"
    : `Vercel's registration still ends ${registration.expiry ?? "(unknown)"}`;
  return { ok: false, alarm: todayIso > plusDays(note.billed, RENEWAL_GRACE_DAYS), why };
}

export interface OwnedCancelOutcome {
  /** "off": auto-renew switched off. "kept": a paid year starts on keptUntil. "failed": Vercel refused. "test": nothing touched. */
  result: "off" | "kept" | "failed" | "test";
  keptUntil?: string;
  /** Unbilled renewal lines deleted (pending, or on a draft invoice): nothing will ever collect them. */
  deletedPending: string[];
  /** Unpaid (open) invoices voided because they carried only a renewal line for a year not started. */
  voided: string[];
  /** Unpaid invoices carrying such a line NEXT TO other charges: the line must be credited by hand. */
  mixed: string[];
  detail?: string;
}

/**
 * The hosting that carried an owned domain has ENDED.
 *  - A renewal line never invoiced, or on a DRAFT invoice, is deleted.
 *  - An UNPAID (open) invoice for a year that has not started: voided when
 *    it carries only renewal lines — we are switching the renewal off, so a
 *    payable year must not be left behind. One that also carries other
 *    charges cannot lose a single line in Stripe: it is reported (`mixed`)
 *    for a credit note by hand.
 *  - A renewal line PAID for a year that has not started keeps Vercel's
 *    auto-renew on until that date — the client bought that year — and the
 *    daily cron switches it off once Vercel has renewed it.
 *  - Otherwise auto-renew goes off now: the domain stays registered until it
 *    expires and is the client's to transfer.
 * `test` never reaches Vercel and deletes or voids nothing.
 */
export async function ownedDomainOnCancel(
  stripe: Stripe, customerId: string | null, note: OwnedDomainNote, todayIso: string, test: boolean,
  setAutoRenew: (domain: string, on: boolean) => Promise<{ ok: boolean; code?: string; status?: number; message?: string }>,
): Promise<OwnedCancelOutcome> {
  const deletedPending: string[] = [];
  const voided: string[] = [];
  const mixed: string[] = [];
  let paidAhead: string | undefined;
  if (customerId) {
    const items = (await stripe.invoiceItems.list({ customer: customerId, limit: 50 })).data
      .filter((i) => i.metadata?.kind === OWNED_RENEWAL_ITEM_KIND && i.metadata?.domain === note.domain);
    for (const item of items) {
      const invoiceId = typeof item.invoice === "string" ? item.invoice : item.invoice?.id ?? null;
      const yearStart = item.metadata?.renews_on ?? "";
      if (!invoiceId) {
        if (!test) { await stripe.invoiceItems.del(item.id); deletedPending.push(item.id); }
        continue;
      }
      const inv = await stripe.invoices.retrieve(invoiceId);
      const notStarted = yearStart >= todayIso;
      if (inv.status === "paid") {
        if (notStarted && (!paidAhead || yearStart > paidAhead)) paidAhead = yearStart;
      } else if (notStarted && inv.status === "draft") {
        if (!test) { await stripe.invoiceItems.del(item.id); deletedPending.push(item.id); }
      } else if (notStarted && (inv.status === "open" || inv.status === "uncollectible")) {
        const lines = inv.lines?.data ?? [];
        const onlyRenewal = lines.length > 0 && lines.every((l) => l.metadata?.kind === OWNED_RENEWAL_ITEM_KIND);
        if (onlyRenewal) {
          if (!test) { await stripe.invoices.voidInvoice(invoiceId); voided.push(invoiceId); }
        } else {
          mixed.push(invoiceId);
        }
      }
    }
  }
  const base = { deletedPending, voided, mixed };
  if (test) return { result: "test", ...base, detail: "TEST: Vercel not touched" };
  if (paidAhead) return { result: "kept", keptUntil: paidAhead, ...base };
  const off = await setAutoRenew(note.domain, false);
  return off.ok
    ? { result: "off", ...base }
    : { result: "failed", ...base, detail: `${off.code ?? off.status}${off.message ? `: ${off.message}` : ""}` };
}

/** One line for the cancellation notice. */
export function ownedCancelLine(domain: string, o: OwnedCancelOutcome): string {
  const extra = [
    o.deletedPending.length ? `Unbilled renewal line${o.deletedPending.length === 1 ? "" : "s"} removed (${o.deletedPending.join(", ")}).` : "",
    o.voided.length ? `Unpaid renewal invoice${o.voided.length === 1 ? "" : "s"} voided (${o.voided.join(", ")}).` : "",
    o.mixed.length ? `⚠️ Unpaid invoice${o.mixed.length === 1 ? "" : "s"} ${o.mixed.join(", ")} still carr${o.mixed.length === 1 ? "ies" : "y"} the domain's renewal next to other charges: credit that line by hand (Stripe > invoice > Create credit note).` : "",
  ].filter(Boolean).join(" ");
  const tail = extra ? ` ${extra}` : "";
  switch (o.result) {
    case "off": return `🌐 Owned domain ${domain}: Vercel auto-renew switched OFF. It stays registered until it expires; transfer it to them if they ask.${tail}`;
    case "kept": return `🌐 Owned domain ${domain}: auto-renew KEPT ON until ${o.keptUntil} — the client already paid for the year from that date; the daily domain check switches it off once Vercel has renewed it.${tail}`;
    case "failed": return `⚠️ Owned domain ${domain}: auto-renew NOT switched off (${o.detail}) — do it in Vercel > Domains.${tail}`;
    default: return `Owned domain ${domain}: TEST — Vercel not touched.${tail}`;
  }
}

/**
 * The client came back (invoice.paid put an ended row back to active): the
 * domain renews again. Vercel auto-renew back ON, the cancellation markers
 * cleared. Returns the note to write, or why not. `test` never reaches Vercel.
 */
export async function ownedDomainOnReturn(
  note: OwnedDomainNote, test: boolean,
  setAutoRenew: (domain: string, on: boolean) => Promise<{ ok: boolean; code?: string; status?: number; message?: string }>,
): Promise<{ ok: true; note: OwnedDomainNote } | { ok: false; detail: string } | null> {
  if (!note.renewalOff && !note.keptUntil) return null;
  if (test) return { ok: false, detail: "TEST: Vercel not touched" };
  const on = await setAutoRenew(note.domain, true);
  if (!on.ok) return { ok: false, detail: `${on.code ?? on.status}${on.message ? `: ${on.message}` : ""}` };
  return { ok: true, note: { ...note, renewalOff: undefined, keptUntil: undefined } };
}

const dateLong = (iso: string, fr: boolean) =>
  new Date(iso).toLocaleDateString(fr ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * The client's confirmation. Says only what is true today: what was charged,
 * when the hosting starts, that the card is charged then, and that cancelling
 * before then costs nothing more.
 */
export function ownedDomainPaidEmail(o: {
  domain: string | null;
  domainUsd: number;
  tier: string;
  planUsd: number;
  period: "monthly" | "annual";
  hostingStartsIso: string;
  siteLabel: string;
  portalUrl: string | null;
  lang: "en" | "fr";
}): { subject: string; html: string } {
  const fr = o.lang === "fr";
  const money = (n: number) => (fr ? `${usd(n)}&nbsp;$` : `$${usd(n)}`);
  const plain = (n: number) => (fr ? `${usd(n)} $` : `$${usd(n)}`);
  const when = dateLong(o.hostingStartsIso, fr);
  const term = fr ? (o.period === "annual" ? "an" : "mois") : (o.period === "annual" ? "year" : "month");
  const P = `style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3F3F46;"`;

  const paidToday = o.domain
    ? (fr
        ? `<strong>Payé aujourd'hui :</strong> Domaine ${o.domain} — première année, ${money(o.domainUsd)}.`
        : `<strong>Paid today:</strong> Domain ${o.domain} — first year, ${money(o.domainUsd)}.`)
    : (fr ? `<strong>Rien n'est prélevé aujourd'hui.</strong>` : `<strong>Nothing is charged today.</strong>`);
  const hosting = fr
    ? `Hébergement (${o.tier}, ${money(o.planUsd)}/${term}) : commence le <strong>${when}</strong> ; votre carte est débitée à cette date.`
    : `Hosting (${o.tier}, ${money(o.planUsd)}/${term}) starts on <strong>${when}</strong>; your card is charged then.`;
  const cancel = fr
    ? "Résiliez avant cette date et rien de plus n'est prélevé."
    : "Cancel before then and nothing more is charged.";

  const subject = o.domain
    ? (fr ? `Paiement reçu — domaine ${o.domain} ; hébergement à partir du ${when}` : `Payment received — domain ${o.domain}; hosting starts ${when}`)
    : (fr ? `Hébergement offert jusqu'au ${when}` : `Hosting free until ${when}`);

  const html = brandWrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">${o.domain ? (fr ? "Paiement reçu" : "Payment received") : (fr ? "C'est confirmé" : "Confirmed")}</h1>
      <p ${P}>${fr ? `Merci${o.siteLabel ? ` — ${o.siteLabel}` : ""}. Voici exactement ce qui a été prélevé et ce qui le sera.` : `Thank you${o.siteLabel ? ` — ${o.siteLabel}` : ""}. Here is exactly what was charged and what will be.`}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             style="margin:0 0 20px;border:1px solid #E8E6E0;border-radius:12px;background:#FAFAF7;">
        <tr><td style="padding:18px 20px;font-size:15px;line-height:1.6;color:#3F3F46;">
          <p style="margin:0 0 8px;">${paidToday}</p>
          <p style="margin:0 0 8px;">${hosting}</p>
          <p style="margin:0;color:#71717A;">${cancel}</p>
        </td></tr>
      </table>
      <p ${P}>${fr
        ? "Stripe vous envoie un reçu séparé pour vos archives. Besoin d'une facture à en-tête de votre société ? Répondez à cet email."
        : "Stripe emails you a separate receipt for your records. Need an invoice with your company details? Reply to this email."}</p>
      ${o.portalUrl ? `<p ${P}><a href="${o.portalUrl}" style="font-weight:700;color:#36671E;text-decoration:none;">${fr ? "Votre page de service — carte, factures, résiliation &rarr;" : "Your service page — card, invoices, cancelling &rarr;"}</a></p>` : ""}
      <p style="margin:0;font-size:14px;line-height:1.6;color:#71717A;">${fr ? "Une question ? Répondez simplement ici — une personne lit chaque message." : "Any question — just reply here. A person reads every message."}</p>
    `, {
    preheader: o.domain
      ? (fr ? `Payé aujourd'hui : ${plain(o.domainUsd)} pour ${o.domain}. Hébergement à partir du ${when}.` : `Paid today: ${plain(o.domainUsd)} for ${o.domain}. Hosting starts ${when}.`)
      : (fr ? `Rien aujourd'hui. Hébergement à partir du ${when}.` : `Nothing today. Hosting starts ${when}.`),
    lang: o.lang,
  });
  return { subject, html };
}

/** The owner's notice lines: the same facts as the client's email, plus what is left to do. */
export function ownedDomainOwnerLines(o: {
  domain: string | null;
  domainUsd: number;
  chargedTodayUsd: number;
  currency: string;
  tier: string;
  planUsd: number;
  period: "monthly" | "annual";
  trialDays: number;
  hostingStartsIso: string;
  renewsOn: string | null;
  project: string | null;
}): string[] {
  const d = o.hostingStartsIso.slice(0, 10);
  const $ = (n: number) => `$${usd(n)}`;
  return [
    `Charged today: ${$(o.chargedTodayUsd)}${o.domain ? ` — Domain ${o.domain}, first year (${$(o.domainUsd)}). Already ours on Vercel${o.project ? ` (project ${o.project})` : ""}: nothing bought, nothing attached.` : " — free days only."}`,
    `${o.tier} ${$(o.planUsd)}/${o.period === "annual" ? "year" : "month"} starts ${d} after ${o.trialDays} free day${o.trialDays === 1 ? "" : "s"}; the card is charged then. A failed charge runs the normal hosting dunning.`,
    o.domain && o.renewsOn ? `Domain second year due ${o.renewsOn} — recorded on the row (${OWNED_DOMAIN_NOTE.slice(0, -1)}); the domain-billing cron adds it to their hosting invoice 7 days before (a price rise emailed 30 days before that).` : null,
  ].filter((l): l is string => Boolean(l));
}
