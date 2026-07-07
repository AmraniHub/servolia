import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const ROUTES: Record<string, string> = {
  blog: "/api/cron/generate-blog",
  linkedin: "/api/cron/generate-linkedin",
  stats: "/api/cron/daily-stats",
  seo: "/api/cron/weekly-seo",
};

/** Manually fire a generation/report job from the CRM UI. Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { job } = (await req.json().catch(() => ({}))) as { job?: string };
  const path = job ? ROUTES[job] : undefined;
  if (!path) return NextResponse.json({ error: "Unknown job" }, { status: 400 });

  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });

  const res = await fetch(`https://servolia.com${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
