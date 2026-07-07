import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Lightweight admin auth via signed JWT in an httpOnly cookie.
 * No DB needed — password comes from ADMIN_PASSWORD env var.
 */

const COOKIE_NAME = "servolia_admin";
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days

function getSecret(): Uint8Array {
  const s = process.env.ADMIN_JWT_SECRET ?? "servolia-dev-secret-change-me-please-32+ch";
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

export function getCookieName(): string {
  return COOKIE_NAME;
}

export function getSessionMaxAge(): number {
  return SESSION_DURATION;
}
