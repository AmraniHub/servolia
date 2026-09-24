import { createHmac, timingSafeEqual } from "node:crypto";
import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { tokenSecret } from "@/lib/upgrade";
import { stripeFor, testModeAvailable } from "@/lib/stripeMode";

/**
 * FOUNDER TEST MODE — who is testing, and which Stripe key their purchase uses.
 *
 * Decided 2026-09-24: the LIVE site accepts Stripe TEST-mode purchases from
 * one browser — the logged-in admin's, after pressing "Test mode: on" at
 * /admin/settings — so every product can be walked exactly as a client gets
 * it, on the real deployment, without paying real money.
 *
 * The switch is a cookie, `sv_test`, set only by /api/admin/test-mode behind
 * the admin login. Its value is `v1.<expiry ms>.<HMAC>`, signed with the same
 * secret as the upgrade and preview tokens (tokenSecret: UPGRADE_TOKEN_SECRET,
 * else ADMIN_JWT_SECRET). A cookie that is forged, expired, or signed with a
 * rotated secret reads as NOT test — i.e. live, today's behaviour.
 *
 * A companion cookie, `sv_test_ui`, is NOT httpOnly and carries no authority:
 * it only lets a static thank-you page print "TEST MODE". Nothing trusts it.
 *
 * Money safety: with the cookie on and no STRIPE_TEST_SECRET_KEY, every
 * checkout REFUSES (503) rather than falling back to live — the founder must
 * never pay real money believing it is a test.
 */

export const TEST_COOKIE = "sv_test";
export const TEST_UI_COOKIE = "sv_test_ui";
export const TEST_HOURS = 8;

function mac(expMs: number): string {
  return createHmac("sha256", Buffer.from(tokenSecret())).update(`sv_test|${expMs}`).digest("base64url");
}

/** A signed cookie value that expires at `expMs`. */
export function signTestCookie(expMs: number): string {
  return `v1.${expMs}.${mac(expMs)}`;
}

/** The expiry (ms) of a valid, unexpired cookie; null for anything else. */
export function verifyTestCookie(value: string | null | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const m = /^v1\.(\d{10,16})\.([A-Za-z0-9_-]+)$/.exec(value);
  if (!m) return null;
  const exp = Number(m[1]);
  if (!Number.isFinite(exp) || exp <= now) return null;
  let expected: string;
  try {
    expected = mac(exp);
  } catch {
    return null; // no signing secret configured: nothing can be verified
  }
  const a = Buffer.from(m[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return exp;
}

type CookieReader = { get(name: string): { value: string } | undefined };

/** Is this request from a browser in founder test mode? */
export function isTestRequest(req: { cookies: CookieReader }): boolean {
  return verifyTestCookie(req.cookies.get(TEST_COOKIE)?.value) !== null;
}

/** The same question for code that only has a cookie store (next/headers). */
export function testModeUntil(store: CookieReader): number | null {
  return verifyTestCookie(store.get(TEST_COOKIE)?.value);
}

export type CheckoutStripe =
  | { refused: NextResponse; stripe?: undefined; test?: undefined; tag?: undefined }
  | { refused: null; stripe: Stripe | null; test: boolean; tag: { test?: "1" } };

export const TEST_KEY_MISSING = "Test mode is on but no Stripe test key is configured";

/**
 * The Stripe client a checkout-creating route must use for this request.
 *
 *   not in test mode  → the live client (null if STRIPE_SECRET_KEY is unset,
 *                       which the route answers with its own 503 as before);
 *                       tag {} so the session's metadata is exactly as before.
 *   test mode + key   → the TEST client, and tag { test: "1" } to spread into
 *                       the session's metadata.
 *   test mode, no key → refused: 503, never a live session.
 */
export function checkoutStripe(req: { cookies: CookieReader }): CheckoutStripe {
  if (!isTestRequest(req)) return { refused: null, stripe: stripeFor(true), test: false, tag: {} };
  if (!testModeAvailable()) {
    return { refused: NextResponse.json({ error: TEST_KEY_MISSING }, { status: 503 }) };
  }
  return { refused: null, stripe: stripeFor(false), test: true, tag: { test: "1" } };
}
