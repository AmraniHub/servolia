/**
 * CLIENT SERVICES — a separate line of business from the Servolia subscription.
 *
 * Deliberately NOT added to PLANS in pricing.ts. Two reasons:
 *
 *  1. PLAN_ORDER drives the public pricing page. Anything in PLANS is a
 *     candidate to render on servolia.com, and these are not Servolia products
 *     for the French market.
 *  2. Every SubscriptionPlan carries `conversations` (the AI-receptionist
 *     quota) and an implied installation fee. These have neither, so they
 *     would have to fake both.
 *
 * Priced in USD. Servolia's plans are EUR — keeping the two apart avoids a
 * currency field on shared code that would have to be handled at every call
 * site.
 */

export interface ClientProduct {
  key: string;
  name: string;
  /** Shown as the card heading on the payment page. */
  heading: string;
  /** One sentence under the heading. */
  blurb: string;
  /** USD per month. */
  monthlyUsd: number;
  /** USD per year when prepaid. */
  annualUsd: number;
  /** Line items on the card. */
  includes: string[];
  /** Sent to Stripe as the product description. */
  description: string;
}

/**
 * Monthly rates come from the agency price list (hosting $8, AI assistant $12).
 *
 * ANNUAL PRICING IS NOT CONSISTENT BETWEEN THE TWO, on purpose:
 *
 *  - hosting  $96 = 12 x monthly. Set explicitly by the operator, so a yearly
 *    payer gets no discount — it buys cash up front and no churn, not a saving.
 *  - chatbot  $120 = 10 x monthly, the house rule elsewhere in this codebase
 *    (pay 10, get 12). The old dashboard used 12 x fee less 19% = $116.64,
 *    which is the same idea with an uglier number.
 *
 * If a consistent rule is wanted, change one line here rather than in a page.
 */
export const CLIENT_PRODUCTS: Record<string, ClientProduct> = {
  hosting: {
    key: "hosting",
    name: "Hosting",
    heading: "Website hosting",
    blurb:
      "Your site stays online, fast and secure — and the forms that bring you enquiries keep working.",
    monthlyUsd: 8,
    annualUsd: 96,
    includes: [
      "Hosting on a global CDN, with SSL",
      "Domain renewal and DNS managed",
      "Contact and quote forms kept connected",
      "Tracking and analytics kept connected",
      "Uptime watched — you hear it from us first",
    ],
    description:
      "Hosting, SSL, domain renewal, DNS, and keeping the site's forms and " +
      "tracking connected. Content changes and new pages are quoted separately.",
  },
  chatbot: {
    key: "chatbot",
    name: "AI Assistant",
    heading: "AI assistant",
    blurb:
      "Answers your customers day and night, in their language, so an enquiry at 2am is still an enquiry you win.",
    monthlyUsd: 12,
    annualUsd: 120,
    includes: [
      "Replies instantly, 24 hours a day",
      "Answers in Arabic, French and English",
      "Trained on your products and policies",
      "Hands over to you when a human is needed",
      "Kept updated as your catalogue changes",
    ],
    description:
      "An AI assistant on your site that answers customer questions around the " +
      "clock and passes real enquiries to you.",
  },
};

/** Back-compat: the original single-product export. */
export const HOSTING_PLANS = CLIENT_PRODUCTS;

export function resolveHostingPlan(key?: string | null): ClientProduct | undefined {
  if (!key) return undefined;
  return CLIENT_PRODUCTS[key.toLowerCase()];
}

/** Amount in cents for Stripe, for the chosen billing period. */
export function hostingAmountCents(
  plan: ClientProduct,
  period: "monthly" | "annual",
): number {
  const usd = period === "annual" ? plan.annualUsd : plan.monthlyUsd;
  return Math.round(usd * 100);
}

/**
 * Marks a Stripe subscription as belonging to the client-services line, so the
 * webhook writes it to hosting_clients instead of `clients`. Which product it
 * is travels separately in metadata.plan — without this marker the payment
 * would land in Servolia's EUR MRR.
 */
export const HOSTING_METADATA_KIND = "hosting";
