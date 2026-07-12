import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Reactivation & review campaigns — CSV import of a client's dormant contacts,
 * plus status tracking as they're messaged / reply / book.
 */

/** Parse a pasted CSV: optional header row, columns name,phone,email,last_visit,treatment (flexible order via header). */
function parseCsv(csv: string): { name?: string; phone?: string; email?: string; last_visit?: string; treatment?: string }[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const split = (line: string) => line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));

  // Detect header row
  const first = split(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = first.some((c) => /name|nom|phone|tel|email|mail|visit|visite|treatment|soin/.test(c));
  const cols = hasHeader ? first : ["name", "phone", "email", "last_visit", "treatment"];
  const rows = hasHeader ? lines.slice(1) : lines;

  const idx = (patterns: RegExp) => cols.findIndex((c) => patterns.test(c));
  const iName = hasHeader ? idx(/name|nom|prenom|client|patient/) : 0;
  const iPhone = hasHeader ? idx(/phone|tel|mobile|portable|whatsapp/) : 1;
  const iEmail = hasHeader ? idx(/email|mail/) : 2;
  const iVisit = hasHeader ? idx(/visit|visite|last|dernier/) : 3;
  const iTreat = hasHeader ? idx(/treatment|soin|service|traitement/) : 4;

  return rows.map((line) => {
    const c = split(line);
    const get = (i: number) => (i >= 0 && c[i] ? c[i] : undefined);
    return {
      name: get(iName),
      phone: get(iPhone)?.replace(/[^\d+]/g, "") || undefined,
      email: get(iEmail),
      last_visit: get(iVisit),
      treatment: get(iTreat),
    };
  }).filter((r) => r.phone || r.email);
}

export async function GET(req: NextRequest) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const siteSlug = req.nextUrl.searchParams.get("siteSlug");
  let q = db.from("reactivation_contacts").select("*").order("created_at", { ascending: false }).limit(500);
  if (siteSlug) q = q.eq("site_slug", siteSlug);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const { siteSlug, campaign, csv } = await req.json() as { siteSlug: string; campaign?: string; csv: string };
  if (!siteSlug || !csv) return NextResponse.json({ error: "siteSlug and csv required" }, { status: 400 });

  const parsed = parseCsv(csv);
  if (!parsed.length) return NextResponse.json({ error: "No valid rows found (need at least a phone or email per row)" }, { status: 400 });

  const { error } = await db.from("reactivation_contacts").insert(
    parsed.map((r) => ({ ...r, site_slug: siteSlug, campaign: campaign === "review" ? "review" : "reactivation" })),
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: parsed.length });
}

export async function PATCH(req: NextRequest) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const { id, status, booked_value } = await req.json() as { id: string; status: string; booked_value?: number };
  const allowed = ["pending", "contacted", "replied", "booked", "opted_out"];
  if (!id || !allowed.includes(status)) return NextResponse.json({ error: "Invalid update" }, { status: 400 });

  const update: Record<string, unknown> = { status };
  if (status === "contacted") update.contacted_at = new Date().toISOString();
  if (typeof booked_value === "number") update.booked_value = booked_value;

  const { error } = await db.from("reactivation_contacts").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
