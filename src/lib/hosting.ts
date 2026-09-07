/**
 * HOSTING — a separate line of business from the Servolia subscription.
 *
 * Deliberately NOT added to PLANS in pricing.ts. Two reasons:
 *
 *  1. PLAN_ORDER drives the public pricing page. Anything in PLANS is a
 *     candidate to render on servolia.com, and hosting is not a Servolia
 *     product for the French market.
 *  2. Every SubscriptionPlan carries `conversations` (the AI-receptionist
 *     quota) and an implied installation fee. Hosting has neither, so it
 *     would have to fake both.
 *
 * Priced in USD. Servolia's plans are EUR — keeping the two apart avoids a
 * currency field on shared code that would otherwise have to be handled at
 * every call site.
 */

export interface HostingPlan {
  key: string;
  name: string;
  /** USD per month. */
  monthlyUsd: number;
  /** USD per year when prepaid. */
  annualUsd: number;
  description: string;
}

/**
 * Note the annual figure is 12x the monthly, not 10x. Servolia's own tiers use
 * `monthlyEur * 10` — pay 10, get 12 — but hosting is set at the operator's
 * instruction to $8/mo and $96/yr, which is the same money either way. Annual
 * therefore buys cash up front and no churn, not a discount. If a discount is
 * ever wanted, 10x would be $80.
 */
export const HOSTING_PLANS: Record<string, HostingPlan> = {
  hosting: {
    key: "hosting",
    name: "Hosting",
    monthlyUsd: 8,
    annualUsd: 96,
    description:
      "Hosting, SSL, domain renewal, DNS, and keeping the site's forms and " +
      "tracking connected. Content changes and new pages are quoted separately.",
  },
};

export function resolveHostingPlan(key?: string | null): HostingPlan | undefined {
  if (!key) return undefined;
  return HOSTING_PLANS[key.toLowerCase()];
}

/** Amount in cents for Stripe, for the chosen billing period. */
export function hostingAmountCents(
  plan: HostingPlan,
  period: "monthly" | "annual",
): number {
  const usd = period === "annual" ? plan.annualUsd : plan.monthlyUsd;
  return Math.round(usd * 100);
}

/**
 * Marks a Stripe subscription as belonging to the hosting line. The webhook
 * routes on this: without it a hosting payment would be written into the
 * `clients` table and would show up in Servolia's MRR.
 */
export const HOSTING_METADATA_KIND = "hosting";
