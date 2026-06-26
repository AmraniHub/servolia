import { MetadataRoute } from "next";

const base = "https://servolia.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base,                                  lastModified: new Date(), changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/pricing`,                     lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/contact`,                     lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/free-audit`,                  lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/dentists`,                    lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/niches/aesthetic-clinics`,    lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/legal/privacy`,               lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/legal/cgv`,                   lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
  ];
}
