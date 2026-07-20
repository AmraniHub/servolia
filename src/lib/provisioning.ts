import { ADDONS } from "@/lib/pricing";

/**
 * Add-on provisioning dispatch.
 *
 * When a client enables an add-on (and pays via Stripe), this decides how it
 * gets fulfilled:
 *   - If the provider integration is configured (env keys present) AND the
 *     add-on is fully automatable, it is provisioned by API.
 *   - Otherwise it records a structured task for the founder (Telegram) so the
 *     revenue starts immediately and fulfilment is a single known step.
 *
 * This is the seam for turning the manual add-ons automatic: wire each adapter
 * once the reseller account exists (Cloudflare Registrar, Google Workspace
 * reseller, Twilio) — no other code changes needed.
 */

export interface ProvisionContext {
  addonKey: string;
  email?: string | null;
  siteSlug?: string | null;
  amountEur?: number;
}

export interface ProvisionResult {
  automated: boolean;
  status: "provisioned" | "queued";
  message: string;
}

const has = (...keys: string[]) => keys.every((k) => !!process.env[k]?.trim());

/** Provider readiness — flip to automated once the account + keys exist. */
export const PROVIDERS = {
  twilio: () => has("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"),
  cloudflare: () => has("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"),
  workspace: () => has("GOOGLE_WORKSPACE_RESELLER_TOKEN"),
};

export async function provisionAddon(ctx: ProvisionContext): Promise<ProvisionResult> {
  const addon = ADDONS[ctx.addonKey];
  const label = addon?.name ?? ctx.addonKey;

  let result: ProvisionResult;
  switch (ctx.addonKey) {
    case "sms":
      // SMS reminders run through our own reminder pipeline over Twilio. Once a
      // Twilio number is configured, enabling is instantaneous.
      result = PROVIDERS.twilio()
        ? { automated: true, status: "provisioned", message: `${label} enabled (Twilio configured).` }
        : { automated: false, status: "queued", message: `${label} ready to enable — connect Twilio to make it automatic.` };
      break;
    case "reviews":
      // Review automation is within our own system; the only input needed is the
      // client's Google Business profile link, collected on first run.
      result = { automated: true, status: "provisioned", message: `${label} enabled — will start once the Google Business link is confirmed.` };
      break;
    case "domain":
      result = PROVIDERS.cloudflare()
        ? { automated: false, status: "queued", message: `${label}: Cloudflare connected — register/transfer the chosen domain.` }
        : { automated: false, status: "queued", message: `${label}: register/transfer the client's domain and point DNS.` };
      break;
    case "email":
      result = PROVIDERS.workspace()
        ? { automated: false, status: "queued", message: `${label}: Workspace reseller connected — create the mailboxes.` }
        : { automated: false, status: "queued", message: `${label}: create the professional mailboxes at the client's domain.` };
      break;
    default:
      result = { automated: false, status: "queued", message: `${label}: set up manually.` };
  }

  await notifyFounder(ctx, result);
  return result;
}

/** Structured founder alert so fulfilment is one known step. Best-effort. */
async function notifyFounder(ctx: ProvisionContext, r: ProvisionResult): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const icon = r.automated ? "✅" : "🧩";
  const msg =
    `${icon} *Add-on ${r.automated ? "provisioned" : "to fulfil"}*\n` +
    `${ADDONS[ctx.addonKey]?.name ?? ctx.addonKey}${ctx.amountEur ? ` — €${ctx.amountEur}` : ""}\n` +
    `${ctx.email ?? "no email"}${ctx.siteSlug ? ` · ${ctx.siteSlug}` : ""}\n\n${r.message}`;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "Markdown" }),
  }).catch(() => {});
}
