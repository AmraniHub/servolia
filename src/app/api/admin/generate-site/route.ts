import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, type Build, type Lead } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { configFromIntake, slugify, type ClientSiteConfig } from "@/lib/clientSites";
import { aiEnrichConfig } from "@/lib/generateSiteCopy";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Generate (or regenerate) a draft client site from a build's intake data.
 * Mechanical draft first (configFromIntake), then Claude writes the full
 * site copy from the intake answers (aiEnrichConfig) — falls back to the
 * mechanical draft if the AI call fails, so generation never breaks.
 * POST { buildId }  →  { slug, config, ai }
 * Admin-only.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { buildId } = (await req.json().catch(() => ({}))) as { buildId?: string };
  if (!buildId) return NextResponse.json({ error: "buildId required" }, { status: 400 });

  // Load the build + its lead (for niche)
  const { data: build } = await db.from("builds").select("*").eq("id", buildId).maybeSingle();
  if (!build) return NextResponse.json({ error: "Build not found" }, { status: 404 });
  const b = build as Build;

  let niche: string | null = null;
  if (b.lead_id) {
    const { data: lead } = await db.from("leads").select("niche").eq("id", b.lead_id).maybeSingle();
    niche = (lead as Pick<Lead, "niche"> | null)?.niche ?? null;
  }

  // Draft the config from intake, then let Claude write the real copy
  const draft: ClientSiteConfig = configFromIntake({
    intake: b.intake_data ?? null,
    business: b.business,
    niche,
    email: b.email,
  });
  const { config, ai } = await aiEnrichConfig(draft, b.intake_data ?? {});

  // Ensure a unique slug (append short suffix on collision with a *different* build)
  let slug = config.slug;
  const { data: clash } = await db.from("client_sites").select("id, build_id").eq("slug", slug).maybeSingle();
  if (clash && (clash as { build_id?: string }).build_id !== buildId) {
    slug = `${slug}-${slugify(buildId).slice(0, 4)}`;
  }
  config.slug = slug;

  // Upsert by build_id so re-running updates the same site
  const { data: existing } = await db.from("client_sites").select("id").eq("build_id", buildId).maybeSingle();
  const row = {
    slug,
    build_id: buildId,
    business: config.businessName,
    niche: config.niche,
    config,
    status: "draft" as const,
  };

  if (existing) {
    await db.from("client_sites").update(row).eq("id", (existing as { id: string }).id);
  } else {
    await db.from("client_sites").insert(row);
  }

  return NextResponse.json({ slug, config, ai });
}
