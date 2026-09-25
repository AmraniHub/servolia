import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { stripeFor } from "@/lib/stripeMode";
import { markDomainOrderBought, stopDomainOrder, chargeDateFor } from "@/lib/domainOrders";
import { sameOriginRequest } from "@/lib/sameOrigin";
import { sendEmail, domainOrderEmail } from "@/lib/email";
import { bounded } from "@/lib/notify";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * THE OWNER'S HAND ON A DOMAIN SOLD ON ITS OWN (src/lib/domainOrders.ts).
 *
 *   { action: "mark-bought", domain, customer? }
 *     An order finished by hand (failed, unknown, interrupted, stuck) —
 *     refused unless Vercel shows the name in our team. Writes status
 *     bought, the purchase date and the renewal a year later, attaches it to
 *     the recorded project, and emails the client the "registered" email.
 *   { action: "stop", domain, customer? }
 *     The client asked not to renew: status stopped, every draft/open
 *     renewal invoice deleted/voided, Vercel's auto-renew switched off.
 *
 * Live Stripe only (a domain order is always live). Admin session AND
 * same-origin: both actions touch a real client's money or domain.
 */
export async function POST(req: NextRequest) {
  if (!sameOriginRequest(req.headers)) return NextResponse.json({ error: "Cross-origin request refused" }, { status: 403 });
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "Expected JSON" }, { status: 415 });
  }
  const stripe = stripeFor(true);
  if (!stripe) return NextResponse.json({ error: "STRIPE_SECRET_KEY is not set" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const customer = str("customer") || undefined;
  try {
    if (str("action") === "mark-bought") {
      const r = await markDomainOrderBought(stripe, str("domain"), customer);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
      const renewsOn = r.record.renewsOn!;
      const tpl = domainOrderEmail({
        domain: r.record.domain, amountUsd: r.record.retailUsd, state: "registered",
        renewsOnIso: renewsOn, chargeOnIso: chargeDateFor(renewsOn), name: r.record.name, lang: r.record.lang,
      });
      const emailed = r.email ? (await bounded("domain registered email", sendEmail(r.email, tpl.subject, tpl.html))) === true : false;
      return NextResponse.json({ ok: true, record: r.record, customer: r.customer, attach: r.attach, attachDetail: r.attachDetail, emailed, email: r.email });
    }
    if (str("action") === "stop") {
      const r = await stopDomainOrder(stripe, str("domain"), customer);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
      return NextResponse.json({ ok: true, record: r.record, voided: r.voided, problems: r.problems });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Stripe error" }, { status: 502 });
  }
}
