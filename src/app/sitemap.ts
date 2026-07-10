import { MetadataRoute } from "next";
import { SOLUTION_SLUGS, INDUSTRY_SLUGS } from "@/lib/content/pages";
import { getAllPosts } from "@/lib/content/dynamicPosts";

const base = "https://servolia.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const solutionRoutes = SOLUTION_SLUGS.map((slug) => ({
    url: `${base}/solutions/${slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.9,
  }));
  const industryRoutes = INDUSTRY_SLUGS.map((slug) => ({
    url: `${base}/niches/${slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.8,
  }));
  const allPosts = await getAllPosts();
  const blogRoutes = allPosts.map((p) => ({
    url: `${base}/blog/${p.slug}`, lastModified: new Date(p.publishedAt), changeFrequency: "monthly" as const, priority: 0.7,
  }));

  return [
    { url: base,                                  lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/fr`,                           lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${base}/fr/audit`,                     lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/solutions`,                    lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/pricing`,                     lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/contact`,                     lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/free-audit`,                  lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/how-it-works`,                lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/case-studies`,               lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/blog`,                         lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${base}/about`,                        lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/dentists`,                    lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/niches/aesthetic-clinics`,    lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/niches/real-estate`,          lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/niches/home-services`,        lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    ...solutionRoutes,
    ...industryRoutes,
    ...blogRoutes,
    { url: `${base}/billing`,                     lastModified: now, changeFrequency: "yearly",  priority: 0.4 },
    { url: `${base}/legal/privacy`,               lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/legal/cgv`,                   lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/legal/terms`,                 lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/legal/refund`,                lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ];
}
