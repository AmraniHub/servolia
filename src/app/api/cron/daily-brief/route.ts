import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { computeLeadScore } from "@/lib/scoring";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, reason: "DB not configured" });

  const [leadsRes, buildsRes] = await Promise.all([
    db.from("leads").select("*").not("stage", "in", '("live","lost")'),
    db.from("builds").select("id, business, status").not("status", "in", '("live","delivered")'),
  ]);

  const leads = leadsRes.data ?? [];
  const builds = buildsRes.data ?? [];

  const scored = leads
    .map(l => ({ ...l, _score: computeLeadScore(l) }))
    .sort((a, b) => b._score - a._score);

  const hot = scored.filter(l => l._score >= 60);
  const now = Date.now();
  const slaBreached = leads.filter(l => {
    const ref = l.last_contacted_at ?? l.created_at;
    return (now - new Date(ref).getTime()) > 48 * 3600 * 1000 && l.stage !== "deposit_paid";
  });

  const pipeline = leads.reduce((s: number, l) => s + Number(l.value_estimate ?? 0), 0);
  const dateStr = new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "short" });

  let msg = `🌅 *Servolia — ${dateStr}*\n\n`;
  msg += `💰 Open pipeline: *€${pipeline.toLocaleString()}* · ${leads.length} leads\n`;
  if (builds.length > 0) msg += `🏗️ Builds in progress: ${builds.length}\n`;
  msg += "\n";

  if (hot.length > 0) {
    msg += `🔥 *Action today* (score ≥60):\n`;
    hot.slice(0, 4).forEach(l => {
      const niche = l.niche ? ` · ${l.niche}` : "";
      msg += `• *${l.business || l.email || "Unknown"}*${niche} — Score ${l._score} · ${l.stage.replace(/_/g, " ")}\n`;
    });
    msg += "\n";
  }

  if (slaBreached.length > 0) {
    msg += `⚠️ *No contact in 48h+* — follow up now:\n`;
    slaBreached.slice(0, 3).forEach(l => {
      const ref = l.last_contacted_at ?? l.created_at;
      const hrs = Math.round((now - new Date(ref).getTime()) / 3_600_000);
      msg += `• ${l.business || l.email || "Unknown"} — ${hrs}h silent\n`;
    });
    msg += "\n";
  }

  if (hot.length === 0 && slaBreached.length === 0) {
    msg += leads.length === 0
      ? "📭 No open leads. Focus on outreach today.\n"
      : "✅ Pipeline looks healthy — no urgent actions.\n";
  }

  msg += `\n👉 [Open CRM](https://servolia.com/admin)`;

  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.TELEGRAM_CHAT_ID;

  if (tgToken && tgChatId) {
    const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: tgChatId, text: msg, parse_mode: "Markdown" }),
    });
    const json = await res.json();
    return NextResponse.json({ ok: true, telegram: json.ok, hot: hot.length, sla: slaBreached.length });
  }

  return NextResponse.json({ ok: true, preview: msg });
}
