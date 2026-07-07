import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegramMessage, telegramConfigured } from "@/lib/telegram";
import { pollinationsImageUrl } from "@/lib/pollinations";
import { pickCluster, type KeywordCluster } from "@/lib/blogClusters";
import type { Block } from "@/lib/content/posts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-haiku-4-5-20251001";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function extractJson<T>(raw: string): T | null {
  const cleaned = raw.replace(/```json\s*|```\s*$/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

async function fetchVisitorQuestions(): Promise<string[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  try {
    const { data } = await db
      .from("chat_sessions")
      .select("messages")
      .order("created_at", { ascending: false })
      .limit(15);
    const rows = (data as { messages: { role: string; content: string }[] }[] | null) ?? [];
    const questions: string[] = [];
    for (const row of rows) {
      for (const m of row.messages ?? []) {
        if (m.role === "user" && m.content.length > 8 && m.content.length < 200) {
          questions.push(m.content);
        }
      }
    }
    return questions.slice(0, 10);
  } catch {
    return [];
  }
}

async function generateBody(client: Anthropic, cluster: KeywordCluster, visitorQuestions: string[]): Promise<Block[] | null> {
  const contextLine = visitorQuestions.length
    ? `\n\nReal questions recent website visitors asked (use as inspiration for what to cover — do not quote verbatim):\n${visitorQuestions.map((q) => `- ${q}`).join("\n")}`
    : "";

  const prompt = `You are writing an SEO blog article for Servolia, an agency that builds AI websites, AI receptionists, booking systems, and CRM dashboards for service businesses in Europe and the US.

Primary keyword to target: "${cluster.keyword}"
Angle: ${cluster.angle}
Target niche: ${cluster.niche.replace(/-/g, " ")}
${contextLine}

Write the article body as a JSON array of content blocks. Each block is one of:
{"type":"p","text":"..."}
{"type":"h2","text":"..."}
{"type":"ul","items":["...","..."]}
{"type":"ol","items":["...","..."]}
{"type":"quote","text":"..."}
{"type":"callout","text":"..."}

Hard rules:
- The primary keyword must appear naturally in the first paragraph.
- Include at least 2 "h2" section headers, one of which contains the primary keyword.
- Total body length across all "p" blocks: 900–1300 words (concise, no padding, no filler like "in conclusion" or "in today's world").
- Include exactly one "quote" block with a punchy, standalone insight.
- Include exactly one "callout" block with a practical tip (start it with "💡 ").
- End with an "h2" titled "FAQ" followed by 3 question/answer pairs as short "p" blocks (bold the question inline is not supported — just phrase each answer paragraph starting with the question as a sentence).
- Never invent specific statistics, client names, or client counts. Speak in terms of mechanisms and reasoning, not fabricated data.
- Write for a service-business owner, not a developer. Practical, direct, no fluff.

Output ONLY the JSON array, no markdown fences, no commentary before or after.`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
  return extractJson<Block[]>(text);
}

interface MetaResult {
  title: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  ctaHeadline: string;
}

async function generateMeta(client: Anthropic, cluster: KeywordCluster): Promise<MetaResult | null> {
  const prompt = `For a blog article targeting the SEO keyword "${cluster.keyword}" (angle: ${cluster.angle}, niche: ${cluster.niche.replace(/-/g, " ")}), generate:
{"title":"an engaging H1, under 70 chars, includes the keyword naturally","excerpt":"a 1-2 sentence teaser, under 200 chars","metaTitle":"SEO title tag, under 60 chars","metaDescription":"SEO meta description, under 155 chars, includes the keyword","ctaHeadline":"a short punchy call-to-action headline related to the topic, under 60 chars"}

Output ONLY this JSON object, no markdown fences, no commentary.`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
  return extractJson<MetaResult>(text);
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, reason: "ANTHROPIC_API_KEY not configured" });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, reason: "Supabase not configured" });

  try {
    const { count } = await db.from("blog_posts").select("id", { count: "exact", head: true });
    const cluster = pickCluster(count ?? 0);

    const [visitorQuestions, client] = await Promise.all([
      fetchVisitorQuestions(),
      Promise.resolve(new Anthropic({ apiKey })),
    ]);

    const [body, meta] = await Promise.all([
      generateBody(client, cluster, visitorQuestions),
      generateMeta(client, cluster),
    ]);

    if (!body || !meta) {
      return NextResponse.json({ ok: false, reason: "Failed to parse generated content" });
    }

    const slug = `${slugify(meta.title)}-${Date.now().toString(36).slice(-4)}`;
    const coverImageUrl = pollinationsImageUrl(cluster.category);
    const wordCount = body.filter((b): b is Extract<Block, { type: "p" }> => b.type === "p")
      .reduce((s, b) => s + b.text.split(/\s+/).length, 0);
    const readingMinutes = Math.max(3, Math.round(wordCount / 220));

    const { data: inserted, error } = await db.from("blog_posts").insert({
      slug,
      status: "draft",
      title: meta.title,
      excerpt: meta.excerpt,
      category: cluster.category,
      reading_minutes: readingMinutes,
      meta_title: meta.metaTitle,
      meta_description: meta.metaDescription,
      cta_headline: meta.ctaHeadline,
      cover_image_url: coverImageUrl,
      body,
      keyword_cluster: cluster.keyword,
    }).select("id").single();

    if (error || !inserted) {
      return NextResponse.json({ ok: false, reason: `DB insert failed: ${error?.message}` });
    }

    if (telegramConfigured()) {
      const preview = `📝 *New blog draft ready*\n\n*${meta.title}*\n_${meta.excerpt}_\n\n🎯 Keyword: ${cluster.keyword}\n📁 ${cluster.category} · ~${readingMinutes} min read`;
      const sent = await sendTelegramMessage(preview, [[
        { text: "✅ Publish", callback_data: `blog_publish:${inserted.id}` },
        { text: "❌ Skip", callback_data: `blog_skip:${inserted.id}` },
      ]]);
      if (sent) {
        await db.from("blog_posts").update({
          telegram_chat_id: sent.chatId,
          telegram_message_id: sent.messageId,
        }).eq("id", inserted.id);
      }
    }

    return NextResponse.json({ ok: true, slug, cluster: cluster.keyword, telegramNotified: telegramConfigured() });
  } catch (err) {
    console.error("Blog generation error:", err);
    return NextResponse.json({ ok: false, reason: String(err) }, { status: 500 });
  }
}
