export interface Env {
  AI: Ai;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  GOOGLE_SHEETS_WEBHOOK_URL: string;
  WORKER_ENV: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Llama model — fast 8B for chat, swap to llama-3.3-70b for higher quality
const LLAMA_MODEL = "@cf/meta/llama-3.1-8b-instruct";

const SYSTEM_PROMPT = `You are Solia, the AI assistant for Servolia — an agency that builds AI-powered websites, booking systems, and lead systems for service businesses in Europe and the US.

Your job: have a warm natural conversation, understand the visitor's business, and collect their contact info to book a free audit.

PERSONALITY:
- Warm, confident, expert — like a smart business consultant friend
- Speak French if the visitor writes in French, English otherwise
- Short replies only — 2-3 sentences max per message
- Never robotic or corporate

CONVERSATION GOAL — collect in this order (naturally, not like a form):
1. Their business type / industry
2. Their main problem (no bookings, no leads, bad website, etc.)
3. Their first name
4. Their email address

Once you have their email, say:
"Perfect [name]! I've sent your details to our team. You'll receive your free audit at [email] within 24 hours. Feel free to ask me anything in the meantime!"

Then on a NEW LINE emit exactly this (invisible to users, parsed by system):
LEAD_CAPTURED:{"name":"[name]","email":"[email]","business":"[business]","problem":"[problem]"}

SERVICES:
- Starter Website: €690, 3 days — 5-page site, GDPR, Google Analytics
- Growth Package: €1,490, 5 days — website + AI chatbot + booking + CRM
- Pro System: €2,900, 7 days — everything + admin dashboard + automations
- Monthly retainer: from €99/mo

KEY POINTS to mention naturally:
- Fixed price — they know the cost before paying
- 7-day delivery — not 7 weeks like traditional agencies
- GDPR compliant — required for EU businesses
- French + English service

NICHES: dental clinics, aesthetic clinics, real estate, HVAC/plumbing, restaurants, accountants/lawyers

GUARANTEE: "If we miss the deadline, clients get 10% back per day late. We've never triggered it."

Start each new conversation with: "Hi! 👋 I'm Solia, Servolia's AI assistant. What kind of business do you run?"`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface LeadData {
  name: string;
  email: string;
  business: string;
  problem: string;
}

interface AiTextGenerationOutput {
  response?: string;
}

async function runLlama(messages: Message[], env: Env): Promise<string> {
  const result = await env.AI.run(LLAMA_MODEL, {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ],
    max_tokens: 350,
    temperature: 0.7,
  }) as AiTextGenerationOutput;

  return result.response ?? "";
}

async function sendToTelegram(lead: LeadData, source: string, env: Env): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;

  const msg =
    `🔥 *New Servolia Lead!*\n\n` +
    `👤 *Name:* ${lead.name}\n` +
    `📧 *Email:* ${lead.email}\n` +
    `🏢 *Business:* ${lead.business}\n` +
    `💬 *Problem:* ${lead.problem}\n\n` +
    `⚡ Source: ${source}\n` +
    `🕐 ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`;

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: msg,
      parse_mode: "Markdown",
    }),
  });
}

async function sendToSheets(lead: LeadData & { source?: string }, env: Env): Promise<void> {
  if (!env.GOOGLE_SHEETS_WEBHOOK_URL) return;

  await fetch(env.GOOGLE_SHEETS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      name: lead.name,
      email: lead.email,
      business: lead.business,
      problem: lead.problem,
      source: lead.source ?? "AI Chatbot (Llama)",
    }),
  });
}

function extractLead(text: string): LeadData | null {
  const match = text.match(/LEAD_CAPTURED:\{([^}]+)\}/);
  if (!match) return null;
  try {
    return JSON.parse(`{${match[1]}}`) as LeadData;
  } catch {
    return null;
  }
}

function cleanReply(text: string): string {
  return text.replace(/\nLEAD_CAPTURED:\{[^}]+\}/g, "").trim();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", model: LLAMA_MODEL, service: "servolia-chat" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Chat endpoint — Llama via Workers AI
    if (url.pathname === "/chat" && request.method === "POST") {
      try {
        const { messages } = await request.json() as { messages: Message[] };

        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response(
            JSON.stringify({ error: "messages array required" }),
            { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
          );
        }

        const raw = await runLlama(messages, env);
        const reply = cleanReply(raw);
        const lead = extractLead(raw);

        if (lead) {
          // Non-blocking — don't delay the response
          Promise.all([
            sendToTelegram(lead, "AI Chatbot (Llama)", env),
            sendToSheets({ ...lead, source: "AI Chatbot (Llama)" }, env),
          ]).catch(console.error);
        }

        return new Response(
          JSON.stringify({ reply, leadCaptured: lead !== null }),
          { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("Chat error:", err);
        return new Response(
          JSON.stringify({ error: "Something went wrong. Email us at hello@servolia.com" }),
          { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
    }

    // Contact form lead — fires Telegram + Sheets
    if (url.pathname === "/lead" && request.method === "POST") {
      try {
        const body = await request.json() as LeadData & { plan?: string; source?: string };
        const lead: LeadData = {
          name: body.name ?? "",
          email: body.email ?? "",
          business: body.business ?? "",
          problem: body.problem ?? body.plan ?? "",
        };
        const source = body.source ?? "Contact Form";

        await Promise.all([
          sendToTelegram(lead, source, env),
          sendToSheets({ ...lead, source }, env),
        ]);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("Lead error:", err);
        return new Response(
          JSON.stringify({ error: "Failed to submit" }),
          { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
};
