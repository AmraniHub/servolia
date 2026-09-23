import { supabaseAdmin } from "@/lib/supabase";
import { registrar } from "@/lib/domainSales";
import { normalizeDomainInput, fetchPublic } from "@/lib/brandProbe";
import { isSharedPlatform } from "@/lib/receptionistTrial";
import { isOurHost, SITE_MARKER } from "@/lib/siteHost";
import type { ClientSiteConfig } from "@/lib/clientSites";

/**
 * C2 — ATTACHING A PRACTICE'S OWN DOMAIN, AND KNOWING WHEN IT ANSWERS.
 *
 * She keeps her domain at her own registrar (OVH, IONOS, Gandi…: Vercel
 * cannot register .fr, decided 2026-09-22). So the job is three steps, and
 * only the first is ours:
 *   1. attach it to this Vercel project (apex serves, www redirects to it)
 *      and hand her the exact DNS lines Vercel asks for;
 *   2. she (or her webmaster) adds them;
 *   3. a cron fetches https://<her domain>/ every quarter hour and, the first
 *      time it serves THIS site (the site-id marker), stamps domainLiveAt and
 *      sends the go-live email — never before, so the email is never a lie.
 */

/** The Vercel project this app runs as. VERCEL_PROJECT_ID is set by Vercel
 *  itself when system variables are exposed; the name works in the API too. */
export function projectRef(): string {
  return process.env.VERCEL_PROJECT_ID || "servolia";
}

export interface DnsLine { type: "A" | "CNAME" | "TXT"; name: string; value: string }

/** Vercel's documented defaults — used when its config answer is unreadable. */
const DEFAULT_A = "76.76.21.21";
const DEFAULT_CNAME = "cname.vercel-dns.com";

/**
 * The lines to give her, from Vercel's own recommendation for this domain
 * (GET /v6/domains/{d}/config), plus any ownership TXT Vercel requires when
 * the domain was once used by another Vercel account. Pure over the answers.
 */
export function dnsLinesFrom(
  apex: string,
  config: Record<string, unknown> | null,
  verification: { type?: string; domain?: string; value?: string }[] = [],
): DnsLine[] {
  const pick = (v: unknown): string | null => {
    // Shapes seen: [{ rank, value: ["76.76.21.21"] }] or [{ rank, value: "cname…" }] or ["76.76.21.21"].
    if (!Array.isArray(v) || !v.length) return null;
    const first = v[0] as unknown;
    if (typeof first === "string") return first;
    const val = (first as { value?: unknown }).value;
    if (Array.isArray(val) && typeof val[0] === "string") return val[0];
    return typeof val === "string" ? val : null;
  };
  const a = pick(config?.recommendedIPv4) ?? DEFAULT_A;
  const cname = (pick(config?.recommendedCNAME) ?? DEFAULT_CNAME).replace(/\.$/, "");
  const lines: DnsLine[] = [
    { type: "A", name: "@", value: a },
    { type: "CNAME", name: "www", value: cname },
  ];
  for (const v of verification) {
    if (v.type === "TXT" && v.domain && v.value) {
      lines.push({ type: "TXT", name: v.domain.replace(new RegExp(`\\.?${apex.replace(/\./g, "\\.")}$`), "") || "@", value: v.value });
    }
  }
  return lines;
}

export type AttachResult =
  | { ok: true; domain: string; dns: DnsLine[]; verified: boolean }
  | { ok: false; reason: "invalid" | "subdomain" | "ours" | "platform" | "taken" | "not-found" | "no-db" | "not-configured" | "in-use-elsewhere" | "vercel" | "write-failed"; detail?: string };

/* Second-level suffixes where the registrable name has three labels. */
const TWO_LEVEL = ["co.uk", "org.uk", "me.uk", "com.au", "net.au", "co.nz", "co.za", "com.br", "co.jp", "com.mx", "co.ma", "net.ma", "org.ma", "com.tr", "com.tn", "com.dz"];

/**
 * A registrable domain (cabinet-dupont.fr), not a subdomain of one
 * (rdv.cabinet-dupont.fr). The DNS lines and the www redirect are written for
 * an apex: sent for a subdomain they would tell her to repoint her main site.
 */
export function isApexDomain(domain: string): boolean {
  const labels = domain.toLowerCase().split(".");
  if (labels.length <= 2) return true;
  const suffix = labels.slice(-2).join(".");
  return labels.length === 3 && TWO_LEVEL.includes(suffix);
}

interface SiteRow { id: string; slug: string; config: ClientSiteConfig }

async function siteRow(slug: string): Promise<SiteRow | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db.from("client_sites").select("id, slug, config").eq("slug", slug).maybeSingle();
  return (data as SiteRow | null) ?? null;
}

