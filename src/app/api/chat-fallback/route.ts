import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";
import { getClientSite } from "@/lib/clientSites";
import { notifyClientOfLead } from "@/lib/clientNotify";
import { originAllowed, corsHeaders } from "@/lib/assistant";
import { assistantEnabled } from "@/lib/assistantAccess";

/**
 * Chat graceful-degradation endpoint. When the AI backend is down, the widget
 * shows a mini lead-capture form that posts here — the enquiry is never lost.
 * Works for both Servolia's own site and client sites (siteSlug present).
 *
 * For a client site the lead goes to the CLIENT as well as to us: the reason
 * the form exists is that their assistant could not answer, and an enquiry
 * that only reaches the operator's Telegram is an enquiry the business never
 * hears about until somebody forwards it.
 *
 * IT CHECKS THE SUBSCRIPTION, exactly as /api/chat does. It used to check
 * only the origin, which left a real hole once trials existed: /api/assistant
 * is CDN-cached for five minutes, so for a few minutes after a trial ends the
 * widget still draws for new visitors, their first message gets a 403, the
 * widget degrades to this form — and the enquiry was captured and the client
 * notified, free, past the boundary they had just declined to pay for. Small
 * window, but "paid = on" has to be true on every route that does work, or it
 * is not a rule. A preview conversation is refused here too: the showroom
 * promises that nothing is saved and nobody is alerted.
 */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders("*") });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  let cors: Record<string, string> = {};
  try {
    const body = await req.json() as {
      name?: string;
      contact?: string;
      siteSlug?: string;
      sessionId?: string;
      pageUrl?: string;
    };
    const { name, contact, sessionId, pageUrl } = body;
    // Pinned by the proxy on a practice's own domain (see /api/chat): wins over the body.
    const siteSlug = req.nextUrl.searchParams.get("site") || body.siteSlug;

    const config = siteSlug ? await getClientSite(siteSlug) : undefined;
    if (siteSlug) {
      if (config && !originAllowed(origin, config)) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }
      cors = corsHeaders(origin);
      if (!config || !(await assistantEnabled(config))) {
        return NextResponse.json({ error: "Chat is not enabled for this site." }, { status: 403, headers: cors });
      }
    }

    const cleanContact = (contact ?? "").trim().slice(0, 200);
    const cleanName = (name ?? "").trim().slice(0, 120);
    if (!cleanContact) {
      return NextResponse.json({ error: "Contact required" }, { status: 400, headers: cors });
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
          messages: [{ role: "user", content: `[fallback form] ${cleanName} — ${cleanContact}` }],
          message_count: 1,
          page_url: pageUrl ?? null,
        });
      } else {
        await db.from("leads").insert({
          name: cleanName || null,
          email: isEmail ? cleanContact : null,
          phone: isEmail ? null : cleanContact,
          source: "chatbot",
          stage: "new",
          notes: "Captured via chat fallback form (AI backend unavailable)",
        });
      }
    }

    // Awaited side by side (each bounded, never throwing): an un-awaited send
    // can die with the serverless function once the response is returned.
    // Plain text: a visitor's name or address would break Markdown.
    await Promise.all([
      config && !config.isDemo
        ? notifyClientOfLead(config, {
            name: cleanName || null,
            phone: isEmail ? null : cleanContact,
            email: isEmail ? cleanContact : null,
            excerpt: cleanName ? `${cleanName} — ${cleanContact}` : cleanContact,
            source: "chat",
          }).catch(() => {})
        : null,
      sendTelegramMessage(
        `⚠️ Chat fallback capture (AI was down)\n` +
        `${siteSlug ? `Client site: ${siteSlug}\n` : ""}` +
        `👤 ${cleanName || "—"}\n📞 ${cleanContact}`,
        undefined, { plain: true },
      ),
    ]);

    return NextResponse.json({ ok: true }, { headers: cors });
  } catch (err) {
    console.error("chat-fallback error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500, headers: cors });
  }
}
