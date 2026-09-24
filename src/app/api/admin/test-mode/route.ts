import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, getCookieName } from "@/lib/auth";
import { testModeAvailable } from "@/lib/stripeMode";
import { TEST_COOKIE, TEST_HOURS, TEST_UI_COOKIE, signTestCookie, testModeUntil } from "@/lib/testMode";

export const runtime = "nodejs";

/**
 * Founder test mode, switched on or off for THIS browser (src/lib/testMode.ts).
 *
 *   GET                  → { on, until, available } (401 unless admin — the
 *                          TEST MODE pill asks here, so it shows only when the
 *                          signed cookie AND the admin session both check out)
 *   POST { on: true }    → sets sv_test (signed, 8 hours) + sv_test_ui
 *   POST { on: false }   → clears both
 *
 * Admin-only, like every /api/admin route. The cookie is httpOnly, Secure in
 * production and SameSite=Lax — Lax so it survives the redirect back from
 * Stripe's checkout to our thank-you pages.
 */

function status(req: NextRequest) {
  const until = testModeUntil(req.cookies);
  return { on: until !== null, until: until ? new Date(until).toISOString() : null, available: testModeAvailable() };
}

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(status(req));
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { on } = (await req.json().catch(() => ({}))) as { on?: boolean };
  const secure = process.env.NODE_ENV === "production";

  if (on === true) {
    const exp = Date.now() + TEST_HOURS * 3600_000;
    const res = NextResponse.json({ on: true, until: new Date(exp).toISOString(), available: testModeAvailable() });
    const maxAge = TEST_HOURS * 3600;
    // Bound to THIS admin session: logging out or its expiry ends test mode.
    const adminToken = req.cookies.get(getCookieName())?.value ?? "";
    res.cookies.set(TEST_COOKIE, signTestCookie(exp, adminToken), { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge });
    res.cookies.set(TEST_UI_COOKIE, "1", { httpOnly: false, secure, sameSite: "lax", path: "/", maxAge });
    return res;
  }

  const res = NextResponse.json({ on: false, until: null, available: testModeAvailable() });
  res.cookies.set(TEST_COOKIE, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
  res.cookies.set(TEST_UI_COOKIE, "", { httpOnly: false, secure, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
