import { SignJWT, jwtVerify } from "jose";
import Stripe from "stripe";
import { clientRefFor } from "@/lib/clientRefs";
import { resolveHostingPlan, productCopy, type ClientProduct } from "@/lib/hosting";

/**
 * MONTHLY → YEARLY, self-serve.
 *
 * WHY A SIGNED TOKEN AND NOT AN EMAIL BOX
 *
 * Switching to yearly takes money — the whole year, today. So the thing that
 * triggers it has to prove the person holds the mailbox, not merely that they
 * know the address. An "enter your email to upgrade" form with no confirmation
 * step lets anyone who knows a client's address put a year's charge on that
 * client's card. The token is minted only into an email we send to the address
 * already on the subscription, so possession of the link is possession of the
 * inbox.
 *
 * It is deliberately long-lived: it rides along in the payment confirmation
 * email, and the offer should still work in month five when they decide the
 * service is worth keeping. It carries no amount and no price — only which
 * subscription it is about. Everything chargeable is read from Stripe and from
 * src/lib/hosting.ts at the moment it is used, so an old link cannot pin an
 * old price or be edited into a different one.
 */

const TOKEN_ROLE = "hosting-upgrade";
const DEFAULT_TTL_DAYS = 400;

function secret(): Uint8Array {
  /* Its own secret where one is set, so rotating it cannot log every admin
     out, and vice versa. Falls back to the admin secret rather than to a
     constant: a hardcoded default would make every link forgeable by anyone
     who has read this file. */
  const s = process.env.UPGRADE_TOKEN_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!s) throw new Error("UPGRADE_TOKEN_SECRET or ADMIN_JWT_SECRET must be set");
  return new TextEncoder().encode(s);
}

export async function mintUpgradeToken(
  subscriptionId: string,
  days = DEFAULT_TTL_DAYS,
): Promise<string> {
  return new SignJWT({ role: TOKEN_ROLE, sub_id: subscriptionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secret());
}

/** The subscription this token is about, or null if it is not a valid one. */
export async function readUpgradeToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.role !== TOKEN_ROLE) return null;
    return typeof payload.sub_id === "string" ? payload.sub_id : null;
  } catch {
    return null;
  }
}

/** A link the client can act on, for the email templates. */
export async function upgradeLinkFor(subscriptionId: string, origin = "https://servolia.com") {
  return `${origin}/hosting/upgrade?t=${encodeURIComponent(await mintUpgradeToken(subscriptionId))}`;
}

/**
 * Into Stripe's billing portal — card, invoices, cancel.
 *
 * Points at our own route rather than at Stripe, because a Stripe portal
 * session is short-lived and this link sits in a receipt somebody opens when
 * their card expires months later. The route mints the session at click time.
 *
 * Same token as the upgrade link: both act only on the holder's own
 * subscription, and both are delivered only to the address already on it.
 */
export async function billingPortalLinkFor(subscriptionId: string, origin = "https://servolia.com") {
  return `${origin}/api/billing-portal?t=${encodeURIComponent(await mintUpgradeToken(subscriptionId))}`;
}

/* ── The quote ─────────────────────────────────────────────────────────── */

export type QuoteProblem =
  | "no-stripe"
  | "not-found"
  | "not-active"
  | "already-annual"
  | "unknown-plan";

export interface UpgradeQuote {
  subscriptionId: string;
  plan: ClientProduct;
  /** Product name and bullets in the client's language. */
  heading: string;
  includes: string[];
  siteLabel: string;
  lang: "en" | "fr";
  monthlyUsd: number;
  annualUsd: number;
  /** What twelve monthly payments would have cost, less the annual price. */
  savingUsd: number;
  /**
   * What Stripe says will actually be charged today, after crediting the
   * unused part of the current month. Null when the preview could not be
   * fetched — the page then says the credit applies without inventing a
   * figure, because a number that disagrees with the card statement is worse
   * than no number.
   */
  dueTodayUsd: number | null;
  /** When the next charge lands if they go ahead. */
  nextRenewalIso: string;
}

/** The item and price this subscription is currently billing on. */
function currentItem(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const productId =
    typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id;
  return { item, productId, interval: item?.price?.recurring?.interval };
}

/**
 * The annual price to move to, expressed the way the Stripe API wants it.
 *
 * Reuses the EXISTING product rather than creating one, so the client's
 * invoice keeps the name they recognise instead of sprouting a second,
 * near-identical product in the dashboard. price_data on a subscription item
 * accepts `product` only — `product_data`, which the Checkout call uses, is
 * not available here.
 */
function annualPriceData(productId: string, plan: ClientProduct): Stripe.SubscriptionUpdateParams.Item.PriceData {
  return {
    currency: "usd",
    product: productId,
    unit_amount: Math.round(plan.annualUsd * 100),
    recurring: { interval: "year" },
  };
}

/**
 * Who this subscription belongs to and what it is for, without the Stripe
 * invoice preview.
 *
 * Split out because the "email me the link" route needs the client's language
 * and product but has nothing to quote yet — and calling buildUpgradeQuote for
 * it would fire a preview request whose answer is thrown away.
 */
