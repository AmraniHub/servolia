import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { publishSite } from "@/lib/publishSite";

export const runtime = "nodejs";

/**
 * Toggle a client site between draft and published. POST { slug, status }. Admin-only.
 * Publishing goes through src/lib/publishSite.ts — the same function the
 * client's own "go" uses (C3), so the archive, the go-live email and its
 * once-only rule are one piece of code, not two.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { slug, status } = (await req.json().catch(() => ({}))) as { slug?: string; status?: string };
  if (!slug || (status !== "draft" && status !== "published")) {
    return NextResponse.json({ error: "slug and valid status required" }, { status: 400 });
  }

  if (status === "published") {
    const out = await publishSite(slug, { by: "admin" });
    if (!out.ok) return NextResponse.json({ error: out.reason }, { status: out.reason === "not-found" ? 404 : 500 });
    return NextResponse.json({ ok: true, slug, status, goLiveEmailed: out.goLiveEmailed });
  }

  const { error } = await db.from("client_sites").update({ status }).eq("slug", slug);
  if (error) return NextResponse.json({ error: "write-failed" }, { status: 500 });
  return NextResponse.json({ ok: true, slug, status, goLiveEmailed: false });
}
