import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import {
  IDEA_STATUSES, IDEA_PRIORITIES, IDEA_CATEGORIES, seedFromRoadmap, type Idea,
} from "@/lib/ideas";

export const runtime = "nodejs";

/**
 * The ideas board. Admin-only on EVERY verb including GET — the board holds
 * unshipped plans and pricing strategy, so hiding the nav link would do
 * nothing to stop a direct call.
 *
 * GET     → { items, tableMissing }
 * POST    → create a card, or { seed: true } to import roadmap.ts once
 * PATCH   → { id, ...fields } move/edit a card
 * DELETE  → { id }
 */

async function guard() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

export async function GET() {
  const denied = await guard();
  if (denied) return denied;

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ items: [], tableMissing: false, noDb: true });

  const { data, error } = await db
    .from("ideas")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  // The table is created by supabase/pending-migration.sql. Until that runs
  // the board explains itself rather than showing a broken page.
  if (error) return NextResponse.json({ items: [], tableMissing: true });

  return NextResponse.json({ items: (data as Idea[]) ?? [], tableMissing: false });
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // ── Import everything outstanding from roadmap.ts, once ────────────────
  // upsert on external_key so pressing it twice is harmless.
  if (body.seed === true) {
    const rows = seedFromRoadmap();
    const { error } = await db.from("ideas").upsert(rows, {
      onConflict: "external_key",
      ignoreDuplicates: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, imported: rows.length });
  }

  const title = str(body.title, 200);
  if (!title || title.length < 3) {
    return NextResponse.json({ error: "Give it a title (3 characters minimum)." }, { status: 400 });
  }

  const category = IDEA_CATEGORIES.includes(body.category as never) ? body.category : "feature";
  const priority = IDEA_PRIORITIES.includes(body.priority as never) ? body.priority : "medium";
  const status = IDEA_STATUSES.includes(body.status as never) ? body.status : "idea";

  const { data, error } = await db.from("ideas").insert({
    title,
    description: str(body.description, 4000),
    needs: str(body.needs, 500),
    category, priority, status,
    source: "founder",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (IDEA_STATUSES.includes(body.status as never)) update.status = body.status;
  if (IDEA_PRIORITIES.includes(body.priority as never)) update.priority = body.priority;
  if (IDEA_CATEGORIES.includes(body.category as never)) update.category = body.category;
  if (typeof body.title === "string" && body.title.trim()) update.title = body.title.slice(0, 200);
  if ("description" in body) update.description = str(body.description, 4000);
  if ("needs" in body) update.needs = str(body.needs, 500);
  if ("notes" in body) update.notes = str(body.notes, 4000);

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await db.from("ideas").update(update).eq("id", body.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await db.from("ideas").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