/** Add one hostname to the project; "already in use" is fine only if it is in use by US. */
async function addToProject(name: string, redirectTo?: string): Promise<{ ok: true; verified: boolean; verification: { type?: string; domain?: string; value?: string }[] } | { ok: false; code?: string; message?: string }> {
  const path = `/v10/projects/${encodeURIComponent(projectRef())}/domains`;
  const res = await registrar<{ verified?: boolean; verification?: { type?: string; domain?: string; value?: string }[] }>(path, {
    method: "POST",
    body: JSON.stringify(redirectTo ? { name, redirect: redirectTo, redirectStatusCode: 308 } : { name }),
  });
  if (res.ok) return { ok: true, verified: res.data?.verified !== false, verification: res.data?.verification ?? [] };
  if (res.code === "domain_already_in_use" || res.code === "domain_already_exists") {
    const mine = await registrar<{ verified?: boolean; verification?: { type?: string; domain?: string; value?: string }[] }>(
      `/v9/projects/${encodeURIComponent(projectRef())}/domains/${encodeURIComponent(name)}`,
    );
    if (mine.ok) return { ok: true, verified: mine.data?.verified !== false, verification: mine.data?.verification ?? [] };
  }
  return { ok: false, code: res.code, message: res.message };
}

/**
 * Attach her domain to her site. Refuses anything that is not a plain public
 * domain of her own: our own hosts, shared platforms (a Doctolib profile), or
 * a domain another site here already holds.
 */
export async function attachSiteDomain(slug: string, input: string, now = new Date()): Promise<AttachResult> {
  const apex = normalizeDomainInput(input);
  if (!apex) return { ok: false, reason: "invalid" };
  if (!isApexDomain(apex)) return { ok: false, reason: "subdomain" };
  if (isOurHost(apex)) return { ok: false, reason: "ours" };
  if (isSharedPlatform(apex)) return { ok: false, reason: "platform" };
  const db = supabaseAdmin();
  if (!db) return { ok: false, reason: "no-db" };
  if (!process.env.VERCEL_TOKEN || !process.env.VERCEL_TEAM_ID) return { ok: false, reason: "not-configured" };

  const row = await siteRow(slug);
  if (!row || row.config.assistantOnly || row.config.isDemo) return { ok: false, reason: "not-found" };
  const { data: others, error: othersErr } = await db.from("client_sites").select("slug")
    .eq("config->>customDomain", apex).neq("slug", row.slug).limit(1);
  if (othersErr) return { ok: false, reason: "no-db" };
  if ((others ?? []).length) return { ok: false, reason: "taken" };

  /* All or nothing. A domain Vercel holds with no row behind it would pass
     through to servolia.com's own pages at her address (review, 2026-09-22),
     so a half-finished attach is rolled back rather than left standing. */
  const rollback = async (names: string[]) => {
    for (const n of names) await removeFromProject(n);
  };
  const main = await addToProject(apex);
  if (!main.ok) {
    return { ok: false, reason: main.code === "domain_already_in_use" ? "in-use-elsewhere" : "vercel", detail: [main.code, main.message].filter(Boolean).join(": ") };
  }
  const www = await addToProject(`www.${apex}`, apex);
  if (!www.ok) {
    await rollback([apex]);
    return { ok: false, reason: "vercel", detail: `www: ${[www.code, www.message].filter(Boolean).join(": ")}` };
  }

  const cfg = await registrar<Record<string, unknown>>(`/v6/domains/${encodeURIComponent(apex)}/config?projectIdOrName=${encodeURIComponent(projectRef())}`);
  const dns = dnsLinesFrom(apex, cfg.ok ? cfg.data : null, [...main.verification, ...www.verification]);

  const next: ClientSiteConfig = { ...row.config, customDomain: apex, domainAttachedAt: now.toISOString(), domainDns: dns };
  delete next.domainLiveAt; // a new domain is live only when it answers
  const { error } = await db.from("client_sites").update({ config: next }).eq("id", row.id);
  if (error) {
    await rollback([`www.${apex}`, apex]);
    return { ok: false, reason: "write-failed", detail: error.message };
  }
  return { ok: true, domain: apex, dns, verified: main.verified && www.verified };
}

/** Remove one hostname from the project. Already gone counts as removed. */
async function removeFromProject(name: string): Promise<boolean> {
  const res = await registrar(`/v9/projects/${encodeURIComponent(projectRef())}/domains/${encodeURIComponent(name)}`, { method: "DELETE" });
  return res.ok || res.status === 404;
}

/**
 * Undo: the site goes back to servolia.com/sites/<slug>. The row is cleared
 * only once Vercel has let go of BOTH names: a domain still attached with no
 * row behind it would show servolia.com's own pages at her address.
 */
