import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

/**
 * CSV export of all leads. Useful for spreadsheet analysis or migration.
 */
export async function GET() {
  if (!await isAdminAuthed()) return new NextResponse("Unauthorized", { status: 401 });
  const db = supabaseAdmin();
  if (!db) return new NextResponse("DB not configured", { status: 503 });

  const { data: leads } = await db.from("leads").select("*").order("created_at", { ascending: false });

  const headers = ["id","created_at","business","name","email","phone","country","city","niche","source","stage","value_estimate","plan_interest","website","language"];
  const rows = (leads ?? []).map(l => headers.map(h => {
    const v = (l as Record<string, unknown>)[h];
    if (v == null) return "";
    const str = String(v).replace(/"/g, '""');
    return /[,"\n]/.test(str) ? `"${str}"` : str;
  }).join(","));
  const csv = [headers.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="servolia-leads-${new Date().toISOString().slice(0,10)}.csv"`,
    },
  });
}
