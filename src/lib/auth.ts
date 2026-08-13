import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Lightweight admin auth via signed JWT in an httpOnly cookie.
 * No DB needed — password comes from ADMIN_PASSWORD env var.
 */

const COOKIE_NAME = "servolia_admin";
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days

function getSecret(): Uint8Array {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s) {
    // FAIL CLOSED in production: the old fallback was a publicly-known string
    // from the repo — anyone reading GitHub could forge an admin session.
    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_JWT_SECRET must be set in production");
    }
    return new TextEncoder().encode("servolia-dev-secret-change-me-please-32+ch");
  }
  return new TextEncoder().encode(s);
}

export async function createAdminSession(): Promise<string> {
  return await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());
}

export async function verifyAdminSession(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export async function isAdminAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyAdminSession(token);
}

/**
 * Short-lived ticket proving the password step already passed.
 *
 * The login page asks for the password first and only then for the code, so
 * something has to carry "this person knows the password" between the two
 * requests without being a session. This is that: signed with the same secret,
 * dead in five minutes, and useless on its own — it grants nothing until a
 * valid second factor is presented with it.
 */
const TOTP_TICKET_TTL = 5 * 60;

export async function createTotpTicket(): Promise<string> {
  return await new SignJWT({ stage: "totp-pending" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TOTP_TICKET_TTL}s`)
    .sign(getSecret());
}

export async function verifyTotpTicket(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.stage === "totp-pending";
  } catch {
    return false;
  }
}

export function getTotpTicketTtl(): number {
  return TOTP_TICKET_TTL;
}

export function getCookieName(): string {
  return COOKIE_NAME;
}

export function getSessionMaxAge(): number {
  return SESSION_DURATION;
}
