import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { excludeTest } from "@/lib/testContext";
import { sendEmail, paymentFailedEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";
import { subscriptionContext } from "@/lib/upgrade";
import { billingPortalUrl } from "@/lib/clientPortal";
import { resolveHostingPlan, productCopy, HOSTING_TIERS } from "@/lib/hosting";
import { applyGate } from "@/lib/hostingGate";
import { clientRefFor } from "@/lib/clientRefs";
import { expireAssistantTrials, nudgeAssistantTrials } from "@/lib/assistantTrial";
import { backfillSiteUrls } from "@/lib/hostingRow";
import { assistantTrialEndedEmail, assistantTrialNudgeEmail } from "@/lib/email";
import { CLIENT_PRODUCTS } from "@/lib/hosting";
import { assistantLinkFor } from "@/lib/upgrade";
import { receptionistDailyPass, receptionistLinkFor } from "@/lib/receptionistTrial";
import { receptionistNudgeEmail, receptionistEndedEmail } from "@/lib/email";
import { PLANS, PLAN_ORDER, SETUP_PLAN } from "@/lib/pricing";

export const runtime = "nodejs";
export const maxDuration = 120;

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

/**
 * The settings link for a trialling client, minted from their HOSTING
 * subscription — the same key that opens their service page. Returns the
 * plain showroom path when we cannot mint one, so an email never carries a
 * link that goes nowhere.
 */
async function assistantSettingsUrl(
  db: ReturnType<typeof supabaseAdmin>,
  email: string,
): Promise<string> {
  if (!db || !email) return "https://servolia.com/hosting";
  const { data } = await excludeTest(db, (live) => live(db
    .from("hosting_clients")
    .select("subscription_id, plan")
    .ilike("email", email)
    .in("status", ["active", "past_due"])));
  const hosting = (data ?? []).find(
    (r) => HOSTING_TIERS.includes(String(r.plan).toLowerCase()) && r.subscription_id,
  );
  if (!hosting?.subscription_id) return "https://servolia.com/hosting";
  return assistantLinkFor(hosting.subscription_id);
}

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

  // `is_test is not true`: founder test rows are never dunned or suspended —
  // suspension commits to a client repository (src/lib/testContext.ts).
  const { data: overdue, error } = await excludeTest(db, (live) => live(db
    .from("hosting_clients")
    .select("id, business, email, plan, subscription_id, past_due_since, suspend_at, open_invoice_url")
    .eq("payment_status", "past_due")
    .not("email", "is", null)
    .lte("past_due_since", olderThan)));

  if (error) {
    console.error("[dunning] query failed:", error.message);
    return NextResponse.json({ error: "query-failed" }, { status: 500 });
  }
  /* NO EARLY RETURN HERE. Until 2026-09-22 this line returned when nobody was
     overdue — most days — and so every pass below it (the suspension stage,
     both trial passes, the site_url backfill) ran only on a day some card had
     failed. The trial day-5 and day-7 emails could never have fired on a
     normal morning. An empty list simply skips the loop. */
  let sent = 0;
  for (const c of overdue ?? []) {
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
  const { data: expired } = await excludeTest(db, (live) => live(db
    .from("hosting_clients")
    .select("id, business, plan, subscription_id, repo, branch, site_root, suspend_at, status")
    .in("payment_status", ["past_due", NOTIFIED])
    .neq("status", "suspended")
    .not("suspend_at", "is", null)
    .lte("suspend_at", new Date(now).toISOString())));

  let suspended = 0;
  const blocked: string[] = [];

  for (const c of expired ?? []) {
    if (!c.subscription_id) continue;

    const ctx = await subscriptionContext(c.subscription_id);
    if (!ctx || (ctx.status !== "past_due" && ctx.status !== "unpaid")) continue;

    /* AN ADD-ON IS NOT THE SITE. An unpaid AI assistant goes quiet by itself:
       its widget asks /api/assistant whether it is paid for, and that answer
       reads this row's status. Writing site-status.js here would take the
       client's whole website — which they pay for separately — off the air
       over a $12 add-on. So the row is marked and the gate is left alone. */
    if (!HOSTING_TIERS.includes(String(c.plan ?? "").toLowerCase())) {
      const { error: aErr } = await db
        .from("hosting_clients").update({ status: "suspended" }).eq("id", c.id);
      if (aErr) { blocked.push(`${c.business} — add-on paused, but the record did not save`); continue; }
      suspended++;
      continue;
    }

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

  /* ── ASSISTANT TRIALS WITH TWO DAYS LEFT ──────────────────────────────
   * Day 5 of 7. The row is marked before the email goes, so this can run
   * twice in a day without the client hearing twice. What it says depends
   * on whether the assistant has actually done anything — see
   * assistantTrialNudgeEmail; a "nobody wrote to it" week gets a check-your-
   * site email, not a sales pitch, and that is also how a silently failed
   * install surfaces. */
  const nudges = await nudgeAssistantTrials(now);
  for (const t of nudges.nudged) {
    const tpl = assistantTrialNudgeEmail({
      business: t.business,
      siteLabel: t.siteLabel,
      conversations: t.conversations,
      untilIso: t.until,
      tryUrl: `https://servolia.com/hosting/assistant/try?site=${encodeURIComponent(t.ref)}${t.lang === "fr" ? "&lang=fr" : ""}`,
      settingsUrl: await assistantSettingsUrl(db, t.email),
      payUrl: `https://servolia.com/hosting?plan=chatbot&ref=${encodeURIComponent(t.ref)}`,
      monthlyUsd: CLIENT_PRODUCTS.chatbot.monthlyUsd,
      lang: t.lang,
    });
    if (t.email) sendEmail(t.email, tpl.subject, tpl.html).catch(() => {});
  }
  if (nudges.nudged.length) {
    await sendTelegramMessage(
      `⏳ *Assistant trial${nudges.nudged.length === 1 ? "" : "s"} — two days left: ${nudges.nudged.length}*\n` +
      nudges.nudged.map((t) => `- ${t.business}: ${t.conversations} so far${t.quiet ? " — QUIET, sent the check-your-site email (an install may have failed)" : ""}`).join("\n"),
    ).catch(() => {});
  }
  if (nudges.errors.length) {
    await sendTelegramMessage(`*Trial nudge hit errors*\n` + nudges.errors.map((e) => `- ${e}`).join("\n")).catch(() => {});
  }

  /* ── ASSISTANT TRIALS WHOSE WEEK IS OVER ──────────────────────────────
   * Same daily pass, same idempotence: a trial row past its date becomes
   * trial_ended once, the widget on their site goes quiet by itself (it
   * reads the row), and the client hears what it did — the count of real
   * conversations it held for them — with the one line to keep it. No gate,
   * no uninstall: the tag stays, drawing nothing, ready for the day they pay.
   * See src/lib/assistantTrial.ts. */
  /* ── A CLIENT WE KNOW MUST NOT HAVE A BLANK ADDRESS ───────────────────
   * site_url is typed by hand at setup, so it is blank whenever anyone
   * forgot — and it is the link in the CRM and the address the client reads
   * in their own trial email. The domain is already in CLIENT_REFS. Fills
   * only what is empty, only that one column, every day, for every client
   * added from here on. */
  const urls = await backfillSiteUrls();
  if (urls.filled.length || urls.errors.length) {
    console.log("[cron/dunning] site_url filled:", urls.filled, "errors:", urls.errors);
  }

  const trials = await expireAssistantTrials(now);
  for (const t of trials.ended) {
    const tpl = assistantTrialEndedEmail({
      business: t.business,
      siteLabel: clientRefFor(t.ref)?.label ?? t.business,
      conversations: t.conversations,
      payUrl: `https://servolia.com/hosting?plan=chatbot&ref=${encodeURIComponent(t.ref)}`,
      monthlyUsd: CLIENT_PRODUCTS.chatbot.monthlyUsd,
      annualUsd: CLIENT_PRODUCTS.chatbot.annualUsd,
      lang: t.lang,
    });
    if (t.email) sendEmail(t.email, tpl.subject, tpl.html).catch(() => {});
  }
  if (trials.ended.length) {
    await sendTelegramMessage(
      `🧪 *Assistant trial${trials.ended.length === 1 ? "" : "s"} ended — ${trials.ended.length}*\n` +
      trials.ended.map((t) => `- ${t.business}: ${t.conversations} conversation${t.conversations === 1 ? "" : "s"} in the week`).join("\n") +
      `\n\nThe widget is quiet on their site now; the "keep it" email is on its way.`,
    ).catch(() => {});
  }
  if (trials.errors.length) {
    await sendTelegramMessage(`*Trial expiry hit errors*\n` + trials.errors.map((e) => `- ${e}`).join("\n")).catch(() => {});
  }

  /* ── RECEPTIONIST TRIALS FROM THE PUBLIC FRONT DOOR ────────────────────
   * A different trial from the one above: a practice that found Servolia on
   * its own, put the receptionist on its own site, and will pay in EUR. Its
   * row lives in client_sites (see src/lib/receptionistTrial.ts), so nothing
   * above ever sees it. Each step marks the row before its email goes. */
  const rec = await receptionistDailyPass(now);
  const planLines = PLAN_ORDER.map((k) => PLANS[k]);
  for (const e of rec.nudged) {
    if (!e.email) continue;
    const link = await receptionistLinkFor({ slug: e.slug, email: e.email, lang: e.lang });
    const tpl = receptionistNudgeEmail({ business: e.business, domain: e.domain, conversations: e.conversations, installed: e.installed, untilIso: e.until, link, lang: e.lang });
    sendEmail(e.email, tpl.subject, tpl.html).catch(() => {});
  }
  for (const e of rec.ended) {
    if (!e.email) continue;
    const link = await receptionistLinkFor({ slug: e.slug, email: e.email, lang: e.lang });
    const tpl = receptionistEndedEmail({
      business: e.business, domain: e.domain, conversations: e.conversations, setupEur: SETUP_PLAN.totalEur, link, lang: e.lang,
      plans: planLines.map((p) => ({ name: e.lang === "fr" ? p.nameFr : p.name, monthlyEur: p.monthlyEur, conversations: p.conversations })),
    });
    sendEmail(e.email, tpl.subject, tpl.html).catch(() => {});
  }
  if (rec.installed.length || rec.nudged.length || rec.ended.length) {
    await sendTelegramMessage(
      [
        ...rec.installed.map((e) => `Installed: ${e.business} (${e.domain}) - 7 days now run to ${e.until.slice(0, 10)}`),
        ...rec.nudged.map((e) => `Day 5: ${e.business} - ${e.installed ? `${e.conversations} conversations` : "line NOT on their site yet - worth a call"}`),
        ...rec.ended.map((e) => `Ended: ${e.business} - ${e.conversations} conversations; the keep-it email went`),
      ].join("\n"),
      undefined, { plain: true },
    ).catch(() => {});
  }
  if (rec.errors.length) {
    await sendTelegramMessage(`Receptionist pass hit errors\n${rec.errors.map((x) => `- ${x}`).join("\n")}`, undefined, { plain: true }).catch(() => {});
  }

  return NextResponse.json({
    ok: true, checked: overdue?.length ?? 0, nudged: sent, suspended, blocked: blocked.length,
    trialsEnded: trials.ended.length,
    receptionist: { installed: rec.installed.length, nudged: rec.nudged.length, ended: rec.ended.length },
  });
}
