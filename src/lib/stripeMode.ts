import Stripe from "stripe";

/**
 * Which Stripe mode is this key, really?
 *
 * Stripe issues TWO shapes of secret key and both come in test and live:
 *
 *   sk_test_ / sk_live_   standard secret keys, full account access
 *   rk_test_ / rk_live_   restricted keys, scoped to chosen permissions
 *
 * Every check in this codebase used to test `startsWith("sk_live_")` alone,
 * which fails dangerously in one direction: a restricted LIVE key would be
 * reported as test mode across the health endpoint, the settings badge and
 * the pre-flight banner — while charging real customers real money. "You are
 * safely in test mode" is the worst possible thing to be wrong about.
 */

export type StripeMode = "live" | "test" | "unknown" | "missing";

export function stripeModeOf(key: string | undefined | null): StripeMode {
  const k = (key ?? "").trim();
  if (!k) return "missing";
  if (k.startsWith("sk_live_") || k.startsWith("rk_live_")) return "live";
  if (k.startsWith("sk_test_") || k.startsWith("rk_test_")) return "test";
  return "unknown";
}

export function isLiveKey(key: string | undefined | null): boolean {
  return stripeModeOf(key) === "live";
}

/** True for rk_… keys, which only work if the right permissions were granted. */
export function isRestrictedKey(key: string | undefined | null): boolean {
  return (key ?? "").trim().startsWith("rk_");
}

/* ── Founder test mode: one client per mode ─────────────────────────────
 *
 * STRIPE_SECRET_KEY is the live key and stays the default everywhere.
 * STRIPE_TEST_SECRET_KEY (optional) is a TEST key that only the founder's
 * test-mode purchases use (src/lib/testMode.ts). When it is absent, every
 * function below behaves exactly as `new Stripe(STRIPE_SECRET_KEY)` did.
 */

let makeStripe = (key: string): Stripe => new Stripe(key);

/** Test seam, used by tests/test-mode.test.mjs to record Stripe calls
 *  through a fake HTTP client. Never called by the app. */
export function __setStripeFactoryForTests(f: ((key: string) => Stripe) | null): void {
  makeStripe = f ?? ((key: string) => new Stripe(key));
}

/**
 * The test key, only if it really IS a test key. A live key pasted into
 * STRIPE_TEST_SECRET_KEY would turn every "test" purchase into a real charge
 * on the founder's card while everything around it said TEST — so it is
 * refused, and test mode reads as unavailable.
 */
function testSecretKey(): string | null {
  const k = process.env.STRIPE_TEST_SECRET_KEY?.trim();
  return k && stripeModeOf(k) === "test" ? k : null;
}

/** Can a test-mode purchase be made at all? */
export function testModeAvailable(): boolean {
  return testSecretKey() !== null;
}

/** The Stripe client for one mode, or null when that mode's key is absent. */
export function stripeFor(livemode: boolean): Stripe | null {
  if (livemode) {
    const key = process.env.STRIPE_SECRET_KEY;
    return key ? makeStripe(key) : null;
  }
  const key = testSecretKey();
  return key ? makeStripe(key) : null;
}

/** Checkout session ids DO carry their mode (cs_test_… / cs_live_…). */
export function stripeForSessionId(sessionId: string): Stripe | null {
  return stripeFor(!sessionId.startsWith("cs_test_"));
}

function isMissing(err: unknown): boolean {
  const e = err as { code?: string; statusCode?: number } | null;
  return e?.code === "resource_missing" || e?.statusCode === 404;
}

/**
 * Fetch an object by an id that does not say its mode (sub_…, cus_…).
 *
 * `livemode` known (the webhook knows it from the event): that mode only.
 * Unknown (a page opened from an emailed link): the live key first — a live
 * id is found there, exactly as before — and only on "no such object", the
 * test key, so a test purchase's receipt links open too. Without a test key
 * this is precisely the old single live call.
 */
export async function inEitherMode<T>(
  get: (stripe: Stripe) => Promise<T>,
  livemode?: boolean,
): Promise<{ stripe: Stripe; value: T; livemode: boolean } | null> {
  if (livemode !== undefined) {
    const stripe = stripeFor(livemode);
    return stripe ? { stripe, value: await get(stripe), livemode } : null;
  }
  const live = stripeFor(true);
  if (!live) return null;
  try {
    return { stripe: live, value: await get(live), livemode: true };
  } catch (err) {
    const test = isMissing(err) ? stripeFor(false) : null;
    if (!test) throw err;
    return { stripe: test, value: await get(test), livemode: false };
  }
}
