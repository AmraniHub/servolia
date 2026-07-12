import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { slugify } from "@/lib/clientSites";
import { listCaseStudies } from "@/lib/caseStudies";

export const runtime = "nodejs";

/** Admin CRUD for real case studies. */

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ caseStudies: await listCaseStudies() });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const business = String(b.business ?? "").trim();
  const headline = String(b.headline ?? "").trim();
  if (!business || !headline) return NextResponse.json({ error: "Business and headline required" }, { status: 400 });

  const base = slugify(business);
  let slug = base;
  const { data: clash } = await db.from("case_studies").select("id").eq("slug", slug).maybeSingle();
  if (clash) slug = `${base}-${Math.random().toString(36).slice(2, 5)}`;

  const metrics = Array.isArray(b.metrics)
    ? (b.metrics as { label?: string; value?: string }[])
        .map((m) => ({ label: String(m.label ?? "").slice(0, 40), value: String(m.value ?? "").slice(0, 20) }))
        .filter((m) => m.label && m.value)
        .slice(0, 6)
    : [];

  const { data, error } = await db.from("case_studies").insert({
    slug,
    business,
    headline,
    published: !!b.published,
    featured: !!b.featured,
    niche: b.niche ?? null,
    city: b.city ?? null,
    accent: b.accent ?? "#36671E",
    summary: b.summary ?? null,
    challenge: b.challenge ?? null,
    solution: b.solution ?? null,
    metrics,
    quote: b.quote ?? null,
    quote_author: b.quoteAuthor ?? null,
    plan: b.plan ?? null,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, slug });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id ?? "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const update: Record<string, unknown> = {};
  for (const k of ["published", "featured", "headline", "summary", "challenge", "solution", "quote", "plan", "city", "niche", "accent", "sort"]) {
    if (b[k] !== undefined) update[k] = b[k];
  }
  if (b.quoteAuthor !== undefined) update.quote_author = b.quoteAuthor;
  if (Array.isArray(b.metrics)) {
    update.metrics = (b.metrics as { label?: string; value?: string }[])
      .map((m) => ({ label: String(m.label ?? "").slice(0, 40), value: String(m.value ?? "").slice(0, 20) }))
      .filter((m) => m.label && m.value).slice(0, 6);
  }

  const { error } = await db.from("case_studies").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.from("case_studies").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
