import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { sendTelegramMessage, telegramConfigured } from "@/lib/telegram";
import type { ClientSiteConfig } from "@/lib/clientSites";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = "claude-haiku-4-5-20251001";

/**
 * MONTHLY CLIENT REPORT — the retention engine.
 *
 * For every published client site whose build has an ACTIVE care-plan client,
 * aggregate last month's AI-receptionist activity (conversations, qualified
 * leads, sample questions), have Claude write a 3-sentence narrative + one
 * concrete recommendation in the client's language, and email it to the
 * client. Founder gets a Telegram summary of every report sent.
 *
 * The report answers one sentence: "what did the system do for you this
 * month, and what do we improve next?" — that sentence is why retainers renew.
 *
 * Scheduled: GitHub Actions, 5th of each month. Auth: Bearer CRON_SECRET.
 * Gracefully skips: no Resend → reports go to Telegram only (founder can
 * forward manually); no Anthropic → plain template without narrative.
 */

interface ChatRow {
  messages: { role: string; content: string }[];
  qualified: boolean | null;
  created_at: string;
}

function authed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

function monthWindow(): { fromIso: string; toIso: string; label: string; labelFr: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthsEn = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const monthsFr = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    label: `${monthsEn[from.getUTCMonth()]} ${from.getUTCFullYear()}`,
    labelFr: `${monthsFr[from.getUTCMonth()]} ${from.getUTCFullYear()}`,
  };
}

async function writeNarrative(
  cfg: ClientSiteConfig,
  stats: { conversations: number; qualified: number; questions: string[] },
): Promise<{ narrative: string; recommendation: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const lang = cfg.language === "fr" ? "French" : "English";
  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `You write the monthly performance report for ${cfg.businessName} (${cfg.niche} business). Write in ${lang}.

Last month their AI receptionist had ${stats.conversations} conversations, of which ${stats.qualified} became qualified leads (contact details captured).
Sample visitor questions: ${stats.questions.slice(0, 6).join(" | ") || "none recorded"}

Return ONLY JSON: {"narrative":"2-3 warm, factual sentences summarizing the month for the business owner — plain language, no hype, no invented numbers","recommendation":"ONE concrete improvement for next month based on the questions (e.g. add a price to a service, add an FAQ topic), one sentence"}`,
      }],
    });
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as { narrative?: string; recommendation?: string };
    if (!parsed.narrative) return null;
    return { narrative: parsed.narrative.slice(0, 600), recommendation: (parsed.recommendation ?? "").slice(0, 300) };
  } catch {
    return null;
  }
}

function reportHtml(
  cfg: ClientSiteConfig,
  monthLabel: string,
  stats: { conversations: number; qualified: number },
  ai: { narrative: string; recommendation: string } | null,
): { subject: string; html: string } {
  const fr = cfg.language === "fr";
  const subject = fr
    ? `${cfg.businessName} — votre rapport ${monthLabel}`
    : `${cfg.businessName} — your ${monthLabel} report`;
  const rows = [
    [fr ? "Conversations gérées par l'IA" : "Conversations handled by the AI", String(stats.conversations)],
    [fr ? "Leads qualifiés capturés" : "Qualified leads captured", String(stats.qualified)],
  ];
  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#18181B">
    <div style="background:#0A1F14;border-radius:12px;padding:24px;margin-bottom:20px">
      <p style="color:#BEF264;font-weight:800;font-size:18px;margin:0">Servolia</p>
      <p style="color:#FAFAF7;font-size:14px;margin:6px 0 0">${fr ? "Rapport mensuel" : "Monthly report"} · ${monthLabel}</p>
    </div>
    ${ai ? `<p style="font-size:14px;line-height:1.6">${ai.narrative}</p>` : ""}
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      ${rows.map(([k, v]) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #E8E6E0;font-size:14px;color:#52525B">${k}</td>
        <td style="padding:10px 0;border-bottom:1px solid #E8E6E0;font-size:20px;font-weight:800;text-align:right">${v}</td>
      </tr>`).join("")}
    </table>
    ${ai?.recommendation ? `<div style="background:#EEF5EA;border-radius:10px;padding:14px;font-size:13px">
      <strong style="color:#36671E">${fr ? "Amélioration prévue le mois prochain" : "Next month's improvement"} :</strong> ${ai.recommendation}
    </div>` : ""}
    <p style="font-size:12px;color:#71717A;margin-top:20px">${
      fr ? "Une question ? Répondez simplement à cet email." : "Questions? Just reply to this email."
    }</p>
  </div>`;
  return { subject, html };
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const win = monthWindow();
  const results: { site: string; conversations: number; qualified: number; emailed: boolean }[] = [];

  // Published client sites …
  const { data: sites } = await db
    .from("client_sites")
    .select("slug, build_id, config, status")
    .eq("status", "published");

  for (const row of (sites as { slug: string; build_id: string | null; config: ClientSiteConfig }[] | null) ?? []) {
    const cfg = { ...row.config, slug: row.slug };

    // … whose build has an ACTIVE care-plan client (no retainer → no report).
    if (!row.build_id) continue;
    const { data: client } = await db
      .from("clients")
      .select("email, status")
      .eq("build_id", row.build_id)
      .eq("status", "active")
      .maybeSingle();
    if (!client) continue;

    // Aggregate last month's receptionist activity for this site.
    const { data: chats } = await db
      .from("chat_sessions")
      .select("messages, qualified, created_at")
      .eq("site_slug", row.slug)
      .gte("created_at", win.fromIso)
      .lt("created_at", win.toIso);
    const chatRows = (chats as ChatRow[] | null) ?? [];
    const questions = chatRows
      .flatMap((c) => (c.messages ?? []).filter((m) => m.role === "user").map((m) => m.content))
      .filter((q) => q.length > 8 && q.length < 160);
    const stats = {
      conversations: chatRows.length,
      qualified: chatRows.filter((c) => c.qualified).length,
      questions,
    };

    const ai = await writeNarrative(cfg, stats);
    const monthLabel = cfg.language === "fr" ? win.labelFr : win.label;
    const { subject, html } = reportHtml(cfg, monthLabel, stats, ai);

    const to = (client as { email: string | null }).email ?? cfg.email;
    const emailed = to ? await sendEmail(to, subject, html) : false;
    results.push({ site: row.slug, conversations: stats.conversations, qualified: stats.qualified, emailed });
  }

  if (telegramConfigured() && results.length) {
    const lines = results.map(
      (r) => `• ${r.site}: ${r.conversations} conv · ${r.qualified} qualifiés · ${r.emailed ? "📧 envoyé" : "⚠️ email NON envoyé"}`,
    );
    await sendTelegramMessage(`📊 Rapports clients ${win.labelFr}\n${lines.join("\n")}`);
  }

  return NextResponse.json({ month: win.label, reports: results });
}
