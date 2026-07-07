import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, estimateLeadValue, type LeadSource } from "@/lib/supabase";
import { sendEmail, auditConfirmationEmail } from "@/lib/email";
import { sendMetaCapiEvent } from "@/lib/metaCapi";

/**
 * Receives every form submission: free-audit, contact, intake.
 * 1. Writes to Supabase (CRM source of truth)
 * 2. Notifies Telegram (instant alert)
 * 3. Pushes to Google Sheets (backup / external workflows)
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, business, businessName, industry, niche, plan, planName,
            website, websiteUrl, problem, problems, type, country, city,
            clientValue, language } = body;

    // ── 1. Persist to Supabase ────────────────────────────────────────────
    const db = supabaseAdmin();
    let leadId: string | null = null;
    if (db) {
      const source: LeadSource =
        type === "free-audit" ? "free-audit" :
        type === "intake"     ? "intake" :
        type === "chatbot"    ? "chatbot" :
        "contact";

      const resolvedNiche = niche || industry || null;
      const resolvedBiz   = business || businessName || null;
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
      const tpl = auditConfirmationEmail(firstName);
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
