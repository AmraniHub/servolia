import { NextRequest } from "next/server";
import { getClientSite } from "@/lib/clientSites";
import { customHostFrom } from "@/lib/siteHost";

export const runtime = "nodejs";

/**
 * /sitemap.xml at a practice's own domain (C2) — src/proxy.ts rewrites it
 * here. Lists the pages her site actually has, at her domain. Only ever
 * answers on her host: there is no servolia.com sitemap of client sites.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const host = customHostFrom(req.headers);
  const { slug } = await params;
  const c = host ? await getClientSite(slug) : undefined;
  if (!host || !c || c.status !== "published") return new Response("Not found", { status: 404 });

  const pages = ["/"];
  if (c.multiPage) {
    if (c.about || (c.team?.length ?? 0) > 0 || (c.values?.length ?? 0) > 0) pages.push("/cabinet");
    if ((c.expertise?.length ?? 0) > 0 || (c.solutions?.length ?? 0) > 0) pages.push("/expertise");
    if ((c.advice?.length ?? 0) > 0 || c.whyUs.length > 0 || c.faqs.length > 0) pages.push("/conseils");
  }
  pages.push("/confidentialite");

  const today = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((p) => `  <url><loc>https://${host}${p === "/" ? "/" : p}</loc><lastmod>${today}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
