import { NextRequest, NextResponse, after } from "next/server";
import { reportAiFallback } from "@/lib/aiHealth";
import { checkConversationCap } from "@/lib/conversationCap";
import { supabaseAdmin, estimateLeadValue } from "@/lib/supabase";
import { getClientSite } from "@/lib/clientSites";
import { notifyClientOfLead } from "@/lib/clientNotify";
import { buildReceptionistPrompt } from "@/lib/clientPrompt";
import { sendMetaCapiEvent } from "@/lib/metaCapi";
import { pricingPromptLines } from "@/lib/pricing";
import { assistantEnabled, previewOrigin, previewable, previewBudgetOk } from "@/lib/assistantAccess";
import { originAllowed, corsHeaders, sanitizeMessages } from "@/lib/assistant";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * CORS PREFLIGHT. A client's site embeds assistant.js, and the browser asks
 * permission before the widget's first POST. The body is not readable here, so
 * the slug is unknown and the preflight is answered for every origin; the
 * POST below is where a foreign origin is actually checked against the slug
 * it asks for. Answering `*` to a preflight and a specific origin to the
 * request is valid CORS and leaks nothing.
 */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders("*") });
}

/**
 * A speed bump for the open endpoint, per serverless instance. Not a wall —
 * instances do not share memory — but enough that a script hammering one
 * slug pays for a fraction of what it would otherwise, and cheap enough to
 * have. Real cost control is the message cap in sanitizeMessages.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const rate = new Map<string, { n: number; at: number }>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const e = rate.get(key);
  if (!e || now - e.at > RATE_WINDOW_MS) {
    rate.set(key, { n: 1, at: now });
    if (rate.size > 5000) rate.clear();
    return false;
  }
  e.n += 1;
  return e.n > RATE_MAX;
}

/**
 * Servolia chatbot — "Solia"
 * Uses Cloudflare Workers AI (Llama 3.1 8B Instruct).
 * Free tier: 10,000 neurons/day (~thousands of replies). Fast, EU/US hosted.
 *
 * Setup:
 *   1. Cloudflare dashboard → Workers & Pages → "AI" → Get API token
 *      OR Profile → API Tokens → "Workers AI" template
 *   2. Note your Account ID (dash.cloudflare.com → URL has /accounts/{ID}/)
 *   3. Vercel env vars:
 *        CLOUDFLARE_ACCOUNT_ID = your account id
 *        CLOUDFLARE_AI_TOKEN   = your API token
 */

// 2026-09-05: this id routes to @cf/meta/infire-llama-3.1-8b-instruct,
// DEPRECATED 2026-05-30 - so the Claude fallback was a trapdoor, not a
// safety net: when Claude failed this threw AiError 5028 and took the whole
// request with it. Same bug killed the cf-worker chatbot for three months.
// Verify with `wrangler ai models` before changing this.
const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

// Client-facing receptionists use Claude when ANTHROPIC_API_KEY is set —
// dramatically better French and safer guardrails than the 8B Llama, at
// pennies per conversation. Llama remains the fallback path.
const CLAUDE_MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You are Solia, the AI receptionist for Servolia — an AI client acquisition systems agency serving service businesses in Europe and the US.

# What Servolia offers
${pricingPromptLines()}

Payment: the installation is paid in full via Stripe to start — nothing is owed on delivery. The monthly plan begins once the site is live.

# Target niches
Dental clinics, aesthetic clinics, med spas, cosmetic surgeons, veterinary clinics, home services (HVAC, plumbing, roofing).

# Your job
Have a SHORT, friendly conversation. Quickly understand:
1. Their business type (niche)
2. Biggest current problem (lost leads? no website? slow follow-up?)
3. City/country
4. Then recommend ONE monthly plan and offer a free audit at /free-audit

