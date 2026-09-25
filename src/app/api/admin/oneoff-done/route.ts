import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { markOneOffDone, type OneOffLeadData } from "@/lib/oneOffOrders";

export const runtime = "nodejs";

/**
 * POST /api/admin/oneoff-done { where: "hosting" | "lead", id, session } —
 * the promised one-off work (src/lib/oneOffOrders.ts) was delivered. Stamps
 * `done` on that one order, which takes it off /admin/today. Admin session
 * only; touches nothing but the order named by its checkout session.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { where?: string; id?: string; session?: string };
  const id = typeof body.id === "string" ? body.id.slice(0, 64) : "";
  const session = typeof body.session === "string" ? body.session.slice(0, 200) : "";
  if (!id || !session || (body.where !== "hosting" && body.where !== "lead")) {
    return NextResponse.json({ error: "where (hosting|lead), id and session required" }, { status: 400 });
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const today = new Date().toISOString().slice(0, 10);

  if (body.where === "hosting") {
    const { data: row } = await db.from("hosting_clients").select("notes").eq("id", id).maybeSingle();
    const notes = markOneOffDone((row as { notes?: string | null } | null)?.notes, session);
    if (notes === null) return NextResponse.json({ error: "order not found" }, { status: 404 });
    const { error } = await db.from("hosting_clients").update({ notes }).eq("id", id);
    return error ? NextResponse.json({ error: "write failed" }, { status: 500 }) : NextResponse.json({ ok: true });
  }

  const { data: lead } = await db.from("leads").select("raw_data").eq("id", id).maybeSingle();
  const raw = (lead as { raw_data?: OneOffLeadData | null } | null)?.raw_data;
  if (!raw || raw.type !== "oneoff" || raw.session !== session) return NextResponse.json({ error: "order not found" }, { status: 404 });
  const { error } = await db.from("leads").update({ raw_data: { ...raw, doneAt: raw.doneAt ?? today } }).eq("id", id);
  return error ? NextResponse.json({ error: "write failed" }, { status: 500 }) : NextResponse.json({ ok: true });
}
