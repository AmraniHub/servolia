import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { buildToday } from "@/lib/today";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/admin/today — the same list /admin/today renders, as JSON.
 *
 * Two ways in: the admin session (a browser), or `Authorization: Bearer
 * CRON_SECRET` (a script — Qarun pulling today's Servolia missions onto the
 * wallpaper, or the daily brief). Read-only.
 */
export async function GET(req: NextRequest) {
  const bearer = req.headers.get("authorization");
  const viaSecret = Boolean(process.env.CRON_SECRET) && bearer === `Bearer ${process.env.CRON_SECRET}`;
  if (!viaSecret && !(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const today = await buildToday();
  return NextResponse.json(today, { headers: { "Cache-Control": "no-store" } });
}
