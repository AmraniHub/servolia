import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tokenSecret } from "@/lib/upgrade";
import { stripeFor, testModeAvailable } from "@/lib/stripeMode";
import { getCookieName } from "@/lib/auth";
import { founderEmail } from "@/lib/testContext";

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
 * else ADMIN_JWT_SECRET) over the expiry AND a hash of the admin session
 * cookie it was issued under. So it is test mode only next to THAT admin
 * session: log out, or let the session expire, and it is dead. A cookie that
 * is forged, expired, signed with a rotated secret, or separated from its
 * admin session reads as NOT test — i.e. live, today's behaviour.
 *
 * A companion cookie, `sv_test_ui`, is NOT httpOnly and carries no authority:
 * it only tells the TEST MODE pill to ask the server (GET /api/admin/test-mode,
 * the same check) whether to show itself. Nothing trusts it.
 *
 * Money safety: with the cookie on and no STRIPE_TEST_SECRET_KEY, every
 * checkout REFUSES (503) rather than falling back to live — the founder must
 * never pay real money believing it is a test.
 */

export const TEST_COOKIE = "sv_test";
export const TEST_UI_COOKIE = "sv_test_ui";
export const TEST_HOURS = 8;

function sessionHash(adminToken: string): string {
  return createHash("sha256").update(adminToken).digest("base64url");
}

function mac(expMs: number, adminToken: string): string {
  return createHmac("sha256", Buffer.from(tokenSecret())).update(`sv_test|${expMs}|${sessionHash(adminToken)}`).digest("base64url");
}

/** The admin session JWT's own expiry, read without re-verifying: the
 *  signature binding above already proves it was a session this server
 *  accepted when test mode was switched on. */
function sessionAlive(adminToken: string, now: number): boolean {
  try {
    const payload = JSON.parse(Buffer.from(adminToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp * 1000 > now;
  } catch {
    return false;
  }
}

/** A signed cookie value that expires at `expMs`, bound to this admin session. */
export function signTestCookie(expMs: number, adminToken: string): string {
  return `v1.${expMs}.${mac(expMs, adminToken)}`;
}

/** The expiry (ms) of a valid, unexpired cookie issued under this (live)
 *  admin session; null for anything else. */
export function verifyTestCookie(
  value: string | null | undefined,
  adminToken: string | null | undefined,
  now = Date.now(),
): number | null {
  if (!value || !adminToken || !sessionAlive(adminToken, now)) return null;
  const m = /^v1\.(\d{10,16})\.([A-Za-z0-9_-]+)$/.exec(value);
  if (!m) return null;
  const exp = Number(m[1]);
  if (!Number.isFinite(exp) || exp <= now) return null;
  let expected: string;
  try {
    expected = mac(exp, adminToken);
  } catch {
    return null; // no signing secret configured: nothing can be verified
  }
  const a = Buffer.from(m[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return exp;
}

type CookieReader = { get(name: string): { value: string } | undefined };

/** The same question for code that only has a cookie store (next/headers). */
export function testModeUntil(store: CookieReader): number | null {
  return verifyTestCookie(store.get(TEST_COOKIE)?.value, store.get(getCookieName())?.value);
}

/** Is this request from a browser in founder test mode? */
export function isTestRequest(req: { cookies: CookieReader }): boolean {
  return testModeUntil(req.cookies) !== null;
}

/** For pages and libraries with no request object: is the current request
 *  the founder's test-mode browser? False wherever there is no request
 *  (a cron, a script) — cookies() throws there. */
export async function founderTestBrowser(): Promise<boolean> {
  try {
    return testModeUntil(await cookies()) !== null;
  } catch {
    return false;
  }
}

export type CheckoutStripe =
  | { refused: NextResponse; stripe?: undefined; test?: undefined; tag?: undefined; buyer?: undefined }
  | { refused: null; stripe: Stripe | null; test: boolean; tag: { test?: "1" }; buyer: string | null };

export const TEST_KEY_MISSING = "Test mode is on but no Stripe test key is configured";
export const TEST_FOUNDER_MISSING = "Test mode needs FOUNDER_EMAIL (or EMAIL_REPLY_TO) set: a test purchase is always made in the founder's name";

/**
 * The Stripe client a checkout-creating route must use for this request.
 *
 *   not in test mode  → the live client (null if STRIPE_SECRET_KEY is unset,
 *                       which the route answers with its own 503 as before);
 *                       tag {} so the session's metadata is exactly as before.
 *   test mode + key   → the TEST client, tag { test: "1" } to spread into
 *                       the session's metadata, and `buyer`: the founder's
 *                       address, which the route puts on the session as
 *                       customer_email. A test purchase is therefore always
 *                       made in the founder's name — it can never take on a
 *                       real client's address, and every row it writes and
 *                       every later email points at the founder.
 *   test mode, no key or no founder address → refused: 503, never a live
 *                       session.
 */
export function checkoutStripe(req: { cookies: CookieReader }): CheckoutStripe {
  if (!isTestRequest(req)) return { refused: null, stripe: stripeFor(true), test: false, tag: {}, buyer: null };
  if (!testModeAvailable()) {
    return { refused: NextResponse.json({ error: TEST_KEY_MISSING }, { status: 503 }) };
  }
  const buyer = founderEmail();
  if (!buyer) return { refused: NextResponse.json({ error: TEST_FOUNDER_MISSING }, { status: 503 }) };
  return { refused: null, stripe: stripeFor(false), test: true, tag: { test: "1" }, buyer };
}
