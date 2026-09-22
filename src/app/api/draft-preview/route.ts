import { NextRequest, NextResponse } from "next/server";
import { readPreviewToken, PREVIEW_COOKIE, PREVIEW_TTL_DAYS } from "@/lib/draftPreview";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * GET /api/draft-preview?t=<token>
 *
 * Where the "see your draft" link in the email lands. It turns the signed
 * token into a cookie scoped to /sites and sends the client on to their
 * draft — so the token survives every click inside the site instead of
 * dying on the first one. The cookie holds the same signed token; a page
 * re-verifies it on every request and it grants nothing beyond that build.
 *
 * The build is the stable identity, not the slug: a regenerate that corrects
 * the business name renames the slug, and the link in the client's inbox
 * must still arrive at their site. So the current slug is looked up by
 * build id; the slug in the token is only the fallback.
 *
 * A token that does not verify (forged, expired, wrong purpose) lands on
 * /draft-expired, a page that says so in both languages and names the way
 * to get a fresh link. The link is the first thing a paying client clicks
 * after their intake; a sales homepage or a bare 404 there reads as "this
 * company is broken".
 */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t") ?? "";
  const claim = await readPreviewToken(t);
  const origin = req.nextUrl.origin;
  if (!claim) return NextResponse.redirect(`${origin}/draft-expired`, 302);

  let slug = claim.slug;
  const db = supabaseAdmin();
  if (db) {
    const { data } = await db.from("client_sites").select("slug").eq("build_id", claim.buildId).maybeSingle();
    const current = (data as { slug?: string } | null)?.slug;
    if (current) slug = current;
  }

  const res = NextResponse.redirect(`${origin}/sites/${encodeURIComponent(slug)}`, 302);
  res.cookies.set({
    name: PREVIEW_COOKIE,
    value: t,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/sites",
    maxAge: PREVIEW_TTL_DAYS * 86400,
  });
  return res;
}
