import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { toCsv, csvResponse } from "@/lib/csv";

/**
 * CSV export of the outbound prospect list — a mapped, scored target market
 * (business asset), NOT a marketing-consent list. See /admin/data-room for
 * the collection-basis note before sharing this externally.
 */
export async function GET() {
  if (!(await isAdminAuthed())) return new NextResponse("Unauthorized", { status: 401 });
  const db = supabaseAdmin();
  if (!db) return new NextResponse("DB not configured", { status: 503 });

  const { data } = await db.from("prospects").select("*").order("updated_at", { ascending: false });

  const headers = ["id", "business", "owner_name", "city", "niche", "phone", "email", "instagram", "website", "status", "touch_count", "last_touch_at", "value_estimate", "created_at"];
  const csv = toCsv(headers, (data ?? []) as Record<string, unknown>[]);
  return csvResponse("prospects", csv);
}
