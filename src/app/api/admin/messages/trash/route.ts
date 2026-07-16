import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/** Every thread with at least one message deleted (by admin, client, or both) — never actually gone, just hidden. */
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ threads: [] });

  const { data } = await db
    .from("client_messages")
    .select("email, deleted_by_admin_at, deleted_by_client_at")
    .or("deleted_by_admin_at.not.is.null,deleted_by_client_at.not.is.null");

  type Row = { email: string; deleted_by_admin_at: string | null; deleted_by_client_at: string | null };
  const byEmail = new Map<string, { email: string; deletedByAdmin: number; deletedByClient: number; lastDeletedAt: string }>();
  for (const r of (data as Row[] | null) ?? []) {
    let t = byEmail.get(r.email);
    if (!t) { t = { email: r.email, deletedByAdmin: 0, deletedByClient: 0, lastDeletedAt: "" }; byEmail.set(r.email, t); }
    if (r.deleted_by_admin_at) { t.deletedByAdmin += 1; if (r.deleted_by_admin_at > t.lastDeletedAt) t.lastDeletedAt = r.deleted_by_admin_at; }
    if (r.deleted_by_client_at) { t.deletedByClient += 1; if (r.deleted_by_client_at > t.lastDeletedAt) t.lastDeletedAt = r.deleted_by_client_at; }
  }

  const threads = Array.from(byEmail.values()).sort((a, b) => b.lastDeletedAt.localeCompare(a.lastDeletedAt));
  return NextResponse.json({ threads });
}
