import { supabaseAdmin } from "@/lib/supabase";

/**
 * ZERO-MISS GUARANTEE — the measurement behind the promise.
 *
 * The CGV (section 4 bis, EN + FR) commit Servolia to answering every enquiry
 * to a client's AI receptionist within 60 seconds, or refunding that month's
 * plan fee. Two obligations follow from that wording, and this file exists to
 * honour both:
 *
 *   1. "measured from Servolia's own server-side timestamps" — so the clock is
 *      the time the /api/chat route spends producing the reply. Network time
 *      to and from the visitor is not observable server-side and is therefore
 *      NOT claimed. This is the honest measure, and it is the one the contract
 *      describes.
 *   2. "which the client can consult at any time in their client portal" — a
 *      guarantee nobody can audit is marketing. The portal panel reads the
 *      same function the founder's monitor does, so the client and Servolia
 *      are always looking at identical numbers.
 *
 * A guarantee that only pays out when the customer notices is worse than no
 * guarantee: the one time it silently fails is the time trust dies. So the
 * cron (/api/cron/zero-miss) reports misses to the founder BEFORE the client
 * finds them.
 *
 * DEGRADATION: reply latency is recorded per assistant message as `ms` inside
 * chat_sessions.messages, plus a denormalised `max_reply_ms` column for cheap
 * scanning. Sessions recorded before that shipped, and rows written while the
 * column is missing, have no latency and are reported as UNMEASURED — never
 * silently counted as compliant. See roadmap.ts for the one-line SQL.
 */

/** The contractual threshold, in milliseconds. */
export const ZERO_MISS_THRESHOLD_MS = 60_000;

/** One assistant reply that breached the threshold. */
export interface Miss {
  sessionId: string;
  siteSlug: string | null;
  at: string;
  ms: number;
}

export interface ComplianceReport {
  /** ISO month, e.g. "2026-07". */
  month: string;
  siteSlug: string | null;
  /** Assistant replies with a recorded latency. */
  measured: number;
  /** Replies that exceeded the threshold. */
  misses: Miss[];
  /** Slowest measured reply in ms, or null when nothing was measurable. */
  slowestMs: number | null;
  /** Replies with no recorded latency (pre-instrumentation sessions). */
  unmeasured: number;
  /** True only when at least one reply was measured and none breached. */
  compliant: boolean;
}

interface StoredMessage {
  role: string;
  content: string;
  /** Server timestamp when this message was recorded (ISO). */
  ts?: string;
  /** For assistant messages: milliseconds spent producing the reply. */
  ms?: number;
}

interface SessionRow {
  session_id: string;
  site_slug: string | null;
  created_at: string;
  updated_at?: string | null;
  messages: StoredMessage[] | null;
}

/** Month key ("2026-07") from a Date, in UTC — billing months, not local days. */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** First instant of a month key, and the first instant of the next month. */
export function monthBounds(key: string): { from: string; to: string } {
  const [y, m] = key.split("-").map(Number);
  return {
    from: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
    to: new Date(Date.UTC(y, m, 1)).toISOString(),
  };
}

/**
 * Compliance for one site over one month.
 *
 * `siteSlug` null means "Servolia's own site" (Solia), which is not under
 * contract with anyone — useful to watch, never refundable.
 */
export async function complianceFor(
  siteSlug: string | null,
  month: string = monthKey(new Date()),
): Promise<ComplianceReport> {
  const empty: ComplianceReport = {
    month, siteSlug, measured: 0, misses: [], slowestMs: null, unmeasured: 0, compliant: false,
  };

  const db = supabaseAdmin();
  if (!db) return empty;

  const { from, to } = monthBounds(month);
  try {
    let q = db
      .from("chat_sessions")
      .select("session_id, site_slug, created_at, updated_at, messages")
      .gte("created_at", from)
      .lt("created_at", to);
    q = siteSlug === null ? q.is("site_slug", null) : q.eq("site_slug", siteSlug);

    const { data, error } = await q;
    if (error || !data) return empty;

    const misses: Miss[] = [];
    let measured = 0;
    let unmeasured = 0;
    let slowest: number | null = null;

    for (const row of data as SessionRow[]) {
      for (const m of row.messages ?? []) {
        if (m.role !== "assistant") continue;
        if (typeof m.ms !== "number" || !Number.isFinite(m.ms)) {
          unmeasured++;
          continue;
        }
        measured++;
        if (slowest == null || m.ms > slowest) slowest = m.ms;
        if (m.ms > ZERO_MISS_THRESHOLD_MS) {
          misses.push({
            sessionId: row.session_id,
            siteSlug: row.site_slug,
            at: m.ts ?? row.updated_at ?? row.created_at,
            ms: m.ms,
          });
        }
      }
    }

    return {
      month, siteSlug, measured, misses, unmeasured,
      slowestMs: slowest,
      compliant: measured > 0 && misses.length === 0,
    };
  } catch {
    return empty;
  }
}

/**
 * Every client site with activity this month, scanned in one pass.
 * Used by the cron; returns only sites that actually had replies.
 */
export async function scanAllSites(month: string = monthKey(new Date())): Promise<ComplianceReport[]> {
  const db = supabaseAdmin();
  if (!db) return [];

  const { from, to } = monthBounds(month);
  try {
    const { data, error } = await db
      .from("chat_sessions")
      .select("session_id, site_slug, created_at, updated_at, messages")
      .gte("created_at", from)
      .lt("created_at", to)
      .not("site_slug", "is", null);
    if (error || !data) return [];

    const bySlug = new Map<string, SessionRow[]>();
    for (const row of data as SessionRow[]) {
      if (!row.site_slug) continue;
      const list = bySlug.get(row.site_slug) ?? [];
      list.push(row);
      bySlug.set(row.site_slug, list);
    }

    const reports: ComplianceReport[] = [];
    for (const [slug, rows] of bySlug) {
      const misses: Miss[] = [];
      let measured = 0, unmeasured = 0;
      let slowest: number | null = null;
      for (const row of rows) {
        for (const m of row.messages ?? []) {
          if (m.role !== "assistant") continue;
          if (typeof m.ms !== "number" || !Number.isFinite(m.ms)) { unmeasured++; continue; }
          measured++;
          if (slowest == null || m.ms > slowest) slowest = m.ms;
          if (m.ms > ZERO_MISS_THRESHOLD_MS) {
            misses.push({ sessionId: row.session_id, siteSlug: slug, at: m.ts ?? row.created_at, ms: m.ms });
          }
        }
      }
      reports.push({
        month, siteSlug: slug, measured, misses, unmeasured,
        slowestMs: slowest,
        compliant: measured > 0 && misses.length === 0,
      });
    }
    return reports;
  } catch {
    return [];
  }
}
