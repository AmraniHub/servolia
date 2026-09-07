import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail, upgradeLinkEmail } from "@/lib/email";
import { upgradeLinkFor, subscriptionContext } from "@/lib/upgrade";
import { productCopy } from "@/lib/hosting";

export const runtime = "nodejs";

/**
 * "Email me the upgrade link" — the way back in for a client who no longer has
 * their payment confirmation.
 *
 * ALWAYS ANSWERS THE SAME. Whether the address is on a monthly subscription,
 * on no subscription at all, or is not a client, the reply is identical: check
 * your inbox. A form that says "no subscription found" for one address and
 * "sent" for another is a way to test whether a given business is a customer,
 * and it tells whoever is typing something about a third party. The link goes
 * only to the address on the subscription, so nothing reaches anyone who is
 * not already the client.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  const same = NextResponse.json({ ok: true });
  if (!/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "invalid-email" }, { status: 400 });
  }

  const db = supabaseAdmin();
  if (!db) return same;

  const { data: client } = await db
    .from("hosting_clients")
    .select("subscription_id, business, plan")
    .eq("email", email)
    .eq("billing_period", "monthly")
    .eq("status", "active")
    .maybeSingle();

  if (!client?.subscription_id) return same;

  /* Product and language come from the subscription, so this email reads like
     every other one the client gets. Already-yearly is answered the same way
     as everything else — silently — rather than telling the sender anything
     about the state of someone else's account. */
  const ctx = await subscriptionContext(client.subscription_id);
  if (!ctx || ctx.interval === "year") return same;

  const { plan, lang } = ctx;
  const copy = productCopy(plan, lang);

  const url = await upgradeLinkFor(client.subscription_id, req.nextUrl.origin);
  const tpl = upgradeLinkEmail({
    url,
    productName: copy.heading,
    siteLabel: ctx.siteLabel || client.business || "",
    monthlyUsd: plan.monthlyUsd,
    annualUsd: plan.annualUsd,
    savingUsd: Math.round(plan.monthlyUsd * 12 - plan.annualUsd),
    lang,
  });
  sendEmail(email, tpl.subject, tpl.html).catch(() => {});

  return same;
}
