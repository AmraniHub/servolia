import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { hashMatches, envPasswordHash, readStoredHash } from "@/lib/siteEditorPassword";

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
 * WHERE THE HASH LIVES. Originally one Vercel variable per site, which was
 * right while only we could set a password. It stopped being right the moment
 * a client could change her own: a deploy is not something she can trigger,
 * and a password she cannot change is not really hers.
 *
 * So the hash is read from the client's own hosting_clients row first, and
 * falls back to the env var. That keeps every password we set by hand working,
 * needs no migration, and means a client changing her password takes effect on
 * the next request rather than the next deploy. The env var also remains the
 * way to get someone back in when they have locked themselves out.
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

/* The password rules themselves live in siteEditorPassword, which imports
   nothing from Next and can therefore be tested. Re-exported here so every
   caller still has one place to import the editor's auth from. */
export {
  passwordEnvName, hashPassword, hashMatches, envPasswordHash,
  readStoredHash, writeStoredHash, passwordProblem,
} from "@/lib/siteEditorPassword";


/**
 * Is this the site's password?
 *
 * The client's own hash wins over ours. If she has set one, the one we handed
 * over must stop working — otherwise "change your password" changes nothing
 * that matters, and the old password is still written in whatever chat we sent
 * it through.
 */
export async function passwordMatchesFor(ref: string, password: string): Promise<boolean> {
  const stored = await storedHashFor(ref);
  if (stored) return hashMatches(ref, password, stored);
  return hashMatches(ref, password, envPasswordHash(ref));
}

/** True when a site has a password at all — nothing to log into otherwise. */
export async function editorConfiguredFor(ref: string): Promise<boolean> {
  return Boolean((await storedHashFor(ref)) || envPasswordHash(ref));
}

async function storedHashFor(ref: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/lib/supabase");
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("hosting_clients")
    .select("notes")
    .eq("client_ref", ref)
    .maybeSingle();
  return readStoredHash((data as { notes?: string | null } | null)?.notes);
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
