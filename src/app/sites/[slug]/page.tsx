import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ClientSite from "@/components/ClientSite";
import ClientAnalytics from "@/components/ClientAnalytics";
import { getClientSite } from "@/lib/clientSites";
import { isHiddenDraft, DraftPreviewRibbon } from "@/lib/draftGate";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getClientSite(slug);
  if (!c) return { title: "Site not found" };
  return {
    title: `${c.businessName}${c.city ? ` · ${c.city}` : ""}`,
    description: c.heroSub || c.about,
    // Client sites are hosted here on a platform subpath — the real site lives on
    // the client's own domain, so we don't want servolia.com/sites/* indexed.
    robots: { index: false, follow: false },
    openGraph: {
      title: c.businessName,
      description: c.heroSub || c.about,
      type: "website",
    },
  };
}

export default async function ClientSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = await getClientSite(slug);
  if (!config) notFound();
  // Unpublished drafts are private until an admin publishes them.
  if (await isHiddenDraft(config)) notFound();
  const isDraft = config.status && config.status !== "published";
  return (
    <>
      {isDraft && <DraftPreviewRibbon lang={config.language === "fr" ? "fr" : "en"} />}
      <ClientSite config={config} />
      <ClientAnalytics ga4Id={config.ga4Id} metaPixelId={config.metaPixelId} />
    </>
  );
}
