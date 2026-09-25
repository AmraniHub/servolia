import { NextRequest, NextResponse } from "next/server";
import { stripeFor } from "@/lib/stripeMode";
import { settlePurchasingOrders, chargeDateFor, nextYear } from "@/lib/domainOrders";
import { sendEmail, domainOrderEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * DOMAINS SOLD ON THEIR OWN, STILL BEING REGISTERED (src/lib/domainOrders.ts).
 *
 * Vercel registers a name asynchronously: the webhook waits a few seconds and
 * then has to answer Stripe. An order still "purchasing" at that point is
 * settled here, every quarter hour: a completed one is attached to its
 * project and the client gets the "registered" email; a failed one is marked
 * failed, the client is told it is being finished by hand or refunded, and
 * the owner is told on Telegram. The record is written before the email, so
 * a crash between the two costs an email, never a second one.
 *
 * Live key only: a founder test purchase never reaches the registrar, so it
 * is never "purchasing". Scheduled in vercel.json. Auth: Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const stripe = stripeFor(true);
  if (!stripe) return NextResponse.json({ error: "not-configured" }, { status: 503 });

  let settled: Awaited<ReturnType<typeof settlePurchasingOrders>>;
  try {
    settled = await settlePurchasingOrders(stripe);
  } catch (e) {
    await sendTelegramMessage(`Domain orders check failed: ${e instanceof Error ? e.message : String(e)}`, undefined, { plain: true }).catch(() => {});
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  for (const s of settled) {
    const rec = s.record;
    const who = rec.name || s.email || s.customer;
    if (s.step === "stuck") {
      await sendTelegramMessage(
        `⚠️ ${rec.domain} (${who}) is still "purchasing" at Vercel (order ${rec.orderId}) hours after payment. ${s.detail ?? ""}\n` +
        `Look at Vercel > Domains. The client was told it would be confirmed; this is reported once.`,
        undefined, { plain: true },
      ).catch(() => {});
      continue;
    }
    let mailNote = "";
    const renewsOn = rec.renewsOn ?? nextYear(new Date().toISOString().slice(0, 10));
    const tpl = domainOrderEmail({
      domain: rec.domain, amountUsd: rec.retailUsd, state: s.step === "registered" ? "registered" : "failed",
      renewsOnIso: renewsOn, chargeOnIso: chargeDateFor(renewsOn), name: rec.name, lang: rec.lang,
    });
    const sent = s.email ? await sendEmail(s.email, tpl.subject, tpl.html).catch(() => false) : false;
    if (!sent) mailNote = `\nClient email NOT sent${s.email ? ` to ${s.email}` : " (no address)"} - tell them yourself.`;
    const text = s.step === "registered"
      ? `🌐 ${rec.domain} (${who}) is now REGISTERED (order ${rec.orderId}). Renews ${rec.renewsOn}.\n` +
        (s.attach === "done" ? `Attached to Vercel project ${rec.project}.`
          : s.attach === "failed" ? `NOT attached to ${rec.project} (${s.attachDetail}) - add it in Vercel > ${rec.project} > Domains.`
          : "No Vercel project named - attach it by hand.")
      : `⚠️ ${who} PAID $${rec.retailUsd.toFixed(2)} for ${rec.domain} and Vercel's order FAILED (${s.detail}). Buy it by hand (vercel domains buy ${rec.domain}) or refund them. They were told.`;
    await sendTelegramMessage(text + mailNote, undefined, { plain: true }).catch(() => {});
  }
  return NextResponse.json({ ok: true, settled: settled.map((s) => ({ domain: s.domain, step: s.step })) });
}
