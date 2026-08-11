/**
 * PRICING — single source of truth for every Servolia price.
 *
 * Import from here for anything that charges money or quotes a price
 * (Stripe checkout, chatbot prompts). Marketing pages display these same
 * numbers as copy — when you change a price HERE, grep the repo for the old
 * value and update the display strings too:
 *   pricing/page.tsx · fr/tarifs · page.tsx · FrenchHome.tsx · contact pages ·
 *   niches/* · dentists · fr/dentistes · fr/esthetique · fr/solutions ·
 *   frGeo.ts · ROICalculator · cf-worker/src/index.ts (separate deploy —
 *   cannot import this file).
 *
 * NOTE: "never invent a price" is a guard on a CLIENT's own service prices
 * (dental treatments etc.), NOT on Servolia's own prices — those live here.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE MODEL (revised 2026-07-28) — one setup fee + a metered subscription.
 *
 * What changed and why: the old shape was €290–990 once + €49/mo. The cash
 * was front-loaded while the value and the costs are recurring, so income
 * only existed while new clients kept closing — the agency treadmill. And
 * €49/mo signalled "hosting", a thing people cancel, while barely covering
 * the Claude inference a busy clinic consumes.
 *
 * Now: a modest INSTALLATION fee, then the subscription IS the product,
 * tiered by INCLUDED AI CONVERSATIONS.
 *
 * Why meter conversations rather than bookings: charging per patient booked
 * is a fee tied to patient volume, which French "compérage" rules restrict
 * for regulated medical professions (that's why PAY_PER_BOOKING below is
 * aesthetic-only). Metering AI conversations is metering a technical
 * resource — ordinary SaaS — so it works for dental AND aesthetic while
 * still growing with the client's business. This distinction has NOT yet
 * been confirmed by a French lawyer; see roadmap.ts before leaning on it in
 * public copy.
 * ───────────────────────────────────────────────────────────────────────── */

export interface BuildPlan {
  key: string;
  name: string;
  nameFr: string;
  totalEur: number;   // full price in EUR
  delivery: string;   // e.g. "7 days"
  deliveryFr?: string; // e.g. "7 jours" — FR pages must not render the EN string
  monthlyEur?: number; // optional recurring component
  /**
   * Retired plans are no longer sold: they're hidden from every public page and
   * refused at checkout. They stay defined so builds and leads that were sold
   * under them still render their real name in the admin instead of "undefined".
   */
  retired?: boolean;
}

export const BUILD_PLANS: Record<string, BuildPlan> = {
  // The only thing sold up front: installation of the system.
  setup:   { key: "setup",   name: "Installation", nameFr: "Mise en place",        totalEur: 490, delivery: "7 days", deliveryFr: "7 jours" },

  // ── Retired 2026-07-28 — the three-way build choice was replaced by one
  // setup fee plus a subscription tier. Kept so historical builds render. ──
  starter: { key: "starter", name: "Website System", nameFr: "Système Site Web",   totalEur: 290, delivery: "3 days",  retired: true },
  growth:  { key: "growth",  name: "Booking System", nameFr: "Système de Réservation", totalEur: 590, delivery: "5 days", retired: true },
  pro:     { key: "pro",     name: "Client System",  nameFr: "Système Client",     totalEur: 990, delivery: "7 days",  retired: true },
  landing: { key: "landing", name: "Ads Landing",    nameFr: "Système Landing Pub", totalEur: 290, delivery: "4 days", monthlyEur: 99, retired: true },
  webapp:  { key: "webapp",  name: "Web App / SaaS", nameFr: "Web App / SaaS",     totalEur: 290, delivery: "7–14 days", retired: true },
  mobile:  { key: "mobile",  name: "Mobile App",     nameFr: "Application Mobile", totalEur: 490, delivery: "10–15 days", retired: true },
};

/** The plans actually on sale — use this anywhere a customer chooses a plan. */
export const SELLABLE_BUILD_PLANS = Object.values(BUILD_PLANS).filter((p) => !p.retired);

/** The one-time installation fee. */
export const SETUP_PLAN = BUILD_PLANS.setup;

/**
 * SUBSCRIPTION PLANS — the recurring core of the business, and the product
 * itself. Each tier is an ALL-IN bundle: one monthly fee and Servolia is the
 * single vendor for the client's whole digital presence (domain, hosting, pro
 * email, the AI receptionist, reporting). Commodity inputs are bundled, never
 * itemised — higher perceived value, and every included service raises the
 * switching cost. NEVER unbundle domain/hosting/email: leaving has to mean
 * losing the whole presence, not cancelling one line item.
 *
 * annualEur = 10 × monthly (PAY 10, GET 12 — two months free). Brings a year
 * of cash up front and locks in twelve months against churn, which matters
 * enormously for a solo founder.
 *
 * `conversations` is the included monthly AI-receptionist volume. Going over
 * auto-upgrades to the next tier (see planForConversations) rather than
 * charging surprise overage — predictable for them, expansion revenue for you.
 */
