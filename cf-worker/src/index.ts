export interface Env {
  ANTHROPIC_API_KEY: string;
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

const SYSTEM_PROMPT = `You are Solia, the AI assistant for Servolia — an agency that builds AI-powered websites, booking systems, and lead systems for service businesses in Europe and the US.

Your job: have a natural conversation, understand the visitor's business, collect their contact info, and book them for a free audit.

PERSONALITY:
- Warm, confident, expert — like a smart business consultant
- Speak French if the visitor writes in French, English otherwise
- Never robotic, never corporate — conversational and direct
- Short messages (2-4 sentences max per reply)

CONVERSATION GOAL:
Naturally guide the conversation to collect:
1. Their business type / industry
2. Their main problem (no online bookings, no leads, bad website, etc.)
3. Their first name
4. Their email address

Once you have their email, tell them:
"Perfect! I've sent your details to our team. You'll receive your free audit within 24 hours at [email]. In the meantime, feel free to ask me anything about our services."

Then emit a special JSON block on a new line (the system uses this, users don't see it):
LEAD_CAPTURED:{"name":"[name]","email":"[email]","business":"[business type]","problem":"[main problem]"}

SERVICES CONTEXT:
- Starter Website: €690, 3-day delivery — 5-page site, contact form, GDPR, Google Analytics
- Growth Package: €1,490, 5-day delivery — website + AI chatbot + booking flow + CRM
- Pro System: €2,900, 7-day delivery — everything + admin dashboard + automations + monthly reports
- Monthly retainer: from €99/mo for maintenance, chatbot updates, and analytics

KEY DIFFERENTIATORS to mention naturally:
- Fixed price — they know the price before they pay
- 7-day delivery — not 7 weeks like other agencies
- GDPR compliant — required for EU businesses
- Stripe payments — secure, no bank transfer needed
- French + English — serve clients in France, Belgium, Switzerland, US

NICHES WE SERVE: dental clinics, aesthetic clinics/med spas, real estate agents, HVAC/roofing/plumbing, restaurants, accountants/lawyers

GUARANTEE: "If we miss our delivery deadline, you get 10% back per day of delay. We've never triggered this."

Start every new conversation with: "Hi! 👋 I'm Solia, Servolia's AI assistant. What kind of business do you run?"`;

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

async function callClaude(
  messages: Message[],
  env: Env
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  return data.content[0]?.text ?? "";
}

async function sendToTelegram(lead: LeadData, env: Env): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;

  const message =
    `🔥 *New Servolia Lead!*\n\n` +
    `👤 *Name:* ${lead.name}\n` +
    `📧 *Email:* ${lead.email}\n` +
    `🏢 *Business:* ${lead.business}\n` +
    `💬 *Problem:* ${lead.problem}\n\n` +
    `⚡ Source: AI Chatbot\n` +
    `🕐 Time: ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`;

  await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    }
  );
}

async function sendToGoogleSheets(lead: LeadData, env: Env): Promise<void> {
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
      source: "AI Chatbot",
    }),
  });
}

function extractLead(text: string): LeadData | null {
  const match = text.match(/LEAD_CAPTURED:(\{[^}]+\})/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as LeadData;
  } catch {
    return null;
  }
}

function cleanResponse(text: string): string {
  // Remove the LEAD_CAPTURED JSON block from the visible response
  return text.replace(/\nLEAD_CAPTURED:\{[^}]+\}/g, "").trim();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", service: "servolia-chat" }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Chat endpoint
    if (url.pathname === "/chat" && request.method === "POST") {
      try {
        const body = (await request.json()) as { messages: Message[] };
        const { messages } = body;

        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response(
            JSON.stringify({ error: "messages array required" }),
            { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
          );
        }

        const rawReply = await callClaude(messages, env);
        const cleanReply = cleanResponse(rawReply);

        // Check if lead was captured
        const lead = extractLead(rawReply);
        if (lead) {
          // Fire and forget — don't block the response
          Promise.all([
            sendToTelegram(lead, env),
            sendToGoogleSheets(lead, env),
          ]).catch(console.error);
        }

        return new Response(
          JSON.stringify({
            reply: cleanReply,
            leadCaptured: lead !== null,
          }),
          {
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      } catch (err) {
        console.error("Chat error:", err);
        return new Response(
          JSON.stringify({ error: "Something went wrong. Please try again." }),
          { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
    }

    // Contact form lead endpoint
    if (url.pathname === "/lead" && request.method === "POST") {
      try {
        const lead = (await request.json()) as LeadData & { plan?: string; website?: string };

        await Promise.all([
          sendToTelegram({ ...lead, problem: lead.problem || lead.plan || "" }, env),
          sendToGoogleSheets({ ...lead, problem: lead.problem || lead.plan || "" }, env),
        ]);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Lead error:", err);
        return new Response(JSON.stringify({ error: "Failed to submit lead" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
};
