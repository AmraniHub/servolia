import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { buildCrmSnapshot } from "@/lib/crmSnapshot";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "claude-haiku-4-5";

interface ChatMessage { role: "user" | "assistant"; content: string }

/**
 * Servolia admin copilot — a read-only business assistant. It answers the
 * founder's questions using a live CRM snapshot. It does NOT take actions
 * (no writes) — it advises and reports.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      reply: "The copilot needs ANTHROPIC_API_KEY set in your environment to think. Add it in Vercel and I'll be ready.",
    });
  }

  const { messages } = (await req.json().catch(() => ({}))) as { messages?: ChatMessage[] };
  const history = (messages ?? []).filter((m) => m?.content?.trim()).slice(-12);
  if (!history.length) return NextResponse.json({ error: "No message" }, { status: 400 });

  const snapshot = await buildCrmSnapshot();

  const system = `You are Solia Copilot, the AI business partner for the founder of Servolia — an agency that installs AI lead-to-booking systems for dental clinics in France.

You have a LIVE snapshot of the founder's business below. Use it to answer their questions with real numbers, spot what needs attention, and advise on next actions.

${snapshot}

# How to respond
- Be concise, direct, and specific. Lead with the answer/number, then a short so-what.
- Use the live data above — never invent figures. If the snapshot doesn't contain something, say so plainly.
- When useful, flag what needs attention (unanswered leads, unread client messages, stalled prospects, upcoming calls today).
- You are READ-ONLY: you cannot send messages, change records, or take actions. If asked to DO something, explain exactly which admin page to use (e.g. /admin/prospects, /admin/messages, /admin/demo) and what to click. Never claim you did it.
- Speak the founder's language (English or French) matching their message.
- Strategy questions: the beachhead is Franco dental/implant clinics; the motion is mystery-shop → demo → book a call → close. Keep advice aligned to that.
- Today is ${new Date().toISOString().slice(0, 10)}.`;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    });
    const reply = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return NextResponse.json({ reply: reply || "…" });
  } catch (err) {
    console.error("Copilot error:", err);
    return NextResponse.json({ reply: "I hit a connection issue reaching my reasoning engine. Try again in a moment." }, { status: 200 });
  }
}
