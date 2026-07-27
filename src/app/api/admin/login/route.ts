import { NextRequest, NextResponse } from "next/server";
import { createAdminSession, getCookieName, getSessionMaxAge } from "@/lib/auth";
import { timingSafeEqualStr, rateLimited, clientIp, verifyTotp } from "@/lib/security";

export const runtime = "nodejs";

/**
 * Admin login. Hardened 2026-07-27:
 *  - constant-time password comparison (no timing oracle)
 *  - cross-instance rate limit: 8 attempts / 15 min per IP (DB-backed)
 *  - optional TOTP 2FA: set ADMIN_TOTP_SECRET (generate via /api/admin/2fa-setup)
 *    and every login additionally requires the 6-digit authenticator code.
 */

export async function POST(req: NextRequest) {
  const { password, code } = (await req.json().catch(() => ({}))) as { password?: string; code?: string };
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: "Admin password not configured" }, { status: 503 });
  }

  const ip = clientIp(req.headers);
  if (await rateLimited(`admin-login:${ip}`, 8, 15 * 60)) {
    return NextResponse.json({ error: "Too many attempts — try again in 15 minutes." }, { status: 429 });
  }

  const passwordOk = !!password && timingSafeEqualStr(password, expected);

  // 2FA: when a TOTP secret is configured, a valid code is mandatory.
  const totpSecret = process.env.ADMIN_TOTP_SECRET;
  const totpOk = !totpSecret || verifyTotp(totpSecret, code ?? "");

  if (!passwordOk || !totpOk) {
    // Small delay + identical message for wrong password vs wrong code —
    // no oracle for which factor failed.
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createAdminSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(getCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getSessionMaxAge(),
  });
  return res;
}
