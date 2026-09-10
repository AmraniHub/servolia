import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { applyGate } from "@/lib/hostingGate";

export const runtime = "nodejs";

/**
 * The operator finishes a hosting client's setup here.
 *
 * WHY THIS ENDPOINT IS WHAT MAKES SELF-SERVE HOSTING REAL
 *
 * Both the dunning cron and the restore-on-payment path fall back to the
 * client's own row for gate details when the client is not in CLIENT_REFS.
 * Until now nothing could write those columns, so for anyone who bought from
 * the plans page the fallback pointed at null: they could never be paused for
 * non-payment and -- worse -- never restored after paying. This is the write.
 *
 * It also VERIFIES the gate before saving it. Recording a repo the token
 * cannot reach, or one with no site-status.js, would report the client as set
 * up while the cut-off and the restore both silently did nothing. applyGate
 * with suspend=false is a safe probe: it checks the files exist and, if the
 * site is already unsuspended, changes nothing.
 */
const MAX = 300;
const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX) : "");

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "no-db" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const repo = clean(body?.repo);
  const branch = clean(body?.branch) || "main";
  const siteRoot = clean(body?.siteRoot);
  const vercelProject = clean(body?.vercelProject);
  const siteUrl = clean(body?.siteUrl);
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 4000) : "";

  if (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return NextResponse.json({ error: "repo must look like owner/name" }, { status: 400 });
  }

  /* Probe the gate before trusting it. A saved repo that cannot be gated is
     worse than an empty one: the empty one shows "needs setup"; the wrong one
     shows "set up" and does nothing on the day it matters. */
  let gate: { ok: boolean; detail: string } = { ok: false, detail: "no repo given" };
  if (repo) {
    const outcome = await applyGate({ repo, branch, siteRoot: siteRoot || null, gateWidget: null }, false);
    gate = outcome.ok
      ? { ok: true, detail: `${outcome.kind} gate reachable` }
      : { ok: false, detail: `${outcome.reason}${outcome.detail ? ` (${outcome.detail})` : ""}` };
    if (!outcome.ok && body?.force !== true) {
      return NextResponse.json(
        { error: "gate-unreachable", detail: gate.detail, hint: "Install site-status.js + middleware.js in that repo, or check GH_TOKEN can see it. Pass force:true to save anyway." },
        { status: 409 },
      );
    }
  }

  const { error } = await db
    .from("hosting_clients")
    .update({
      repo: repo || null,
      branch,
      site_root: siteRoot || null,
      vercel_project: vercelProject || null,
      ...(siteUrl ? { site_url: siteUrl } : {}),
      ...(notes ? { notes } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, gate });
}
