import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage, telegramConfigured } from "@/lib/telegram";
import { renewalsDue, RENEWAL_WARN_DAYS } from "@/lib/domains";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * DOMAIN RENEWAL WATCHDOG — weekly.
 *
 * Cloudflare's Registrar API (beta) can register a domain but CANNOT renew
 * one, so renewal is a human action in the dashboard. Forgetting it is the
 * single most damaging failure in the product: a lapsed domain takes down a
 * clinic's website AND its professional email at the same time, and the name
 * can be bought by anyone. Contractually it is also Servolia's job while the
 * plan is active (CGV 7 bis).
 *
 * Alerting matches the Zero-Miss policy — loud only when it matters, silent
 * when there is nothing to do, so the channel keeps its signal.
 *
 * Scheduled: GitHub Actions, weekly. Auth: Bearer CRON_SECRET.
 */

function authed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const due = await renewalsDue();
  const urgent = due.filter((d) => d.urgent);

  if (telegramConfigured() && due.length) {
    const line = (d: (typeof due)[number]) =>
      `• *${d.domain}* — ${d.daysLeft} day${d.daysLeft === 1 ? "" : "s"}${d.email ? ` · ${d.email}` : ""}`;
    const text = urgent.length
      ? `🔴 *DOMAIN RENEWAL URGENT*\nCloudflare cannot renew via API — do these by hand in the dashboard. A lapsed domain kills the client's site AND email.\n\n${urgent.map(line).join("\n")}` +
        (due.length > urgent.length ? `\n\nAlso coming up:\n${due.filter((d) => !d.urgent).map(line).join("\n")}` : "")
      : `📅 *Domain renewals within ${RENEWAL_WARN_DAYS} days*\n${due.map(line).join("\n")}`;

    // Urgent buzzes; the routine heads-up stays silent.
    await sendTelegramMessage(text, undefined, urgent.length ? undefined : { silent: true });
  }

  return NextResponse.json({ checked: due.length, urgent: urgent.length, domains: due });
}
