import { INTEGRATIONS, ROADMAP, type RoadmapStatus } from "@/lib/roadmap";
import { SERVICE_COSTS, isActive, totalFixedMonthlyEur } from "@/lib/costs";

/**
 * Derivations shared by the settings layout and its sub-pages.
 *
 * The tab badges ("3 missing", "12 left") are computed here and nowhere else,
 * so a badge can never disagree with the page it points at. Server-only —
 * reads process.env to see which secrets are set, and never returns a value.
 */

const STATUS_SORT: Record<RoadmapStatus, number> = { blocked: 0, in_progress: 1, todo: 2, done: 3 };

export function integrationStatus() {
  // We surface whether each secret is SET, never its value.
  const checked = INTEGRATIONS.map((i) => ({ ...i, ok: i.envVars.every((v) => !!process.env[v]?.trim()) }));
  return {
    checked,
    requiredMissing: checked.filter((c) => c.required && !c.ok),
    unsetCount: checked.filter((c) => !c.ok && !c.activeByDefault).length,
  };
}

export function stripeMode(): "live" | "test" | "unknown" | "missing" {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("sk_test_")) return "test";
  return key ? "unknown" : "missing";
}

export function openRoadmap() {
  return [...ROADMAP]
    .filter((r) => r.status !== "done")
    .sort((a, b) => a.priority - b.priority || STATUS_SORT[a.status] - STATUS_SORT[b.status]);
}

export function costBreakdown() {
  const costs = SERVICE_COSTS.map((c) => ({ ...c, active: isActive(c) }));
  const fixed = costs.filter((c) => c.billing === "flat");
  return {
    fixed,
    usage: costs.filter((c) => c.billing === "usage"),
    free: costs.filter((c) => c.billing === "free"),
    fixedActiveTotal: totalFixedMonthlyEur(),
    hasEstimates: fixed.some((c) => c.active && c.isEstimate),
  };
}
