/**
 * Shared Telegram helpers — sending messages (with optional inline keyboards),
 * editing them after a button tap, and acknowledging callback queries.
 * Used by the content-approval pipeline (blog + LinkedIn) and the webhook
 * that handles button taps.
 */

import { testPrefixed } from "@/lib/testContext";

export interface InlineButton {
  text: string;
  callback_data: string;
}

function creds() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  return { token, chatId, configured: !!(token && chatId) };
}

export function telegramConfigured(): boolean {
  return creds().configured;
}

/**
 * NOTIFICATION POLICY — the phone should only buzz for money.
 *
 *   loud  (default) → a real event you'd want to know about within minutes:
 *                     a captured lead, a payment, a scope accepted, a failed
 *                     charge, a client message.
 *   silent          → routine digests and reports. Delivered to the chat with
 *                     `disable_notification`, so it's there when you look but
 *                     never interrupts you.
 *
 * Config nags ("X not connected yet") should not be sent at all — /admin/settings/integrations
 * already tracks every unset secret and never stops being visible.
 */
export interface SendOptions {
  /** Deliver without sound/vibration. Use for digests, reports and summaries. */
  silent?: boolean;
  /**
   * Send with NO parse mode, for text that was not written as Markdown.
   *
   * Every message here goes out as Markdown by default, which is fine for
   * hand-written alerts and quietly fatal for machine-generated ones: a
   * Stripe event name like invoice.payment_failed carries an underscore that
   * opens an italic run and never closes it, Telegram answers 400 "can't
   * parse entities", and this function returns null. The caller sees no
   * throw, no log, and no message — the failure mode is silence, which is the
   * worst possible one for an alert channel.
   */
  plain?: boolean;
}

/**
 * How long one Telegram call may take before it is given up. Callers AWAIT
 * this function (a serverless function can be frozen the moment its response
 * is returned, killing an un-awaited request half-sent), so a Telegram that
 * never answers must not be able to hold a Stripe webhook open.
 */
export const TELEGRAM_TIMEOUT_MS = 5_000;

/** Send a message, optionally with a row of inline buttons. Returns the message_id, or null if not configured/failed.
 *  Never throws; bounded by TELEGRAM_TIMEOUT_MS per attempt; every failure is console.error'd. */
export async function sendTelegramMessage(
  text: string,
  buttons?: InlineButton[][],
  opts?: SendOptions
): Promise<{ messageId: string; chatId: string } | null> {
  const { token, chatId, configured } = creds();
  if (!configured) return null;

  const attempt = async (markdown: boolean) => {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        // "TEST — " in front while a founder test purchase is handled
        // (src/lib/testContext.ts); unchanged otherwise.
        text: testPrefixed(text),
        ...(markdown ? { parse_mode: "Markdown" } : {}),
        disable_notification: opts?.silent === true,
        reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
      }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; description?: string; result?: { message_id?: number } }
      | null;
    return { status: res.status, json };
  };

  try {
    const markdown = opts?.plain !== true;
    let { status, json } = await attempt(markdown);
    /* A Markdown message Telegram cannot parse (an interpolated address
       like jean_dupont@... opens an italic run that never closes) is NOT
       lost: it is sent again as plain text, formatting marks and all. */
    if (!json?.ok && markdown && /can't parse entities/i.test(json?.description ?? "")) {
      console.error(`[telegram] Markdown refused (${json?.description}); re-sending as plain text`);
      ({ status, json } = await attempt(false));
    }
    if (!json?.ok || !json.result) {
      console.error(`[telegram] sendMessage refused: HTTP ${status} ${json?.description ?? "(no body)"} | ${text.slice(0, 80)}`);
      return null;
    }
    return { messageId: String(json.result.message_id), chatId: String(chatId) };
  } catch (err) {
    console.error(`[telegram] sendMessage failed: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)} | ${text.slice(0, 80)}`);
    return null;
  }
}

/** Edit an existing message's text (used after Publish/Skip to remove the buttons and show the outcome). */
export async function editTelegramMessage(chatId: string, messageId: string, text: string): Promise<void> {
  const { token, configured } = creds();
  if (!configured) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: Number(messageId), text, parse_mode: "Markdown" }),
    });
  } catch {
    /* best-effort */
  }
}

/** Acknowledge a callback query so Telegram stops showing the button's loading spinner. */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const { token, configured } = creds();
  if (!configured) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch {
    /* best-effort */
  }
}
