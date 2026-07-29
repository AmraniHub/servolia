import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage, telegramConfigured } from "@/lib/telegram";
import { scanAllSites, monthKey, ZERO_MISS_THRESHOLD_MS } from "@/lib/zeroMiss";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ZERO-MISS WATCHDOG — daily.
 *
 * The CGV (section 4 bis) refund a client's whole month if a single enquiry
 * goes unanswered past 60 seconds. A guarantee that only pays when the
 * customer happens to notice is worth less than no guarantee at all: the one
 * silent failure is exactly the one that ends the relationship. So this runs
 * every day and tells the founder FIRST.
 *
 * Alerting policy, deliberately noisy in one direction only:
 *   - a breach          → LOUD Telegram (this is money and trust)
 *   - unmeasured replies → LOUD once, because it means the guarantee cannot
 *                          currently be proven, which is its own emergency
 *   - all clear          → silent; nothing is sent
 *
 * That last rule matters — the founder already asked for less Telegram noise,
 * and a daily "everything is fine" is precisely the message that trains you to
 * stop reading the channel where the real alert will arrive.
 *
 * Scheduled: GitHub Actions, daily. Auth: Bearer CRON_SECRET.
 */

function authed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const month = monthKey(new Date());
  const reports = await scanAllSites(month);

  const breached = reports.filter((r) => r.misses.length > 0);
  // Only worth shouting about when a site has activity we cannot verify at all.
  const blind = reports.filter((r) => r.measured === 0 && r.unmeasured > 0);

  if (telegramConfigured() && breached.length > 0) {
    const lines = breached.map((r) => {
      const worst = r.misses.reduce((a, b) => (b.ms > a.ms ? b : a));
      return `• *${r.siteSlug}* — ${r.misses.length} miss${r.misses.length === 1 ? "" : "es"}, worst ${seconds(worst.ms)}`;
    });
    await sendTelegramMessage(
      `🚨 *ZERO-MISS BREACH — ${month}*\n` +
      `The 60s guarantee was missed. Per CGV 4 bis these clients are owed this month's plan fee.\n\n` +
      lines.join("\n") +
      `\n\n[Open clients](https://servolia.com/admin/clients)`,
    );
  }

  if (telegramConfigured() && blind.length > 0) {
    await sendTelegramMessage(
      `⚠️ *Zero-Miss unverifiable — ${month}*\n` +
      `${blind.length} site${blind.length === 1 ? " has" : "s have"} replies with no recorded latency, so the guarantee cannot be proven for ${blind.length === 1 ? "it" : "them"}: ` +
      blind.map((r) => r.siteSlug).join(", ") +
      `\nUsually means the sessions predate response-time recording.`,
      undefined,
      { silent: true },
    );
  }

  return NextResponse.json({
    month,
    thresholdMs: ZERO_MISS_THRESHOLD_MS,
    sitesScanned: reports.length,
    breached: breached.map((r) => ({ site: r.siteSlug, misses: r.misses.length, slowestMs: r.slowestMs })),
    unverifiable: blind.map((r) => r.siteSlug),
  });
}
