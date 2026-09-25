import { ADDONS } from "@/lib/pricing";
import { notifyOwner, paidSubject } from "@/lib/notify";

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
      // C2 (2026-09-22): she keeps her domain; it is attached on /admin/sites.
      result = { automated: false, status: "queued", message: `${label}: attach the client's own domain on /admin/sites and send her the DNS lines.` };
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

/** The owner is told of the payment (Telegram + email, src/lib/notify.ts) with
 *  the one step fulfilment needs. Awaited, bounded, never throws; "TEST — " /
 *  "[TEST] " are added by the senders during a founder test purchase. */
async function notifyFounder(ctx: ProvisionContext, r: ProvisionResult): Promise<void> {
  const label = ADDONS[ctx.addonKey]?.name ?? ctx.addonKey;
  await notifyOwner({
    subject: paidSubject(`add-on ${label}`, ctx.amountEur ?? 0, "EUR", ctx.email),
    lines: [
      `${r.automated ? "✅ Provisioned automatically" : "🧩 To fulfil by hand"}: ${label}`,
      `Client: ${ctx.email ?? "no email"}${ctx.siteSlug ? ` · site ${ctx.siteSlug}` : ""}`,
      `Next: ${r.message}`,
    ],
    link: "https://servolia.com/admin/clients",
  });
}
