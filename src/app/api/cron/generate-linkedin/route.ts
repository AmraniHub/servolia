import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegramMessage, telegramConfigured } from "@/lib/telegram";
import { getAllPosts } from "@/lib/content/dynamicPosts";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "claude-sonnet-4-5";

const TOPICS = [
  "Why response time — not price — decides who wins a service-business lead",
  "The hidden cost of a missed after-hours call for local businesses",
  "Why 'we'll call you back' is the most expensive sentence in business",
  "What actually happens in the 5 minutes after someone fills out a contact form",
  "The difference between a chatbot and an AI receptionist that actually books appointments",
  "Why service businesses lose more revenue to slow follow-up than to bad marketing",
  "How to tell if your booking process is costing you clients before you even meet them",
  "The real ROI math behind automating your front desk",
  "Why 'we're too busy for a website redesign' is exactly when you need one",
  "What a CRM actually needs to do for a 5-person service business (it's not what software companies sell you)",
  "The pattern behind every service business that scales past word-of-mouth",
  "Why fixed-price, fixed-deadline projects build more trust than hourly billing",
  "How AI qualification changes who gets your team's attention first",
  "The no-show problem nobody talks about — and the simple fix",
  "What separates a service business that's booked solid from one that's always chasing leads",
];

function extractJson<T>(raw: string): T | null {
  const cleaned = raw.replace(/```json\s*|```\s*$/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

interface LinkedInResult {
  body: string;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, reason: "ANTHROPIC_API_KEY not configured" });

  const db = supabaseAdmin();

  try {
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const client = new Anthropic({ apiKey });

    const prompt = `Write a LinkedIn post for the founder of Servolia, an agency that builds AI websites, AI receptionists, booking systems, and CRM dashboards for service businesses (dental clinics, law firms, real estate agents, contractors, accountants).

Topic: "${topic}"

Rules:
- This is thought leadership, NOT an ad. Never mention Servolia's own pricing, packages, or say "book a call with us."
- Structure: a hook (max 210 characters, must work as a standalone opening line), then 3-5 short paragraphs of substance (insight, reasoning, a concrete mental model — no fabricated statistics or client stories), then a closing line that ends with a genuine question to the reader.
- End with exactly 3 relevant hashtags on their own line.
- Plain, direct, confident tone. No emoji spam (max 1-2 total). No "in today's world" or "in conclusion" filler.
- Total length: 120-200 words.

Output ONLY this JSON object, no markdown fences: {"body":"the full post text with line breaks as \\n"}`;

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const result = extractJson<LinkedInResult>(text);
    if (!result?.body) {
      return NextResponse.json({ ok: false, reason: "Failed to parse generated content" });
    }

    // Pick the most relevant already-published post to reference in the first comment.
    const posts = await getAllPosts();
    const linkedSlug = posts[0]?.slug;

    let insertedId: string | null = null;
    if (db) {
      const { data: inserted } = await db.from("linkedin_drafts").insert({
        status: "draft",
        topic,
        body: result.body,
        linked_post_slug: linkedSlug ?? null,
      }).select("id").single();
      insertedId = inserted?.id ?? null;
    }

    if (telegramConfigured() && insertedId) {
      const preview = `💼 *New LinkedIn draft*\n\n${result.body}${linkedSlug ? `\n\n_First comment will link:_ servolia.com/blog/${linkedSlug}` : ""}`;
      const sent = await sendTelegramMessage(preview, [[
        { text: "✅ Post", callback_data: `linkedin_post:${insertedId}` },
        { text: "❌ Skip", callback_data: `linkedin_skip:${insertedId}` },
      ]]);
      if (sent && db) {
        await db.from("linkedin_drafts").update({
          telegram_chat_id: sent.chatId,
          telegram_message_id: sent.messageId,
        }).eq("id", insertedId);
      }
    }

    return NextResponse.json({ ok: true, topic, telegramNotified: telegramConfigured() });
  } catch (err) {
    console.error("LinkedIn generation error:", err);
    return NextResponse.json({ ok: false, reason: String(err) }, { status: 500 });
  }
}
