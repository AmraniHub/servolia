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
 * THE DOMAIN PRICE IS TYPED BY THE ADMIN, not computed. The live price rule
 * (retailYearlyUsd in src/lib/domainSales.ts) rounds to whole dollars with a
 * 26 floor; the owner's rule of a .90 price with a 27.90 floor lives on the
 * unmerged domain-sales branch. Until that lands, the admin types it and it
 * must be 10-80 and end in .90.
 *
 * The email template lives here rather than in src/lib/email.ts only to keep
 * this change clear of two branches that are rewriting email.ts right now.
 */

export const MAX_TRIAL_DAYS = 30;
export const OWNED_DOMAIN_MIN_USD = 10;
export const OWNED_DOMAIN_MAX_USD = 80;

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
export async function verifyOwnedDomain(domain: string, project: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const inTeam = await registrar<{ domain?: { name?: string } }>(`/v5/domains/${encodeURIComponent(domain)}`);
  if (!inTeam.ok) {
    if (inTeam.code === "not_configured") return { ok: false, status: 503, error: "VERCEL_TOKEN / VERCEL_TEAM_ID are not set, so the domain cannot be checked." };
    if (inTeam.status === 404) return { ok: false, status: 400, error: `${domain} is not a domain in our Vercel team. Nothing was created.` };
    return { ok: false, status: 502, error: `Could not check ${domain} with Vercel (${inTeam.code ?? inTeam.status}${inTeam.message ? `: ${inTeam.message}` : ""}). Try again.` };
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
  /** YYYY-MM-DD: the day the domain's second year is due -- for the renewal work. */
  renewsOn: string;
  paidOn: string;
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
  ].join(" | ");
  return [...kept, line].join("\n");
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
    o.domain && o.renewsOn ? `Domain second year due ${o.renewsOn} — recorded on the row (${OWNED_DOMAIN_NOTE.slice(0, -1)}); its renewal is NOT billed automatically yet.` : null,
  ].filter((l): l is string => Boolean(l));
}
