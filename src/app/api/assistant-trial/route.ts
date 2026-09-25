import { NextRequest, NextResponse } from "next/server";
import { readUpgradeToken, subscriptionContext, assistantLinkFor } from "@/lib/upgrade";
import { HOSTING_TIERS, CLIENT_PRODUCTS } from "@/lib/hosting";
import { startAssistantTrial } from "@/lib/assistantTrial";
import { sendEmail, assistantTrialStartedEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

/**
 * POST /api/assistant-trial { token } — the client's click that puts their
 * assistant on their site for seven days.
 *
 * Authorised by the HOSTING subscription's signed token — the same key that
 * opens their service page and their settings page — so the only person who
 * can start a trial on a site is the person who pays for that site. No
 * operator path on purpose: the trial is consent, and consent is a click
 * from the client's own link (see assistantTrial.ts).
 *
 * The response names the outcome plainly so the page can say it; the email
 * says it again so the client has the end date in writing.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token.slice(0, 2000) : "";
  const subscriptionId = token ? await readUpgradeToken(token) : null;
  if (!subscriptionId) return NextResponse.json({ ok: false, reason: "invalid-link" }, { status: 400 });

  const ctx = await subscriptionContext(subscriptionId);
  if (!ctx || !HOSTING_TIERS.includes(ctx.plan.key) || !ctx.ref) {
    return NextResponse.json({ ok: false, reason: "not-hosting-client" }, { status: 400 });
  }

  const out = await startAssistantTrial(ctx.ref);
  if (!out.ok) return NextResponse.json(out, { status: 409 });

  if (!out.already) {
    const origin = req.nextUrl.origin;
    const settingsUrl = await assistantLinkFor(subscriptionId, origin);
    const payUrl = `${origin}/hosting?plan=chatbot&ref=${encodeURIComponent(ctx.ref)}`;
    const tpl = assistantTrialStartedEmail({
      business: out.business,
      siteUrl: out.siteUrl,
      untilIso: out.until,
      settingsUrl,
      payUrl,
      monthlyUsd: CLIENT_PRODUCTS.chatbot.monthlyUsd,
      installed: out.installed,
      lang: out.lang,
    });
    await sendEmail(out.email, tpl.subject, tpl.html).catch(() => {});
    await sendTelegramMessage(
      `🧪 *Assistant trial started* — ${out.business}\n` +
      `${out.siteUrl}\n` +
      `until ${out.until.slice(0, 10)} · tag ${out.installed === null ? "n/a" : out.installed ? `installed (${out.installDetail})` : `NOT installed — ${out.installDetail}`}`,
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true, until: out.until, already: out.already, installed: out.installed });
}
