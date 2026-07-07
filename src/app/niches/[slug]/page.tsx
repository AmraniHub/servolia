import { notFound } from "next/navigation";
import type { Metadata } from "next";
import MarketingPage from "@/components/MarketingPage";
import { getIndustry, INDUSTRY_SLUGS } from "@/lib/content/pages";

export function generateStaticParams() {
  return INDUSTRY_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = getIndustry(slug);
  if (!data) return {};
  return {
    title: data.metaTitle,
    description: data.metaDescription,
    alternates: { canonical: `https://servolia.com/niches/${slug}` },
    openGraph: { title: data.metaTitle, description: data.metaDescription, url: `https://servolia.com/niches/${slug}` },
  };
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = getIndustry(slug);
  if (!data) notFound();
  return <MarketingPage data={data} />;
}
