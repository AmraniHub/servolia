import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MarketingPage from "@/components/MarketingPage";
import { getIndustryFr, INDUSTRY_FR_SLUGS } from "@/lib/content/pagesFr";

export function generateStaticParams() {
  return INDUSTRY_FR_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = getIndustryFr(slug);
  if (!data) return {};
  return {
    title: data.metaTitle,
    description: data.metaDescription,
    alternates: {
      canonical: `https://servolia.com/fr/secteurs/${data.slug}`,
      languages: {
        "en-US": `https://servolia.com${data.enPath}`,
        "fr-FR": `https://servolia.com/fr/secteurs/${data.slug}`,
        "x-default": `https://servolia.com${data.enPath}`,
      },
    },
  };
}

export default async function FrIndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = getIndustryFr(slug);
  if (!data) notFound();
  return <MarketingPage data={data} lang="fr" enHref={data.enPath} />;
}
