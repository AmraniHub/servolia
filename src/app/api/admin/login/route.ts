import { NextRequest, NextResponse } from "next/server";
import {
  createAdminSession,
  createTotpTicket,
  getCookieName,
  getSessionMaxAge,
  getTotpTicketTtl,
  verifyTotpTicket,
} from "@/lib/auth";
import { timingSafeEqualStr, rateLimited, clientIp } from "@/lib/security";
import { consumeSecondFactor, getTwoFactorState } from "@/lib/admin2fa";

export const runtime = "nodejs";

/**
 * Admin login — two steps when 2FA is on.
 *
 *   POST { password }         → 2FA off: signed in.
 *                               2FA on:  { totpRequired: true, ticket }
 *   POST { ticket, code }     → code (or a recovery code) → signed in.
 *
 * WHY TWO STEPS: the code field used to sit on the login form permanently,
 * labelled "if enabled", so every login asked for something most of the time
 * unnecessary and the form couldn't tell you which factor you got wrong. Now
 * the password is checked first and the code screen only appears when it is
 * actually needed — and the ticket that carries you between the two is dead in
 * five minutes and grants nothing by itself.
 *
 * Hardened: constant-time password compare, cross-instance rate limit
 * (8 attempts / 15 min per IP, DB-backed), replay-proof TOTP (a spent code is
 * refused even inside its own 30s window), single-use recovery codes.
 */

export async function POST(req: NextRequest) {
  const { password, code, ticket } = (await req.json().catch(() => ({}))) as {
    password?: string;
    code?: string;
    ticket?: string;
  };

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "Admin password not configured" }, { status: 503 });
  }

  // Password guesses and code guesses are counted SEPARATELY.
  //
  // Splitting the flow in two made a single sign-in cost two requests, so one
  // shared counter would have halved the allowance from 8 logins to 4 — and a
  // fat-fingered code would have eaten the password budget. Two keys, 8 each:
  // a normal login spends one of each, and brute-forcing either is still capped.
  const ip = clientIp(req.headers);
  const limitKey = ticket ? `admin-2fa:${ip}` : `admin-login:${ip}`;
  if (await rateLimited(limitKey, 8, 15 * 60)) {
    return NextResponse.json({ error: "Too many attempts — try again in 15 minutes." }, { status: 429 });
  }

  // ── Step 2: ticket + code ────────────────────────────────────────────────
  if (ticket) {
    if (!(await verifyTotpTicket(ticket))) {
      return NextResponse.json({ error: "That took too long — start again." }, { status: 401 });
    }
    const result = await consumeSecondFactor(code ?? "");
    if (!result.ok) {
      await new Promise((r) => setTimeout(r, 400));
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
    return await signIn(
      result.usedRecovery
        ? {
            usedRecovery: true,
            recoveryRemaining: result.recoveryRemaining,
            notice:
              result.recoveryRemaining > 0
                ? `Recovery code used — ${result.recoveryRemaining} left. Generate a fresh set in Settings.`
                : "That was your last recovery code. Generate a fresh set in Settings now.",
          }
        : {},
    );
  }

  // ── Step 1: password ─────────────────────────────────────────────────────
  const passwordOk = !!password && timingSafeEqualStr(password, expected);
  if (!passwordOk) {
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  let twoFactorOn = false;
  try {
    twoFactorOn = (await getTwoFactorState()).enabled;
  } catch {
    // Can't tell whether 2FA is on → assume it is. Never fail open.
    twoFactorOn = true;
  }

  if (!twoFactorOn) return await signIn({});

  // Password + code in one request still works — older clients, and anyone who
  // pastes both. No reason to break it.
  if (code) {
    const result = await consumeSecondFactor(code);
    if (!result.ok) {
      await new Promise((r) => setTimeout(r, 400));
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
    return await signIn(result.usedRecovery ? { usedRecovery: true, recoveryRemaining: result.recoveryRemaining } : {});
  }

  return NextResponse.json({
    totpRequired: true,
    ticket: await createTotpTicket(),
    expiresIn: getTotpTicketTtl(),
  });
}

async function signIn(extra: Record<string, unknown>): Promise<NextResponse> {
  const token = await createAdminSession();
  const res = NextResponse.json({ ok: true, ...extra });
  res.cookies.set(getCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getSessionMaxAge(),
  });
  return res;
}
