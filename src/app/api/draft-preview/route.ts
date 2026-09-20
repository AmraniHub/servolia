import { NextRequest, NextResponse } from "next/server";
import { readPreviewToken, PREVIEW_COOKIE, PREVIEW_TTL_DAYS } from "@/lib/draftPreview";

export const runtime = "nodejs";

/**
 * GET /api/draft-preview?t=<token>
 *
 * Where the "see your draft" link in the email lands. It turns the signed
 * token into a cookie scoped to /sites and sends the client on to their
 * draft — so the token survives every click inside the site instead of
 * dying on the first one. The cookie holds the same signed token; a page
 * re-verifies it on every request and it grants nothing beyond that one slug.
 *
 * A token that does not verify (forged, expired, wrong purpose) sends the
 * visitor to the homepage rather than to a bare 404: the link is the first
 * thing a paying client clicks after their intake, and a dead end there
 * reads as "this company is broken".
 */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t") ?? "";
  const claim = await readPreviewToken(t);
  const origin = req.nextUrl.origin;
  if (!claim) return NextResponse.redirect(`${origin}/?draft=expired`, 302);

  const res = NextResponse.redirect(`${origin}/sites/${encodeURIComponent(claim.slug)}`, 302);
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
