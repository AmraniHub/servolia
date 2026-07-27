import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, hasPassword } from "@/lib/clientPassword";
import { createClientSession, getClientCookieName, getClientSessionMaxAge } from "@/lib/clientAuth";
import { rateLimited, clientIp } from "@/lib/security";

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

  // Don't reveal whether an account exists — same message for "no password" and "wrong password".
  if (!(await hasPassword(clean)) || !(await verifyPassword(clean, password))) {
    return NextResponse.json({ error: "Incorrect email or password. If you've never set a password, use the email link." }, { status: 401 });
  }

  const session = await createClientSession(clean);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(getClientCookieName(), session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getClientSessionMaxAge(),
  });
  return res;
}
