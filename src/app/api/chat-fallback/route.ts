import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * Chat graceful-degradation endpoint. When the AI backend is down, the widget
 * shows a mini lead-capture form that posts here — the enquiry is never lost.
 * Works for both Servolia's own site and client sites (siteSlug present).
 */
export async function POST(req: NextRequest) {
  try {
    const { name, contact, siteSlug, sessionId, pageUrl } = await req.json() as {
      name?: string;
      contact?: string;
      siteSlug?: string;
      sessionId?: string;
      pageUrl?: string;
    };

    const cleanContact = (contact ?? "").trim();
    if (!cleanContact) {
      return NextResponse.json({ error: "Contact required" }, { status: 400 });
    }
    const isEmail = /@/.test(cleanContact);

    const db = supabaseAdmin();
    if (db) {
      if (siteSlug) {
        // A client's visitor — record as a qualified chat session for that client.
        await db.from("chat_sessions").insert({
          session_id: sessionId ?? crypto.randomUUID(),
          site_slug: siteSlug,
          qualified: true,
          email_captured: isEmail ? cleanContact : null,
          phone_captured: isEmail ? null : cleanContact,
          messages: [{ role: "user", content: `[fallback form] ${name ?? ""} — ${cleanContact}` }],
          message_count: 1,
          page_url: pageUrl ?? null,
        });
      } else {
        await db.from("leads").insert({
          name: name || null,
          email: isEmail ? cleanContact : null,
          phone: isEmail ? null : cleanContact,
          source: "chatbot",
          stage: "new",
          notes: "Captured via chat fallback form (AI backend unavailable)",
        });
      }
    }

    sendTelegramMessage(
      `⚠️ *Chat fallback capture* (AI was down)\n` +
      `${siteSlug ? `Client site: ${siteSlug}\n` : ""}` +
      `👤 ${name || "—"}\n📞 ${cleanContact}`,
    ).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("chat-fallback error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
