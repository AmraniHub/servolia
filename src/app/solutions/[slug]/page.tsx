import { notFound } from "next/navigation";
import type { Metadata } from "next";
import MarketingPage from "@/components/MarketingPage";
import { getSolution, SOLUTION_SLUGS } from "@/lib/content/pages";

export function generateStaticParams() {
  return SOLUTION_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = getSolution(slug);
  if (!data) return {};
  return {
    title: data.metaTitle,
    description: data.metaDescription,
    alternates: { canonical: `https://servolia.com/solutions/${slug}` },
    openGraph: { title: data.metaTitle, description: data.metaDescription, url: `https://servolia.com/solutions/${slug}` },
  };
}

export default async function SolutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = getSolution(slug);
  if (!data) notFound();
  return <MarketingPage data={data} />;
}
