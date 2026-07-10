import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Client portal auth — passwordless magic links.
 * A short-lived signed token (15 min) is emailed as a login link; once
 * clicked, it's exchanged for a long-lived session cookie (30 days).
 * No password to remember, no reset flow to build.
 */

const COOKIE_NAME = "servolia_client";
const LINK_DURATION = 15 * 60;            // 15 minutes to click the email link
const SESSION_DURATION = 60 * 60 * 24 * 30; // 30 days once logged in

function getSecret(): Uint8Array {
  const s = process.env.ADMIN_JWT_SECRET ?? "servolia-dev-secret-change-me-please-32+ch";
  return new TextEncoder().encode(s);
}

/** Signs a short-lived token embedding the email — this becomes the magic-link URL param. */
export async function createLoginLinkToken(email: string): Promise<string> {
  return await new SignJWT({ email, purpose: "portal-login" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${LINK_DURATION}s`)
    .sign(getSecret());
}

/** Verifies a magic-link token and returns the email if valid. */
export async function verifyLoginLinkToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== "portal-login" || typeof payload.email !== "string") return null;
    return payload.email;
  } catch {
    return null;
  }
}

/** Signs the long-lived portal session (set as a cookie after a magic link is verified). */
export async function createClientSession(email: string): Promise<string> {
  return await new SignJWT({ email, role: "client" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());
}

/** Reads the portal session cookie and returns the logged-in client's email, or null. */
export async function getClientEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.role !== "client" || typeof payload.email !== "string") return null;
    return payload.email;
  } catch {
    return null;
  }
}

export function getClientCookieName(): string {
  return COOKIE_NAME;
}

export function getClientSessionMaxAge(): number {
  return SESSION_DURATION;
}
