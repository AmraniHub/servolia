import { NextResponse, type NextRequest } from "next/server";
import { isOurHost, siteForHost, hostRoute, apexOf, notReadyPage } from "@/lib/siteHost";

/**
 * Two jobs, in front of every request.
 *
 * 1. A PRACTICE'S OWN DOMAIN (C2, src/lib/siteHost.ts). A request whose Host
 *    is not ours is looked up; if a published site has that domain, the path
 *    is rewritten to the site (or refused), and the page is told which host
 *    it is being served at (`x-site-host`) so its links, canonical and
 *    metadata name her domain, never servolia.com. An unknown host passes
 *    through untouched, exactly as before C2.
 *
 * 2. x-pathname on the REQUEST so server components / layouts can read it.
 *    Next.js doesn't pass pathname to layouts by default.
 *
 * Called `proxy`, in proxy.ts: Next 16 renamed this convention and warns on
 * every dev start until the file moves. The export name must match the file
 * name or Next refuses to load it and silently runs no proxy at all — which
 * would strip x-pathname from every request and break the layouts that read
 * it, with nothing in the log but the deprecation notice that is already there.
 */
export async function proxy(req: NextRequest) {
  const host = req.headers.get("host");
  if (!isOurHost(host)) {
    const site = await siteForHost(host);
    /* A domain attached to a practice NEVER falls through to servolia.com's
       own pages: not on a database error, not while her site is a draft,
       unpublished or being regenerated (review, 2026-09-22). Unknown hosts
       still pass through exactly as before C2. */
    if (site === "error") {
      return new NextResponse("Temporarily unavailable", { status: 503, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
    }
    if (site && !site.published) {
      return new NextResponse(notReadyPage(site.lang), {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": "3600", "Cache-Control": "no-store" },
      });
    }
    if (site) {
      const slug = site.slug;
      const route = hostRoute(req.nextUrl.pathname, slug, { multiPage: site.multiPage });
      if (route.kind === "not-found") return new NextResponse("Not found", { status: 404 });
      if (route.kind === "redirect") {
        // Built from HER host: nextUrl can carry the internal address the
        // request was routed to, and the redirect must land on her domain.
        const proto = req.headers.get("x-forwarded-proto") === "http" ? "http" : "https";
        const url = new URL(`${route.to}${req.nextUrl.search}`, `${proto}://${host}`);
        return NextResponse.redirect(url, 308);
      }
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-site-host", apexOf(host));
      requestHeaders.set("x-pathname", req.nextUrl.pathname);
      if (route.kind === "rewrite") {
        // `to` may carry its own query (the chat pins ?site=<slug>).
        const target = new URL(route.to, req.nextUrl.origin);
        const url = req.nextUrl.clone();
        url.pathname = target.pathname;
        if (target.search) url.search = target.search;
        return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
      }
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
  }
  const requestHeaders = new Headers(req.headers);
  // Never trusted from outside: only this proxy may say a request is a custom host.
  requestHeaders.delete("x-site-host");
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  /* Everything but Next's own static files. Before C2 this also skipped every
     path with a dot, which on her domain would have let /robots.txt and
     /sitemap.xml fall through to servolia.com's own. */
  matcher: ["/((?!_next/static|_next/image).*)"],
};