# Style
- Reply in 1-3 short sentences MAX. No walls of text.
- Match their language (French / English).
- Sound warm, confident, human. Never robotic.
- Recommend ONE plan, not all three. Croissance is the usual answer.
- If they're not a fit (B2B SaaS, agencies, hobbyists), politely say so.
- If asked "what's the cost" — give a real range. Don't dodge.
- For a human, share hello@servolia.com or /contact.

# Lead qualification
If you have their business type + email (or business + phone), reply with: "Perfect — I'll have our team send your free audit within 24 hours" and add the internal tag [QUALIFIED] at the very end. The frontend hides it.

Today is ${new Date().toISOString().slice(0, 10)}.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function callClaude(messages: ChatMessage[], systemContent: string): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 400,
    system: systemContent,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
  if (!text) throw new Error("Claude returned no text");
  return text;
}

/** Prefer Claude, fall back to Cloudflare Llama — whichever is configured and up. */
async function runAssistant(messages: ChatMessage[], systemContent: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await callClaude(messages, systemContent);
    } catch (err) {
      // Loud, throttled alert: the reply still goes out, but on the weaker
      // model. A console line here meant weeks of degraded service could
      // pass unnoticed by everyone except the patient on the other end.
      await reportAiFallback("receptionist", err);
    }
  }
  return callCloudflareAI(messages, systemContent);
}

/** Pull utm_* params out of the landing URL for ad attribution. */
function parseUtm(pageUrl?: string): Record<string, string> | null {
  if (!pageUrl || !pageUrl.includes("utm_")) return null;
  try {
    const qs = new URLSearchParams(pageUrl.split("?")[1] ?? "");
    const utm: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const v = qs.get(key);
      if (v) utm[key] = v.slice(0, 120);
    }
    return Object.keys(utm).length ? utm : null;
  } catch {
    return null;
  }
}

