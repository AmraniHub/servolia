import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { HAND_STEPS, type HandStep } from "@/lib/hostingSetup";
import { supabaseStore, tickHandStep, runSetupCheck, defaultDeps, storedChecklist } from "@/lib/hostingSetupRun";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * The founder's side of the setup checklist. Admin-only.
 *
 *   POST { action: "tick", step: "onboard" | "forms" | "mailbox", done: true | false }
 *   POST { action: "check" }   — run the live checks now (same code as the cron)
 *
 * A tick is the only way a HAND step becomes done: nothing in code can see a
 * client's WordPress form deliver an email, so a person says it did. `done`
 * must be a real boolean — "false" as a string is refused, not read as true.
 * "On our hosting" needs the Vercel project recorded first. An established
 * client (from before the tracker) cannot be ticked; a check on one only
 * measures.
 */
const FAIL: Record<string, { status: number; hint?: string }> = {
  "no-column": { status: 503, hint: "Run supabase/2026-09-25-hosting-setup.sql in the Supabase SQL editor first." },
  "needs-vercel-project": { status: 409, hint: "Record the Vercel project in Hosting setup on this page first: the live check is made against it." },
  established: { status: 409, hint: "Established client (before the tracker shipped): the tracker is not used and their row is not changed." },
  "not-found": { status: 404 },
  busy: { status: 409, hint: "Someone else changed it at the same moment. Try again." },
  unchanged: { status: 409 },
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "no-db" }, { status: 503 });
  const body = await req.json().catch(() => ({}));

  if (body?.action === "check") {
    const out = await runSetupCheck(id, defaultDeps(db));
    if (!out.ok) return NextResponse.json({ error: out.reason }, { status: out.reason === "busy" ? 409 : 404 });
    return NextResponse.json({ ok: true, checklist: out.checklist, sent: out.sent, notified: out.notified, stored: out.stored, established: out.established });
  }

  if (body?.action === "tick") {
    const step = String(body?.step ?? "") as HandStep;
    if (!HAND_STEPS.includes(step)) return NextResponse.json({ error: "unknown-step" }, { status: 400 });
    if (typeof body?.done !== "boolean") {
      return NextResponse.json({ error: "done-must-be-boolean", hint: "Send done: true or done: false." }, { status: 400 });
    }
    const out = await tickHandStep(supabaseStore(db), id, step, body.done);
    if (!out.ok) {
      const f = FAIL[out.reason] ?? { status: 409 };
      return NextResponse.json({ error: out.reason, ...(f.hint ? { hint: f.hint } : {}) }, { status: f.status });
    }
    return NextResponse.json({ ok: true, checklist: storedChecklist(out.row) });
  }

  return NextResponse.json({ error: "unknown-action" }, { status: 400 });
}
