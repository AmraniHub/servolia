import { BUILD_PLANS, CARE_PLANS, depositCents, balanceCents, type BuildPlan } from "./pricing";

/**
 * Generates the "1-page scope document" text promised in the how-it-works
 * sales flow (step 4: "what we build, what's not included, the fixed price,
 * the delivery deadline"). There's no public API for Google Workspace's
 * built-in eSignature feature, so this produces ready-to-paste plain text —
 * paste it into a Google Doc, then use Workspace's own "Request signature"
 * action on that doc. This just removes the manual writing/pricing-lookup
 * step and keeps every scope doc consistent with the real BUILD_PLANS prices.
 */

const WHATS_INCLUDED: Record<string, string[]> = {
  setup: [
    "Conversion-focused multi-page website, written for your practice",
    "Your 24/7 AI receptionist, trained on your services and hours",
    "Online booking / enquiry capture, wired to instant alerts",
    "Domain, hosting, SSL and professional email set up for you",
    "GDPR pages and cookie consent included",
    "One round of revisions before we go live",
  ],
  // ── Retired plans, kept so historical scopes still render ──
  starter: ["Conversion-focused website (up to 6 pages)", "Mobile-optimized, fast-loading", "Contact form wired to your email", "Basic on-page SEO setup"],
  growth:  ["Everything in the Website System", "AI receptionist chatbot (trained on your business)", "Booking/enquiry capture into a client dashboard", "GDPR-compliant data handling"],
  pro:     ["Everything in the Booking System", "Admin dashboard: leads, pipeline, messages", "Monthly performance report (PDF)", "CRM access for your team"],
  landing: ["High-converting ad landing page", "Full tracking (Meta Pixel / Conversions API)", "A/B-test-ready structure"],
  webapp:  ["Custom web app scoped to your workflow", "Database + admin access", "User accounts if required"],
  mobile:  ["Native-feel mobile app (iOS/Android via web wrapper)", "Push-notification ready", "App store listing support"],
};

const EXCLUSIONS = [
  "Copy/content revisions beyond the one included round of feedback",
  "Third-party subscription costs (domain renewal, SMS credits, ad spend)",
  "Features not listed above — these are scoped and priced separately before work begins",
];

export interface ScopeDocInput {
  businessName: string;
  contactName?: string | null;
  email?: string | null;
  planKey: keyof typeof BUILD_PLANS;
  carePlanKey?: keyof typeof CARE_PLANS | null;
  /** Web acceptance flow (src/app/scope/[token]) provides its own digital
   * accept UI below this text, so it doesn't need the blank physical
   * signature-line footer meant for a printed/Google-Docs copy. */
  forWeb?: boolean;
}

export function generateScopeDocument(input: ScopeDocInput): string {
  const plan: BuildPlan = BUILD_PLANS[input.planKey];
  const care = input.carePlanKey ? CARE_PLANS[input.carePlanKey] : null;
  const included = WHATS_INCLUDED[input.planKey] ?? [];
  const deposit = (depositCents(plan) / 100).toLocaleString();
  const balance = (balanceCents(plan) / 100).toLocaleString();
  // The current model is one installation fee + a monthly plan. Retired build
  // plans keep the old 50/50 deposit wording so historical scopes still read right.
  const isSetup = input.planKey === "setup";
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const footer = input.forWeb
    ? `Any additions beyond what's listed above will be quoted separately before work begins.`
    : `Any additions beyond what's listed above will be quoted separately before work begins. By signing below, both parties agree to this scope.

SERVOLIA                                          CLIENT
_________________________                         _________________________
Date: ${today}                                     Date: __________________
`;

  return `SERVOLIA — PROJECT SCOPE
${input.businessName}
${today}

CLIENT
${input.businessName}${input.contactName ? `\nAttn: ${input.contactName}` : ""}${input.email ? `\n${input.email}` : ""}

WHAT WE BUILD — ${plan.name} (€${plan.totalEur.toLocaleString()})
${included.map((i) => `  • ${i}`).join("\n")}

WHAT'S NOT INCLUDED
${EXCLUSIONS.map((i) => `  • ${i}`).join("\n")}

PRICE
${isSetup
  ? `  Installation: €${plan.totalEur.toLocaleString()} — one-time, due to start.${care ? `\n  Waived if you start on the annual plan below.` : ""}`
  : `  Total: €${plan.totalEur.toLocaleString()}
  Deposit (50%, due to start): €${deposit}
  Balance (50%, due on delivery): €${balance}${plan.monthlyEur ? `\n  Recurring platform fee: €${plan.monthlyEur}/month` : ""}`}
${care ? `\nYOUR PLAN — ${care.name}
  €${care.monthlyEur}/month, or €${care.annualEur.toLocaleString()}/year (two months free).
  Includes ${care.conversations} AI conversations per month, plus hosting, domain,
  professional email, your client portal and ongoing support. Go over the included
  conversations and we simply move you up a plan — never a surprise bill.
  Cancel any time with 30 days' notice.\n` : ""}
DELIVERY
  Live within ${plan.delivery} of ${isSetup ? "the installation fee" : "the deposit"} being received + your completed intake form.

GUARANTEE
  Live on time or 10% of your payment refunded per day late, capped at 50%, if the delay is Servolia's fault — per our Terms of Service (servolia.com/legal/cgv).

${footer}`;
}
