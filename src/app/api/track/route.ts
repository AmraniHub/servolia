import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * First-party pageview ingest — the source of /admin/traffic and the portal's
 * Traffic tab.
 *
 * Why not just read Google Analytics? Two reasons:
 *  1. Every client site is served by this same app under /sites/{slug}, so one
 *     tracker covers all of them. Reading GA instead would mean provisioning a
 *     GA property per client by hand.
 *  2. The data lands in the same database as leads and bookings, so a client
 *     sees visitors → enquiries → bookings as one funnel. GA can never do that
 *     because it doesn't know what a booking is.
 *
 * Privacy: no cookie is set and no IP is stored. A visitor is a salted hash of
 * (ip + user-agent + today's date), so the identifier is useless tomorrow and
 * cannot be reversed — which is what keeps this outside consent requirements.
 */

const BOT_RE = /bot|crawler|spider|crawling|facebookexternalhit|slurp|bingpreview|headless|lighthouse|preview|monitor|curl|wget|python-requests|axios|node-fetch/i;

function deviceOf(ua: string): string {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return "mobile";
  return "desktop";
}

function browserOf(ua: string): string {
  // Order matters — Edge and Chrome both claim "Safari", Chrome claims nothing unique.
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/chrome\/|crios/i.test(ua)) return "Chrome";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  return "Other";
}

/** Host only — we never store the full referring URL (it can carry personal data). */
function hostOf(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const h = new URL(referrer).hostname.replace(/^www\./, "");
    return h || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") ?? "";
    // Drop bots before they touch the database — otherwise every dashboard lies.
    if (!ua || BOT_RE.test(ua)) return NextResponse.json({ ok: true, skipped: "bot" });

    const body = (await req.json()) as {
      path?: string;
      siteSlug?: string | null;
      referrer?: string | null;
      sessionId?: string;
      isEntry?: boolean;
      utm?: Record<string, string> | null;
    };

    const path = (body.path ?? "").slice(0, 300);
    if (!path) return NextResponse.json({ ok: true, skipped: "no-path" });

    const db = supabaseAdmin();
    if (!db) return NextResponse.json({ ok: true, skipped: "no-db" });

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    // Rotates every day, so the hash can't be used to follow someone over time.
    const day = new Date().toISOString().slice(0, 10);
    const salt = process.env.ANALYTICS_SALT ?? "servolia-default-salt";
    const visitorHash = createHash("sha256").update(`${ip}|${ua}|${day}|${salt}`).digest("hex").slice(0, 32);

    const utm = body.utm ?? {};

    await db.from("page_views").insert({
      site_slug: body.siteSlug || null,
      path,
      referrer_host: hostOf(body.referrer),
      utm_source: utm.utm_source?.slice(0, 100) ?? null,
      utm_medium: utm.utm_medium?.slice(0, 100) ?? null,
      utm_campaign: utm.utm_campaign?.slice(0, 100) ?? null,
      // Vercel resolves geo at the edge and passes it through as headers.
      country: req.headers.get("x-vercel-ip-country") ?? null,
      city: (() => {
        const c = req.headers.get("x-vercel-ip-city");
        return c ? decodeURIComponent(c) : null;
      })(),
      device: deviceOf(ua),
      browser: browserOf(ua),
      visitor_hash: visitorHash,
      session_id: body.sessionId?.slice(0, 64) ?? null,
      is_entry: !!body.isEntry,
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Analytics must never break a page render or surface an error to a visitor.
    return NextResponse.json({ ok: true });
  }
}
