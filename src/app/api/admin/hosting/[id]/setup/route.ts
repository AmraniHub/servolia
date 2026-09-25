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
 *   POST { action: "tick",   step: "onboard" | "forms" | "mailbox", done: boolean }
 *   POST { action: "check" }   — run the live checks now (same code as the cron)
 *
 * A tick is the only way a HAND step becomes done: nothing in code can see a
 * client's WordPress form deliver an email, so a person says it did. The
 * client's page shows it as "We're doing this" until then.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "no-db" }, { status: 503 });
  const body = await req.json().catch(() => ({}));

  if (body?.action === "check") {
    const out = await runSetupCheck(id, defaultDeps(db));
    if (!out.ok) return NextResponse.json({ error: out.reason }, { status: out.reason === "busy" ? 409 : 404 });
    return NextResponse.json({ ok: true, checklist: out.checklist, sent: out.sent, notified: out.notified, stored: out.stored });
  }

  if (body?.action === "tick") {
    const step = String(body?.step ?? "") as HandStep;
    if (!HAND_STEPS.includes(step)) return NextResponse.json({ error: "unknown-step" }, { status: 400 });
    const out = await tickHandStep(supabaseStore(db), id, step, body?.done !== false);
    if (!out.ok) {
      if (out.reason === "no-column") {
        return NextResponse.json({ error: "no-column", hint: "Run supabase/2026-09-25-hosting-setup.sql in the Supabase SQL editor first." }, { status: 503 });
      }
      return NextResponse.json({ error: out.reason }, { status: out.reason === "not-found" ? 404 : 409 });
    }
    return NextResponse.json({ ok: true, checklist: storedChecklist(out.row) });
  }

  return NextResponse.json({ error: "unknown-action" }, { status: 400 });
}
