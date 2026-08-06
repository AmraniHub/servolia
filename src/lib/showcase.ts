import { supabaseAdmin } from "@/lib/supabase";
import { SITE_TEMPLATES } from "@/lib/templates";
import type { ClientSiteConfig } from "@/lib/clientSites";

/**
 * "WHAT WE'VE BUILT" — the proof page's data.
 *
 * One list, two kinds of entry, never blurred:
 *
 *   REAL   — every PUBLISHED client site, read straight from client_sites.
 *            No manual case-study entry to remember: deliver a client, publish
 *            their site, and it appears here. The proof grows by working.
 *   DEMO   — the fictional showcases from the template registry, which carry
 *            the page until the first real client exists.
 *
 * The distinction is structural (a `kind` field), not a styling choice, so a
 * demo can never accidentally be presented as a client. That matters more than
 * it sounds: this is the page a sceptical clinic owner opens to decide whether
 * Servolia is real, and one overstated card there would be the most expensive
 * lie on the site.
 *
 * Reals sort first. When there are none, the page says so in plain language
 * rather than padding the grid — see the copy on /case-studies.
 */

export interface BuiltSite {
  kind: "client" | "demo";
  slug: string;
  /** Internal path — every site Servolia builds is served from /sites/{slug}. */
  href: string;
  business: string;
  /** What shows in the fake browser bar. */
  displayUrl: string;
  niche: string | null;
  city: string | null;
  language: "en" | "fr";
  /** Short line under the title. */
  summary: string | null;
  /** "What we built" — the spec row. */
  built: string;
}

const NICHE_LABEL: Record<string, { en: string; fr: string }> = {
  dental: { en: "Dental clinic", fr: "Cabinet dentaire" },
  aesthetic: { en: "Aesthetic clinic", fr: "Clinique esthétique" },
  "home-services": { en: "Home services", fr: "Services à domicile" },
};

export function nicheLabel(niche: string | null, lang: "en" | "fr"): string {
  if (!niche) return lang === "fr" ? "Service" : "Service business";
  const key = Object.keys(NICHE_LABEL).find((k) => niche.toLowerCase().includes(k));
  return key ? NICHE_LABEL[key][lang] : niche;
}

/** What a given site actually ships with, from its config. */
function builtLabel(cfg: ClientSiteConfig | undefined, lang: "en" | "fr"): string {
  const hasChat = cfg?.features?.chat !== false;
  if (lang === "fr") return hasChat ? "Site + réceptionniste IA" : "Site web";
  return hasChat ? "Site + AI receptionist" : "Website";
}

/**
 * Everything Servolia has built that can be shown publicly.
 * Never throws — the page must render even with no database.
 */
export async function listBuiltSites(lang: "en" | "fr" = "en"): Promise<BuiltSite[]> {
  const demos: BuiltSite[] = SITE_TEMPLATES.map((t) => ({
    kind: "demo" as const,
    slug: t.demoSlug,
    href: `/sites/${t.demoSlug}`,
    business: t.demoBusiness,
    displayUrl: `servolia.com/sites/${t.demoSlug}`,
    niche: t.key,
    city: t.demoCity,
    language: "fr" as const, // all three showcases are French practices
    summary: t.audience[lang],
    built: lang === "fr" ? "Site + réceptionniste IA" : "Site + AI receptionist",
  }));

  const db = supabaseAdmin();
  if (!db) return demos;

  try {
    const { data, error } = await db
      .from("client_sites")
      .select("slug, business, niche, config, status")
      .eq("status", "published")
      .order("created_at", { ascending: false });
    if (error || !data) return demos;

    const clients: BuiltSite[] = (data as {
      slug: string; business: string | null; niche: string | null; config: ClientSiteConfig;
    }[])
      // Prospect demos and the bundled showcases are not clients.
      .filter((r) => !r.config?.isDemo && !r.slug.startsWith("demo-"))
      .map((r) => ({
        kind: "client" as const,
        slug: r.slug,
        href: `/sites/${r.slug}`,
        business: r.config?.businessName ?? r.business ?? r.slug,
        displayUrl: `servolia.com/sites/${r.slug}`,
        niche: r.niche ?? r.config?.niche ?? null,
        city: r.config?.city ?? null,
        language: r.config?.language === "fr" ? "fr" : "en",
        summary: r.config?.tagline ?? null,
        built: builtLabel(r.config, lang),
      }));

    // Real work first — it is the only thing that actually persuades.
    return [...clients, ...demos];
  } catch {
    return demos;
  }
}
