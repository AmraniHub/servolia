import { NextRequest, NextResponse } from "next/server";
import { getClientEmail } from "@/lib/clientAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { loadAssistantContext, buildAssistantPrompt } from "@/lib/portalAssistant";
import { rateLimited } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * The client's in-portal help assistant. Authed by the portal session, so it
 * can only ever answer about the account that is logged in — the context is
 * loaded server-side from that email and never taken from the request body.
 *
 * Persists the transcript to `portal_ai_chats` so the founder can see what
 * clients actually ask (the questions ARE the product roadmap). Degrades
 * silently when that table doesn't exist yet — the assistant still answers.
 */

const CLAUDE_MODEL = "claude-haiku-4-5";

interface Msg { role: "user" | "assistant"; content: string }

async function reply(messages: Msg[], system: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const res = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    return text.trim() || null;
  } catch (err) {
    console.error("Portal assistant failed:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  // A logged-in client is already trusted, but inference costs money.
  if (await rateLimited(`portal-assistant:${email}`, 30, 600)) {
    return NextResponse.json({ error: "Too many questions at once — give it a minute." }, { status: 429 });
  }

  const { messages, lang } = (await req.json().catch(() => ({}))) as {
    messages?: Msg[]; lang?: "en" | "fr";
  };
  const history = (Array.isArray(messages) ? messages : []).slice(-12);
  if (!history.length) return NextResponse.json({ error: "No message" }, { status: 400 });

  const l: "en" | "fr" = lang === "fr" ? "fr" : "en";
  const ctx = await loadAssistantContext(email, l);
  const answer = await reply(history, buildAssistantPrompt(ctx));

  // No AI backend or the call failed — hand off honestly rather than stall.
  if (!answer) {
    return NextResponse.json({
      reply: l === "fr"
        ? "Je n'arrive pas à répondre pour le moment. Écrivez directement à Abdelali dans l'onglet Messages — il vous répond en personne."
        : "I can't answer right now. Send Abdelali a message in the Messages tab — he'll reply personally.",
      degraded: true,
    });
  }

  // Best-effort transcript, for the founder's visibility. Never blocks a reply.
  try {
    const db = supabaseAdmin();
    if (db) {
      const full = [...history, { role: "assistant" as const, content: answer }];
      const { data: existing } = await db.from("portal_ai_chats")
        .select("id").eq("email", email).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      const row = {
        email,
        business: ctx.businessName,
        messages: full,
        message_count: full.length,
        lang: l,
        updated_at: new Date().toISOString(),
      };
      if (existing) await db.from("portal_ai_chats").update(row).eq("id", (existing as { id: string }).id);
      else await db.from("portal_ai_chats").insert(row);
    }
  } catch { /* table not created yet — see roadmap.ts */ }

  return NextResponse.json({ reply: answer });
}
