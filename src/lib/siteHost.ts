import { supabaseAdmin } from "@/lib/supabase";

/**
 * C2 — A PRACTICE'S SITE AT HER OWN DOMAIN.
 *
 * The site Servolia generates lives at servolia.com/sites/<slug>. Once her
 * domain is attached to this Vercel project, requests for cabinet-dupont.fr
 * arrive HERE with that Host header, and src/proxy.ts uses this module to
 * serve her site at the root of her domain:
 *
 *   /                 → /sites/<slug>
 *   /cabinet …        → /sites/<slug>/cabinet …   (the site's own pages)
 *   /robots.txt       → her robots, pointing at her sitemap
 *   /sitemap.xml      → her pages, at her domain
 *   /api/site-chat    → /api/chat  (the widget's path on her host; a bare
 *                       /api/chat on her domain would answer as Servolia's
 *                       own sales chat — the leak public/assistant.js avoids)
 *   /api/sites/<slug>/lead, /api/track, /_next/*   pass through
 *   anything else     → 404 — none of servolia.com's own pages exist there
 *
 * Decided with him on 2026-09-22: she KEEPS her domain at her own registrar
 * (Vercel cannot register .fr, .be, .eu or .lu), so this never buys anything;
 * it only answers for a domain the founder attached, and the site says
 * "Servolia" only on its privacy page, as the data processor.
 */

const OUR_HOSTS = new Set(["servolia.com", "www.servolia.com", "localhost", "127.0.0.1"]);

/** "WWW.Cabinet-Dupont.fr:443" → "cabinet-dupont.fr" */
export function apexOf(host: string | null | undefined): string {
  return String(host ?? "").toLowerCase().split(":")[0].replace(/^www\./, "").replace(/\.$/, "");
}

/** A host that is Servolia itself, a preview deployment, or a local server. */
export function isOurHost(host: string | null | undefined): boolean {
  const h = String(host ?? "").toLowerCase().split(":")[0];
  if (!h) return true;
  return OUR_HOSTS.has(h) || h.endsWith(".servolia.com") || h.endsWith(".vercel.app");
}

/** The pages a MULTI-page generated site has besides its home (sites/[slug]/[page]). */
export const SITE_PAGES = ["cabinet", "expertise", "services", "conseils"] as const;

export type HostRoute =
  | { kind: "rewrite"; to: string }
  | { kind: "redirect"; to: string }
  | { kind: "pass" }
  | { kind: "not-found" };

/**
 * Where a path on her domain goes. Pure, so the whole table is testable
 * without a request: every route not listed here is a 404, never a page of
 * servolia.com wearing her domain.
 *
 * Sub-pages exist only when her site is multi-page: rewriting /cabinet on a
 * single-page site would reach notFound() and render the ROOT 404, which is
 * Servolia's branded page (review, 2026-09-22). Here it is a plain 404.
 */
export function hostRoute(pathname: string, slug: string, opts: { multiPage?: boolean } = {}): HostRoute {
  // Collapse runs of slashes first: "/sites/x//evil.com" must never become a
  // protocol-relative redirect target.
  const p = pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  if (p === "/") return { kind: "rewrite", to: `/sites/${slug}` };
  if (p === "/confidentialite") return { kind: "rewrite", to: `/sites/${slug}/confidentialite` };
  const first = p.split("/")[1] ?? "";
  if (opts.multiPage && (SITE_PAGES as readonly string[]).includes(first) && p.split("/").length === 2) {
    return { kind: "rewrite", to: `/sites/${slug}/${first}` };
  }
  if (p === "/robots.txt") return { kind: "rewrite", to: `/api/sites/${slug}/robots` };
  if (p === "/sitemap.xml") return { kind: "rewrite", to: `/api/sites/${slug}/sitemap` };
  /* The chat, pinned to HER site: the slug rides in the rewritten query and
     /api/chat takes it over whatever the body says, so her domain can never
     answer as Servolia's own sales chat or as another client's receptionist. */
  if (p === "/api/site-chat") return { kind: "rewrite", to: `/api/chat?site=${slug}` };
  if (p === "/api/site-chat-fallback") return { kind: "rewrite", to: `/api/chat-fallback?site=${slug}` };
  if (p === `/api/sites/${slug}/lead` || p === "/api/track") return { kind: "pass" };
  if (p.startsWith("/_next/")) return { kind: "pass" };
  // An old servolia.com/sites/<slug> link opened on her domain: send it home.
  if (p === `/sites/${slug}` || p.startsWith(`/sites/${slug}/`)) {
    const rest = p.slice(`/sites/${slug}`.length) || "/";
    return { kind: "redirect", to: rest.startsWith("/") ? rest : `/${rest}` };
  }
  return { kind: "not-found" };
}

/* ── which site answers for a host ─────────────────────────────────────── */

