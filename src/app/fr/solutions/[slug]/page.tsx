import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MarketingPage from "@/components/MarketingPage";
import { getSolutionFr, SOLUTION_FR_SLUGS } from "@/lib/content/pagesFr";

export function generateStaticParams() {
  return SOLUTION_FR_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = getSolutionFr(slug);
  if (!data) return {};
  return {
    title: data.metaTitle,
    description: data.metaDescription,
    alternates: {
      canonical: `https://servolia.com/fr/solutions/${data.slug}`,
      languages: {
        "en-US": `https://servolia.com${data.enPath}`,
        "fr-FR": `https://servolia.com/fr/solutions/${data.slug}`,
        "x-default": `https://servolia.com${data.enPath}`,
      },
    },
  };
}

export default async function FrSolutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = getSolutionFr(slug);
  if (!data) notFound();
  return <MarketingPage data={data} lang="fr" enHref={data.enPath} />;
}
