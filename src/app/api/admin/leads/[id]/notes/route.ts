import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

/**
 * Add a note or activity (call, email, meeting) to a lead's timeline.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const { id } = await params;
  const { type, description } = await req.json() as { type?: string; description: string };
  if (!description?.trim()) return NextResponse.json({ error: "description required" }, { status: 400 });

  const { error } = await db.from("lead_activities").insert({
    lead_id: id,
    type: type ?? "note",
    description: description.trim(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Bump last_contacted_at if this was an outreach
  if (["call", "email", "message"].includes(type ?? "")) {
    await db.from("leads").update({ last_contacted_at: new Date().toISOString() }).eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