export interface HostSite { slug: string; published: boolean; multiPage: boolean; lang: "fr" | "en" }

/* A small cache per instance. Sixty seconds: a domain the founder just
   attached answers within a minute, and a busy site costs one query a minute,
   not one per page view. Misses are cached too, so a scan of random hosts
   pointed at us cannot turn into a query per request. */
const TTL_MS = 60_000;
const cache = new Map<string, { site: HostSite | null; at: number }>();

/**
 * The site a foreign host belongs to — in ANY state, not only published: a
 * domain attached to a practice must never fall through to servolia.com's own
 * pages because her site is a draft, unpublished, or being regenerated
 * (review, 2026-09-22). "error" when the database could not answer: the proxy
 * then says "try again", it does not guess.
 */
export async function siteForHost(host: string | null | undefined): Promise<HostSite | null | "error"> {
  const apex = apexOf(host);
  // Local testing only: DEV_SITE_HOSTS="cabinet-test.fr=demo-metay" maps a
  // Host header to a site without a database. Never read in production.
  if (process.env.NODE_ENV !== "production" && process.env.DEV_SITE_HOSTS) {
    for (const pair of process.env.DEV_SITE_HOSTS.split(",")) {
      const [h, s, flag] = pair.split("=").map((x) => x.trim());
      if (h && s && apexOf(h) === apex) return { slug: s, published: flag !== "draft", multiPage: true, lang: "fr" };
    }
  }
  if (!apex || isOurHost(apex)) return null;
  const hit = cache.get(apex);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.site;
  const db = supabaseAdmin();
  if (!db) return "error";
  const { data, error } = await db.from("client_sites").select("slug, status, config")
    .eq("config->>customDomain", apex).limit(1);
  if (error) {
    console.error("[siteHost] lookup failed:", error.message);
    return "error"; // not cached: the next request tries again
  }
  const row = (data ?? [])[0] as { slug: string; status: string; config?: { multiPage?: boolean; language?: string } } | undefined;
  const site: HostSite | null = row
    ? { slug: row.slug, published: row.status === "published", multiPage: Boolean(row.config?.multiPage), lang: row.config?.language === "en" ? "en" : "fr" }
    : null;
  if (cache.size > 2000) cache.clear();
  cache.set(apex, { site, at: Date.now() });
  return site;
}

/** What her domain shows while her site is not published: her own words, no one else's. */
export function notReadyPage(lang: "fr" | "en"): string {
  const t = lang === "en"
    ? { title: "Coming soon", body: "This site is being prepared and will be online shortly." }
    : { title: "Bientôt en ligne", body: "Ce site est en cours de préparation et sera en ligne très prochainement." };
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${t.title}</title></head>` +
    `<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#fafaf7;color:#18181b">` +
    `<div style="text-align:center;padding:24px"><h1 style="font-size:22px;margin:0 0 8px">${t.title}</h1><p style="margin:0;color:#52525b">${t.body}</p></div></body></html>`;
}

/** Her public address once it answers; until then, the servolia.com preview. */
export function siteUrlFor(config: { slug: string; customDomain?: string; domainLiveAt?: string }): string {
  return config.customDomain && config.domainLiveAt
    ? `https://${config.customDomain}`
    : `https://servolia.com/sites/${config.slug}`;
}

/** The marker the go-live check looks for in her homepage's HTML. Names the
 *  site, never the supplier. */
export const SITE_MARKER = "site-id";

/**
 * The page's metadata at her own domain: her name as the whole title (not
 * "… | Servolia"), her domain as canonical, indexable, and every root-layout
 * field that names Servolia replaced — Next merges metadata one level deep,
 * so a key set here replaces the layout's key entirely.
 */
export function customHostMetadata(
  c: { slug: string; businessName: string; city?: string; heroSub?: string; about?: string; language?: string },
  host: string,
  path: string,
  pageLabel?: string,
): Record<string, unknown> {
  const title = `${pageLabel ? `${pageLabel} · ` : ""}${c.businessName}${c.city ? ` · ${c.city}` : ""}`;
  const description = c.heroSub || c.about || c.businessName;
  const url = `https://${host}${path === "/" ? "" : path}`;
  return {
    metadataBase: new URL(`https://${host}`),
    title: { absolute: title },
    description,
    keywords: [],
    authors: [{ name: c.businessName }],
    robots: { index: true, follow: true },
    alternates: { canonical: url },
    openGraph: { title, description, type: "website", url, siteName: c.businessName, locale: c.language === "fr" ? "fr_FR" : "en_US" },
    twitter: { card: "summary", title, description },
    other: { [SITE_MARKER]: c.slug },
  };
}

/** Read by the site pages: the host the proxy says this request is for. */
export function customHostFrom(h: { get(name: string): string | null }): string | null {
  const v = h.get("x-site-host");
  return v && !isOurHost(v) ? v : null;
}
