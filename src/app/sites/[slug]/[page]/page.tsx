import { notFound, permanentRedirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { customHostFrom, customHostMetadata } from "@/lib/siteHost";
import ClientSite, { type ClientSitePage } from "@/components/ClientSite";
import ClientAnalytics from "@/components/ClientAnalytics";
import { getClientSite } from "@/lib/clientSites";
import { draftAccess, DraftPreviewRibbon } from "@/lib/draftGate";

export const dynamic = "force-dynamic";

// Sub-pages exist only for multi-page client sites. Anchors on a single-page
// site (#services, #about) still work; these real routes are the multi-page
// equivalent so nav items lead to their own indexable page.
const PAGES: Record<string, ClientSitePage> = {
  cabinet: "cabinet",
  expertise: "expertise",
  services: "services",
  conseils: "conseils",
};

const PAGE_LABEL: Record<ClientSitePage, { en: string; fr: string }> = {
  home: { en: "", fr: "" },
  cabinet: { en: "About", fr: "Cabinet" },
  expertise: { en: "Expertise", fr: "Expertise" },
  services: { en: "Services", fr: "Services" },
  conseils: { en: "Advice", fr: "Conseils" },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string; page: string }> }): Promise<Metadata> {
  const { slug, page } = await params;
  const c = await getClientSite(slug);
  const which = PAGES[page];
  if (!c || !which || !c.multiPage) return { title: "Site not found" };
  const label = PAGE_LABEL[which][c.language === "fr" ? "fr" : "en"];
  const host = customHostFrom(await headers());
  if (host) return customHostMetadata(c, host, `/${page}`, label) as Metadata;
  return {
    title: `${label} · ${c.businessName}${c.city ? ` · ${c.city}` : ""}`,
    description: c.heroSub || c.about,
    robots: { index: false, follow: false },
  };
}

export default async function ClientSubPage({ params }: { params: Promise<{ slug: string; page: string }> }) {
  const { slug, page } = await params;
  const which = PAGES[page];
  if (!which) notFound();
  const config = await getClientSite(slug);
  // Sub-pages are only meaningful for multi-page sites.
  if (!config || !config.multiPage) notFound();
  // Unpublished drafts are private — to an admin, or to the client through the
  // preview cookie /api/draft-preview set on their first click, which is what
  // lets them move from the home page to /services without losing access.
  const access = await draftAccess(config);
  if (access === "hidden") notFound();
  // C2: once her domain is live, this page lives there (see the home page).
  const host = customHostFrom(await headers());
  if (!host && access === "public" && config.customDomain && config.domainLiveAt) {
    permanentRedirect(`https://${config.customDomain}/${page}`);
  }
  const viewer = access === "client" ? "client" : access === "admin" ? "admin" : null;
  return (
    <>
      {viewer && <DraftPreviewRibbon lang={config.language === "fr" ? "fr" : "en"} viewer={viewer} />}
      <ClientSite config={config} page={which} basePath={host ? "" : undefined} customHost={Boolean(host)} />
      {/* No analytics on a draft — see the home page for why. */}
      {!viewer && <ClientAnalytics ga4Id={config.ga4Id} metaPixelId={config.metaPixelId} slug={config.slug} lang={config.language === "fr" ? "fr" : "en"} />}
    </>
  );
}
