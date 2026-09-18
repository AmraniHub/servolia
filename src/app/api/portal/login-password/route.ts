import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, hasPassword } from "@/lib/clientPassword";
import { createClientSession, getClientCookieName, getClientSessionMaxAge } from "@/lib/clientAuth";
import { rateLimited, clientIp } from "@/lib/security";
import {
  identify, createClientSession as createHostingSession,
  CLIENT_COOKIE, CLIENT_SESSION_SECONDS,
} from "@/lib/clientAreaAuth";

export const runtime = "nodejs";

/** Log in with email + password. Only works once the client has set a password. */
export async function POST(req: NextRequest) {
  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const clean = (email ?? "").toLowerCase().trim();

  if (!clean || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  // Cross-instance limiter (was per-lambda in-memory before 2026-07-27).
  const ip = clientIp(req.headers);
  if (await rateLimited(`portal-pw:${ip}:${clean}`, 8, 10 * 60)) {
    return NextResponse.json({ error: "Too many attempts — try again later or use the email login link." }, { status: 429 });
  }

  /* ONE FRONT DOOR, TWO KINDS OF CLIENT.
   *
   * This portal was built for the website-build product: it reads `builds` and
   * `clients`, and a password lives in `client_auth`. A HOSTING client has
   * none of those rows — the Stripe webhook writes `hosting_clients` on that
   * branch and nothing else — so signing one in here would land them on an
   * empty dashboard, which is worse than being turned away.
   *
   * They do have a password, though: the one that opens their page editor. So
   * it is accepted here and they are sent where their service actually lives.
   * A client should not have to know which of our tables they are in.
   */
  if (!(await hasPassword(clean)) || !(await verifyPassword(clean, password))) {
    const who = await identify(clean, password);
    if (who) {
      const res = NextResponse.json({ ok: true, to: "/hosting/account" });
      res.cookies.set(CLIENT_COOKIE, await createHostingSession(who), {
        httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: CLIENT_SESSION_SECONDS,
      });
      return res;
    }
    // Don't reveal whether an account exists — same message either way.
    return NextResponse.json({ error: "Incorrect email or password. If you've never set a password, use the email link." }, { status: 401 });
  }

  const session = await createClientSession(clean);
  const res = NextResponse.json({ ok: true, to: "/portal" });
  res.cookies.set(getClientCookieName(), session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getClientSessionMaxAge(),
  });
  return res;
}
