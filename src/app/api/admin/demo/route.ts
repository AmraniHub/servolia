import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { configFromIntake, slugify, listClientSites, type ClientSiteConfig } from "@/lib/clientSites";
import { aiEnrichConfig } from "@/lib/generateSiteCopy";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Prospect demo generator — the #1 pre-sale closing asset.
 * Type a clinic's name + services and get a LIVE demo link where their own
 * AI receptionist answers their patients in French, before they pay a cent.
 * No build/payment required — creates a published, demo-flagged client_site.
 * Admin-only.
 */

/** POST { businessName, city, niche, services, phone?, lang } → { slug, url, ai } */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as {
    businessName?: string;
    city?: string;
    niche?: string;
    services?: string;
    phone?: string;
    lang?: string;
    demoContactUrl?: string;
  };

  const businessName = (body.businessName ?? "").trim();
  if (!businessName) return NextResponse.json({ error: "Business name required" }, { status: 400 });

  const niche = (body.niche ?? "dental").trim();
  const lang = /fr|french|français/i.test(body.lang ?? "fr") ? "fr" : "en";

  // Feed the same intake pipeline a real client uses — so the demo is
  // pixel-identical to what they'd get after paying.
  const intake: Record<string, unknown> = {
    businessName,
    niche,
    city: body.city,
    services: body.services,
    preferredLanguage: lang === "fr" ? "français" : "english",
    phone: body.phone,
  };

  const draft = configFromIntake({ intake, business: businessName, niche });
  const { config, ai } = await aiEnrichConfig(draft, intake);

  // Mark as a demo and ensure a unique, demo-namespaced slug.
  config.isDemo = true;
  config.demoContactUrl = body.demoContactUrl?.trim() || "https://servolia.com/contact";
  config.status = "published";

  let slug = `demo-${slugify(businessName)}`;
  const { data: clash } = await db.from("client_sites").select("id").eq("slug", slug).maybeSingle();
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  config.slug = slug;

  const { error } = await db.from("client_sites").insert({
    slug,
    build_id: null,
    business: businessName,
    niche,
    config,
    status: "published",
    notes: "PROSPECT DEMO (pre-sale, no payment)",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = req.headers.get("origin") ?? "https://servolia.com";
  return NextResponse.json({ slug, url: `${origin}/sites/${slug}`, ai });
}

/** GET → list all prospect demos, newest first. */
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sites = await listClientSites();
  const demos = sites
    .filter((s: ClientSiteConfig) => s.isDemo)
    .map((s) => ({ slug: s.slug, businessName: s.businessName, niche: s.niche, language: s.language }));
  return NextResponse.json({ demos });
}
