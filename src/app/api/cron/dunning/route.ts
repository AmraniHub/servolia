import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail, paymentFailedEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";
import { subscriptionContext } from "@/lib/upgrade";
import { billingPortalUrl } from "@/lib/clientPortal";
import { resolveHostingPlan, productCopy } from "@/lib/hosting";
import { applyGate } from "@/lib/hostingGate";
import { clientRefFor } from "@/lib/clientRefs";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * THE SECOND NUDGE — daily, one email per client, seven days after their card
 * first failed.
 *
 * The first notice goes out from the Stripe webhook the moment a payment
 * fails. Most cards are fixed on that one. This is for the client who read it,
 * meant to deal with it, and did not — which is the majority of the money lost
 * to expired cards. It names the date the service stops, because a week in,
 * that is the only fact that still adds anything.
 *
 * WHY THE MARKER, AND NOT A ONE-DAY WINDOW
 *
 * The first version selected "past_due_since fell exactly seven days ago" and
 * relied on a daily cron landing in that window exactly once. Simulating a
 * month of runs showed that holds only while the cron fires at precisely the
 * same second: drift the schedule by half an hour and consecutive windows
 * either overlap — two identical warnings for one card — or leave a gap that
 * skips a client entirely. Cron schedulers do not promise that precision.
 *
 * So the selection is now open-ended (seven days or more), and the row itself
 * records that its final notice went out by moving payment_status to
 * `past_due_final`. That is idempotent regardless of when or how often this
 * runs, and a day the cron misses is caught up on the next one rather than
 * lost. It needs no new column: `payment_status` already exists, and the one
 * other place that reads it treats any past_due* value as past due.
 *
 * `invoice.paid` resets payment_status to "ok", so a client who pays is out of
 * this query the moment their money lands.
 *
 * Scheduled in vercel.json. Auth: Bearer CRON_SECRET.
 */

