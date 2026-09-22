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
  const a = pick(config?.recommendedIPv4) ?? pick(config?.aValues) ?? DEFAULT_A;
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
  | { ok: false; reason: "invalid" | "ours" | "platform" | "taken" | "not-found" | "no-db" | "not-configured" | "in-use-elsewhere" | "vercel" | "write-failed"; detail?: string };

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

  const main = await addToProject(apex);
  if (!main.ok) {
    return { ok: false, reason: main.code === "domain_already_in_use" ? "in-use-elsewhere" : "vercel", detail: [main.code, main.message].filter(Boolean).join(": ") };
  }
  const www = await addToProject(`www.${apex}`, apex);
  if (!www.ok) return { ok: false, reason: "vercel", detail: `www: ${[www.code, www.message].filter(Boolean).join(": ")}` };

  const cfg = await registrar<Record<string, unknown>>(`/v6/domains/${encodeURIComponent(apex)}/config?projectIdOrName=${encodeURIComponent(projectRef())}`);
  const dns = dnsLinesFrom(apex, cfg.ok ? cfg.data : null, [...main.verification, ...www.verification]);

  const next: ClientSiteConfig = { ...row.config, customDomain: apex, domainAttachedAt: now.toISOString() };
  delete next.domainLiveAt; // a new domain is live only when it answers
  const { error } = await db.from("client_sites").update({ config: next }).eq("id", row.id);
  if (error) return { ok: false, reason: "write-failed", detail: error.message };
  return { ok: true, domain: apex, dns, verified: main.verified && www.verified };
}

/** Undo: the site goes back to servolia.com/sites/<slug>. Vercel removal is best effort. */
export async function detachSiteDomain(slug: string): Promise<boolean> {
  const db = supabaseAdmin();
  const row = await siteRow(slug);
  if (!db || !row?.config.customDomain) return false;
  const apex = row.config.customDomain;
  for (const name of [`www.${apex}`, apex]) {
    await registrar(`/v9/projects/${encodeURIComponent(projectRef())}/domains/${encodeURIComponent(name)}`, { method: "DELETE" });
  }
  const next: ClientSiteConfig = { ...row.config };
  delete next.customDomain;
  delete next.domainAttachedAt;
  delete next.domainLiveAt;
  const { error } = await db.from("client_sites").update({ config: next }).eq("id", row.id);
  return !error;
}

/** Does her homepage, fetched over HTTPS at her domain, serve THIS site? Pure over the HTML. */
export function servesSite(html: string, slug: string): boolean {
  const re = new RegExp(`<meta[^>]+name=["']${SITE_MARKER}["'][^>]+content=["']${slug.replace(/[^a-z0-9-]/gi, "")}["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']${slug.replace(/[^a-z0-9-]/gi, "")}["'][^>]+name=["']${SITE_MARKER}["']`, "i");
  return re.test(html) || re2.test(html);
}

export interface LiveEvent { slug: string; domain: string; business: string; email: string | null; lang: "fr" | "en"; buildId: string | null }

/**
 * The quarter-hourly check: every published site with a domain attached but
 * not yet live. Stamps domainLiveAt the first time her domain serves her site
 * and returns it, so the caller emails once. Waiting sites are returned too,
 * with how long they have waited, for the founder's list.
 */
export async function checkPendingDomains(now = new Date()): Promise<{ live: LiveEvent[]; waiting: { slug: string; domain: string; hours: number }[]; errors: string[] }> {
  const live: LiveEvent[] = [];
  const waiting: { slug: string; domain: string; hours: number }[] = [];
  const errors: string[] = [];
  const db = supabaseAdmin();
  if (!db) return { live, waiting, errors: ["no-db"] };
  const { data, error } = await db.from("client_sites").select("id, slug, config, build_id")
    .not("config->>customDomain", "is", null).eq("status", "published");
  if (error) return { live, waiting, errors: [error.message] };

  for (const r of (data ?? []) as (SiteRow & { build_id: string | null })[]) {
    const c = r.config;
    if (!c.customDomain || c.domainLiveAt) continue;
    const page = await fetchPublic(`https://${c.customDomain}/`, 400_000, 8000);
    if (page && servesSite(page.text, r.slug)) {
      const next: ClientSiteConfig = { ...c, domainLiveAt: now.toISOString() };
      const { error: upErr } = await db.from("client_sites").update({ config: next }).eq("id", r.id);
      if (upErr) { errors.push(`${r.slug}: ${upErr.message}`); continue; }
      live.push({ slug: r.slug, domain: c.customDomain, business: c.businessName, email: c.email ?? null, lang: c.language === "fr" ? "fr" : "en", buildId: r.build_id });
    } else {
      const since = c.domainAttachedAt ? Date.parse(c.domainAttachedAt) : now.getTime();
      waiting.push({ slug: r.slug, domain: c.customDomain, hours: Math.round((now.getTime() - since) / 3_600_000) });
    }
  }
  return { live, waiting, errors };
}
