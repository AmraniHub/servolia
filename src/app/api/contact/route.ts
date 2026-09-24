import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, estimateLeadValue, type LeadSource } from "@/lib/supabase";
import { stripeForSessionId } from "@/lib/stripeMode";
import { isTestRequest } from "@/lib/testMode";
import { runAsTest, testTag, testPrefixed, inTestContext, excludeTest } from "@/lib/testContext";
import { sendEmail, auditConfirmationEmail } from "@/lib/email";
import { sendMetaCapiEvent } from "@/lib/metaCapi";
import { startBuildFromIntake } from "@/lib/intakeBuild";
import { sendTelegramMessage, telegramConfigured } from "@/lib/telegram";
import { rateLimited, clientIp } from "@/lib/security";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const runtime = "nodejs";
// The intake auto-wire runs AFTER the response (src/lib/intakeBuild.ts) but shares
// this route's duration budget. The Claude copy call is budgeted at 10–30s
// and has no timeout of its own; on a slow day it has reached 50s, which
// under the old 60s ceiling killed the draft-ready email AND the Telegram
// message that would have said so — silence, against a thank-you screen
// that now promises a link "within a few minutes". Pro allows 300.
export const maxDuration = 120;

/**
 * Receives every form submission: free-audit, contact, intake.
 * 1. Writes to Supabase (CRM source of truth)
 * 2. Notifies Telegram (instant alert)
 * 3. Pushes to Google Sheets (backup / external workflows)
 * Intake submissions additionally auto-generate the draft client site.
 */

export async function POST(req: NextRequest) {
  /* Founder test mode (src/lib/testMode.ts): a form sent from the admin's
     test browser — the intake after a test purchase — writes a lead tagged
     is_test, its alert says TEST, and nothing goes to Meta or the Sheets
     backup. Every other request runs exactly as before. */
  return runAsTest(isTestRequest(req), () => handleContact(req));
}

