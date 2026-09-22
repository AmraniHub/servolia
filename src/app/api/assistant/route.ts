import { NextRequest, NextResponse, after } from "next/server";
import { markSeenLive } from "@/lib/receptionistTrial";
import { getClientSite, slugify } from "@/lib/clientSites";
import { assistantEnabled, previewOrigin, previewable } from "@/lib/assistantAccess";
import { publicAssistantConfig, corsHeaders } from "@/lib/assistant";

export const runtime = "nodejs";

/**
 * GET /api/assistant?site=<slug> — what the embed script needs to draw itself.
 *
 * Open to any origin on purpose: the script tag lives on the client's site,
 * so the first request always comes from a foreign origin, and the payload
 * carries nothing worth protecting (see publicAssistantConfig). The things
 * worth protecting — the prompt, the lead destination — never leave the
 * server; the widget only ever sees replies.
 *
 * An unknown, unpaid or switched-off assistant answers `{enabled:false}` with
 * a 200, not an error. The script reads that as "draw nothing": a client
 * whose subscription lapsed gets a site with no widget, not a site with a
 * broken one, and a page that embeds a slug that never existed is silent
 * rather than throwing in a stranger's console.
 */
export async function GET(req: NextRequest) {
  const slug = slugify(req.nextUrl.searchParams.get("site") ?? "");
  const askedPreview = req.nextUrl.searchParams.get("preview") === "1";
  const headers = {
    ...corsHeaders("*"),
    /* Short enough that switching an assistant off is felt within minutes;
       long enough that a busy site does not hit the database per page view.
       NEVER for a preview URL, in either direction: the answer there depends
       on WHO asked (our page, or not), and the CDN keys on the URL. The first
       production deploy proved it — one refused probe from a foreign origin
       was cached for five minutes under the very URL the showroom fetches,
       and every real browser after it was handed `enabled:false`. */
    "Cache-Control": askedPreview
      ? "private, no-store"
      : "public, max-age=120, s-maxage=300, stale-while-revalidate=600",
  };
  const config = slug ? await getClientSite(slug) : undefined;
  if (!config) return NextResponse.json({ enabled: false }, { headers });
  if (await assistantEnabled(config)) {
    /* A practice's trial receptionist loading on her own domain is the
       install, even when a tag manager hides the line from our HTML check.
       Best effort: this response is CDN-cached, so /api/chat records it too. */
    const origin = req.headers.get("origin");
    if (config.receptionist && !config.receptionist.installedAt && origin && !askedPreview) {
      let host = "";
      try { host = new URL(origin).hostname; } catch { /* nothing to record */ }
      if (host) after(() => markSeenLive(config.slug, host).then(() => undefined));
    }
    return NextResponse.json(publicAssistantConfig(config), { headers });
  }

  /* THE SHOWROOM. Unpaid, but asked for as a preview from one of our own
     pages: draw it. See previewOrigin() for the rule. */
  if (askedPreview && previewable(config) && previewOrigin(req.headers)) {
    return NextResponse.json({ ...publicAssistantConfig(config), preview: true }, { headers });
  }
  return NextResponse.json({ enabled: false }, { headers });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders("*") });
}
