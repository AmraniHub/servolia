import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Admin messages inbox — every client conversation in one place.
 * GET: threads (grouped by email, last message + admin-unread count) plus the
 * list of client emails you can start a new conversation with.
 */
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ threads: [], contacts: [] });

  const { data: msgs } = await db
    .from("client_messages")
    .select("email, sender, body, created_at, read_by_admin, attachment_url")
    .is("deleted_by_admin_at", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  type Row = { email: string; sender: string; body: string; created_at: string; read_by_admin: boolean; attachment_url: string | null };
  const rows = (msgs as Row[] | null) ?? [];

  const byEmail = new Map<string, { email: string; lastBody: string; lastAt: string; lastSender: string; unread: number; telegramMuted: boolean }>();
  for (const m of rows) {
    let t = byEmail.get(m.email);
    if (!t) {
      t = { email: m.email, lastBody: m.body || (m.attachment_url ? "📷 Photo" : ""), lastAt: m.created_at, lastSender: m.sender, unread: 0, telegramMuted: false };
      byEmail.set(m.email, t);
    }
    // rows are newest-first, so the first seen per email is the latest
    if (m.sender === "client" && !m.read_by_admin) t.unread += 1;
  }

  if (byEmail.size > 0) {
    const { data: prefs } = await db.from("chat_notification_prefs").select("email, telegram_muted").in("email", Array.from(byEmail.keys()));
    for (const p of (prefs ?? []) as { email: string; telegram_muted: boolean }[]) {
      const t = byEmail.get(p.email);
      if (t) t.telegramMuted = p.telegram_muted;
    }
  }

  const threads = Array.from(byEmail.values());

  // Contacts you can start a NEW conversation with: every client + build email.
  const contactSet = new Set<string>();
  const { data: clients } = await db.from("clients").select("email, business").not("email", "is", null);
  const { data: builds } = await db.from("builds").select("email, business").not("email", "is", null);
  const names = new Map<string, string>();
  for (const c of (clients ?? []) as { email: string; business: string }[]) { if (c.email) { contactSet.add(c.email); if (c.business) names.set(c.email, c.business); } }
  for (const b of (builds ?? []) as { email: string; business: string }[]) { if (b.email) { contactSet.add(b.email); if (b.business && !names.has(b.email)) names.set(b.email, b.business); } }

  const contacts = Array.from(contactSet).map((email) => ({ email, business: names.get(email) ?? null }));

  return NextResponse.json({ threads, contacts });
}
