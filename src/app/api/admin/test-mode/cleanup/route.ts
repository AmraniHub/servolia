import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { sameOriginRequest } from "@/lib/sameOrigin";
import { planCleanup, applyCleanup, planView, restClient, sameSelection, CleanupRefused } from "@/lib/testCleanup";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * THE TEST-MODE CLEANUP, RUN ON THE SERVER (src/lib/testCleanup.ts).
 *
 * The owner's laptop has no SUPABASE_SERVICE_ROLE_KEY and must never be
 * given one, so scripts/test-mode-cleanup.mjs cannot run there. This route
 * runs the same logic where the key already lives. The button is on
 * /admin/settings, under the Test mode card.
 *
 *   POST { apply: false }
 *     Dry run. Every is_test row (clients, builds, hosting_clients, leads),
 *     each re-checked, with a readable label, the notes markers that go with
 *     it, what the database cascades, and the trial rows that get reverted.
 *     `keys` is the identity of that list.
 *   POST { apply: true, expect: keys }
 *     Re-reads and re-checks everything, and deletes ONLY if the fresh list
 *     is exactly `expect` — the rows the admin was shown and confirmed.
 *     Anything different (a new test purchase since, a row gone) is refused
 *     with nothing deleted; look again and confirm the new list.
 *
 * Refusals (409) delete nothing: a selected row not reading is_test ===
 * true, a real row linked to a test row, or a changed list. Never touches
 * Stripe or Vercel. Admin session AND same-origin: it deletes rows.
 */
export async function POST(req: NextRequest) {
  if (!sameOriginRequest(req.headers)) return NextResponse.json({ error: "Cross-origin request refused" }, { status: 403 });
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "Expected JSON" }, { status: 415 });
  }
  const body = (await req.json().catch(() => ({}))) as { apply?: unknown; expect?: unknown };
  const apply = body.apply === true;
  if (apply && !Array.isArray(body.expect)) {
    return NextResponse.json({ error: "Apply needs `expect`: the list you were shown by the dry run" }, { status: 400 });
  }

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) return NextResponse.json({ error: "Supabase is not configured on the server" }, { status: 503 });
  const rest = restClient(url, key);

  try {
    const plan = await planCleanup(rest);
    if (!apply) return NextResponse.json({ ok: true, applied: false, ...planView(plan) });

    if (!sameSelection(plan, body.expect)) {
      throw new CleanupRefused("changed", "The test records changed since you looked (a new test purchase, or one already removed). Nothing was deleted. Find them again and confirm the new list.");
    }
    const result = await applyCleanup(rest, plan);
    const total = Object.values(result.deleted).reduce((n, c) => n + c, 0);
    return NextResponse.json({ ok: true, applied: true, total, ...result });
  } catch (err) {
    if (err instanceof CleanupRefused) {
      return NextResponse.json({ error: err.message, reason: err.reason }, { status: err.reason === "alarm" ? 500 : 409 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Cleanup failed" }, { status: 502 });
  }
}
