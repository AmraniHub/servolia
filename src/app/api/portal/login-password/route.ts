import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, hasPassword } from "@/lib/clientPassword";
import { createClientSession, getClientCookieName, getClientSessionMaxAge } from "@/lib/clientAuth";

export const runtime = "nodejs";

// Very light in-memory throttle (per instance) to blunt password guessing.
const attempts = new Map<string, { n: number; ts: number }>();
const WINDOW = 10 * 60 * 1000;
const MAX = 8;

function throttled(key: string): boolean {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.ts > WINDOW) {
    attempts.set(key, { n: 1, ts: now });
    return false;
  }
  rec.n += 1;
  return rec.n > MAX;
}

/** Log in with email + password. Only works once the client has set a password. */
export async function POST(req: NextRequest) {
  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const clean = (email ?? "").toLowerCase().trim();

  if (!clean || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (throttled(`${ip}:${clean}`)) {
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
