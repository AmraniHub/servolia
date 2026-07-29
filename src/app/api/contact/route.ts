import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { supabaseAdmin, estimateLeadValue, type LeadSource } from "@/lib/supabase";
import { sendEmail, auditConfirmationEmail } from "@/lib/email";
import { sendMetaCapiEvent } from "@/lib/metaCapi";
import { generateSiteForBuild } from "@/lib/generateSite";
import { sendTelegramMessage, telegramConfigured } from "@/lib/telegram";
import { rateLimited, clientIp } from "@/lib/security";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const runtime = "nodejs";
// The intake auto-wire runs AFTER the response (see after() below) but shares
// this route's duration budget — the Claude copy call needs the room.
export const maxDuration = 60;

/**
 * Receives every form submission: free-audit, contact, intake.
 * 1. Writes to Supabase (CRM source of truth)
 * 2. Notifies Telegram (instant alert)
 * 3. Pushes to Google Sheets (backup / external workflows)
 * Intake submissions additionally auto-generate the draft client site.
 */

export async function POST(req: NextRequest) {
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
        const { data: build } = await db.from("builds")
          .select("id, lead_id").eq("checkout_session_id", sessionId).maybeSingle();
        if (build) {
          const { error: updateErr } = await db.from("builds").update({
            intake_data: body,
            business: resolvedBiz || undefined,
            status: "building",
            started_at: new Date().toISOString(),
          }).eq("id", build.id);
          if (build.lead_id) {
            await db.from("lead_activities").insert({
              lead_id: build.lead_id,
              type: "note",
              description: "✅ Intake form completed — build started",
            });
          }

          // ── 1c. Auto-generate the draft site from the fresh intake ──────
          // Runs AFTER the response is sent (next/server after()), so the
          // client who just submitted the form never waits on the 10–30s
          // Claude copywriting call. By the time the founder opens the admin,
          // the draft should already exist — the founder reviews and publishes
          // in /admin/sites; auto-generation only prepares the draft.
          // Strictly best-effort: generateSiteForBuild returns null instead
          // of throwing, and the try/catch is belt-and-braces. The outcome
          // arrives as a second, silent Telegram message.
          if (!updateErr) {
            const buildId = build.id as string;
            after(async () => {
              let draftSite: { slug: string; ai: boolean } | null = null;
              try {
                draftSite = await generateSiteForBuild(buildId);
              } catch {
                draftSite = null;
              }
              if (telegramConfigured()) {
                const text = draftSite
                  ? `🪄 *Draft site ready* — review & publish\nhttps://servolia.com/sites/${draftSite.slug}\n[Open in admin](https://servolia.com/admin/sites)`
                  : `⚠️ *Draft generation failed* for the new intake — generate manually from [the build page](https://servolia.com/admin/builds/${buildId})`;
                await sendTelegramMessage(text, undefined, { silent: true }); // follow-up to the intake alert — no second buzz
              }
            });
          }
        }
      }
    }

    // ── 2. Notify Telegram ────────────────────────────────────────────────
    const tgToken  = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChatId) {
      const msg =
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
    if (sheetsUrl) {
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
