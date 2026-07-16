import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/** Bring a deleted chat back — for the admin's own inbox, the client's portal, or both. */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, target } = (await req.json().catch(() => ({}))) as { email?: string; target?: "admin" | "client" | "both" };
  if (!email || !target) return NextResponse.json({ error: "email and target required" }, { status: 400 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const updates: Record<string, null> = {};
  if (target === "admin" || target === "both") updates.deleted_by_admin_at = null;
  if (target === "client" || target === "both") updates.deleted_by_client_at = null;
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "invalid target" }, { status: 400 });

  const { error } = await db.from("client_messages").update(updates).eq("email", email);
  if (error) return NextResponse.json({ error: "Failed to restore" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
