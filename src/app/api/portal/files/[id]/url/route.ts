import { NextRequest, NextResponse } from "next/server";
import { signedDownload, resolveActor, vaultErrorResponse } from "@/lib/clientVault";

export const runtime = "nodejs";

/**
 * Download one file.
 *
 * Redirects to a freshly minted 60-second signed URL rather than returning it
 * as JSON, so the link is never printed into the page and a copied page source
 * carries nothing usable. The signed URL itself sets Content-Disposition from
 * the original filename, which is what makes every vault download an
 * attachment — nothing from the vault is ever rendered inline in a browser.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const actor = await resolveActor(req.nextUrl.searchParams.get("email"));
  if (!actor) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const result = await signedDownload(actor.email, id);
  if (!result.ok) {
    const { status, error } = vaultErrorResponse(result.reason);
    return NextResponse.json({ error }, { status });
  }

  // 302, not 308: the signed URL expires, so this must never be cached as a
  // permanent redirect by the browser or by Vercel's edge.
  return NextResponse.redirect(result.value, 302);
}
