import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";
import { readUpgradeToken, subscriptionContext, referenceFor } from "@/lib/upgrade";

export const runtime = "nodejs";

/**
 * The handover details a new hosting client sends after paying.
 *
 * Authorised by the same signed token as every other client surface: it writes
 * to one named subscription's row, so it must not be callable with a
 * subscription id someone guessed.
 *
 * NOTHING HERE IS A CREDENTIAL, and the endpoint is built so it cannot become
 * one by accident: the fields are named and coerced individually rather than
 * spread from the body, so a future form that added a password field would
 * silently drop it here instead of persisting it.
 */
const MAX = 2000;
const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX) : "");

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const subscriptionId = await readUpgradeToken(clean(body?.token));
  if (!subscriptionId) {
    return NextResponse.json({ error: "invalid-link" }, { status: 400 });
  }

  const siteUrl = clean(body?.siteUrl);
  const platform = clean(body?.platform);
  const registrar = clean(body?.registrar);
  const notes = clean(body?.notes);
  if (!siteUrl || !platform) {
    return NextResponse.json({ error: "missing-fields" }, { status: 400 });
  }

  const ctx = await subscriptionContext(subscriptionId);
  const reference = referenceFor(subscriptionId);

  /* Written into the columns the table already has: site_url for the address,
     notes for the rest. A migration to give platform and registrar their own
     columns would have to be run before this endpoint could be deployed
     safely, and an endpoint that 500s until someone remembers a migration is
     an endpoint that loses a client's details on the day they paid. */
  const summary = [
    `Platform: ${platform}`,
    registrar ? `Registrar: ${registrar}` : null,
    notes ? `Client notes: ${notes}` : null,
    `Submitted ${new Date().toISOString().slice(0, 10)}`,
  ].filter(Boolean).join("\n");

  const db = supabaseAdmin();
  if (db) {
    const { error } = await db
      .from("hosting_clients")
      .update({ site_url: siteUrl, notes: summary })
      .eq("subscription_id", subscriptionId);
    if (error) console.error("[hosting-setup] update failed:", error.message);
  }

  /* Loud, and with everything in it. This is the message that turns a payment
     into work, and it is the one thing the operator must not miss -- so the
     details are IN the alert rather than behind a link to a dashboard. */
  await sendTelegramMessage(
    [
      `*New hosting client - details received*`,
      ``,
      `Ref: ${reference}`,
      `Site: ${siteUrl}`,
      `Platform: ${platform}`,
      registrar ? `Registrar: ${registrar}` : null,
      ctx?.siteLabel ? `Sold as: ${ctx.siteLabel}` : null,
      ctx?.plan ? `Plan: ${ctx.plan.name}` : null,
      notes ? `` : null,
      notes ? `Notes: ${notes}` : null,
      ``,
      `Ask for DELEGATED access, never a password.`,
    ].filter((l) => l !== null).join("\n"),
    undefined,
    { plain: true },
  ).catch(() => {});

  return NextResponse.json({ ok: true, reference });
}
