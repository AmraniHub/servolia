import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, estimateLeadValue } from "@/lib/supabase";
import { getClientSite } from "@/lib/clientSites";
import { buildReceptionistPrompt } from "@/lib/clientPrompt";
import { sendMetaCapiEvent } from "@/lib/metaCapi";

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

const SYSTEM_PROMPT = `You are Solia, the AI receptionist for Servolia — an AI client acquisition systems agency serving service businesses in Europe and the US.

# What Servolia offers
1. AI Website System — €490, 3 days. Conversion-focused website.
2. AI Booking System — €990, 5 days. Website + AI receptionist + booking.
3. Ads Landing System — €490 + €200/mo. High-converting landing page with full tracking.
4. AI Client System — €1,900, 7 days. Complete: site + chatbot + admin dashboard + CRM + monthly reports.
5. Monthly Care Plans — €69 / €149 / €299 for hosting, retraining, reports.

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
  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_AI_TOKEN) {
    return NextResponse.json({
      reply: "Hi! 👋 I'm Solia. Our chat is being upgraded right now — please email us at hello@servolia.com and we'll respond within 24 hours.",
      qualified: false,
    });
  }

  try {
    const { messages, sessionId, pageUrl, siteSlug } = await req.json() as {
      messages: ChatMessage[];
      sessionId?: string;
      pageUrl?: string;
      siteSlug?: string;
    };

    const db = supabaseAdmin();

    // ── CLIENT SITE branch: speak AS the client's business ────────────────
    if (siteSlug) {
      const config = await getClientSite(siteSlug);
      const systemContent = config ? buildReceptionistPrompt(config) : SYSTEM_PROMPT;
      const rawReply = (await callCloudflareAI(messages, systemContent)).trim();
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
          };
          if (existing) await db.from("chat_sessions").update(row).eq("id", existing.id);
          else await db.from("chat_sessions").insert({ session_id: sessionId, ...row });
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

    const rawReply = (await callCloudflareAI(messages, SYSTEM_PROMPT + (priorContext ?? ""))).trim();
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
    return NextResponse.json({
      reply: "Sorry, I'm having a connection issue. Please email us at hello@servolia.com and we'll get right back to you 🙏",
      qualified: false,
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
