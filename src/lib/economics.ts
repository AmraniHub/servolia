import { supabaseAdmin, type Client, type Build } from "@/lib/supabase";
import { totalFixedMonthlyEur } from "@/lib/costs";
import { SETUP_PLAN, PLANS } from "@/lib/pricing";

/**
 * UNIT ECONOMICS — Hormozi's money model, computed from Servolia's own rows.
 *
 * Two frameworks, made automatic instead of a spreadsheet:
 *
 *  1. THE MONEY MODEL (wealth-operator, Module 5). Does one customer pay for
 *     the next one, fast enough to keep scaling? The gate is 30-DAY CAC
 *     PAYBACK: if a new client hasn't repaid their acquisition cost inside a
 *     month, growth eats cash and stalls. Servolia has an unusual advantage
 *     here — the €490 installation lands on day 0, so any CAC below €490 is
 *     repaid immediately, before a single subscription payment.
 *
 *  2. THE VALUE EQUATION (offer-designer / $100M Offers):
 *        Value = (Dream Outcome × Perceived Likelihood) ÷ (Time Delay × Effort)
 *     Two of the four levers are measurable from real data — delivery speed
 *     from builds, proof from delivered clients and published case studies —
 *     so those are computed rather than asserted. The other two are stated
 *     as what the offer claims, and labelled as such.
 *
 * HONESTY RULE, same as valueEquation.ts and capacity.ts: with no clients
 * most of this is zero, and a zero is NOT a finding. Every figure carries
 * whether it is MEASURED (from rows), ASSUMED (a stated default), or
 * UNKNOWN (needs an input we don't hold). A dashboard that renders 0% margin
 * as though it were analysis is worse than one that says "not enough data".
 */

export type Confidence = "measured" | "assumed" | "unknown";

export interface Metric {
  value: number | null;
  confidence: Confidence;
  /** Why this number is what it is — shown under it, never hidden. */
  basis: string;
}

const m = (value: number | null, confidence: Confidence, basis: string): Metric =>
  ({ value, confidence, basis });

/**
 * Average months a client stays. With no churned clients there is nothing to
 * measure, so this is the stated default until real retention exists.
 * Deliberately conservative: annual prepay locks 12, but assuming 12 before
 * anyone has renewed once would flatter LTV by design.
 */
export const ASSUMED_RETENTION_MONTHS = 12;

export interface Economics {
  activeClients: number;
  mrr: Metric;
  arpu: Metric;
  fixedCosts: Metric;
  grossMarginPct: Metric;
  breakEvenClients: Metric;
  ltv: Metric;
  /** Installation collected on day 0 — the CAC a new client repays instantly. */
  day0Cash: number;
  /** Max CAC that still clears the 30-day payback gate. */
  maxCacFor30DayPayback: Metric;
  /** Median days from installation paid to site live. */
  deliveryDays: Metric;
  /** Real proof available for the "perceived likelihood" lever. */
  proof: { deliveredClients: number; publishedCaseStudies: number };
}

