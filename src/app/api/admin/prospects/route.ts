import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Outbound prospecting pipeline — cold dental-clinic targets + mystery-shop tracking.
 * GET list, POST import (CSV), PATCH update (status / touch / demo link / notes).
 */

export const PROSPECT_STAGES = [
  "to_contact", "mystery_shopped", "demo_sent", "followup_1",
  "followup_2", "replied", "call_booked", "won", "lost",
] as const;

interface ParsedProspect {
  business?: string; owner_name?: string; city?: string;
  phone?: string; email?: string; instagram?: string; website?: string;
}

function parseCsv(csv: string): ParsedProspect[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const split = (l: string) => l.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));

  const first = split(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = first.some((c) => /business|clinic|cabinet|name|nom|phone|tel|email|insta|web|city|ville/.test(c));
  const cols = hasHeader ? first : ["business", "owner_name", "city", "phone", "email", "instagram", "website"];
  const rows = hasHeader ? lines.slice(1) : lines;

  const idx = (re: RegExp) => cols.findIndex((c) => re.test(c));
  const iBiz = hasHeader ? idx(/business|clinic|cabinet|practice|name|nom/) : 0;
  const iOwner = hasHeader ? idx(/owner|dr|dentist|contact|responsable/) : 1;
  const iCity = hasHeader ? idx(/city|ville|town/) : 2;
  const iPhone = hasHeader ? idx(/phone|tel|mobile/) : 3;
  const iEmail = hasHeader ? idx(/email|mail/) : 4;
  const iInsta = hasHeader ? idx(/insta|ig/) : 5;
  const iWeb = hasHeader ? idx(/web|site|url/) : 6;

  return rows.map((line) => {
    const c = split(line);
    const g = (i: number) => (i >= 0 && c[i] ? c[i] : undefined);
    return {
      business: g(iBiz),
      owner_name: g(iOwner),
      city: g(iCity),
      phone: g(iPhone)?.replace(/[^\d+]/g, "") || undefined,
      email: g(iEmail),
      instagram: g(iInsta),
      website: g(iWeb),
    };
  }).filter((p) => p.business);
}

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const status = req.nextUrl.searchParams.get("status");
  let q = db.from("prospects").select("*").order("updated_at", { ascending: false }).limit(1000);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prospects: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { csv?: string; niche?: string; one?: ParsedProspect };
  const niche = body.niche || "dental";

  // Single manual add
  if (body.one?.business) {
    const { error } = await db.from("prospects").insert({ ...body.one, niche });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ imported: 1 });
  }

  const parsed = parseCsv(body.csv ?? "");
  if (!parsed.length) return NextResponse.json({ error: "No valid rows (each needs at least a business name)" }, { status: 400 });

  const { error } = await db.from("prospects").insert(parsed.map((p) => ({ ...p, niche })));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: parsed.length });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as {
    id?: string; status?: string; notes?: string; demo_slug?: string;
    mystery_shop_notes?: string; logTouch?: boolean; next_action_at?: string | null;
  };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.status && (PROSPECT_STAGES as readonly string[]).includes(body.status)) update.status = body.status;
  if (typeof body.notes === "string") update.notes = body.notes;
  if (typeof body.demo_slug === "string") update.demo_slug = body.demo_slug;
  if (typeof body.mystery_shop_notes === "string") update.mystery_shop_notes = body.mystery_shop_notes;
  if (body.next_action_at !== undefined) update.next_action_at = body.next_action_at;

  if (body.logTouch) {
    update.last_touch_at = new Date().toISOString();
    const { data: cur } = await db.from("prospects").select("touch_count").eq("id", body.id).maybeSingle();
    update.touch_count = ((cur as { touch_count?: number } | null)?.touch_count ?? 0) + 1;
  }

  const { error } = await db.from("prospects").update(update).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.from("prospects").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
