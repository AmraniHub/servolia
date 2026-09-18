import { siteSourceFor } from "@/lib/clientFiles";

/**
 * "IS MY SITE UP, AND WHEN DID IT LAST CHANGE?"
 *
 * The two questions a hosting client actually has, answered by measuring
 * rather than by asserting. A panel that says "Active" because a database row
 * says active is telling them what we believe; this fetches their site and
 * reads their repository, so it is telling them what is true.
 *
 * WHY THERE IS NO TRAFFIC CHART HERE. There is one GA4 property configured and
 * it is Servolia's own website — there is no per-client analytics to read. A
 * chart of numbers we do not have would be the single most damaging thing on
 * this page, because it is the one card a client would repeat to someone else.
 * Traffic goes in when a real source of it does.
 */

export interface SiteHealth {
  /** Null when we could not reach it at all — different from "down". */
  up: boolean | null;
  status: number | null;
  /** ISO date of the most recent change to their site. */
  lastChange: string | null;
  /** How many changes in the last 30 days. */
  recentChanges: number;
}

async function headOk(url: string): Promise<{ up: boolean | null; status: number | null }> {
  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "Servolia-uptime/1.0" },
      next: { revalidate: 120 },
    });
    /* 2xx and 3xx are up. A 503 is the hosting gate doing its job and is
       reported honestly as down, because to a visitor it is. */
    return { up: r.status < 400, status: r.status };
  } catch {
    return { up: null, status: null };
  }
}

/**
 * Changes read from the client's own repository.
 *
 * Dates only — never the commit messages. Those are ours ("Editable regions on
 * the sourcing and contact pages") and reading them would put our working
 * notes on a client's dashboard, which is the same mistake as the README in
 * their download.
 */
async function changes(ref: string): Promise<{ lastChange: string | null; recentChanges: number }> {
  const src = siteSourceFor(ref);
  const token = process.env.GH_TOKEN;
  if (!src || !token) return { lastChange: null, recentChanges: 0 };
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  try {
    const r = await fetch(
      `https://api.github.com/repos/${src.repo}/commits?sha=${encodeURIComponent(src.branch)}&since=${since}&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "servolia-client-area",
        },
        next: { revalidate: 300 },
      },
    );
    if (!r.ok) return { lastChange: null, recentChanges: 0 };
    const list = (await r.json()) as { commit?: { committer?: { date?: string } } }[];
    if (!Array.isArray(list) || !list.length) return { lastChange: null, recentChanges: 0 };
    return {
      lastChange: list[0]?.commit?.committer?.date ?? null,
      recentChanges: list.length,
    };
  } catch {
    return { lastChange: null, recentChanges: 0 };
  }
}

/** Never throws: this decorates a page that must render without it. */
export async function siteHealth(ref: string, siteUrl: string | null): Promise<SiteHealth> {
  const [reach, hist] = await Promise.all([
    siteUrl ? headOk(siteUrl) : Promise.resolve({ up: null, status: null }),
    changes(ref),
  ]);
  return { ...reach, ...hist };
}
