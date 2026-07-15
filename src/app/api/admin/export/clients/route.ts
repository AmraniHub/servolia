import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { toCsv, csvResponse } from "@/lib/csv";

/** CSV export of all client subscriptions — revenue/retention diligence. */
export async function GET() {
  if (!(await isAdminAuthed())) return new NextResponse("Unauthorized", { status: 401 });
  const db = supabaseAdmin();
  if (!db) return new NextResponse("DB not configured", { status: 503 });

  const { data } = await db.from("clients").select("*").order("started_at", { ascending: false });

  const headers = ["id", "business", "email", "plan", "monthly_amount", "status", "started_at", "churned_at", "churn_reason", "created_at"];
  const csv = toCsv(headers, (data ?? []) as Record<string, unknown>[]);
  return csvResponse("clients", csv);
}
