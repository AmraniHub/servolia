import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { generateSiteForBuild } from "@/lib/generateSite";
import { notifyDraftReady, previewLinkFor, type NotifyOutcome } from "@/lib/draftPreview";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Generate (or regenerate) a draft client site from a build's intake data.
 * Thin admin wrapper around generateSiteForBuild() — the same generation
 * path also runs automatically the moment a paid client submits the intake
 * form (see /api/contact); this endpoint is the manual (re-)run button.
 *
 * It then tells the client, through the SAME notifier the intake path uses
 * (once per site — a client who already has their link is not emailed
 * again). So pressing this button on a build whose email is your own is how
 * the draft-ready email is verified end to end, with no fake sale.
 *
 * POST { buildId }  →  { slug, config, ai, notified, previewUrl }
 * `previewUrl` is always returned so a link a client lost can be re-sent by
 * hand. Admin-only.
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

  /* The site is already regenerated and written by now. Neither the email
     nor the link may turn that into a 500 — the founder would see an error
     for work that succeeded and press the button again. */
  let notified: NotifyOutcome;
  try {
    notified = await notifyDraftReady({ buildId, slug: result.slug, config: result.config, ai: result.ai });
  } catch (e) {
    notified = { sent: false, reason: "send-failed", detail: e instanceof Error ? e.message : String(e) };
  }
  let previewUrl: string | null = null;
  try {
    previewUrl = await previewLinkFor(result.slug, buildId);
  } catch (e) {
    console.error("[generate-site] could not mint the preview link:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ ...result, notified, previewUrl });
}
