import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Web Push to a client's own devices.
 *
 * WHY THIS EXISTS: the product's promise is "you never miss an enquiry". Email
 * and WhatsApp already carry that, but both arrive in a pile of other mail. A
 * push lands on the lock screen of a phone that is already in the room.
 *
 * WHY IT SHIPPED AFTER THE INSTALLABLE APP: iOS only permits Web Push for a
 * PWA the user has actually added to their home screen (16.4+). On iPhone,
 * without the install there is no notification to receive — so the order was
 * install first, then this.
 *
 * Failure here must never break the thing that triggered it. Every send is
 * fire-and-forget from the caller's perspective: a dead push service must not
 * stop a lead being written or an email going out.
 */

export interface PushPayload {
  title: string;
  body: string;
  /** Where the notification opens. Relative to the site root. */
  url?: string;
  /** Collapses repeats — a second enquiry replaces the first rather than stacking. */
  tag?: string;
}

function configured(): boolean {
  return !!(
    process.env.VAPID_PRIVATE_KEY?.trim() &&
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
    process.env.VAPID_SUBJECT?.trim()
  );
}

export function pushConfigured(): boolean {
  return configured();
}

function init(): boolean {
  if (!configured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!.trim(),
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim(),
  );
  return true;
}

type Row = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Send to every device this client has subscribed.
 * Returns how many actually accepted it. Never throws.
 */
export async function sendPushToClient(email: string, payload: PushPayload): Promise<number> {
  try {
    if (!init()) return 0;
    const db = supabaseAdmin();
    if (!db) return 0;

    const addr = email.toLowerCase().trim();
    const { data, error } = await db
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("email", addr);

    if (error || !data?.length) return 0;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/portal",
      tag: payload.tag,
    });

    let sent = 0;
    const dead: string[] = [];

    await Promise.allSettled(
      (data as Row[]).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
            { TTL: 6 * 60 * 60 }, // A "new enquiry" ping is worthless a day later.
          );
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          // 404/410 mean the browser threw this subscription away — the user
          // cleared site data, uninstalled, or the push service expired it.
          // Delete by ROW ID, never by endpoint: two accounts can legitimately
          // hold the same endpoint, and deleting by endpoint would silently
          // unsubscribe someone who never asked to be.
          if (status === 404 || status === 410) dead.push(sub.id);
          else console.error(`[push] send failed (${status ?? "?"}) for ${addr}`);
        }
      }),
    );

    if (dead.length) {
      await db.from("push_subscriptions").delete().in("id", dead);
      console.info(`[push] pruned ${dead.length} dead subscription(s) for ${addr}`);
    }
    if (sent) {
      await db
        .from("push_subscriptions")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("email", addr);
    }
    return sent;
  } catch (err) {
    // A broken notification must never take down the lead capture that fired it.
    console.error("[push] unexpected failure:", err);
    return 0;
  }
}
