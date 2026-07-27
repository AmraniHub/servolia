import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Google Places → prospects. Type what you'd type into Google Maps
 * ("clinique esthétique Lyon") and get up to 20 prospects with phone,
 * website, rating and address — instead of hand-typing CSVs.
 *
 * Uses the Places API (New) Text Search endpoint. Needs GOOGLE_PLACES_API_KEY
 * (Google Cloud Console → APIs → Places API (New) → credentials). Costs
 * ~$0.035 per search (Enterprise-tier fields: phone + website), ~1,000 free/month — effectively free at founder prospecting scale.
 *
 * POST { query, niche? } → { imported, skipped, total }
 * Dedupes against existing prospects by (business, city) pair.
 */

interface PlaceResult {
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
}

/** Pull a city out of "12 Rue X, 69006 Lyon, France" — second-to-last part, digits stripped. */
function cityFromAddress(addr?: string): string | undefined {
  if (!addr) return undefined;
  const parts = addr.split(",").map((p) => p.trim());
  if (parts.length < 2) return undefined;
  const cityPart = parts[parts.length - 2] ?? "";
  const city = cityPart.replace(/\d+/g, "").trim();
  return city || undefined;
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY not set — see /admin/settings → Growth & ads" },
      { status: 503 },
    );
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { query?: string; niche?: string };
  const query = (body.query ?? "").trim();
  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });
  const niche = (body.niche ?? "aesthetic").trim();

  let places: PlaceResult[] = [];
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 20, languageCode: "fr" }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("Places API error:", res.status, detail.slice(0, 500));
      return NextResponse.json({ error: `Places API error (${res.status}) — check the key and that Places API (New) is enabled` }, { status: 502 });
    }
    const data = (await res.json()) as { places?: PlaceResult[] };
    places = data.places ?? [];
  } catch (err) {
    console.error("Places fetch failed:", err);
    return NextResponse.json({ error: "Places API unreachable" }, { status: 502 });
  }

  if (!places.length) return NextResponse.json({ imported: 0, skipped: 0, total: 0 });

  // Dedupe against existing prospects by lowercased business name.
  const { data: existing } = await db.from("prospects").select("business");
  const seen = new Set(((existing ?? []) as { business: string }[]).map((p) => p.business.trim().toLowerCase()));

  const rows = [];
  let skipped = 0;
  for (const p of places) {
    const business = p.displayName?.text?.trim();
    if (!business) { skipped++; continue; }
    if (seen.has(business.toLowerCase())) { skipped++; continue; }
    seen.add(business.toLowerCase());
    const phone = (p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? "").replace(/[^\d+]/g, "") || undefined;
    const ratingNote = p.rating
      ? `Google ${p.rating}★ (${p.userRatingCount ?? 0} avis)${p.formattedAddress ? ` · ${p.formattedAddress}` : ""}`
      : p.formattedAddress;
    rows.push({
      business,
      city: cityFromAddress(p.formattedAddress),
      phone,
      website: p.websiteUri ?? undefined,
      niche,
      notes: ratingNote,
    });
  }

  if (rows.length) {
    const { error } = await db.from("prospects").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ imported: rows.length, skipped, total: places.length });
}