export async function detachSiteDomain(slug: string): Promise<boolean> {
  const db = supabaseAdmin();
  const row = await siteRow(slug);
  if (!db || !row?.config.customDomain) return false;
  const apex = row.config.customDomain;
  const wwwGone = await removeFromProject(`www.${apex}`);
  const apexGone = wwwGone && await removeFromProject(apex);
  if (!apexGone) return false;
  const next: ClientSiteConfig = { ...row.config };
  delete next.customDomain;
  delete next.domainAttachedAt;
  delete next.domainLiveAt;
  delete next.domainDns;
  // liveNotifiedFor stays: re-attaching the same domain must not re-announce it.
  const { error } = await db.from("client_sites").update({ config: next }).eq("id", row.id);
  return !error;
}

/** Does her homepage, fetched over HTTPS at her domain, serve THIS site? Pure over the HTML. */
export function servesSite(html: string, slug: string): boolean {
  const re = new RegExp(`<meta[^>]+name=["']${SITE_MARKER}["'][^>]+content=["']${slug.replace(/[^a-z0-9-]/gi, "")}["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']${slug.replace(/[^a-z0-9-]/gi, "")}["'][^>]+name=["']${SITE_MARKER}["']`, "i");
  return re.test(html) || re2.test(html);
}

export interface LiveEvent {
  slug: string; domain: string; business: string; contactEmail: string | null;
  lang: "fr" | "en"; buildId: string | null;
  /** False when this very domain was announced before (a detach and re-attach). */
  announce: boolean;
}

/**
 * The quarter-hourly check: every published site with a domain attached but
 * not yet live. The first time her domain serves her site, domainLiveAt is
 * stamped with a CONDITIONAL update — only while it is still empty — so two
 * runs overlapping (Vercel may deliver a cron twice) cannot both announce it.
 * Unverified domains are nudged to re-check their TXT. Fetches run a few at a
 * time inside a time budget, so one slow host cannot starve the rest; what is
 * not reached is checked on the next run.
 */
export async function checkPendingDomains(now = new Date(), budgetMs = 40_000): Promise<{ live: LiveEvent[]; waiting: { slug: string; domain: string; hours: number }[]; errors: string[] }> {
  const live: LiveEvent[] = [];
  const waiting: { slug: string; domain: string; hours: number }[] = [];
  const errors: string[] = [];
  const db = supabaseAdmin();
  if (!db) return { live, waiting, errors: ["no-db"] };
  const { data, error } = await db.from("client_sites").select("id, slug, config, build_id")
    .not("config->>customDomain", "is", null).eq("status", "published");
  if (error) return { live, waiting, errors: [error.message] };

  const pending = ((data ?? []) as (SiteRow & { build_id: string | null })[]).filter((r) => r.config.customDomain && !r.config.domainLiveAt);
  const until = Date.now() + budgetMs;

  const one = async (r: SiteRow & { build_id: string | null }) => {
    const c = r.config;
    const domain = c.customDomain!;
    // A domain waiting on its ownership TXT is only re-checked when asked to.
    await registrar(`/v9/projects/${encodeURIComponent(projectRef())}/domains/${encodeURIComponent(domain)}/verify`, { method: "POST" }).catch(() => null);
    const page = await fetchPublic(`https://${domain}/`, 400_000, 8000);
    if (page && servesSite(page.text, r.slug)) {
      const stamp = now.toISOString();
      const next: ClientSiteConfig = { ...c, domainLiveAt: stamp, liveNotifiedFor: domain };
      const { data: won, error: upErr } = await db.from("client_sites").update({ config: next })
        .eq("id", r.id).is("config->>domainLiveAt", null).select("id");
      if (upErr) { errors.push(`${r.slug}: ${upErr.message}`); return; }
      if (!won?.length) return; // another run stamped it first — it announces, not us
      live.push({
        slug: r.slug, domain, business: c.businessName, contactEmail: c.email ?? null,
        lang: c.language === "fr" ? "fr" : "en", buildId: r.build_id,
        announce: c.liveNotifiedFor !== domain,
      });
    } else {
      const since = c.domainAttachedAt ? Date.parse(c.domainAttachedAt) : now.getTime();
      waiting.push({ slug: r.slug, domain, hours: Math.round((now.getTime() - since) / 3_600_000) });
    }
  };

  for (let i = 0; i < pending.length; i += 5) {
    if (Date.now() > until) break;
    await Promise.all(pending.slice(i, i + 5).map((r) => one(r).catch((e) => { errors.push(`${r.slug}: ${e instanceof Error ? e.message : e}`); })));
  }
  return { live, waiting, errors };
}
