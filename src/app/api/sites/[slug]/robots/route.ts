import { NextRequest } from "next/server";
import { customHostFrom } from "@/lib/siteHost";

export const runtime = "nodejs";

/**
 * /robots.txt at a practice's own domain (C2) — src/proxy.ts rewrites it
 * here. Allows everything and points at HER sitemap. Asked for any other
 * way (servolia.com/api/sites/<slug>/robots), it disallows everything: the
 * servolia.com copy of a site must never be the one that gets indexed.
 */
export async function GET(req: NextRequest) {
  const host = customHostFrom(req.headers);
  const body = host
    ? `User-agent: *\nAllow: /\n\nSitemap: https://${host}/sitemap.xml\n`
    : `User-agent: *\nDisallow: /\n`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
