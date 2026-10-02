import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { sameOriginRequest } from "@/lib/sameOrigin";
import { supabaseAdmin } from "@/lib/supabase";
import { loadReceptionist, receptionistPhase } from "@/lib/receptionistTrial";

/**
 * Correct the practice name on a DRAFTED receptionist before outreach.
 *
 * Why (2026-10-02, Lyon batch 2): the name is read from the homepage title,
 * and many practice sites title themselves "Dentiste à Bron" or
 * "DR ATTIA CORINNE". The preview greets the dentist by that name, so a wrong
 * one in a cold email looks careless. This changes businessName, the
 * headline, and the old name wherever the description repeats it.
 *
 * Drafts only: once a practice has started its trial the receptionist is
 * live on her site and its name is hers to change, not ours.
 *
 * POST { slug, name }
 */
export async function POST(req: NextRequest) {
  if (!sameOriginRequest(req.headers)) return NextResponse.json({ error: "Cross-origin request refused" }, { status: 403 });
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const slug = String(body.slug ?? "").trim();
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
  if (!slug || name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: "slug and a name of 2-80 characters are required" }, { status: 400 });
  }

  const row = await loadReceptionist(slug);
  if (!row) return NextResponse.json({ error: "No receptionist with that slug" }, { status: 404 });
  const phase = receptionistPhase(row.config.receptionist);
  if (phase !== "draft") {
    return NextResponse.json({ error: `This receptionist is ${phase}: only drafts are renamed here` }, { status: 409 });
  }

  const old = row.config.businessName ?? "";
  const swap = (s: string | undefined) => (s && old ? s.split(old).join(name) : s);
  const config = {
    ...row.config,
    businessName: name,
    heroHeadline: name,
    about: swap(row.config.about),
    heroSub: swap(row.config.heroSub),
  };
  const { error } = await db.from("client_sites").update({ config, business: name }).eq("id", row.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, slug: row.slug, from: old, to: name });
}
