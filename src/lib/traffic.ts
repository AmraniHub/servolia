/**
 * Traffic aggregation — shared by /admin/traffic (servolia.com) and the portal
 * Traffic tab (one client site). Both read the same page_views rows; the only
 * difference is the site_slug filter, so the numbers can never disagree.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface PageViewRow {
  created_at: string;
  path: string;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  country: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  visitor_hash: string | null;
  session_id: string | null;
  is_entry: boolean | null;
}

export interface TrafficSummary {
  views: number;
  visitors: number;
  visits: number;
  /** % of visits that looked at exactly one page — high means the page isn't holding them. */
  bounceRate: number;
  viewsPerVisit: number;
  fromAds: number;
  days: { label: string; iso: string; views: number; visitors: number }[];
  topPages: [string, number][];
  referrers: [string, number][];
  countries: [string, number][];
  devices: [string, number][];
  browsers: [string, number][];
  campaigns: [string, number][];
  /** Change vs the equivalent preceding window, in % (null when there's no baseline). */
  trend: { views: number | null; visitors: number | null };
}

const count = <T extends string>(rows: (T | null)[], limit?: number): [string, number][] => {
  const m: Record<string, number> = {};
  rows.forEach((r) => {
    const k = r ?? "unknown";
    m[k] = (m[k] ?? 0) + 1;
  });
  const sorted = Object.entries(m).sort((a, b) => b[1] - a[1]);
  return limit ? sorted.slice(0, limit) : sorted;
};

const uniq = (rows: (string | null)[]) => new Set(rows.filter(Boolean) as string[]).size;

const pct = (now: number, before: number): number | null =>
  before === 0 ? null : Math.round(((now - before) / before) * 100);

const AD_RE = /facebook|instagram|fb|ig|meta|google|adwords|tiktok|linkedin|cpc|paid/i;

/**
 * Rolls raw rows into everything both dashboards render.
 * `previous` is the same-length window immediately before `rows`, used only for
 * the trend arrows — pass an empty array to hide them.
 */
export function summarize(rows: PageViewRow[], days: number, previous: PageViewRow[] = []): TrafficSummary {
  const views = rows.length;
  const visitors = uniq(rows.map((r) => r.visitor_hash));
  const visits = rows.filter((r) => r.is_entry).length || uniq(rows.map((r) => r.session_id));

  // A bounce is a session with exactly one pageview.
  const perSession: Record<string, number> = {};
  rows.forEach((r) => {
    if (!r.session_id) return;
    perSession[r.session_id] = (perSession[r.session_id] ?? 0) + 1;
  });
  const sessions = Object.values(perSession);
  const bounceRate = sessions.length
    ? Math.round((sessions.filter((n) => n === 1).length / sessions.length) * 100)
    : 0;

  // Day-by-day series, oldest first, with no gaps (a quiet day must show as zero).
  const buckets: { label: string; iso: string; views: number; visitors: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const dayRows = rows.filter((r) => r.created_at.slice(0, 10) === iso);
    buckets.push({
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      iso,
      views: dayRows.length,
      visitors: uniq(dayRows.map((r) => r.visitor_hash)),
    });
  }

  const fromAds = rows.filter(
    (r) => AD_RE.test(`${r.utm_source ?? ""} ${r.utm_medium ?? ""}`) || AD_RE.test(r.referrer_host ?? "")
  ).length;

  return {
    views,
    visitors,
    visits,
    bounceRate,
    viewsPerVisit: visits ? Math.round((views / visits) * 10) / 10 : 0,
    fromAds,
    days: buckets,
    topPages: count(rows.map((r) => r.path), 10),
    // "unknown" referrer = typed the URL or came from an app — that's direct traffic.
    referrers: count(rows.map((r) => r.referrer_host), 8).map(([k, v]) => [k === "unknown" ? "Direct" : k, v] as [string, number]),
    countries: count(rows.map((r) => r.country), 8),
    devices: count(rows.map((r) => r.device)),
    browsers: count(rows.map((r) => r.browser), 5),
    campaigns: count(rows.filter((r) => r.utm_campaign).map((r) => r.utm_campaign), 6),
    trend: {
      views: pct(views, previous.length),
      visitors: pct(visitors, uniq(previous.map((r) => r.visitor_hash))),
    },
  };
}

const COLS =
  "created_at, path, referrer_host, utm_source, utm_medium, utm_campaign, country, city, device, browser, visitor_hash, session_id, is_entry";

/**
 * Fetches the current window plus the preceding one (for trends) in a single
 * query, then splits them. `slugs` scopes to client sites; pass null for
 * servolia.com's own traffic.
 */
export async function fetchTraffic(
  db: SupabaseClient,
  { days, slugs }: { days: number; slugs?: string[] | null }
): Promise<{ current: PageViewRow[]; previous: PageViewRow[] }> {
  const cutoff = new Date(Date.now() - days * 86400000);
  const prevCutoff = new Date(Date.now() - days * 2 * 86400000);

  let q = db.from("page_views").select(COLS).gte("created_at", prevCutoff.toISOString());

  if (slugs) {
    // A client with no published site yet has no slugs — return nothing rather
    // than every row in the table.
    if (!slugs.length) return { current: [], previous: [] };
    q = q.in("site_slug", slugs);
  } else {
    q = q.is("site_slug", null); // servolia.com itself, excluding client sites
  }

  const { data } = await q.order("created_at", { ascending: false }).limit(50000);
  const all = (data as unknown as PageViewRow[] | null) ?? [];
  const cut = cutoff.toISOString();

  return {
    current: all.filter((r) => r.created_at >= cut),
    previous: all.filter((r) => r.created_at < cut),
  };
}
