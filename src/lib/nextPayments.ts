/**
 * "What gets charged next, how much, when" for one hosting client.
 *
 * The hosting line is read from Stripe itself (the end of a free period, or
 * the next renewal, and the price on the subscription), never from our own
 * copy of the plan, which can drift. Domain lines come from the row's notes:
 * a domain we already owned and sold with the hosting (servolia-owned-domain),
 * or one we bought for a monthly client (servolia-domain, renew:).
 */
import type Stripe from "stripe";
import { inEitherMode } from "@/lib/stripeMode";
import { nextHostingInvoiceDate, readOwnedDomainNote } from "@/lib/ownedDomain";
import { readDomainRecord } from "@/lib/domainSales";

export interface NextPayment {
  what: string;
  /** In the subscription's currency, e.g. 66 */
  amount: number | null;
  currency: string;
  /** YYYY-MM-DD */
  date: string | null;
  /** What happens, in one line: "charged automatically to the saved card", "not charged: …". */
  note: string;
  kind: "hosting" | "domain" | "overdue" | "ending";
}

type SubLike = Pick<Stripe.Subscription, "status" | "cancel_at_period_end" | "items"> & {
  trial_end?: number | null;
  cancel_at?: number | null;
  current_period_end?: number;
  default_payment_method?: Stripe.Subscription["default_payment_method"];
};

const day = (ts: number | null | undefined) => (typeof ts === "number" ? new Date(ts * 1000).toISOString().slice(0, 10) : null);

/** Pure: the list, soonest first. */
export function nextPaymentsFrom(
  sub: SubLike | null,
  notes: string | null | undefined,
  planName: string,
): NextPayment[] {
  const out: NextPayment[] = [];
  let hostingEnds: string | null = null;

  if (sub) {
    const price = sub.items?.data?.[0]?.price;
    const amount = typeof price?.unit_amount === "number" ? price.unit_amount / 100 : null;
    const currency = (price?.currency ?? "usd").toUpperCase();
    const interval = price?.recurring?.interval === "year" ? "year" : "month";
    const card = sub.default_payment_method ? "charged automatically to the saved card" : "invoiced (no saved card)";
    const next = nextHostingInvoiceDate(sub as Stripe.Subscription);
    if (sub.status === "canceled") {
      out.push({ what: `${planName}`, amount: null, currency, date: day(sub.cancel_at) ?? null, note: "cancelled: nothing more is charged", kind: "ending" });
      hostingEnds = "now";
    } else if (sub.cancel_at_period_end || sub.cancel_at) {
      hostingEnds = day(sub.cancel_at) ?? next;
      out.push({ what: `${planName}`, amount: null, currency, date: hostingEnds, note: "set to cancel: no renewal is charged, hosting ends that day", kind: "ending" });
    } else if (sub.status === "past_due" || sub.status === "unpaid") {
      out.push({ what: `${planName}: overdue`, amount, currency, date: next, note: "the last charge failed; Stripe is retrying the card", kind: "overdue" });
    } else if (sub.status === "trialing") {
      out.push({ what: `${planName}: first ${interval}`, amount, currency, date: next, note: `free period ends; ${card}`, kind: "hosting" });
    } else {
      out.push({ what: `${planName}: renewal (per ${interval})`, amount, currency, date: next, note: card, kind: "hosting" });
    }
  }

  const owned = readOwnedDomainNote(notes);
  if (owned?.domain && owned.renewsOn) {
    const stops = hostingEnds && (hostingEnds === "now" || hostingEnds <= owned.renewsOn);
    out.push({
      what: `Domain ${owned.domain}: next year`,
      amount: owned.usd || null,
      currency: "USD",
      date: owned.renewsOn,
      note: stops ? "not charged: the hosting ends first" : "charged with the hosting card, on its own invoice",
      kind: "domain",
    });
  }
  const bought = readDomainRecord(notes);
  if (bought?.status === "bought" && bought.nextChargeAt) {
    out.push({
      what: `Domain ${bought.domain}: next year`,
      amount: bought.retailUsd || null,
      currency: "USD",
      date: bought.nextChargeAt,
      note: "added to that month's hosting invoice",
      kind: "domain",
    });
  }

  return out.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
}

/** Reads the subscription (live first, then a founder test one) and builds the list. */
export async function nextPaymentsFor(
  subscriptionId: string | null | undefined,
  notes: string | null | undefined,
  planName: string,
): Promise<{ list: NextPayment[]; stripeRead: boolean }> {
  let sub: SubLike | null = null;
  let stripeRead = false;
  if (subscriptionId) {
    try {
      const found = await inEitherMode((s) => s.subscriptions.retrieve(subscriptionId));
      if (found) { sub = found.value as SubLike; stripeRead = true; }
    } catch { /* shown as "could not read Stripe" */ }
  }
  return { list: nextPaymentsFrom(sub, notes, planName), stripeRead };
}
