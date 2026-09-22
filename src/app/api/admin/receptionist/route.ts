import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { endReceptionistTrial, removeReceptionist } from "@/lib/receptionistTrial";

export const runtime = "nodejs";

/**
 * POST /api/admin/receptionist { slug, action: "end" | "remove" } — the
 * founder's hand on a public trial (src/lib/receptionistTrial.ts).
 *
 *   end     the widget goes quiet now and no day-5 / day-7 email follows
 *   remove  the unpaid receptionist is deleted (a spam draft, a finished test)
 *
 * Admin session only. A paid receptionist is refused by both: that one ends
 * by cancelling its Stripe subscription, which switches it off by itself.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { slug?: string; action?: string };
  const slug = typeof body.slug === "string" ? body.slug.slice(0, 60) : "";
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const out = body.action === "remove" ? await removeReceptionist(slug)
    : body.action === "end" ? await endReceptionistTrial(slug)
    : null;
  if (!out) return NextResponse.json({ error: "action must be end or remove" }, { status: 400 });
  const status = out === "ok" ? 200 : out === "not-found" ? 404 : out === "paid" ? 409 : 500;
  return NextResponse.json({ ok: out === "ok", result: out }, { status });
}
