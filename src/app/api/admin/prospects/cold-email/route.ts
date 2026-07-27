import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Cold-email drafter + sender for a prospect that already has a generated demo.
 *
 * POST { id, mode: "draft" } → { subject, body } — Claude drafts a short,
 *   personalized cold email in the prospect's language pointing at their demo.
 *
 * POST { id, mode: "send", subject, body } → { sent: true } — sends via Resend
 *   from the configured EMAIL_FROM, then logs a touch on the prospect and
 *   advances stage to demo_sent if it isn't already past it.
 *
 * Same "pre-sale asset" idea as /api/admin/demo: no build, no payment — this
 * is the outbound layer on top of it.
 */

const MODEL = "claude-haiku-4-5-20251001";

interface ProspectRow {
  id: string;
  business: string;
  owner_name: string | null;
  city: string | null;
  niche: string | null;
  email: string | null;
  website: string | null;
  demo_slug: string | null;
  status: string;
  touch_count: number | null;
  mystery_shop_notes: string | null;
}

const ADVANCED_STAGES = new Set(["demo_sent", "followup_1", "followup_2", "replied", "call_booked", "won", "lost"]);

function pickLang(p: ProspectRow): "fr" | "en" {
  const fr = /(france|fr\b|\.fr\b|paris|lyon|marseille|toulouse|nice|bordeaux|lille|nantes)/i;
  if (p.city && fr.test(p.city)) return "fr";
  if (p.website && /\.fr\b/i.test(p.website)) return "fr";
  return "fr"; // French beachhead — default to French for outbound
}

function fallbackDraft(p: ProspectRow, previewUrl: string, lang: "fr" | "en") {
  const firstName = p.owner_name?.trim().split(/\s+/)[0] || null;
  if (lang === "fr") {
    return {
      subject: `${p.business} — un aperçu que j'ai préparé pour vous`,
      body: [
        firstName ? `Bonjour ${firstName},` : `Bonjour,`,
        ``,
        `Je m'appelle Amrani, je dirige Servolia — nous équipons les cliniques en assistants IA qui répondent aux patients 24 h/24 et prennent les rendez-vous à votre place.`,
        ``,
        `J'ai préparé un aperçu à votre nom, sans engagement de votre part :`,
        previewUrl,
        ``,
        `Ouvrez-le, parlez à l'assistant comme le ferait un patient, et dites-moi ce que vous en pensez. Si c'est utile, on peut le rendre 100 % à votre image en quelques jours.`,
        ``,
        `Bien à vous,`,
        `Amrani — Servolia`,
      ].join("\n"),
    };
  }
  return {
    subject: `${p.business} — a preview I built for you`,
    body: [
      firstName ? `Hi ${firstName},` : `Hi,`,
      ``,
      `I'm Amrani, I run Servolia — we build AI receptionists for clinics that answer patients 24/7 and book appointments for you.`,
      ``,
      `I put together a preview in your name — no strings attached:`,
      previewUrl,
      ``,
      `Open it, talk to the assistant like a patient would, and tell me what you think. If it's useful, we can make it fully yours in a few days.`,
      ``,
      `Best,`,
      `Amrani — Servolia`,
    ].join("\n"),
  };
}

async function aiDraft(p: ProspectRow, previewUrl: string, lang: "fr" | "en"): Promise<{ subject: string; body: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackDraft(p, previewUrl, lang);

  const langName = lang === "fr" ? "French" : "English";
  const prompt = `You are Amrani, founder of Servolia — an agency that builds AI receptionists + websites for service businesses. You are writing a COLD OUTBOUND email to a prospect you have never spoken to.

PROSPECT
- Business: ${p.business}
- Owner (may be null): ${p.owner_name ?? "unknown"}
- City: ${p.city ?? "unknown"}
- Niche: ${p.niche ?? "clinic"}
- Their current website: ${p.website ?? "none"}
- Mystery-shop notes (what you learned posing as a patient — may be null): ${p.mystery_shop_notes ?? "none"}

YOU ALREADY BUILT THEM A LIVE DEMO. It lives here: ${previewUrl}

WRITE IN ${langName.toUpperCase()}. Return ONLY a JSON object of the shape:
{ "subject": "…", "body": "…plain-text email, \\n for newlines…" }

RULES
- Under 110 words in the body.
- Address them by first name if owner_name is known, else a warm hello with no name.
- ONE clear ask: "Open the preview, try it, tell me what you think."
- The preview URL MUST appear on its own line so it stays clickable in plain-text clients.
- No corporate jargon. Not "leverage synergies". Not "revolutionize". Sound like a human wrote it.
- If mystery-shop notes exist, reference the specific gap you noticed (e.g. "I called your line yesterday afternoon and no one picked up") — that's the wedge.
- No emoji. No unsubscribe boilerplate (this is a first-touch cold email, not a broadcast).
- Sign as "Amrani — Servolia".
- Subject line: short (≤ 55 chars), specific to their business, curiosity-forward, no clickbait, no ALL CAPS.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallbackDraft(p, previewUrl, lang);
    const parsed = JSON.parse(match[0]) as { subject?: string; body?: string };
    const subject = (parsed.subject ?? "").trim().slice(0, 120);
    const body = (parsed.body ?? "").trim();
    if (!subject || !body) return fallbackDraft(p, previewUrl, lang);
    // Make sure the URL appears somewhere, even if the model dropped it.
    return { subject, body: body.includes(previewUrl) ? body : `${body}\n\n${previewUrl}` };
  } catch (err) {
    console.error("Cold-email AI draft failed:", err);
    return fallbackDraft(p, previewUrl, lang);
  }
}

function textToHtml(text: string): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escape(text)
    .replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:#36671E;">$1</a>`)
    .split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    mode?: "draft" | "send";
    subject?: string;
    body?: string;
  };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: p } = await db.from("prospects")
    .select("id, business, owner_name, city, niche, email, website, demo_slug, status, touch_count, mystery_shop_notes")
    .eq("id", body.id).maybeSingle();
  const prospect = p as ProspectRow | null;
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
  if (!prospect.demo_slug) return NextResponse.json({ error: "Generate a demo for this prospect first" }, { status: 400 });

  const origin = req.headers.get("origin") ?? "https://servolia.com";
  const previewUrl = `${origin}/sites/${prospect.demo_slug}`;
  const lang = pickLang(prospect);

  if (body.mode === "send") {
    if (!prospect.email) return NextResponse.json({ error: "Prospect has no email address" }, { status: 400 });
    const subject = (body.subject ?? "").trim();
    const text = (body.body ?? "").trim();
    if (!subject || !text) return NextResponse.json({ error: "subject + body required" }, { status: 400 });
    const html = textToHtml(text);
    const ok = await sendEmail(prospect.email, subject, html, text);
    if (!ok) return NextResponse.json({ error: "Email send failed — is RESEND_API_KEY set?" }, { status: 500 });
    await db.from("prospects").update({
      last_touch_at: new Date().toISOString(),
      touch_count: (prospect.touch_count ?? 0) + 1,
      status: ADVANCED_STAGES.has(prospect.status) ? prospect.status : "demo_sent",
    }).eq("id", prospect.id);
    return NextResponse.json({ sent: true });
  }

  // default: draft
  const draft = await aiDraft(prospect, previewUrl, lang);
  return NextResponse.json({ ...draft, previewUrl, lang });
}
