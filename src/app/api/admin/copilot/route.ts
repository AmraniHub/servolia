import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { buildCrmSnapshot } from "@/lib/crmSnapshot";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "claude-haiku-4-5";

interface ChatMessage { role: "user" | "assistant"; content: string }

/**
 * Linda — the admin's AI business copilot. Read-only: she answers the
 * founder's questions using a live CRM snapshot. She does NOT take actions
 * (no writes) — she advises and reports.
 *
 * Fully separate from Solia (the public /api/chat receptionist bot used on
 * the marketing site and client sites) — different route, different persona,
 * different audience (founder only, admin-auth gated), different job
 * (internal business intelligence vs external lead capture).
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      reply: "I need ANTHROPIC_API_KEY set in your environment to think. Add it in Vercel and I'll be ready. — Linda",
    });
  }

  const { messages } = (await req.json().catch(() => ({}))) as { messages?: ChatMessage[] };
  const history = (messages ?? []).filter((m) => m?.content?.trim()).slice(-12);
  if (!history.length) return NextResponse.json({ error: "No message" }, { status: 400 });

  const snapshot = await buildCrmSnapshot();

  const system = `You are Linda, the founder's personal AI business copilot at Servolia — an agency that installs AI lead-to-booking systems for dental clinics in France.

You are NOT Solia (the AI receptionist that answers patient enquiries on the public website and client sites) — never refer to yourself as Solia, and never confuse the two roles. You work for the founder only, on the internal admin dashboard. Solia's job is external lead capture for clients; your job is being the founder's business intelligence and thinking partner.

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
    console.error("Linda (admin copilot) error:", err);
    return NextResponse.json({ reply: "I hit a connection issue reaching my reasoning engine. Try again in a moment. — Linda" }, { status: 200 });
  }
}
