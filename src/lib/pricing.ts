/**
 * PRICING — single source of truth for every Servolia price.
 *
 * Import from here for anything that charges money or quotes a price
 * (Stripe checkout, chatbot prompts). Marketing pages display these same
 * numbers as copy — when you change a price HERE, grep the repo for the old
 * value and update the display strings too:
 *   pricing/page.tsx · fr/tarifs · page.tsx · FrenchHome.tsx · contact pages ·
 *   niches/* · dentists · fr/dentistes · fr/solutions · ROICalculator ·
 *   cf-worker/src/index.ts (separate deploy — cannot import this file).
 *
 * NOTE: "never invent a price" is a guard on a CLIENT's own service prices
 * (dental treatments etc.), NOT on Servolia's own prices — those live here.
 */

export interface BuildPlan {
  key: string;
  name: string;
  nameFr: string;
  totalEur: number;   // full price in EUR
  delivery: string;   // e.g. "3 days"
  monthlyEur?: number; // optional recurring component (e.g. Ads Landing)
}

export const BUILD_PLANS: Record<string, BuildPlan> = {
  starter: { key: "starter", name: "Website System", nameFr: "Système Site Web",        totalEur: 290, delivery: "3 days" },
  growth:  { key: "growth",  name: "Booking System", nameFr: "Système de Réservation",  totalEur: 590, delivery: "5 days" },
  pro:     { key: "pro",     name: "Client System",  nameFr: "Système Client",          totalEur: 990, delivery: "7 days" },
  landing: { key: "landing", name: "Ads Landing",    nameFr: "Système Landing Pub",     totalEur: 290, delivery: "4 days", monthlyEur: 99 },
  webapp:  { key: "webapp",  name: "Web App / SaaS", nameFr: "Web App / SaaS",          totalEur: 290, delivery: "7–14 days" },
  mobile:  { key: "mobile",  name: "Mobile App",     nameFr: "Application Mobile",      totalEur: 490, delivery: "10–15 days" },
};

/**
 * CARE PLANS — the recurring core of the business. Each tier is an ALL-IN
 * bundle: the client pays one monthly fee and Servolia is the single vendor
 * for their whole digital presence (domain, hosting, pro email, the AI
 * receptionist, and reporting). Commodity inputs are bundled, never itemized —
 * higher perceived value, and every included service raises switching cost.
 *
 * annualEur = 11 × monthly (pay yearly, ONE MONTH FREE) — brings in a year of
 * cash up front (float) and cuts churn.
 */
export interface CarePlan {
  key: string;
  name: string;
  monthlyEur: number;
  annualEur: number; // yearly price when prepaid — one month free
}

const withAnnual = (key: string, name: string, monthlyEur: number): CarePlan => ({
  key, name, monthlyEur, annualEur: monthlyEur * 11, // 1 month free
});

export const CARE_PLANS: Record<string, CarePlan> = {
  care:        withAnnual("care",        "Care",   49),
  care_growth: withAnnual("care_growth", "Growth", 99),
  care_scale:  withAnnual("care_scale",  "Scale",  199),
};

/** Ads Management — Servolia runs the client's Meta/Google ads. Management
 *  retainer + a percentage of ad spend (the client funds the budget: OPM). The
 *  Meta CAPI closed loop proves ROI so spend compounds. */
export const ADS_MANAGEMENT = {
  key: "ads_management",
  name: "Ads Management",
  nameFr: "Gestion Publicitaire",
  retainerEur: 390, // monthly management retainer
  spendPct: 12,     // % of monthly ad spend, on top of the retainer
  minSpendEur: 500, // recommended minimum monthly ad budget
};

/** À-la-carte recurring add-ons (resold infrastructure with managed markup).
 *  Surfaced in the portal; provisioned by Servolia. `per` describes the unit. */
export interface AddOn {
  key: string;
  name: string;
  nameFr: string;
  priceEur: number;
  interval: "month" | "year";
  per?: string; // e.g. "mailbox"
}

export const ADDONS: Record<string, AddOn> = {
  domain:  { key: "domain",  name: "Domain + DNS management",      nameFr: "Nom de domaine + DNS gérés",         priceEur: 39, interval: "year" },
  email:   { key: "email",   name: "Professional email",          nameFr: "Email professionnel @votre-domaine", priceEur: 12, interval: "month", per: "mailbox" },
  sms:     { key: "sms",     name: "SMS / WhatsApp reminders",     nameFr: "Rappels SMS / WhatsApp",             priceEur: 19, interval: "month" },
  reviews: { key: "reviews", name: "Google reviews automation",    nameFr: "Automatisation des avis Google",     priceEur: 39, interval: "month" },
};

/** iOS add-on for the mobile plan, EUR. */
export const MOBILE_IOS_ADDON_EUR = 100;

/** 50% deposit in Stripe cents. */
export function depositCents(plan: BuildPlan): number {
  return Math.round((plan.totalEur * 100) / 2);
}

/** Remaining balance in Stripe cents. */
export function balanceCents(plan: BuildPlan): number {
  return plan.totalEur * 100 - depositCents(plan);
}

/** Care-plan amount in Stripe cents for the chosen billing interval. */
export function careAmountCents(plan: CarePlan, billing: "monthly" | "annual"): number {
  return (billing === "annual" ? plan.annualEur : plan.monthlyEur) * 100;
}

/** Pricing block for AI prompts — keeps every bot quoting the same numbers. */
export function pricingPromptLines(): string {
  const p = BUILD_PLANS;
  const c = CARE_PLANS;
  const a = ADS_MANAGEMENT;
  return [
    `1. AI Website System — €${p.starter.totalEur}, ${p.starter.delivery}. Conversion-focused website.`,
    `2. AI Booking System — €${p.growth.totalEur}, ${p.growth.delivery}. Website + AI receptionist + booking.`,
    `3. Ads Landing System — €${p.landing.totalEur} + €${p.landing.monthlyEur}/mo. High-converting landing page with full tracking.`,
    `4. AI Client System — €${p.pro.totalEur}, ${p.pro.delivery}. Complete: site + chatbot + admin dashboard + CRM + monthly reports.`,
    `5. Care Plans (all-in monthly: domain + hosting + pro email + AI receptionist + reports) — €${c.care.monthlyEur} / €${c.care_growth.monthlyEur} / €${c.care_scale.monthlyEur} per month. Pay yearly and get one month free.`,
    `6. Ads Management — from €${a.retainerEur}/mo + ${a.spendPct}% of ad spend. We run and optimise your Meta/Google ads with full ROI tracking.`,
  ].join("\n");
}
