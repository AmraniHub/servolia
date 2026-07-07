import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

export async function GET() {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json({
      kpis: { leads_30d: 0, leads_7d: 0, awaiting_response: 0, qualified: 0,
              active_builds: 0, live_clients: 0, mrr: 0, deposits_30d: 0 },
      configured: false,
    });
  }
  const { data, error } = await db.from("crm_kpis").select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ kpis: data, configured: true });
}
