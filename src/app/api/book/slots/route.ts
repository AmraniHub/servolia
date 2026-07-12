import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateSlots } from "@/lib/booking";

export const runtime = "nodejs";

/** Public: available discovery-call slots, grouped by day. */
export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang") === "en" ? "en" : "fr";

  let booked: string[] = [];
  const db = supabaseAdmin();
  if (db) {
    const { data } = await db
      .from("bookings")
      .select("slot_start")
      .neq("status", "cancelled")
      .gte("slot_start", new Date().toISOString());
    booked = (data ?? []).map((r: { slot_start: string }) => new Date(r.slot_start).toISOString());
  }

  const slots = generateSlots(booked, lang);

  // Group by day for the picker
  const days: { key: string; label: string; slots: { iso: string; label: string }[] }[] = [];
  for (const s of slots) {
    let day = days.find((d) => d.key === s.dayKey);
    if (!day) {
      day = { key: s.dayKey, label: s.dayLabel, slots: [] };
      days.push(day);
    }
    day.slots.push({ iso: s.iso, label: s.label });
  }

  return NextResponse.json({ days });
}
