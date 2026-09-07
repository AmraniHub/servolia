import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail, upgradeDoneEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";
import { readUpgradeToken, applyUpgrade } from "@/lib/upgrade";
import { productCopy } from "@/lib/hosting";

export const runtime = "nodejs";

/**
 * Switch a hosting subscription from monthly to yearly.
 *
 * The ONLY thing this accepts is the signed token. No email, no subscription
 * id, no amount — every one of those would let a caller name someone else's
 * subscription or their own price. What is charged comes from Stripe and from
 * src/lib/hosting.ts, read at this moment.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";

  const subscriptionId = await readUpgradeToken(token);
  if (!subscriptionId) {
    return NextResponse.json({ error: "invalid-link" }, { status: 400 });
  }

  const result = await applyUpgrade(subscriptionId);
  if ("problem" in result) {
    // "already-annual" is the common one and is not an error the client caused
    // — a double click, or a link used twice. 409 so the page can say so
    // calmly rather than showing a failure for something that is already done.
    const status = result.problem === "already-annual" ? 409 : 400;
    return NextResponse.json({ error: result.problem }, { status });
  }

  const { plan, lang, siteLabel } = result;

  /* Our own record. Best-effort and after the fact: the money has already
     moved, so a database hiccup must not be reported to the client as a failed
     upgrade. Stripe is the source of truth either way. */
  const db = supabaseAdmin();
  if (db) {
    const { error } = await db
      .from("hosting_clients")
      .update({ billing_period: "annual", monthly_usd: plan.annualUsd / 12 })
      .eq("subscription_id", subscriptionId);
    if (error) console.error("[upgrade] hosting_clients update failed:", error.message);
  }

  const copy = productCopy(plan, lang);

  // Told by email as well as on screen, because the page can be closed before
  // it is read and this is the client's only record of what changed.
  let email: string | null = null;
  if (db) {
    const { data } = await db
      .from("hosting_clients").select("email").eq("subscription_id", subscriptionId).maybeSingle();
    email = data?.email ?? null;
  }
  if (email) {
    const tpl = upgradeDoneEmail({
      productName: copy.heading,
      productNoun: copy.sentenceName,
      siteLabel,
      annualUsd: plan.annualUsd,
      savingUsd: Math.round(plan.monthlyUsd * 12 - plan.annualUsd),
      lang,
    });
    sendEmail(email, tpl.subject, tpl.html).catch(() => {});
  }

  sendTelegramMessage(
    `⬆️ *Switched to yearly — $${plan.annualUsd}*\n${siteLabel || "unnamed site"}\n${plan.name}`,
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
