import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BlogArticle from "@/components/BlogArticle";
import { POST_SLUGS } from "@/lib/content/posts";
import { getAnyPost } from "@/lib/content/dynamicPosts";

export const dynamicParams = true; // allow AI-generated slugs not known at build time

export function generateStaticParams() {
  return POST_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getAnyPost(slug);
  if (!post) return {};
  return {
    title: post.metaTitle,
    description: post.metaDescription,
    alternates: { canonical: `https://servolia.com/blog/${slug}` },
    openGraph: {
      title: post.metaTitle,
      description: post.metaDescription,
      url: `https://servolia.com/blog/${slug}`,
      type: "article",
      publishedTime: post.publishedAt,
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getAnyPost(slug);
  if (!post) notFound();

  // Article structured data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDescription,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: { "@type": "Organization", name: "Servolia" },
    publisher: { "@type": "Organization", name: "Servolia", url: "https://servolia.com" },
    mainEntityOfPage: `https://servolia.com/blog/${slug}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BlogArticle post={post} />
    </>
  );
}