export interface SubscriptionPlan {
  key: string;
  name: string;
  nameFr: string;
  monthlyEur: number;
  annualEur: number;      // yearly price when prepaid — two months free
  conversations: number;  // included AI conversations per month
  /** Who the tier fits, in the buyer's units — a dentist doesn't think in
   *  "AI conversations", they think in practice size. Shown under the meter. */
  audience: string;
  audienceFr: string;
  /** Legacy keys that map onto this plan (old Stripe metadata / clients rows). */
  legacyKeys?: string[];
}

const withAnnual = (
  key: string, name: string, nameFr: string, monthlyEur: number, conversations: number,
  audience: string, audienceFr: string, legacyKeys?: string[],
): SubscriptionPlan => ({
  key, name, nameFr, monthlyEur,
  annualEur: monthlyEur * 10, // pay 10, get 12
  conversations,
  audience, audienceFr,
  legacyKeys,
});

export const PLANS: Record<string, SubscriptionPlan> = {
  essentiel: withAnnual("essentiel", "Essentiel", "Essentiel", 149, 100,
    "Fits a solo practice — every enquiry of one practitioner, covered.",
    "Pour un cabinet individuel — toutes les demandes d’un praticien, couvertes.",
    ["care"]),
  croissance: withAnnual("croissance", "Croissance", "Croissance", 249, 300,
    "Fits a group practice — 2–3 practitioners, bookings included.",
    "Pour un cabinet de groupe — 2 à 3 praticiens, rendez-vous inclus.",
    ["care_growth"]),
  performance: withAnnual("performance", "Performance", "Performance", 449, 800,
    "For clinics and multi-site practices running ads.",
    "Pour les centres et multi-sites qui font de la publicité.",
    ["care_scale"]),
};

/** Display order; the middle tier is the anchor. */
export const PLAN_ORDER = ["essentiel", "croissance", "performance"] as const;
export const POPULAR_PLAN_KEY = "croissance";

/**
 * Resolve a plan key, tolerating the pre-2026-07-28 names ("care",
 * "care_growth", "care_scale") that may still sit in Stripe metadata or an
 * old clients row.
 */
export function resolvePlan(key?: string | null): SubscriptionPlan | undefined {
  if (!key) return undefined;
  const k = key.toLowerCase();
  if (PLANS[k]) return PLANS[k];
  return Object.values(PLANS).find((p) => p.legacyKeys?.includes(k));
}

/** The smallest tier that covers this monthly conversation volume. */
export function planForConversations(count: number): SubscriptionPlan {
  return (
    PLAN_ORDER.map((k) => PLANS[k]).find((p) => count <= p.conversations)
    ?? PLANS.performance
  );
}

/**
 * BACKWARDS COMPATIBILITY — `CARE_PLANS` was the old export name. Kept as an
 * alias so nothing breaks mid-migration; prefer PLANS in new code.
 * @deprecated use PLANS
 */
export const CARE_PLANS = PLANS;
/** @deprecated use SubscriptionPlan */
export type CarePlan = SubscriptionPlan;

/** À-la-carte recurring add-ons — mostly upgrades for Essentiel clients,
 *  since Croissance and Performance already include SMS and reviews. Each one
 *  sold is also a nudge toward simply moving up a tier. */
export interface AddOn {
  key: string;
  name: string;
  nameFr: string;
  priceEur: number;
  interval: "month" | "year";
  per?: string; // e.g. "mailbox"
  /** Self-serve = the client can enable + pay in one click (billing auto,
   *  fulfilment is within our system). Others need a short conversation first
   *  (which domain? how many mailboxes?) so they stay "message us". */
  selfServe?: boolean;
  /** Included from this tier upward — hidden as a paid add-on for those plans. */
  includedFrom?: string;
}

export const ADDONS: Record<string, AddOn> = {
  email:   { key: "email",   name: "Extra mailbox",              nameFr: "Boîte email supplémentaire",      priceEur: 12, interval: "month", per: "mailbox" },
  sms:     { key: "sms",     name: "SMS / WhatsApp reminders",   nameFr: "Rappels SMS / WhatsApp",          priceEur: 19, interval: "month", selfServe: true, includedFrom: "croissance" },
  reviews: { key: "reviews", name: "Google reviews automation",  nameFr: "Automatisation des avis Google",  priceEur: 39, interval: "month", selfServe: true, includedFrom: "croissance" },
};

