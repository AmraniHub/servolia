import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/** Diagnostic: returns the most recent build + lead, for verifying a webhook fired correctly. */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, reason: "DB not configured" });

  const { data: builds } = await db
    .from("builds")
    .select("id, business, email, plan, plan_name, total_price, deposit_paid, balance_due, status, checkout_session_id, customer_id, created_at, started_at")
    .order("created_at", { ascending: false })
    .limit(3);

  const { data: leads } = await db
    .from("leads")
    .select("id, business, email, stage, source, created_at")
    .order("created_at", { ascending: false })
    .limit(3);

  return NextResponse.json({ ok: true, builds, leads });
}
