import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** Toggle a client site between draft and published. POST { slug, status }. Admin-only. */
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

  await db.from("client_sites").update({ status }).eq("slug", slug);
  return NextResponse.json({ ok: true, slug, status });
}
