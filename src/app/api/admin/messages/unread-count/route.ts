import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/** Read-only count for the sidebar badge — never marks anything as read. */
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ count: 0 });

  const { count } = await db
    .from("client_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender", "client")
    .eq("read_by_admin", false)
    .is("deleted_by_admin_at", null);

  return NextResponse.json({ count: count ?? 0 });
}
