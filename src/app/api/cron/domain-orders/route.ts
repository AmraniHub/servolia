import { NextRequest, NextResponse } from "next/server";
import { stripeFor } from "@/lib/stripeMode";
import { settlePurchasingOrders, chargeDateFor, nextYear, handFinishLine } from "@/lib/domainOrders";
import { sendEmail, domainOrderEmail } from "@/lib/email";
import { Sends, troubleSubject, money } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ADMIN = "https://servolia.com/admin/hosting";

/**
 * DOMAINS SOLD ON THEIR OWN, STILL BEING REGISTERED (src/lib/domainOrders.ts).
 *
 * Vercel registers a name asynchronously: the webhook waits a few seconds and
 * then has to answer Stripe. An order still "purchasing" at that point is
 * settled here, every quarter hour: a completed one is attached to its
 * project and the client gets the "registered" email; a failed one is marked
 * failed, the client is told it is being finished by hand or refunded, and
 * the owner is told (Telegram + email). The record is written BEFORE the
 * email, so no later run can send a second one.
 *
 * Live key only: a founder test purchase never reaches the registrar, so it
 * is never "purchasing". Every send awaited and bounded (src/lib/notify.ts).
 * Scheduled in vercel.json. Auth: Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const stripe = stripeFor(true);
  if (!stripe) return NextResponse.json({ error: "not-configured" }, { status: 503 });
  const sends = new Sends();

  let settled: Awaited<ReturnType<typeof settlePurchasingOrders>> = [];
  try {
    settled = await settlePurchasingOrders(stripe);
  } catch (e) {
    sends.alert(`Domain orders check failed: ${e instanceof Error ? e.message : String(e)}`);
    await sends.settled();
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  for (const s of settled) {
    const rec = s.record;
    const who = rec.name || s.email || s.customer;
    if (s.step === "stuck") {
      sends.owner({
        subject: troubleSubject("Domain still registering", rec.domain, who),
        lines: [
          `${rec.domain} is still "purchasing" at Vercel (order ${rec.orderId}) hours after it was accepted. ${s.detail ?? ""}`.trim(),
          "Next: look at Vercel > Domains. The client was told it would be confirmed; this is reported once.",
          handFinishLine(rec.domain, s.customer),
        ],
        link: ADMIN,
      });
      continue;
    }
    const renewsOn = rec.renewsOn ?? nextYear(new Date().toISOString().slice(0, 10));
    const tpl = domainOrderEmail({
      domain: rec.domain, amountUsd: rec.retailUsd, state: s.step === "registered" ? "registered" : "failed",
      renewsOnIso: renewsOn, chargeOnIso: chargeDateFor(renewsOn), name: rec.name, lang: rec.lang,
    });
    const sent = s.email ? (await sends.add("domain order email", sendEmail(s.email, tpl.subject, tpl.html))) === true : false;
    const mailNote = sent ? null : `Client email NOT sent${s.email ? ` to ${s.email}` : " (no address)"} — tell them yourself.`;
    if (s.step === "registered") {
      sends.alert([
        `🌐 ${rec.domain} (${who}) is now REGISTERED (order ${rec.orderId}). Renews ${rec.renewsOn}.`,
        s.attach === "done" ? `Attached to Vercel project ${rec.project}.`
          : s.attach === "failed" ? `NOT attached to ${rec.project} (${s.attachDetail}) - add it in Vercel > ${rec.project} > Domains.`
          : "No Vercel project named - attach it by hand.",
        mailNote,
      ].filter(Boolean).join("\n"));
    } else {
      sends.owner({
        subject: troubleSubject("Domain NOT registered", `${rec.domain} — ${money(rec.retailUsd, "USD")} paid`, who),
        lines: [
          `Vercel's order for ${rec.domain} FAILED (${s.detail}). The client was told it is being finished by hand or refunded.`,
          `Next: buy it (vercel domains buy ${rec.domain}) and mark it bought, or refund the payment in Stripe.`,
          handFinishLine(rec.domain, s.customer),
          mailNote,
        ],
        link: ADMIN,
      });
    }
  }
  await sends.settled();
  return NextResponse.json({ ok: true, settled: settled.map((s) => ({ domain: s.domain, step: s.step })) });
}