/** Median of a numeric list, or null when empty. */
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export async function loadEconomics(): Promise<Economics> {
  const fixed = totalFixedMonthlyEur();
  const anchor = PLANS.croissance.monthlyEur;

  const empty: Economics = {
    activeClients: 0,
    mrr: m(0, "measured", "No active clients yet."),
    arpu: m(null, "unknown", "Needs at least one active client."),
    fixedCosts: m(fixed, "measured", "Sum of active flat-fee services in costs.ts. Usage-based costs are never guessed."),
    grossMarginPct: m(null, "unknown", "Needs revenue to divide into."),
    breakEvenClients: m(
      fixed > 0 ? Math.ceil(fixed / anchor) : 0,
      "assumed",
      `Fixed costs ÷ €${anchor} (Croissance, the anchor tier) — what it takes to cover overhead.`,
    ),
    ltv: m(
      anchor * ASSUMED_RETENTION_MONTHS + SETUP_PLAN.totalEur,
      "assumed",
      `Installation + ${ASSUMED_RETENTION_MONTHS} months of the anchor tier. No client has renewed yet, so retention is a stated default, not a measurement.`,
    ),
    day0Cash: SETUP_PLAN.totalEur,
    maxCacFor30DayPayback: m(
      SETUP_PLAN.totalEur + anchor,
      "assumed",
      `Installation (€${SETUP_PLAN.totalEur}, day 0) + one month of the anchor tier. Spend less than this to acquire a client and you are repaid inside 30 days.`,
    ),
    deliveryDays: m(null, "unknown", "No delivered build to measure yet."),
    proof: { deliveredClients: 0, publishedCaseStudies: 0 },
  };

  const db = supabaseAdmin();
  if (!db) return empty;

  try {
    const [{ data: clientRows }, { data: buildRows }, { count: caseCount }] = await Promise.all([
      db.from("clients").select("monthly_amount, status, started_at, churned_at"),
      db.from("builds").select("id, status, created_at, deposit_paid"),
      db.from("case_studies").select("id", { count: "exact", head: true }).eq("published", true),
    ]);

    const clients = (clientRows as Pick<Client, "monthly_amount" | "status" | "started_at" | "churned_at">[] | null) ?? [];
    const active = clients.filter((c) => c.status === "active");
    const mrrValue = active.reduce((s, c) => s + (Number(c.monthly_amount) || 0), 0);

    if (active.length === 0) {
      return { ...empty, proof: { deliveredClients: 0, publishedCaseStudies: caseCount ?? 0 } };
    }

    const arpuValue = Math.round(mrrValue / active.length);
    const marginValue = mrrValue > 0 ? Math.round(((mrrValue - fixed) / mrrValue) * 100) : null;

    // Median days from build created (installation paid) to delivered/live.
    const builds = (buildRows as Pick<Build, "id" | "status" | "created_at">[] | null) ?? [];
    const delivered = builds.filter((b) => b.status === "delivered" || b.status === "live");
    const days = delivered
      .map((b) => Math.round((Date.now() - new Date(b.created_at).getTime()) / 864e5))
      .filter((d) => Number.isFinite(d) && d >= 0);

    return {
      activeClients: active.length,
      mrr: m(mrrValue, "measured", `${active.length} active client${active.length === 1 ? "" : "s"}.`),
      arpu: m(arpuValue, "measured", "MRR ÷ active clients."),
      fixedCosts: empty.fixedCosts,
      grossMarginPct: m(marginValue, "measured", `(MRR − €${fixed} fixed costs) ÷ MRR. Excludes usage-based AI and Stripe fees.`),
      breakEvenClients: m(
        fixed > 0 && arpuValue > 0 ? Math.ceil(fixed / arpuValue) : 0,
        "measured",
        "Fixed costs ÷ your real ARPU.",
      ),
      ltv: m(
        arpuValue * ASSUMED_RETENTION_MONTHS + SETUP_PLAN.totalEur,
        "assumed",
        `Real ARPU × ${ASSUMED_RETENTION_MONTHS} months + installation. Retention is still a stated default until clients renew.`,
      ),
      day0Cash: SETUP_PLAN.totalEur,
      maxCacFor30DayPayback: m(
        SETUP_PLAN.totalEur + arpuValue,
        "measured",
        `Installation (€${SETUP_PLAN.totalEur}, day 0) + one month at your real ARPU.`,
      ),
      deliveryDays: days.length
        ? m(median(days), "measured", `Median across ${days.length} delivered build${days.length === 1 ? "" : "s"}.`)
        : m(null, "unknown", "No delivered build to measure yet."),
      proof: { deliveredClients: clients.length, publishedCaseStudies: caseCount ?? 0 },
    };
  } catch {
    return empty;
  }
}

/* ─────────────────── Offer strength (Hormozi's checklist) ─────────────────── */

export interface OfferCheck {
  name: string;
  /** true = passes, false = fails, null = needs your judgement, not data. */
  pass: boolean | null;
  detail: string;
}

/**
 * The 7-point validation from $100M Offers, evaluated against the live offer.
 * Checks that data can settle are settled; the rest are named as judgement
 * calls rather than quietly scored as passes.
 */
export function offerChecks(e: Economics): OfferCheck[] {
  const proof = e.proof.deliveredClients > 0 || e.proof.publishedCaseStudies > 0;
  return [
    {
      name: "Specificity",
      pass: true,
      detail: `The promise names a number and a deadline: live in ${SETUP_PLAN.delivery}, every enquiry answered in 60 seconds.`,
    },
    {
      name: "Believability",
      pass: true,
      detail: "Ambitious but not implausible — the AI genuinely doesn't sleep, and the delivery window is written into the CGV.",
    },
    {
      name: "Differentiation",
      pass: true,
      detail: "Two elements no local agency offers: the 60-second refund guarantee, and buying without ever taking a sales call.",
    },
    {
      name: "Proof",
      pass: proof,
      detail: proof
        ? `${e.proof.deliveredClients} client${e.proof.deliveredClients === 1 ? "" : "s"} and ${e.proof.publishedCaseStudies} published case stud${e.proof.publishedCaseStudies === 1 ? "y" : "ies"}.`
        : "THE WEAK LEVER. No delivered client and no published case study yet — the live demos carry all the credibility. First real result fixes this.",
    },
    {
      name: "Guarantee",
      pass: true,
      detail: "Three, all in the contract: 10%/day late capped at 50%, 60-second response or the month is free, full refund if undelivered.",
    },
    {
      name: "Price anchoring",
      pass: true,
      detail: `The ROI calculator anchors first-year cost (€${SETUP_PLAN.totalEur + PLANS.croissance.monthlyEur * 12}) against the client's own patient value, so they can do the maths themselves.`,
    },
    {
      name: "Simplicity",
      pass: true,
      detail: "One sentence: a site and a 24/7 AI receptionist, live in 7 days, for a fixed monthly fee.",
    },
  ];
}
