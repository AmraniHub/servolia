/**
 * Shared Telegram helpers — sending messages (with optional inline keyboards),
 * editing them after a button tap, and acknowledging callback queries.
 * Used by the content-approval pipeline (blog + LinkedIn) and the webhook
 * that handles button taps.
 */

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

/** Send a message, optionally with a row of inline buttons. Returns the message_id, or null if not configured/failed. */
export async function sendTelegramMessage(
  text: string,
  buttons?: InlineButton[][]
): Promise<{ messageId: string; chatId: string } | null> {
  const { token, chatId, configured } = creds();
  if (!configured) return null;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
      }),
    });
    const json = await res.json();
    if (!json.ok) return null;
    return { messageId: String(json.result.message_id), chatId: String(chatId) };
  } catch {
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
