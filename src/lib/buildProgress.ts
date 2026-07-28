import { supabaseAdmin } from "@/lib/supabase";
import { daysUntil } from "@/lib/dates";

/**
 * DELIVERY PROGRESS — the checklist that fills itself in.
 *
 * Every step of a Servolia delivery is already recorded somewhere (a deposit
 * on the build, an accepted scope, an intake blob, a published client_site, a
 * clients row). So instead of asking the founder to tick boxes — which drifts
 * from reality the moment someone forgets — we DERIVE the checklist from the
 * data and show the one step that's actually blocking.
 *
 * Each step also records WHO owns it. That's the important part: a build
 * parked for ten days because the client never filled the intake is a
 * completely different situation from one you haven't started, and the CGV
 * say client-caused delay doesn't count against the delivery guarantee.
 */

export type StepOwner = "us" | "client";

export interface DeliveryStep {
  key: string;
  label: string;
  /** Who has to act for this step to complete. */
  owner: StepOwner;
  done: boolean;
  /** What to do about it, shown when this is the current step. */
  hint: string;
}

export interface BuildProgress {
  steps: DeliveryStep[];
  doneCount: number;
  total: number;
  /** First incomplete step — the thing actually holding this build up. */
  current: DeliveryStep | null;
  /** True when the next move belongs to the client, not you. */
  waitingOnClient: boolean;
  /** Days past the promised delivery date (0 when on time). */
  daysLate: number;
  /**
   * Refund exposure per the CGV (10%/day, capped at 50%) — but ZERO while the
   * ball is in the client's court, because the guarantee excludes delays they
   * caused. This is the number that's honest in a dispute.
   */
  atRiskEur: number;
}

export interface BuildLike {
  id: string;
  lead_id?: string | null;
  status: string;
  deadline?: string | null;
  total_price: number;
  deposit_paid: number;
  balance_due: number;
  intake_data?: Record<string, unknown> | null;
}

/** Facts about a build gathered from the other tables, keyed by build id. */
export interface ProgressFacts {
  scopeAcceptedByLead: Set<string>;
  siteByBuild: Map<string, { slug: string; status: string }>;
  clientByBuild: Set<string>;
}

/** One batched round-trip for a whole page of builds — never N+1. */
export async function loadProgressFacts(builds: BuildLike[]): Promise<ProgressFacts> {
  const empty: ProgressFacts = {
    scopeAcceptedByLead: new Set(),
    siteByBuild: new Map(),
    clientByBuild: new Set(),
  };
  const db = supabaseAdmin();
  if (!db || builds.length === 0) return empty;

  const buildIds = builds.map((b) => b.id);
  const leadIds = builds.map((b) => b.lead_id).filter((v): v is string => !!v);

  const [scopes, sites, clients] = await Promise.all([
    leadIds.length
      ? db.from("scope_acceptances").select("lead_id, accepted_at").in("lead_id", leadIds)
      : Promise.resolve({ data: [] }),
    db.from("client_sites").select("build_id, slug, status").in("build_id", buildIds),
    db.from("clients").select("build_id").in("build_id", buildIds),
  ]);

  const facts: ProgressFacts = {
    scopeAcceptedByLead: new Set(
      ((scopes.data ?? []) as { lead_id: string; accepted_at: string | null }[])
        .filter((s) => s.accepted_at).map((s) => s.lead_id),
    ),
    siteByBuild: new Map(
      ((sites.data ?? []) as { build_id: string | null; slug: string; status: string }[])
        .filter((s) => s.build_id).map((s) => [s.build_id as string, { slug: s.slug, status: s.status }]),
    ),
    clientByBuild: new Set(
      ((clients.data ?? []) as { build_id: string | null }[])
        .filter((c) => c.build_id).map((c) => c.build_id as string),
    ),
  };
  return facts;
}

/** The delivery path, derived. Order matters — it IS the sequence. */
export function buildProgress(b: BuildLike, facts: ProgressFacts): BuildProgress {
  const site = facts.siteByBuild.get(b.id);
  const intakeDone = !!b.intake_data && Object.keys(b.intake_data).length > 0;

  const steps: DeliveryStep[] = [
    {
      key: "deposit", label: "Deposit paid", owner: "client",
      done: Number(b.deposit_paid) > 0,
      hint: "Send the checkout link to start the build.",
    },
    {
      key: "scope", label: "Scope signed", owner: "client",
      done: !b.lead_id || facts.scopeAcceptedByLead.has(b.lead_id),
      hint: "Chase the e-signature — work shouldn't start without it.",
    },
    {
      key: "intake", label: "Intake completed", owner: "client",
      done: intakeDone,
      hint: "Chase the intake form — the generator needs their answers.",
    },
    {
      key: "generated", label: "Site generated", owner: "us",
      done: !!site,
      hint: "Open the build and hit Generate.",
    },
    {
      key: "published", label: "Reviewed & published", owner: "us",
      done: site?.status === "published",
      hint: "Review the draft, then Publish.",
    },
    {
      key: "balance", label: "Balance paid", owner: "client",
      done: Number(b.balance_due) === 0,
      hint: "Invoice the remaining balance on delivery.",
    },
    {
      key: "care", label: "Care plan started", owner: "us",
      done: facts.clientByBuild.has(b.id),
      hint: "Sell the Care plan — this is the recurring revenue.",
    },
  ];

  const current = steps.find((s) => !s.done) ?? null;
  const waitingOnClient = current?.owner === "client";
  const daysLate = b.deadline && b.status !== "live" ? Math.max(0, -daysUntil(b.deadline)) : 0;

  // Guarantee is paused while the client is the blocker (CGV: delays caused by
  // the client do not extend the delivery guarantee).
  const atRiskEur = waitingOnClient || daysLate === 0
    ? 0
    : Math.round(Math.min(0.5, 0.1 * daysLate) * Number(b.total_price || 0));

  return {
    steps,
    doneCount: steps.filter((s) => s.done).length,
    total: steps.length,
    current,
    waitingOnClient,
    daysLate,
    atRiskEur,
  };
}

/** Which lane a build belongs in on the board. */
export type BuildLane = "needs-you" | "waiting-client" | "live";

export function buildLane(b: BuildLike, p: BuildProgress): BuildLane {
  if (b.status === "live") return "live";
  return p.waitingOnClient ? "waiting-client" : "needs-you";
}
