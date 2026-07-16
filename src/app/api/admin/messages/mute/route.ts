import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/** Mute/unmute Telegram pings for one client's messages. The CRM thread and portal are unaffected either way. */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, muted } = (await req.json().catch(() => ({}))) as { email?: string; muted?: boolean };
  if (!email || typeof muted !== "boolean") return NextResponse.json({ error: "email and muted required" }, { status: 400 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { error } = await db.from("chat_notification_prefs")
    .upsert({ email, telegram_muted: muted, updated_at: new Date().toISOString() }, { onConflict: "email" });
  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