/** Add-ons still worth selling to a client on this plan. */
export function addonsFor(planKey?: string | null): AddOn[] {
  const plan = resolvePlan(planKey);
  const rank = plan ? PLAN_ORDER.indexOf(plan.key as typeof PLAN_ORDER[number]) : -1;
  return Object.values(ADDONS).filter((a) => {
    if (!a.includedFrom) return true;
    const incRank = PLAN_ORDER.indexOf(a.includedFrom as typeof PLAN_ORDER[number]);
    return rank < incRank;
  });
}

/**
 * PAY-PER-BOOKING — charge only for attended AI-booked consultations, on top
 * of a smaller setup fee. Kept as the RISK-REVERSAL CLOSE for a skeptical
 * aesthetic clinic ("prove it first"), not as the main model — the metered
 * subscription above is the main model because it's legal in the dental
 * beachhead too.
 *
 * LEGAL GATE — do not remove without re-checking: French deontological rules
 * (Ordre des Chirurgiens-Dentistes / Médecins) restrict "compérage"-style fee
 * arrangements tied to patient volume for regulated medical professions. This
 * is cleared to pilot with non-physician-run aesthetic/med-spa businesses
 * ONLY. Dental/medical stays on the subscription until a French lawyer signs
 * off (see roadmap.ts). `payPerBookingEligible()` is the single gate to check
 * before ever offering or quoting this — never bypass it inline.
 */
export interface PayPerBookingPlan {
  key: string;
  name: string;
  nameFr: string;
  setupEur: number;       // one-time setup fee
  perBookingEur: number;  // charged per attended AI-booked consultation
}

export const PAY_PER_BOOKING: PayPerBookingPlan = {
  key: "pay_per_booking",
  name: "Pay-per-booking",
  nameFr: "Paiement à la réservation",
  setupEur: 990,
  perBookingEur: 60,
};

/** Niches legally cleared to pilot pay-per-booking (non-physician-run only). */
const PAY_PER_BOOKING_ELIGIBLE = /aesthetic|med-?spa|beaut/i;

/** Niches where this must NEVER be offered without a French lawyer's sign-off. */
const PAY_PER_BOOKING_REGULATED = /dental|dentist|dentaire|implant|medical|m[ée]dec|chirurg|physician|docteur/i;

/**
 * The single gate to check before ever quoting or offering pay-per-booking.
 * Defaults to false for anything not explicitly cleared — an unrecognised or
 * ambiguous niche should never fall through to "eligible".
 */
export function payPerBookingEligible(niche?: string | null): boolean {
  const n = niche ?? "";
  if (PAY_PER_BOOKING_REGULATED.test(n)) return false;
  return PAY_PER_BOOKING_ELIGIBLE.test(n);
}

/**
 * 50% deposit in Stripe cents — RETIRED BUILD PLANS ONLY.
 *
 * The live installation is charged IN FULL (see /api/checkout); nothing is
 * owed on delivery. These two helpers survive purely so a scope document
 * regenerated for a build sold before 2026-07-28 still shows the deposit and
 * balance that client actually agreed to. Never use them for a new sale.
 */
export function depositCents(plan: BuildPlan): number {
  return Math.round((plan.totalEur * 100) / 2);
}

/** Remaining balance in Stripe cents — retired build plans only. */
export function balanceCents(plan: BuildPlan): number {
  return plan.totalEur * 100 - depositCents(plan);
}

/** Subscription amount in Stripe cents for the chosen billing interval. */
export function planAmountCents(plan: SubscriptionPlan, billing: "monthly" | "annual"): number {
  return (billing === "annual" ? plan.annualEur : plan.monthlyEur) * 100;
}

/** @deprecated use planAmountCents */
export const careAmountCents = planAmountCents;

/** Pricing block for AI prompts — keeps every bot quoting the same numbers. */
export function pricingPromptLines(): string {
  const s = SETUP_PLAN;
  const p = PLANS;
  return [
    `Servolia is sold as a one-time installation plus a monthly plan. The monthly plan IS the product.`,
    `1. Installation — €${s.totalEur} once (${s.delivery}). Site built, AI receptionist trained, everything live. Waived when paying a year up front.`,
    `2. ${p.essentiel.name} — €${p.essentiel.monthlyEur}/month. Site + 24/7 AI receptionist (${p.essentiel.conversations} conversations/mo), instant lead alerts, client portal, hosting + domain + email included.`,
    `3. ${p.croissance.name} — €${p.croissance.monthlyEur}/month (most chosen). Everything above with ${p.croissance.conversations} conversations/mo, plus lead pipeline, monthly ROI report, Google reviews automation, SMS reminders and traffic analytics.`,
    `4. ${p.performance.name} — €${p.performance.monthlyEur}/month. Everything above with ${p.performance.conversations} conversations/mo, plus multi-practitioner, ads closed-loop tracking, custom AI training and a quarterly strategy call.`,
    `Pay yearly and get two months free. Going over the included conversations moves you to the next plan — never a surprise bill.`,
  ].join("\n");
}
