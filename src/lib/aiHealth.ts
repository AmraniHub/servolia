import { sendTelegramMessage } from "@/lib/telegram";
import { rateLimited } from "@/lib/security";

/**
 * AI DEGRADATION ALERTS — make a silent quality drop loud.
 *
 * Two paths fall back when Claude is unreachable or out of credit, and both
 * used to do it on a bare console.error:
 *
 *   1. /api/chat        → the client's AI receptionist drops to Cloudflare
 *                         Llama 3.1 8B, a much weaker model answering real
 *                         patients in French.
 *   2. aiEnrichConfig   → a new client's site copy stays the mechanical
 *                         template draft instead of being written for them.
 *
 * Nothing broke, so nothing complained — which is exactly the failure mode
 * worth paying attention to. A paying client can receive the degraded version
 * of the product for weeks while every dashboard reads green.
 *
 * This is a LOUD alert on purpose. Under the Telegram policy a config nag is
 * not sent at all, but this is not a nag: money has already changed hands and
 * the thing being delivered is not the thing that was sold.
 *
 * Throttled to one message per hour per surface, so a dead key during a busy
 * afternoon costs you one buzz rather than a hundred.
 */

export type AiSurface = "receptionist" | "site-copy";

const LABEL: Record<AiSurface, string> = {
  receptionist: "AI receptionist",
  "site-copy": "Site copy generation",
};

const CONSEQUENCE: Record<AiSurface, string> = {
  receptionist: "Client sites are answering patients with the weaker Llama 3.1 8B fallback.",
  "site-copy": "New client sites are being drafted from the mechanical template, not written by AI.",
};

/**
 * Report that an AI call fell back. Never throws and never blocks the caller —
 * a broken alert must not also break the request that was still served.
 */
export async function reportAiFallback(surface: AiSurface, err: unknown): Promise<void> {
  try {
    const reason = err instanceof Error ? err.message : String(err ?? "unknown error");
    console.error(`[ai-fallback] ${surface}: ${reason}`);

    // One per hour per surface. rateLimited() returns false the first time.
    if (await rateLimited(`ai-fallback:${surface}`, 1, 3600)) return;

    const credit = /credit balance|insufficient|quota|billing/i.test(reason);
    await sendTelegramMessage(
      [
        `⚠️ *${LABEL[surface]} is running degraded*`,
        "",
        CONSEQUENCE[surface],
        "",
        credit
          ? "Looks like *Anthropic credit is exhausted* — top up at console.anthropic.com → Plans & Billing."
          : `Claude call failed: \`${reason.slice(0, 180)}\``,
        "",
        "_Muted for 1 hour. Check /admin/settings/launch for live status._",
      ].join("\n")
    );
  } catch {
    /* alerting must never take down the path it is watching */
  }
}
