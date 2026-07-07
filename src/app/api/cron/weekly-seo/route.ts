import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";
import { runReport, ga4Configured, type RunReportResult } from "@/lib/ga4";

export const runtime = "nodejs";
export const maxDuration = 30;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const ORGANIC_FILTER = {
  filter: {
    fieldName: "sessionDefaultChannelGroup",
    stringFilter: { matchType: "EXACT", value: "Organic Search" },
  },
};

function totalMetric(result: RunReportResult | null): number {
  const v = result?.rows?.[0]?.metricValues?.[0]?.value;
  return v ? Number(v) : 0;
}

function delta(curr: number, prev: number): string {
  if (prev === 0) return curr > 0 ? "▲ new" : "–";
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct === 0) return "→ 0%";
  return pct > 0 ? `▲ +${pct}%` : `▼ ${pct}%`;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!ga4Configured()) {
    await sendTelegramMessage(
      "🔎 *Weekly SEO report* — GA4 not connected yet.\n\nAdd `GOOGLE_SERVICE_ACCOUNT_KEY` + `GA4_PROPERTY_ID` in Vercel to enable this report."
    );
    return NextResponse.json({ ok: true, reason: "GA4 not configured" });
  }

  const today = new Date();
  const start28 = new Date(today); start28.setDate(start28.getDate() - 28);
  const start56 = new Date(today); start56.setDate(start56.getDate() - 56);
  const prevEnd = new Date(start28); prevEnd.setDate(prevEnd.getDate() - 1);

  const [current, previous, landingPages, blogPages, countries, channels] = await Promise.all([
    runReport({
      dateRanges: [{ startDate: isoDate(start28), endDate: isoDate(today) }],
      metrics: [{ name: "sessions" }],
      dimensionFilter: ORGANIC_FILTER,
    }),
    runReport({
      dateRanges: [{ startDate: isoDate(start56), endDate: isoDate(prevEnd) }],
      metrics: [{ name: "sessions" }],
      dimensionFilter: ORGANIC_FILTER,
    }),
    runReport({
      dateRanges: [{ startDate: isoDate(start28), endDate: isoDate(today) }],
      dimensions: [{ name: "landingPage" }],
      metrics: [{ name: "sessions" }],
      dimensionFilter: ORGANIC_FILTER,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 5,
    }),
    runReport({
      dateRanges: [{ startDate: isoDate(start28), endDate: isoDate(today) }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            ORGANIC_FILTER,
            { filter: { fieldName: "pagePath", stringFilter: { matchType: "CONTAINS", value: "/blog/" } } },
          ],
        },
      },
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 5,
    }),
    runReport({
      dateRanges: [{ startDate: isoDate(start28), endDate: isoDate(today) }],
      dimensions: [{ name: "country" }],
      metrics: [{ name: "sessions" }],
      dimensionFilter: ORGANIC_FILTER,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 5,
    }),
    runReport({
      dateRanges: [{ startDate: isoDate(start28), endDate: isoDate(today) }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 6,
    }),
  ]);

  const currSessions = totalMetric(current);
  const prevSessions = totalMetric(previous);

  let msg = `🔎 *Weekly SEO Report*\n\n`;
  msg += `Organic sessions (28d): *${currSessions}* ${delta(currSessions, prevSessions)} vs prior 28d\n\n`;

  const lp = landingPages?.rows ?? [];
  if (lp.length) {
    msg += `📍 *Top landing pages (organic):*\n`;
    lp.forEach((r) => { msg += `• ${r.dimensionValues?.[0]?.value ?? "?"} — ${r.metricValues?.[0]?.value ?? 0}\n`; });
    msg += "\n";
  }

  const bp = blogPages?.rows ?? [];
  if (bp.length) {
    msg += `📝 *Top blog pages (organic):*\n`;
    bp.forEach((r) => { msg += `• ${r.dimensionValues?.[0]?.value ?? "?"} — ${r.metricValues?.[0]?.value ?? 0} views\n`; });
    msg += "\n";
  } else {
    msg += `📝 Blog pages: no organic traffic yet — keep publishing.\n\n`;
  }

  const co = countries?.rows ?? [];
  if (co.length) {
    msg += `🌍 *Top countries (organic):*\n`;
    co.forEach((r) => { msg += `• ${r.dimensionValues?.[0]?.value ?? "?"} — ${r.metricValues?.[0]?.value ?? 0}\n`; });
    msg += "\n";
  }

  const ch = channels?.rows ?? [];
  if (ch.length) {
    msg += `📡 *Traffic by channel:*\n`;
    ch.forEach((r) => { msg += `• ${r.dimensionValues?.[0]?.value ?? "?"} — ${r.metricValues?.[0]?.value ?? 0}\n`; });
  }

  await sendTelegramMessage(msg);
  return NextResponse.json({ ok: true, currSessions, prevSessions });
}
