import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { passwordMatchesFor } from "@/lib/siteEditorAuth";

/**
 * A HOSTING CLIENT SIGNING IN TO THEIR OWN SERVICE PAGE.
 *
 * The page has only ever opened from a signed link in an email. That is fine
 * the day the email arrives and useless four months later, when the client
 * wants to check their renewal date and has to go digging through their inbox
 * — or ask us, which is the outcome a "self-service" page exists to avoid.
 *
 * ONE PASSWORD, TWO DOORS. It is the same password as their page editor, and
 * deliberately so. A client who has to keep two passwords for the two screens
 * we gave them keeps neither; and the editor password is already theirs to
 * change, already revocable, already checked in constant time. Adding a second
 * credential would have doubled the surface to buy nothing.
 *
 * The emailed link keeps working. Every receipt and reminder already sent
 * carries one, and a client who clicks an old email must not meet a login
 * screen asking for a password nobody has mentioned to them yet.
 */

const COOKIE = "servolia_client";
const SESSION_SECONDS = 60 * 60 * 8;

function secret(): Uint8Array {
  const s = process.env.UPGRADE_TOKEN_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!s) throw new Error("UPGRADE_TOKEN_SECRET or ADMIN_JWT_SECRET must be set");
  return new TextEncoder().encode(s);
}

export interface ClientIdentity {
  subscriptionId: string;
  ref: string;
  email: string | null;
}

/**
 * Who this email and password belong to, or null.
 *
 * Null for a wrong password, an unknown address, and a client with no password
 * set — the same answer for all three. Anything else turns this form into a
 * way to ask whether a given business is one of ours.
 */
export async function identify(email: string, password: string): Promise<ClientIdentity | null> {
  const db = supabaseAdmin();
  if (!db || !email || !password) return null;

  const wanted = email.trim().toLowerCase();
  const { data } = await db
    .from("hosting_clients")
    .select("client_ref, email, subscription_id")
    .ilike("email", wanted)
    .limit(5);
  /* ilike is a PATTERN match: `_` matches any character and `%` matches any
     run of them, and both are legal in an email address. So `a_b@x.com` would
     otherwise match `axb@x.com` — a different client, with a different
     invoice. The rows it returns are re-checked here as plain strings. */
  const rows = ((data ?? []) as { client_ref?: string; email?: string; subscription_id?: string }[])
    .filter((r) => (r.email ?? "").trim().toLowerCase() === wanted);

  /* Two rows for one address is a data problem, not a login: signing them into
     whichever came back first would show one client another's invoice. */
  if (rows.length !== 1) return null;

  const row = rows[0];
  if (!row.client_ref || !row.subscription_id) return null;
  const ref = row.client_ref.toLowerCase();
  if (!(await passwordMatchesFor(ref, password))) return null;

  return { subscriptionId: row.subscription_id, ref, email: row.email ?? null };
}

export async function createClientSession(id: ClientIdentity): Promise<string> {
  return new SignJWT({ sub_id: id.subscriptionId, ref: id.ref, role: "hosting-client" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secret());
}

/** The subscription this browser is signed in to, or null. */
export async function clientSession(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, secret());
    if (payload.role !== "hosting-client") return null;
    return typeof payload.sub_id === "string" ? payload.sub_id : null;
  } catch {
    return null;
  }
}

export const CLIENT_COOKIE = COOKIE;
export const CLIENT_SESSION_SECONDS = SESSION_SECONDS;
