import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, estimateLeadValue } from "@/lib/supabase";
import { getClientSite } from "@/lib/clientSites";
import { buildReceptionistPrompt } from "@/lib/clientPrompt";
import { sendMetaCapiEvent } from "@/lib/metaCapi";
import { pricingPromptLines } from "@/lib/pricing";

export const runtime = "nodejs";
export const maxDuration = 30;

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

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

// Client-facing receptionists use Claude when ANTHROPIC_API_KEY is set —
// dramatically better French and safer guardrails than the 8B Llama, at
// pennies per conversation. Llama remains the fallback path.
const CLAUDE_MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You are Solia, the AI receptionist for Servolia — an AI client acquisition systems agency serving service businesses in Europe and the US.

# What Servolia offers
${pricingPromptLines()}

Payment: 50% deposit via Stripe to start, 50% on delivery. Monthly plan starts day 30.

# Target niches
Dental clinics, aesthetic clinics, med spas, real estate agents, home services (HVAC, plumbing, roofing), cosmetic surgeons, veterinary, law firms, wealth managers, IVF clinics.

# Your job
Have a SHORT, friendly conversation. Quickly understand:
1. Their business type (niche)
2. Biggest current problem (lost leads? no website? slow follow-up?)
3. City/country
4. Then recommend ONE package and offer a free audit at /free-audit

# Style
- Reply in 1-3 short sentences MAX. No walls of text.
- Match their language (French / English).
- Sound warm, confident, human. Never robotic.
- Recommend ONE package, not all four.
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
      console.error("Claude call failed, falling back to Cloudflare AI:", err);
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
  try {
    const { messages, sessionId, pageUrl, siteSlug } = await req.json() as {
      messages: ChatMessage[];
      sessionId?: string;
      pageUrl?: string;
      siteSlug?: string;
    };

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
      });
    }

    const db = supabaseAdmin();

    // ── CLIENT SITE branch: speak AS the client's business ────────────────
    if (siteSlug) {
      const config = await getClientSite(siteSlug);
      const systemContent = config ? buildReceptionistPrompt(config) : SYSTEM_PROMPT;
      const rawReply = (await runAssistant(messages, systemContent)).trim();
      const isBooking = /\[BOOKING\]/i.test(rawReply);
      const reply = rawReply.replace(/\[BOOKING\]/gi, "").trim();

      // Best-effort persistence tagged to the client (never blocks the reply).
      if (db && sessionId) {
        try {
          const fullMessages = [...messages, { role: "assistant" as const, content: reply }];
          const allText = fullMessages.map(m => m.content).join(" ");
          const emailMatch = allText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
          const phoneMatch = allText.match(/\+?[\d\s().-]{8,}/);
          const { data: existing } = await db.from("chat_sessions")
            .select("id").eq("session_id", sessionId).maybeSingle();
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
          else await db.from("chat_sessions").insert({ session_id: sessionId, ...row });

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

      return NextResponse.json({ reply, qualified: isBooking });
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
      const fullMessages = [...messages, { role: "assistant" as const, content: reply }];
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
    }, { status: 200 });
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
