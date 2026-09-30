import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { deleteDraftSite } from "@/lib/siteDelete";

export const runtime = "nodejs";

/**
 * Delete a draft client site. POST { slug }. Admin-only.
 * Drafts nobody pays for only, snapshotted to the GitHub archive first --
 * see src/lib/siteDelete.ts for what is refused and why.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { slug } = (await req.json().catch(() => ({}))) as { slug?: unknown };
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,100}$/.test(slug)) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }
  const out = await deleteDraftSite(db, slug);
  if (!out.ok) return NextResponse.json({ error: out.reason }, { status: out.status });
  return NextResponse.json({ ok: true, slug, archiveUrl: out.archiveUrl });
}
