import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { sendTelegramMessage, telegramConfigured } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 48H LEAD FOLLOW-UP — makes the homepage promise ("automated follow-up
 * sent at 48h") actually true.
 *
 * Every run: find leads still in stage "new" that are 48h–7d old, have an
 * email, and were never followed up (checked via lead_activities). Send one
 * soft, personal-sounding nudge in the lead's language, log the activity so
 * it can never double-send, and cap at 20 per run.
 *
 * Scheduled: GitHub Actions, daily. Auth: Bearer CRON_SECRET.
 * Gracefully no-ops without Resend (reports skipped:no-email).
 */

function authed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

interface LeadRow {
  id: string;
  name: string | null;
  email: string | null;
  business: string | null;
  language: string | null;
  niche: string | null;
  created_at: string;
}

function followUpEmail(lead: LeadRow): { subject: string; html: string } {
  const fr = /fr|french|français/i.test(lead.language ?? "");
  const firstName = (lead.name ?? "").trim().split(/\s+/)[0] || null;
  const hello = fr
    ? firstName ? `Bonjour ${firstName},` : "Bonjour,"
    : firstName ? `Hi ${firstName},` : "Hi,";

  const subject = fr
    ? `Votre audit ${lead.business ?? ""} — encore intéressé(e) ?`.replace("  ", " ")
    : `Your ${lead.business ?? "business"} audit — still interested?`;

  const body = fr
    ? `<p>${hello}</p>
       <p>Vous aviez demandé un audit gratuit de votre acquisition de clients il y a deux jours — je voulais m'assurer que rien ne s'est perdu en route.</p>
       <p>Si vous êtes toujours intéressé(e), répondez simplement à cet email (ou renvoyez le formulaire : <a href="https://servolia.com/fr/audit">servolia.com/fr/audit</a>) et je vous envoie l'analyse sous 24h.</p>
       <p>S'il ne s'agit plus d'une priorité, aucun souci — je ne relancerai pas.</p>
       <p>Bonne journée,<br/>Servolia</p>`
    : `<p>${hello}</p>
       <p>You requested a free audit of your client acquisition two days ago — I wanted to make sure nothing got lost along the way.</p>
       <p>If you're still interested, just reply to this email (or resend the form: <a href="https://servolia.com/free-audit">servolia.com/free-audit</a>) and I'll send your analysis within 24h.</p>
       <p>If it's no longer a priority, no problem — I won't chase.</p>
       <p>Best,<br/>Servolia</p>`;

  return {
    subject,
    html: `<div style="font-family:system-ui,sans-serif;max-width:540px;margin:0 auto;color:#18181B;font-size:14px;line-height:1.6">${body}</div>`,
  };
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const now = Date.now();
  const from = new Date(now - 7 * 24 * 3600e3).toISOString(); // not older than 7 days
  const to = new Date(now - 48 * 3600e3).toISOString();       // at least 48h old

  const { data: leads } = await db
    .from("leads")
    .select("id, name, email, business, language, niche, created_at")
    .eq("stage", "new")
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at", { ascending: true })
    .limit(60);

  let sent = 0;
  let skipped = 0;
  const sentTo: string[] = [];

  for (const lead of (leads as LeadRow[] | null) ?? []) {
    if (sent >= 20) break;
    if (!lead.email) { skipped++; continue; }

    // Never double-send: one follow_up_sent activity per lead, ever.
    const { data: prior } = await db
      .from("lead_activities")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("type", "follow_up_sent")
      .limit(1);
    if (prior && prior.length) { skipped++; continue; }

    const { subject, html } = followUpEmail(lead);
    const ok = await sendEmail(lead.email, subject, html);
    if (!ok) { skipped++; continue; }

    await db.from("lead_activities").insert({
      lead_id: lead.id,
      type: "follow_up_sent",
      description: "Automated 48h follow-up email sent",
      metadata: { subject },
    });
    sent++;
    sentTo.push(lead.business ?? lead.email);
  }

  if (telegramConfigured() && sent > 0) {
    await sendTelegramMessage(`📮 Relances 48h envoyées : ${sent}\n${sentTo.map((b) => `• ${b}`).join("\n")}`);
  }

  return NextResponse.json({ sent, skipped });
}
