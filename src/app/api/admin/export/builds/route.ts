import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { toCsv, csvResponse } from "@/lib/csv";

/** CSV export of all builds — one-time revenue history (deposits/balances). */
export async function GET() {
  if (!(await isAdminAuthed())) return new NextResponse("Unauthorized", { status: 401 });
  const db = supabaseAdmin();
  if (!db) return new NextResponse("DB not configured", { status: 503 });

  const { data } = await db.from("builds").select("*").order("created_at", { ascending: false });

  const headers = ["id", "business", "email", "plan", "plan_name", "total_price", "deposit_paid", "balance_due", "status", "started_at", "delivered_at", "live_at", "created_at"];
  const csv = toCsv(headers, (data ?? []) as Record<string, unknown>[]);
  return csvResponse("builds", csv);
}