export async function subscriptionContext(subscriptionId: string) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  try {
    const sub = await new Stripe(key).subscriptions.retrieve(subscriptionId);
    const plan = resolveHostingPlan(sub.metadata?.plan);
    if (!plan) return null;
    const lang = (sub.metadata?.lang === "fr" ? "fr" : "en") as "en" | "fr";
    return {
      plan,
      lang,
      /* The client key, so a caller can look the row up in CLIENT_REFS — which
         is the only place that knows which repository and which widget a
         suspension is allowed to touch. */
      ref: sub.metadata?.ref || "",
      siteLabel: sub.metadata?.business || clientRefFor(sub.metadata?.ref || "")?.label || "",
      interval: currentItem(sub).interval,
      status: sub.status,
    };
  } catch {
    return null;
  }
}

export async function buildUpgradeQuote(
  subscriptionId: string,
): Promise<{ quote: UpgradeQuote } | { problem: QuoteProblem }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { problem: "no-stripe" };
  const stripe = new Stripe(key);

  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subscriptionId);
  } catch {
    return { problem: "not-found" };
  }

  if (sub.status !== "active" && sub.status !== "trialing") return { problem: "not-active" };

  const { item, productId, interval } = currentItem(sub);
  // Guard the direction. Yearly to monthly is a refund question, not a button:
  // the client has already paid for months they have not used.
  if (interval === "year") return { problem: "already-annual" };
  if (!item || !productId) return { problem: "not-found" };

  const plan = resolveHostingPlan(sub.metadata?.plan);
  if (!plan) return { problem: "unknown-plan" };

  const ref = sub.metadata?.ref || "";
  const lang = (sub.metadata?.lang === "fr" ? "fr" : "en") as "en" | "fr";
  const copy = productCopy(plan, lang);

  /* Stripe's own arithmetic, not ours. Working the proration out by hand would
     produce a figure that looks authoritative and disagrees with the card
     statement by a few cents. Wrapped because a preview failing must not stop
     the client seeing the offer. */
  let dueTodayUsd: number | null = null;
  try {
    const preview = await stripe.invoices.createPreview({
      customer: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      subscription: subscriptionId,
      subscription_details: {
        items: [{ id: item.id, price_data: annualPriceData(productId, plan) }],
        proration_behavior: "always_invoice",
        billing_cycle_anchor: "now",
      },
    });
    dueTodayUsd = Math.max(0, (preview.amount_due ?? 0) / 100);
  } catch (err) {
    console.warn("[upgrade] invoice preview failed:", err instanceof Error ? err.message : err);
  }

  const nextRenewal = new Date();
  nextRenewal.setUTCFullYear(nextRenewal.getUTCFullYear() + 1);

  return {
    quote: {
      subscriptionId,
      plan,
      heading: copy.heading,
      includes: copy.includes,
      siteLabel: sub.metadata?.business || clientRefFor(ref)?.label || "",
      lang,
      monthlyUsd: plan.monthlyUsd,
      annualUsd: plan.annualUsd,
      savingUsd: Math.round(plan.monthlyUsd * 12 - plan.annualUsd),
      dueTodayUsd,
      nextRenewalIso: nextRenewal.toISOString(),
    },
  };
}

/**
 * Do it.
 *
 * `billing_cycle_anchor: "now"` restarts the year today, and
 * `proration_behavior: "always_invoice"` bills the difference immediately with
 * the unused days credited. Together they mean the client is charged once, now,
 * for a year that starts today — rather than paying for a year while the old
 * monthly cycle carries on underneath it.
 */
export async function applyUpgrade(
  subscriptionId: string,
): Promise<{ ok: true; plan: ClientProduct; lang: "en" | "fr"; siteLabel: string } | { problem: QuoteProblem }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { problem: "no-stripe" };
  const stripe = new Stripe(key);

  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subscriptionId);
  } catch {
    return { problem: "not-found" };
  }
  if (sub.status !== "active" && sub.status !== "trialing") return { problem: "not-active" };

  const { item, productId, interval } = currentItem(sub);
  // Re-checked here and not only in the quote: the page and the click are two
  // separate requests, and a second tab or a double submit would otherwise
  // charge a second year on top of the first.
  if (interval === "year") return { problem: "already-annual" };
  if (!item || !productId) return { problem: "not-found" };

  const plan = resolveHostingPlan(sub.metadata?.plan);
  if (!plan) return { problem: "unknown-plan" };

  const lang = (sub.metadata?.lang === "fr" ? "fr" : "en") as "en" | "fr";

  await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: item.id, price_data: annualPriceData(productId, plan) }],
    proration_behavior: "always_invoice",
    billing_cycle_anchor: "now",
    // Kept in step, so a later read of the subscription does not still say
    // "monthly" and re-offer an upgrade the client has already taken.
    metadata: { ...sub.metadata, period: "annual" },
  });

  return {
    ok: true,
    plan,
    lang,
    siteLabel: sub.metadata?.business || clientRefFor(sub.metadata?.ref || "")?.label || "",
  };
}