async function callCloudflareAI(messages: ChatMessage[], systemContent: string): Promise<string> {
  const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID ?? "").replace(/^﻿/, "").trim();
  const token = (process.env.CLOUDFLARE_AI_TOKEN ?? "").replace(/^﻿/, "").trim();
  if (!accountId || !token) throw new Error("Cloudflare AI not configured");

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemContent },
          ...messages.map(m => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudflare AI error: ${res.status} ${text}`);
  }

  const data = await res.json() as {
    result?: { response?: string };
    success?: boolean;
    errors?: { message: string }[];
  };

  if (!data.success || !data.result?.response) {
    throw new Error(`Cloudflare AI returned no response: ${JSON.stringify(data.errors ?? data)}`);
  }
  return data.result.response;
}

export async function POST(req: NextRequest) {
  /* Set once the slug's config has accepted this origin. Every response in
     the client-site branch — the reply, the refusals, the catch — carries it,
     because a reply the browser is not allowed to read is a widget that shows
     a spinner forever. */
  const origin = req.headers.get("origin");
  let cors: Record<string, string> = {};
  try {
    const body = await req.json() as {
      messages?: unknown;
      sessionId?: string;
      pageUrl?: string;
      siteSlug?: string;
      preview?: unknown;
    };
    const { sessionId, pageUrl } = body;
    const siteSlug = typeof body.siteSlug === "string" ? body.siteSlug.trim().slice(0, 64) : undefined;
    /* True only once the showroom rule below has accepted it. Read as "this
       conversation is nobody's customer": the model answers, nothing is
       stored, nobody is notified. */
    let preview = false;
    // Last twelve turns, each trimmed. A 200 KB "question" is a bill, not a customer.
    const messages: ChatMessage[] = sanitizeMessages(body.messages);
    if (!messages.length) {
      return NextResponse.json({ error: "No message" }, { status: 400, headers: cors });
    }

    // ZERO-MISS CLOCK. The CGV (s4 bis) guarantee a reply within 60 seconds,
    // measured on Servolia's own server-side timestamps — so the clock starts
    // the moment the enquiry lands here and is stamped onto the assistant
    // message we persist. Without this the guarantee is unverifiable, which is
    // worse than not offering one. See src/lib/zeroMiss.ts.
    const replyClockStart = Date.now();

    /* ── WHO MAY TALK TO WHICH ASSISTANT, decided before any model is paid for.
     *
     * A client-site request names a slug. Its config says which websites may
     * embed it; a browser on any other site is refused, so nobody can put a
     * client's assistant — and their model bill — on a page of their own. Then
     * the subscription is checked: an assistant whose payment lapsed answers
     * 403, and the widget (which already saw enabled:false from /api/assistant)
     * is not on the page to ask. Both checks come before the no-backend
     * fallback so that a refusal is a refusal, not a lead form. */
    const config = siteSlug ? await getClientSite(siteSlug) : undefined;
    if (siteSlug) {
      if (config && !originAllowed(origin, config)) {
        return NextResponse.json({ error: "This site may not use that assistant." }, { status: 403 });
      }
      cors = corsHeaders(origin);
      if (!config) {
        return NextResponse.json({ error: "Chat is not enabled for this site." }, { status: 403, headers: cors });
      }
      if (!(await assistantEnabled(config))) {
        /* THE SHOWROOM: an unpaid brief answers from our own pages only, when
           asked for as a preview, inside a daily budget. Anywhere else, and
           in particular on the client's own website, unpaid stays 403. */
        preview = body.preview === true && previewable(config) && previewOrigin(req.headers) && previewBudgetOk(siteSlug);
        if (!preview) {
          return NextResponse.json({ error: "Chat is not enabled for this site." }, { status: 403, headers: cors });
        }
      }
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
      if (rateLimited(`${siteSlug}:${ip}`)) {
        return NextResponse.json({ error: "Too many messages — try again in a minute." }, { status: 429, headers: cors });
      }
    }

    const cfConfigured = !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AI_TOKEN);
    if (!process.env.ANTHROPIC_API_KEY && !cfConfigured) {
      // No AI backend at all — tell the widget to degrade to its lead-capture form.
      // On client sites, stay white-label: never mention Solia/Servolia.
      return NextResponse.json({
        reply: siteSlug
          ? "Thanks for reaching out! Leave your details below and the team will get back to you shortly."
          : "Hi! 👋 I'm Solia. Our chat is being upgraded right now — leave your details below and we'll get back to you within a few hours.",
        qualified: false,
        fallback: true,
      }, { headers: cors });
    }

    const db = supabaseAdmin();

    // ── CLIENT SITE branch: speak AS the client's business ────────────────
    if (siteSlug) {
      const systemContent = config ? buildReceptionistPrompt(config) : SYSTEM_PROMPT;
      const rawReply = (await runAssistant(messages, systemContent)).trim();
      const isBooking = /\[BOOKING\]/i.test(rawReply);
      const reply = rawReply.replace(/\[BOOKING\]/gi, "").trim();

      // Best-effort persistence tagged to the client (never blocks the reply).
      // A PREVIEW is persisted nowhere and alerts nobody: the person typing
      // is the owner trying their own assistant, or a stranger with the link,
      // and neither is a lead — a "new enquiry" WhatsApp for the owner's own
      // test would be the first thing to make the product feel fake.
      if (db && sessionId && !preview) {
        try {
          const replyMs = Date.now() - replyClockStart;
          const fullMessages = [
            ...messages,
            { role: "assistant" as const, content: reply, ts: new Date().toISOString(), ms: replyMs },
          ];
          const allText = fullMessages.map(m => m.content).join(" ");
          const emailMatch = allText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
          const phoneMatch = allText.match(/\+?[\d\s().-]{8,}/);
          const { data: existing } = await db.from("chat_sessions")
            .select("id, qualified").eq("session_id", sessionId).maybeSingle();
          const row = {
            messages: fullMessages,
            message_count: fullMessages.length,
            qualified: isBooking,
            email_captured: emailMatch?.[0] ?? null,
            phone_captured: phoneMatch?.[0] ?? null,
            site_slug: siteSlug,
            page_url: pageUrl ?? null,
            utm: parseUtm(pageUrl) ?? undefined,
          };
          if (existing) await db.from("chat_sessions").update(row).eq("id", existing.id);
          else {
            await db.from("chat_sessions").insert({ session_id: sessionId, ...row });
            // A NEW conversation was counted: check it against the plan after
            // the reply has gone out. Never a cut-off — an email at 80 % and
            // 100 %, and the founder told (src/lib/conversationCap.ts).
            after(() => checkConversationCap(siteSlug));
          }

          // Alert the clinic owner the FIRST time this conversation becomes a
          // booking (transition only — a long chat can never spam them).
          const wasQualified = !!(existing as { qualified?: boolean } | null)?.qualified;
          if (isBooking && !wasQualified && config && !config.isDemo) {
            const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
            notifyClientOfLead(config, {
              phone: phoneMatch?.[0] ?? null,
              email: emailMatch?.[0] ?? null,
              excerpt: lastUserMsg.slice(0, 400),
              source: "chat",
            }).catch(() => {});
          }

          // Ads closed loop: a booking on a client site fires a Lead event on the
          // CLIENT's pixel, so their Ads Manager sees which euro became a consultation.
          if (isBooking && config?.metaPixelId && config?.metaCapiToken) {
            sendMetaCapiEvent({
              eventName: "Lead",
              email: emailMatch?.[0],
              phone: phoneMatch?.[0],
              eventSourceUrl: pageUrl,
              pixelId: config.metaPixelId,
              accessToken: config.metaCapiToken,
              req,
            });
          }
        } catch { /* table/column may not exist yet — reply still returns */ }
      }

      return NextResponse.json({ reply, qualified: isBooking }, { headers: cors });
    }

    // ── Check for returning visitor (chatbot memory) ──────────────────────
    let priorContext: string | undefined;
    const allTextSoFar = messages.map(m => m.content).join(" ");
    const earlyEmail = allTextSoFar.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    if (earlyEmail && db && sessionId) {
      const { data: prior } = await db
        .from("chat_sessions")
        .select("messages, created_at, qualified")
        .eq("email_captured", earlyEmail[0])
        .neq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (prior && prior.length > 0) {
        const prevMessages = (prior[0].messages as ChatMessage[]) ?? [];
        const summary = prevMessages.slice(0, 6).map(m => `${m.role}: ${m.content}`).join("\n");
        const prevDate = new Date(prior[0].created_at).toLocaleDateString();
        priorContext = `\n\n# Returning visitor\nThis person has chatted with you before (${prevDate}). Their prior conversation:\n${summary}\nGreet them naturally as a returning visitor — don't repeat questions you already asked. Pick up where they left off.`;
      }
    }

    const rawReply = (await runAssistant(messages, SYSTEM_PROMPT + (priorContext ?? ""))).trim();
    const isQualified = /\[QUALIFIED\]/i.test(rawReply);
    const reply = rawReply.replace(/\[QUALIFIED\]/gi, "").trim();

    // ── Persist chat session ──────────────────────────────────────────────
    if (db && sessionId) {
      const replyMs = Date.now() - replyClockStart;
      const fullMessages = [
        ...messages,
        { role: "assistant" as const, content: reply, ts: new Date().toISOString(), ms: replyMs },
      ];
      const allText = fullMessages.map(m => m.content).join(" ");
      const emailMatch = allText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      const phoneMatch = allText.match(/\+?[\d\s().-]{8,}/);

      const { data: existing } = await db
        .from("chat_sessions")
        .select("id, lead_id")
        .eq("session_id", sessionId)
        .maybeSingle();

      if (existing) {
        await db.from("chat_sessions").update({
          messages: fullMessages,
          message_count: fullMessages.length,
          qualified: isQualified || !!existing.lead_id,
          email_captured: emailMatch?.[0] ?? null,
          phone_captured: phoneMatch?.[0] ?? null,
        }).eq("id", existing.id);
      } else {
        await db.from("chat_sessions").insert({
          session_id: sessionId,
          messages: fullMessages,
          message_count: fullMessages.length,
          qualified: isQualified,
          email_captured: emailMatch?.[0] ?? null,
          phone_captured: phoneMatch?.[0] ?? null,
          page_url: pageUrl ?? null,
          utm: parseUtm(pageUrl) ?? undefined,
        });
      }

      // Qualified + has email → create a Lead and link
      if (isQualified && emailMatch) {
        const summary = summarizeChatToLead(fullMessages);

        const { data: lead } = await db.from("leads").insert({
          email: emailMatch[0],
          phone: phoneMatch?.[0] ?? null,
          business: summary.business,
          niche: summary.niche,
          country: summary.country,
          source: "chatbot",
          stage: "new",
          value_estimate: estimateLeadValue(summary.niche),
          notes: summary.notes,
          raw_data: { conversation: fullMessages },
        }).select("id").single();

        if (lead) {
          await db.from("chat_sessions")
            .update({ lead_id: lead.id, qualified: true })
            .eq("session_id", sessionId);

          sendMetaCapiEvent({
            eventName: "Lead",
            email: emailMatch[0],
            phone: phoneMatch?.[0],
            eventSourceUrl: pageUrl ? `https://servolia.com${pageUrl}` : "https://servolia.com",
          });

          const tgToken = process.env.TELEGRAM_BOT_TOKEN;
          const tgChatId = process.env.TELEGRAM_CHAT_ID;
          if (tgToken && tgChatId) {
            const msg = `🤖 *Chatbot captured a lead*\n` +
                        `*${summary.business || "Unknown business"}*\n` +
                        `📧 ${emailMatch[0]}\n` +
                        `🎯 ${summary.niche || "—"}\n\n` +
                        `[Open in CRM](https://servolia.com/admin/leads/${lead.id})`;
            fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: tgChatId, text: msg, parse_mode: "Markdown" }),
            }).catch(() => {});
          }
        }
      }
    }

    return NextResponse.json({ reply, qualified: isQualified });
  } catch (err) {
    console.error("Chat API error:", err);
    // Graceful degradation: tell the widget to switch to its lead-capture form
    // so a broken AI backend never costs the business the enquiry.
    return NextResponse.json({
      reply: "Sorry, I'm having a connection issue — leave your details below and we'll get right back to you 🙏",
      qualified: false,
      fallback: true,
    }, { status: 200, headers: cors });
  }
}

