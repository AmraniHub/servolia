/**
 * Meta Conversions API — server-side event tracking that complements the
 * client-side Pixel (recovers signal lost to iOS/ad-blockers, and carries
 * real conversion value straight from Stripe).
 *
 * Requires two env vars:
 *   META_CAPI_ACCESS_TOKEN — the Conversions API access token (SECRET — never
 *                            expose client-side, never NEXT_PUBLIC_-prefixed)
 *   NEXT_PUBLIC_META_PIXEL_ID — already set; doubles as the CAPI "dataset id"
 *
 * If the token isn't set, every call here is a silent no-op — nothing else
 * in the app should ever block on this.
 */

import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { inTestContext } from "@/lib/testContext";

const DEFAULT_PIXEL = "1394909005810177"; // Servolia Meta Pixel / dataset id

function sha256(input: string): string {
  return createHash("sha256").update(input.trim().toLowerCase()).digest("hex");
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

export interface CapiEventInput {
  eventName: "Lead" | "Purchase" | "InitiateCheckout" | "CompleteRegistration";
  email?: string | null;
  phone?: string | null;
  value?: number;
  currency?: string;
  eventSourceUrl?: string;
  eventId?: string; // shared with client-side Pixel fbq call for dedup, if any
  req?: NextRequest; // used to pull client IP + user agent for match quality
  // Per-client override — fire the event on a CLIENT's pixel instead of Servolia's
  // (the ads closed loop: their ad spend → their booked consultation).
  pixelId?: string;
  accessToken?: string;
}

export function metaCapiConfigured(): boolean {
  return !!process.env.META_CAPI_ACCESS_TOKEN;
}

/** Send a server-side conversion event to Meta. Never throws; capped at 5 s.
 *  AWAIT it: on Vercel an un-awaited request can die when the response is returned. */
export async function sendMetaCapiEvent(input: CapiEventInput): Promise<void> {
  // Never for a founder test purchase (src/lib/testContext.ts): a fake buyer
  // would train the ad account's optimisation on money that never moved.
  if (inTestContext()) return;
  const token = input.accessToken ?? process.env.META_CAPI_ACCESS_TOKEN;
  const datasetId = input.pixelId ?? (process.env.NEXT_PUBLIC_META_PIXEL_ID || DEFAULT_PIXEL);
  if (!token || !datasetId) return;

  try {
    const userData: Record<string, unknown> = {};
    if (input.email) userData.em = [sha256(input.email)];
    if (input.phone) userData.ph = [sha256(normalizePhone(input.phone))];

    if (input.req) {
      const ip = input.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      const ua = input.req.headers.get("user-agent");
      if (ip) userData.client_ip_address = ip;
      if (ua) userData.client_user_agent = ua;
    }

    const customData: Record<string, unknown> = {};
    if (typeof input.value === "number") customData.value = input.value;
    if (input.currency) customData.currency = input.currency;

    const payload = {
      data: [
        {
          event_name: input.eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          event_source_url: input.eventSourceUrl ?? "https://servolia.com",
          event_id: input.eventId,
          user_data: userData,
          custom_data: Object.keys(customData).length ? customData : undefined,
        },
      ],
    };

    // Awaited by its callers (a frozen serverless function drops an
    // un-awaited request), so capped: Meta being slow must not hold a
    // webhook or a form open.
    const res = await fetch(`https://graph.facebook.com/v21.0/${datasetId}/events?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) console.error(`[meta-capi] ${input.eventName} refused: HTTP ${res.status}`);
  } catch (err) {
    /* never let analytics failures affect the real request */
    console.error(`[meta-capi] ${input.eventName} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
