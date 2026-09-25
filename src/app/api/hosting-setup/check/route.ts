import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { readUpgradeToken } from "@/lib/upgrade";
import { clientSession } from "@/lib/clientAreaAuth";
import { rateLimited, clientIp } from "@/lib/security";
import { loadSetupRow, runSetupCheck, defaultDeps } from "@/lib/hostingSetupRun";
import { isEstablished } from "@/lib/hostingSetup";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * "Check again" on the client's service page: re-runs the live checks behind
 * their setup checklist (DNS, certificate, HTTP) and answers with the result.
 *
 * Same credential as the page itself — the signed link, or a signed-in
 * session — so nobody can make us probe a domain that is not on a paid row.
 *
 * RATE-LIMITED, because each call is several DNS lookups, a TLS handshake and
 * a fetch of the client's site: 4 per subscription per 10 minutes (the cron
 * checks every 15 anyway), 20 per IP per hour. The limit is taken before the
 * row is read, so a refused call costs nothing.
 *
 * A milestone reached here is announced here: the email and the founder's
 * alert go out from this request exactly as they would from the cron, once.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";
  const subId = (token ? await readUpgradeToken(token) : null) || (await clientSession().catch(() => null));
  if (!subId) return NextResponse.json({ ok: false, error: "invalid-link" }, { status: 401 });

  if (
    (await rateLimited(`setup-check:${subId}`, 4, 600)) ||
    (await rateLimited(`setup-check-ip:${clientIp(req.headers)}`, 20, 3600))
  ) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429, headers: { "Retry-After": "600" } });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "no-db" }, { status: 503 });
  const row = await loadSetupRow(db, { subscriptionId: subId });
  if (!row) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  // An established client has no tracker (their page shows none): nothing to re-check.
  if (isEstablished(row)) return NextResponse.json({ ok: false, error: "not-tracked" }, { status: 404 });

  const lang = body?.lang === "fr" ? "fr" : "en";
  const out = await runSetupCheck(row.id, defaultDeps(db), lang);
  if (!out.ok) {
    return NextResponse.json({ ok: false, error: out.reason }, { status: out.reason === "busy" ? 409 : 404 });
  }
  return NextResponse.json({ ok: true, checklist: out.checklist, stored: out.stored });
}
