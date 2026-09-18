import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The page editor's own login — a password, per client site.
 *
 * WHY NOT THE EXISTING CLIENT PORTAL AUTH. That is a magic link emailed from
 * servolia.com, and clicking it lands the client on servolia.com. This editor
 * is served at the client's OWN domain on purpose — she asked for control of
 * her site, and being sent to her supplier's website to change her own pages
 * is the opposite of that. A password she types on goodscochina.com keeps the
 * whole thing hers.
 *
 * WHY A HASH IN AN ENV VAR AND NOT A DATABASE. One client today, two soon. A
 * users table would be more machinery than the problem has, and the hash can
 * be rotated by changing one Vercel variable — which is also how a password
 * gets revoked the day a client parts company with the person who had it.
 *
 * The password is SHA-256 hashed with a per-site salt and compared in constant
 * time. It is not bcrypt: these are long random passwords we generate and hand
 * over, not human-chosen ones, so there is nothing to brute-force offline even
 * if the hash leaked. If clients ever choose their own, this must become a
 * slow KDF — that is the line at which the reasoning changes.
 */

const COOKIE = "servolia_editor";
const SESSION_SECONDS = 60 * 60 * 8; // a working day, then log in again

function secret(): Uint8Array {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_JWT_SECRET must be set in production");
    }
    return new TextEncoder().encode("servolia-dev-secret-change-me-please-32+ch");
  }
  return new TextEncoder().encode(s);
}

/** The env var holding one site's password hash, e.g. EDITOR_PW_GOODSCOCHINA. */
export function passwordEnvName(ref: string): string {
  return `EDITOR_PW_${ref.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`;
}

/** The value to put in that variable, for a password we are handing over. */
export function hashPassword(ref: string, password: string): string {
  return createHash("sha256").update(`${ref}:${password}`).digest("hex");
}

/** Is this the site's password? Constant-time, and false when none is set. */
export function passwordMatches(ref: string, password: string): boolean {
  const expected = process.env[passwordEnvName(ref)];
  if (!expected || !password) return false;
  const a = Buffer.from(hashPassword(ref, password), "utf8");
  const b = Buffer.from(expected.trim(), "utf8");
  // timingSafeEqual throws on a length mismatch, which would itself leak.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** True when a site has a password configured at all — nothing to log into otherwise. */
export function editorConfigured(ref: string): boolean {
  return Boolean(process.env[passwordEnvName(ref)]);
}

export async function createEditorSession(ref: string): Promise<string> {
  return new SignJWT({ ref, role: "site-editor" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secret());
}

/** The site this browser is logged in to edit, or null. */
export async function editorSession(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.role !== "site-editor" || typeof payload.ref !== "string") return null;
    return payload.ref;
  } catch {
    return null;
  }
}

export const EDITOR_COOKIE = COOKIE;
export const EDITOR_SESSION_SECONDS = SESSION_SECONDS;