async function handleContact(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, business, businessName, industry, niche, plan, planName,
            website, websiteUrl, problem, problems, type, country, city,
            clientValue, language, sessionId } = body;

    const resolvedNiche = niche || industry || null;
    const resolvedBiz   = business || businessName || null;

    // ── 0. Spam gate ───────────────────────────────────────────────────────
    // "url" is a decoy field: real forms never render or submit it, but bots
    // that blindly fill every input (or replay a guessed schema) tend to.
    // Answer 200/ok so the bot reads it as a success and doesn't adapt.
    if (typeof body.url === "string" && body.url.trim()) {
      return NextResponse.json({ ok: true });
    }
    if (!EMAIL_RE.test(String(email ?? "").trim())) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    // The rendered contact form always sends a non-empty name + problem
    // (both are HTML-required) — a bot posting straight to this API tends to
    // skip whatever it can't see reflected back in the Telegram alert.
    if (type === "contact" && (!String(name ?? "").trim() || !String(problem ?? "").trim())) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (await rateLimited(`contact:${clientIp(req.headers)}`, 8, 900)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // ── 1. Persist to Supabase ────────────────────────────────────────────
    const db = supabaseAdmin();
    let leadId: string | null = null;
    if (db) {
      const source: LeadSource =
        type === "free-audit" ? "free-audit" :
        type === "intake"     ? "intake" :
        type === "chatbot"    ? "chatbot" :
        "contact";

      const valueEstimate = estimateLeadValue(resolvedNiche, plan || planName);

      const { data: lead, error } = await db.from("leads").insert({
        name:           name || body.ownerName || null,
        email:          email || null,
        phone:          phone || null,
        business:       resolvedBiz,
        website:        website || websiteUrl || null,
        country:        country || null,
        city:           city || null,
        language:       language || "English",
        niche:          resolvedNiche,
        problems:       Array.isArray(problems) ? problems : (problem ? [problem] : null),
        client_value:   clientValue || null,
        plan_interest:  plan || planName || null,
        source,
        stage:          type === "intake" ? "deposit_paid" : "new",
        value_estimate: valueEstimate,
        raw_data:       body,
        ...testTag(),
      }).select("id").single();

      if (!error && lead) {
        leadId = lead.id;
        await db.from("lead_activities").insert({
          lead_id: lead.id,
          type: "created",
          description: `Lead created via ${source}`,
          metadata: { source, type },
        });
      } else if (error) {
        console.error("Supabase insert error:", error);
      }

      // ── 1b. Link intake answers to the build that was actually paid for ──
      // Without this, a completed intake form was landing only as a disconnected
      // lead row — the paid build never received the real answers, so "Generate
      // site" always ran on a basic draft and the portal never left "Awaiting
      // your intake" (see src/app/api/webhooks/stripe/route.ts: payment sets
      // status "intake", this is what advances it to "building").
      if (type === "intake" && sessionId) {
        // Newest, never maybeSingle(): two rows with one session id made that
        // error out, and the intake was silently dropped.
        let { data: build } = await db.from("builds")
          .select("id, lead_id, status").eq("checkout_session_id", sessionId)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        /* A scope-flow client who then subscribes keeps her build and its
           FIRST session id, so the subscription's session names no build.
           Stripe says whose session it is: a paid session's own email finds
           the build that is still waiting for its intake. The email is
           Stripe's, never the form's, so a stranger cannot aim this. */
        const sessionStripe = /^cs_(live|test)_/.test(String(sessionId)) ? stripeForSessionId(String(sessionId)) : null;
        if (!build && sessionStripe) {
          try {
            // The session's own key: a cs_test_ session exists only in test mode.
            const s = await sessionStripe.checkout.sessions.retrieve(String(sessionId));
            // A completed PLAN session only (checkout-subscription): a top-up or
            // add-on paid with her address typed in must not aim at her build.
            const planSession = s.status === "complete" && s.mode === "subscription" && s.metadata?.kind === "care_plan";
            const paidEmail = planSession ? (s.customer_details?.email ?? s.customer_email ?? null) : null;
            if (paidEmail) {
              // A TEST session aims only at a test build; a live one never does.
              const testSession = String(sessionId).startsWith("cs_test_");
              ({ data: build } = await excludeTest(db, (live) => {
                const q = db.from("builds")
                  .select("id, lead_id, status")
                  .in("email", Array.from(new Set([paidEmail, paidEmail.toLowerCase()])))
                  .eq("status", "intake");
                return (testSession ? q.eq("is_test", true) : live(q)).order("created_at", { ascending: false }).limit(1).maybeSingle();
              }));
            }
          } catch {
            /* Stripe unreachable: the answers are on the lead row, as before. */
          }
        }
        // No build yet is not an error: Stripe's event may still be on its
        // way. The webhook finds this intake (by the same session id, on the
        // lead row written above) and starts the build itself.
        if (build) {
          const started = await startBuildFromIntake({
            buildId: build.id as string, leadId: build.lead_id as string | null, intake: body, business: resolvedBiz,
          });
          /* A build past "intake" keeps its site exactly as it is; the new
             answers are on the lead row, and the founder decides. */
          if (!started && build.status !== "intake" && telegramConfigured()) {
            await sendTelegramMessage(
              `Intake sent AGAIN for a build already ${build.status} - nothing was changed on the site.\n` +
              `New answers are on the lead. Regenerate by hand only if they asked for it: https://servolia.com/admin/builds/${build.id}`,
              undefined, { silent: true, plain: true },
            );
          }
        }
      }
    }

    // ── 2. Notify Telegram ────────────────────────────────────────────────
    const tgToken  = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChatId) {
      const msg = testPrefixed("") +
        `🔔 *New ${type === "free-audit" ? "Free Audit Request" : type === "intake" ? "Client Intake (PAID)" : "Contact"}*\n` +
        `*${business || businessName || name || "—"}*\n\n` +
        `📧 ${email || "no email"}\n` +
        `📱 ${phone || "—"}\n` +
        `🌍 ${city ? city + ", " : ""}${country || "—"}\n` +
        `🎯 ${niche || industry || "—"}\n` +
        (plan || planName ? `💰 ${plan || planName}\n` : "") +
        (Array.isArray(problems) && problems.length ? `❗ ${problems.join(", ")}\n` : "") +
        (website || websiteUrl ? `🔗 ${website || websiteUrl}\n` : "") +
        (leadId ? `\n[Open in CRM](https://servolia.com/admin/leads/${leadId})` : "");

      await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: msg,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }).catch(() => {});
    }

    // ── 3. Mirror to Google Sheets (backup) ───────────────────────────────
    const sheetsUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    if (sheetsUrl && !inTestContext()) {
      fetch(sheetsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, lead_id: leadId, timestamp: new Date().toISOString(), source: "servolia.com" }),
      }).catch(() => {});
    }

    // ── 4. Send confirmation email (fire and forget) ─────────────────────
    if (email && (type === "free-audit" || type === "contact" || type === "lead-magnet")) {
      const firstName = (name || body.ownerName || (business || businessName) || "there").split(" ")[0];
      const emailLang = /fr|français|french/i.test(String(language ?? "")) ? "fr" : "en";
      const tpl = auditConfirmationEmail(firstName, emailLang);
      sendEmail(email, tpl.subject, tpl.html).catch(() => {});
    }

    // ── 5. Meta Conversions API — server-side Lead event (fire and forget) ─
    if (type !== "intake") {
      sendMetaCapiEvent({
        eventName: "Lead",
        email, phone,
        eventSourceUrl: website || websiteUrl || "https://servolia.com/free-audit",
        req,
      });
    }

    return NextResponse.json({ ok: true, lead_id: leadId });
  } catch (err) {
    console.error("Contact API error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
