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
