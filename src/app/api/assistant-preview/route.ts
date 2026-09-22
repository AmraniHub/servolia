import { NextRequest, NextResponse } from "next/server";
import { probeBrand } from "@/lib/brandProbe";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/assistant-preview?domain=<anything the visitor typed>
 *
 * The engine behind "type your domain, see YOUR assistant": reads the
 * business's own homepage and answers with its name, colour and languages
 * for the demo to wear. Open — it serves a public marketing page — but a
 * probe fetches an arbitrary site from our server, so it is rate limited
 * per IP and everything else is guarded inside probeBrand (public hosts
 * only, byte caps, timeouts, per-domain cache).
 *
 * An unreachable site is still ok:true with fallback:true — the demo then
 * carries the name derived from the domain, because "we could not read
 * your site" must not read as "this product is broken".
 */

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 12;
const rate = new Map<string, { n: number; at: number }>();

function limited(key: string): boolean {
  const now = Date.now();
  const e = rate.get(key);
  if (!e || now - e.at > RATE_WINDOW_MS) {
    rate.set(key, { n: 1, at: now });
    if (rate.size > 5000) rate.clear();
    return false;
  }
  e.n += 1;
  return e.n > RATE_MAX;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  if (limited(ip)) {
    return NextResponse.json({ ok: false, error: "rate" }, { status: 429 });
  }
  const brand = await probeBrand(req.nextUrl.searchParams.get("domain") ?? "");
  if (!brand) {
    return NextResponse.json({ ok: false, error: "invalid-domain" }, { status: 400 });
  }
  // The page text is for server-side drafts only — never ship it back.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { text: _text, ...publicBrand } = brand;
  return NextResponse.json(
    { ok: true, ...publicBrand },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=600" } },
  );
}
