import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { generateSiteForBuild } from "@/lib/generateSite";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Generate (or regenerate) a draft client site from a build's intake data.
 * Thin admin wrapper around generateSiteForBuild() — the same generation
 * path also runs automatically the moment a paid client submits the intake
 * form (see /api/contact); this endpoint is the manual (re-)run button.
 * POST { buildId }  →  { slug, config, ai }
 * Admin-only.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { buildId } = (await req.json().catch(() => ({}))) as { buildId?: string };
  if (!buildId) return NextResponse.json({ error: "buildId required" }, { status: 400 });

  const result = await generateSiteForBuild(buildId);
  if (!result) {
    return NextResponse.json({ error: "Build not found or generation failed" }, { status: 404 });
  }

  return NextResponse.json(result);
}
