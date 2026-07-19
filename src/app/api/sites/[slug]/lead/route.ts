import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getClientSite } from "@/lib/clientSites";
import { sendMetaCapiEvent } from "@/lib/metaCapi";

export const runtime = "nodejs";

/**
 * A client site's booking/contact form submission → a lead for THAT business.
 *
 * Stored in chat_sessions tagged by site_slug (same table the AI receptionist
 * uses), so it surfaces in the client's portal "My leads", their stats, and
 * their monthly report — no separate plumbing. Fires the client's own Meta
 * pixel Lead event when configured (ads closed loop).
 *
 * Demo sites never write anywhere (the form is client-side only there); this
 * route rejects them as defense-in-depth.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string; phone?: string; email?: string;
    service?: string; when?: string; message?: string; pageUrl?: string;
  };

  const name = (body.name ?? "").trim().slice(0, 120);
  const phone = (body.phone ?? "").trim().slice(0, 40);
  const email = (body.email ?? "").trim().slice(0, 160);
  if (!name || (!phone && !email)) {
    return NextResponse.json({ error: "Name and a phone or email are required" }, { status: 400 });
  }

  const config = await getClientSite(slug);
  if (!config) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  // Prospect demos are illustrative only — never record their form submissions.
  if (config.isDemo) return NextResponse.json({ ok: true, demo: true });

  const service = (body.service ?? "").trim().slice(0, 120);
  const when = (body.when ?? "").trim().slice(0, 120);
  const message = (body.message ?? "").trim().slice(0, 1000);

  // Compose a readable "conversation" so it renders identically to a chat lead
  // in the portal (first user line becomes the excerpt).
  const parts = [
    service && service !== "__other" ? `Demande : ${service}` : "Demande de rendez-vous",
    when ? `Créneau souhaité : ${when}` : "",
    message,
    `— ${name}${phone ? ` · ${phone}` : ""}${email ? ` · ${email}` : ""}`,
  ].filter(Boolean);
  const content = parts.join("\n");

  const db = supabaseAdmin();
  if (db) {
    try {
      await db.from("chat_sessions").insert({
        session_id: `form_${slug}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        messages: [{ role: "user", content }],
        message_count: 1,
        qualified: true, // a form submission is an explicit booking request
        email_captured: email || null,
        phone_captured: phone || null,
        site_slug: slug,
        page_url: body.pageUrl ?? null,
      });
    } catch { /* table/column may not exist yet — never block the visitor */ }
  }

  // Client's own pixel: a form booking is a Lead event in THEIR Ads Manager.
  if (config.metaPixelId && config.metaCapiToken) {
    sendMetaCapiEvent({
      eventName: "Lead", email: email || undefined, phone: phone || undefined,
      eventSourceUrl: body.pageUrl, pixelId: config.metaPixelId, accessToken: config.metaCapiToken, req,
    });
  }

  // Founder alert (best-effort) so a new client's first leads don't go unseen.
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.TELEGRAM_CHAT_ID;
  if (tgToken && tgChatId) {
    const msg = `📝 *Booking form — ${config.businessName}*\n*${name}*\n${service && service !== "__other" ? `🦷 ${service}\n` : ""}${when ? `🗓 ${when}\n` : ""}${email ? `📧 ${email}\n` : ""}${phone ? `📱 ${phone}\n` : ""}${message ? `\n"${message}"` : ""}`;
    fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: tgChatId, text: msg, parse_mode: "Markdown" }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
