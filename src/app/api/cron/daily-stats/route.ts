import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";
import { runReport, ga4Configured } from "@/lib/ga4";

export const runtime = "nodejs";
export const maxDuration = 30;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function metric(result: { rows?: { metricValues?: { value: string }[] }[] } | null, idx: number): number {
  const v = result?.rows?.[0]?.metricValues?.[idx]?.value;
  return v ? Number(v) : 0;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!ga4Configured()) {
    await sendTelegramMessage(
      "📊 *Daily stats* — GA4 not connected yet.\n\nAdd `GOOGLE_SERVICE_ACCOUNT_KEY` + `GA4_PROPERTY_ID` in Vercel to enable this report."
    );
    return NextResponse.json({ ok: true, reason: "GA4 not configured" });
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [yesterdayReport, weekReport, countryReport, pageReport] = await Promise.all([
    runReport({
      dateRanges: [{ startDate: isoDate(yesterday), endDate: isoDate(yesterday) }],
      metrics: [{ name: "totalUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "bounceRate" }, { name: "averageSessionDuration" }],
    }),
    runReport({
      dateRanges: [{ startDate: isoDate(weekAgo), endDate: isoDate(today) }],
      metrics: [{ name: "totalUsers" }, { name: "sessions" }],
    }),
    runReport({
      dateRanges: [{ startDate: isoDate(weekAgo), endDate: isoDate(today) }],
      dimensions: [{ name: "country" }],
      metrics: [{ name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
      limit: 3,
    }),
    runReport({
      dateRanges: [{ startDate: isoDate(weekAgo), endDate: isoDate(today) }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 3,
    }),
  ]);

  const db = supabaseAdmin();
  let leadsWeek = 0;
  if (db) {
    const { count } = await db.from("leads").select("id", { count: "exact", head: true }).gte("created_at", weekAgo.toISOString());
    leadsWeek = count ?? 0;
  }

  const users = metric(yesterdayReport, 0);
  const sessions = metric(yesterdayReport, 1);
  const pageviews = metric(yesterdayReport, 2);
  const bounce = metric(yesterdayReport, 3);
  const avgDuration = metric(yesterdayReport, 4);

  const weekUsers = metric(weekReport, 0);
  const weekSessions = metric(weekReport, 1);

  const dateStr = yesterday.toLocaleDateString("en", { weekday: "long", day: "numeric", month: "short" });

  let msg = `📊 *Servolia Traffic — ${dateStr}*\n\n`;
  msg += `👥 Users: *${users}* · Sessions: *${sessions}* · Views: *${pageviews}*\n`;
  msg += `⏱️ Avg session: ${Math.round(avgDuration)}s · Bounce: ${Math.round(bounce * 100)}%\n\n`;
  msg += `📅 *Last 7 days:* ${weekUsers} users, ${weekSessions} sessions, *${leadsWeek} leads*\n\n`;

  const countries = countryReport?.rows ?? [];
  if (countries.length) {
    msg += `🌍 *Top countries:*\n`;
    countries.forEach((r) => {
      msg += `• ${r.dimensionValues?.[0]?.value ?? "?"} — ${r.metricValues?.[0]?.value ?? 0}\n`;
    });
    msg += "\n";
  }

  const pages = pageReport?.rows ?? [];
  if (pages.length) {
    msg += `📄 *Top pages (7d):*\n`;
    pages.forEach((r) => {
      msg += `• ${r.dimensionValues?.[0]?.value ?? "?"} — ${r.metricValues?.[0]?.value ?? 0} views\n`;
    });
  }

  await sendTelegramMessage(msg);
  return NextResponse.json({ ok: true, users, sessions, pageviews, leadsWeek });
}