function summarizeChatToLead(messages: ChatMessage[]): {
  business?: string;
  niche?: string;
  country?: string;
  notes: string;
} {
  const userText = messages.filter(m => m.role === "user").map(m => m.content).join(" ").toLowerCase();

  const nicheMap: Record<string, string> = {
    "dental": "dental", "dentist": "dental",
    "aesthetic": "aesthetic", "med spa": "med-spa", "medspa": "med-spa",
    "real estate": "real-estate", "realtor": "real-estate", "immobilier": "real-estate",
    "home services": "home-services", "hvac": "home-services", "plumb": "home-services", "roof": "home-services",
    "vet": "veterinary", "law": "law-firm", "lawyer": "law-firm", "avocat": "law-firm",
    "wealth": "wealth-management", "ivf": "ivf", "fertility": "ivf",
    "restaurant": "restaurant", "salon": "salon", "spa": "aesthetic",
  };

  let niche: string | undefined;
  for (const [k, v] of Object.entries(nicheMap)) {
    if (userText.includes(k)) { niche = v; break; }
  }

  const countryMap = ["france","belgium","switzerland","monaco","germany","italy","spain","united kingdom","uk","us","united states","canada","morocco"];
  let country: string | undefined;
  for (const c of countryMap) {
    if (userText.includes(c)) { country = c; break; }
  }

  const businessGuess = messages.find(m => m.role === "user" && m.content.length < 60 && m.content.length > 3);

  return {
    business: businessGuess?.content,
    niche,
    country,
    notes: messages.slice(0, 6).map(m => `${m.role}: ${m.content}`).join("\n"),
  };
}
