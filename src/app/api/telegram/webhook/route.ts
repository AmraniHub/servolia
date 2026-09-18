import { NextRequest, NextResponse } from "next/server";
import { editTelegramMessage, answerCallbackQuery, sendTelegramMessage } from "@/lib/telegram";
import { publishBlogPost, rejectBlogPost, postLinkedInDraft, rejectLinkedInDraft } from "@/lib/contentActions";

export const runtime = "nodejs";
export const maxDuration = 30;

const BASE = "https://servolia.com";

interface TelegramUpdate {
  callback_query?: {
    id: string;
    data: string;
    message?: { chat: { id: number }; message_id: number };
  };
  message?: {
    chat: { id: number };
    text?: string;
  };
}

async function handleBlogCallback(action: "publish" | "skip", id: string): Promise<string> {
  const result = action === "publish" ? await publishBlogPost(id) : await rejectBlogPost(id);
  return action === "publish" ? `✅ *Published*\n\n${result.message}` : `❌ *Skipped*\n\n${result.message}`;
}

async function handleLinkedInCallback(action: "post" | "skip", id: string): Promise<string> {
  const result = action === "post" ? await postLinkedInDraft(id) : await rejectLinkedInDraft(id);
  return result.message;
}

async function triggerRoute(path: string): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  fetch(`${BASE}${path}`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } }).catch(() => {});
}

export async function POST(req: NextRequest) {
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected && secretHeader !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const update = (await req.json().catch(() => ({}))) as TelegramUpdate;

  // ── Button taps ─────────────────────────────────────────────────────────
  if (update.callback_query) {
    const { id: callbackId, data, message } = update.callback_query;
    const [action, entityId] = data.split(":");

    let resultText = "Unknown action";
    if (action === "blog_publish") resultText = await handleBlogCallback("publish", entityId);
    else if (action === "blog_skip") resultText = await handleBlogCallback("skip", entityId);
    else if (action === "linkedin_post") resultText = await handleLinkedInCallback("post", entityId);
    else if (action === "linkedin_skip") resultText = await handleLinkedInCallback("skip", entityId);
    else if (action === "copy_ok") resultText = await handleCopyCallback("approve", entityId);
    else if (action === "copy_no") resultText = await handleCopyCallback("refuse", entityId);

    await answerCallbackQuery(callbackId, "Done");
    if (message) {
      await editTelegramMessage(String(message.chat.id), String(message.message_id), resultText);
    }
    return NextResponse.json({ ok: true });
  }

  // ── Slash commands ──────────────────────────────────────────────────────
  const text = update.message?.text?.trim();
  if (text === "/blog") {
    await sendTelegramMessage("⏳ Generating a blog post now…");
    await triggerRoute("/api/cron/generate-blog");
  } else if (text === "/linkedin") {
    await sendTelegramMessage("⏳ Generating a LinkedIn post now…");
    await triggerRoute("/api/cron/generate-linkedin");
  } else if (text === "/stats") {
    await triggerRoute("/api/cron/daily-stats");
  } else if (text === "/seo") {
    await triggerRoute("/api/cron/weekly-seo");
  } else if (text === "/help") {
    await sendTelegramMessage(
      "*Servolia bot commands*\n\n" +
      "/blog — generate a blog post now\n" +
      "/linkedin — generate a LinkedIn post now\n" +
      "/stats — today's traffic numbers\n" +
      "/seo — weekly organic search report\n" +
      "/help — this list"
    );
  }

  return NextResponse.json({ ok: true });
}

/**
 * A client asked for a copy of their website; this is the answer.
 *
 * Approving does not send anything. It puts a download button on the client's
 * own service page for a week, which means the file is fetched by the person
 * who asked, from the page only their link opens, and the permission runs out
 * by itself rather than standing open for a year.
 */
async function handleCopyCallback(what: "approve" | "refuse", ref: string): Promise<string> {
  const { supabaseAdmin } = await import("@/lib/supabase");
  const { readCopyRequest, writeCopyRequest, approvedNow, COPY_WINDOW_DAYS } = await import("@/lib/clientCopy");
  const db = supabaseAdmin();
  if (!db) return "No database configured, so nothing changed.";

  const { data } = await db
    .from("hosting_clients")
    .select("notes")
    .eq("client_ref", ref)
    .maybeSingle();
  const notes = (data as { notes?: string | null } | null)?.notes ?? null;
  const current = readCopyRequest(notes);

  const next = what === "approve"
    ? approvedNow(current)
    : { ...(current?.requested ? { requested: current.requested } : {}), refused: new Date().toISOString() };

  const { error } = await db
    .from("hosting_clients")
    .update({ notes: writeCopyRequest(notes, next) })
    .eq("client_ref", ref);
  if (error) return `Could not save that: ${error.message}`;

  return what === "approve"
    ? `✅ ${ref} can download their website from their own page for the next ${COPY_WINDOW_DAYS} days.`
    : `✖ ${ref} was not approved. Their page shows nothing about it — tell them yourself.`;
}