const NUDGE_AFTER_DAYS = 7;
const GRACE_DAYS = 14;
/** Set once the final notice has gone, so it can never go twice. */
const NOTIFIED = "past_due_final";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: true, skipped: "no-db" });

  const now = Date.now();
  const dayMs = 86_400_000;
  const olderThan = new Date(now - NUDGE_AFTER_DAYS * dayMs).toISOString();

  const { data: overdue, error } = await db
    .from("hosting_clients")
    .select("id, business, email, plan, subscription_id, past_due_since, suspend_at, open_invoice_url")
    .eq("payment_status", "past_due")
    .not("email", "is", null)
    .lte("past_due_since", olderThan);

  if (error) {
    console.error("[dunning] query failed:", error.message);
    return NextResponse.json({ error: "query-failed" }, { status: 500 });
  }
  if (!overdue?.length) return NextResponse.json({ ok: true, nudged: 0 });

  let sent = 0;
  for (const c of overdue) {
    if (!c.email || !c.subscription_id) continue;

    // Read the live subscription rather than trusting the row: a client who
    // paid through Stripe's own retry may already be fine, and warning them
    // that their service is about to stop would be alarming and wrong.
    const ctx = await subscriptionContext(c.subscription_id);
    if (!ctx || (ctx.status !== "past_due" && ctx.status !== "unpaid")) continue;

    const plan = resolveHostingPlan(c.plan);
    const lang = ctx.lang;
    const copy = plan ? productCopy(plan, lang) : null;
    const portalUrl = await billingPortalUrl(c.subscription_id, {
      locale: lang,
      returnUrl: `https://servolia.com/hosting/billing?done=1${lang === "fr" ? "&lang=fr" : ""}`,
    });

    const graceEnds =
      c.suspend_at ??
      new Date(new Date(c.past_due_since as string).getTime() + GRACE_DAYS * dayMs).toISOString();

    const tpl = paymentFailedEmail({
      productName: copy?.heading ?? "Website hosting",
      productNoun: copy?.sentenceName ?? "hosting",
      siteLabel: ctx.siteLabel || c.business || "",
      portalUrl,
      invoiceUrl: c.open_invoice_url ?? null,
      graceEndsIso: graceEnds,
      attempt: "final",
      lang,
    });
    /* Marked only when the send actually succeeded, so a Resend outage means
       this client is tried again tomorrow rather than silently written off as
       warned. */
    if (await sendEmail(c.email, tpl.subject, tpl.html)) {
      sent++;
      const { error: markErr } = await db
        .from("hosting_clients").update({ payment_status: NOTIFIED }).eq("id", c.id);
      // Left unmarked, they would be emailed again tomorrow. Better to know.
      if (markErr) console.error("[dunning] could not mark as notified:", markErr.message);
    }
  }

  /* Only speaks up when it did something. A daily "nothing to report" trains
     the operator to skim past the channel, and this is the one that matters. */
  if (sent) {
    await sendTelegramMessage(
      `🟠 *Final payment reminder sent — ${sent} client${sent === 1 ? "" : "s"}*\n` +
      `Seven days past due. Grace ends a week from now.\n\n[Open](https://servolia.com/admin/hosting)`,
    ).catch(() => {});
  }

  /* ── STAGE TWO: the deadline we already told them about ──────────────────
   *
   * The day-seven email names the date the service stops. Nothing used to make
   * that happen, so it was a threat that expired quietly — and a deadline a
   * client discovers is empty is worse than no deadline, because the next one
   * is ignored too.
   *
   * Everything here is guarded, because this is the one job that takes a live
   * site off the air:
   *   - the row must still be past due AND past its own grace deadline
   *   - STRIPE must still say the subscription is unpaid, checked live, so a
   *     client who paid an hour ago is never cut off by a stale row
   *   - the gate must actually be installed; writing site-status.js into a
   *     repo with no middleware reports a suspension that did not happen
   *   - `status` becomes suspended only once the commit really landed
   */
  const { data: expired } = await db
    .from("hosting_clients")
    .select("id, business, plan, subscription_id, repo, branch, site_root, suspend_at, status")
    .in("payment_status", ["past_due", NOTIFIED])
    .neq("status", "suspended")
    .not("suspend_at", "is", null)
    .lte("suspend_at", new Date(now).toISOString());

  let suspended = 0;
  const blocked: string[] = [];

  for (const c of expired ?? []) {
    if (!c.subscription_id) continue;

    const ctx = await subscriptionContext(c.subscription_id);
    if (!ctx || (ctx.status !== "past_due" && ctx.status !== "unpaid")) continue;

    /* Gate details come from CLIENT_REFS where the client is known: that map
       is the server-side authority on which repository may be written to and
       which widget is flipped, and the database row has no gate_widget column
       at all. It falls back to the row for a client not in the map. */
    const ref = clientRefFor(ctx.ref);
    const outcome = await applyGate(
      {
        repo: ref?.repo ?? c.repo,
        branch: ref?.branch ?? c.branch,
        siteRoot: ref?.siteRoot ?? c.site_root,
        gateWidget: ref?.gateWidget ?? null,
      },
      true,
    );

    if (!outcome.ok) {
      blocked.push(`${c.business} — ${outcome.reason}${outcome.detail ? ` (${outcome.detail})` : ""}`);
      continue;
    }

    const { error: sErr } = await db
      .from("hosting_clients").update({ status: "suspended" }).eq("id", c.id);
    if (sErr) {
      console.error("[dunning] suspended but could not record it:", sErr.message);
      blocked.push(`${c.business} — paused, but the record did not save`);
      continue;
    }
    suspended++;
  }

  if (suspended) {
    await sendTelegramMessage(
      `*Paused for non-payment — ${suspended} client${suspended === 1 ? "" : "s"}*\n` +
      `Grace ran out. Service restores by itself the moment they pay.\n\n` +
      `[Open](https://servolia.com/admin/hosting)`,
    ).catch(() => {});
  }
  /* Loud on purpose. A client past their deadline whose gate could not be
     applied is still being served for free, and only a human can fix it. */
  if (blocked.length) {
    await sendTelegramMessage(
      `*COULD NOT pause ${blocked.length} overdue client${blocked.length === 1 ? "" : "s"}*\n` +
      `They are past the deadline and still being served. This needs you.\n\n` +
      blocked.map((b) => `- ${b}`).join("\n"),
    ).catch(() => {});
  }

  return NextResponse.json({
    ok: true, checked: overdue.length, nudged: sent, suspended, blocked: blocked.length,
  });
}
