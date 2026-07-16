import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const { id } = await params;
  const updates = await req.json();

  // Moving a lead out of "new" is the real first-contact signal (audit sent,
  // called, etc.) — capture it automatically so the response-time SLA on the
  // analytics page has data without relying on a separate manual note.
  if (updates.stage && updates.stage !== "new") {
    const { data: existing } = await db.from("leads").select("last_contacted_at").eq("id", id).single();
    if (existing && !existing.last_contacted_at) updates.last_contacted_at = new Date().toISOString();
  }

  const { data, error } = await db.from("leads").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const { id } = await params;
  const { error } = await db.from("leads").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
