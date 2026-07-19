import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ClientSite, { type ClientSitePage } from "@/components/ClientSite";
import { getClientSite } from "@/lib/clientSites";

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
  return <ClientSite config={config} page={which} />;
}
