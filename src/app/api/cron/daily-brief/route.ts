import { NextRequest, NextResponse } from "next/server";
import { buildToday, todayAsTelegram } from "@/lib/today";
import { sendTelegramMessage, telegramConfigured } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * The morning message — the same list /admin/today shows, so the two can
 * never disagree. Until 2026-09-22 this read the EUR leads and builds only;
 * a hosting client's failed card or ending trial never reached the morning.
 *
 * Silent when there is nothing to do. A daily "all clear" is how you learn
 * to ignore the bot, and the page is always there.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const today = await buildToday();
  const dateStr = new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "short" });
  const text = todayAsTelegram(today, dateStr);
  if (!text) return NextResponse.json({ ok: true, skipped: "nothing actionable" });

  if (!telegramConfigured()) return NextResponse.json({ ok: true, preview: text });
  /* Plain text: business names and client emails carry underscores, and one
     unmatched underscore in Markdown is a 400 Telegram swallows. Buzz only
     when something is due today. */
  const sent = await sendTelegramMessage(text, undefined, { plain: true, silent: today.counts.urgent === 0 });
  return NextResponse.json({ ok: true, telegram: Boolean(sent), me: today.counts.me, client: today.counts.client, urgent: today.counts.urgent });
}
