import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { archiveSite, restoreSite, listArchive, archiveConfigured } from "@/lib/siteArchive";

export const runtime = "nodejs";

/**
 * Client-site GitHub archive. Admin-only.
 *   GET                       → { configured, sites: [{slug,size}] }
 *   POST { slug }             → snapshot the site to the archive repo
 *   POST { slug, restore }    → pull the snapshot back as a DRAFT
 * Publishing a site also auto-archives it (see /api/admin/set-site-status).
 */

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sites = await listArchive();
  return NextResponse.json({ configured: archiveConfigured(), sites: sites ?? [] });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, restore } = (await req.json().catch(() => ({}))) as { slug?: string; restore?: boolean };
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const result = restore ? await restoreSite(slug) : await archiveSite(slug);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 502 });
  return NextResponse.json(result);
}
