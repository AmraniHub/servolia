import { NextRequest, NextResponse } from "next/server";
import { getClientSite, slugify } from "@/lib/clientSites";
import { assistantEnabled } from "@/lib/assistantAccess";
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
  const headers = {
    ...corsHeaders("*"),
    // Short enough that switching an assistant off is felt within minutes;
    // long enough that a busy site does not hit the database per page view.
    "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=600",
  };
  const config = slug ? await getClientSite(slug) : undefined;
  if (!config || !(await assistantEnabled(config))) {
    return NextResponse.json({ enabled: false }, { headers });
  }
  return NextResponse.json(publicAssistantConfig(config), { headers });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders("*") });
}
