import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { passwordMatchesFor } from "@/lib/siteEditorAuth";
import { CLIENT_REFS } from "@/lib/clientRefs";
import { rowForRef, refForEmail } from "@/lib/hostingRow";

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

/* Its own name. Until 2026-09-22 this was "servolia_client" — the same
   cookie the EUR portal (clientAuth.ts) sets with a different role and a
   different secret — so signing into one silently signed the other out, and
   a client with both a plan and a hosted site could never hold both. Sessions
   here last eight hours, so the rename costs at most one re-login. */
const COOKIE = "servolia_hosting";
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
 * The client reference behind a website address, if we know one.
 *
 * A client is far surer of their own domain than of which address we have on
 * file for them — an agency signs up with one mailbox and reads mail in
 * another, and "which email did you use" is a support conversation nobody
 * should need to have with their own hosting page.
 *
 * It grants nothing. The domain is on every page of their site; the password
 * is still the whole gate.
 */
function refForSiteAddress(input: string): string | null {
  const raw = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (!raw || raw.includes("@")) return null;
  for (const [ref, client] of Object.entries(CLIENT_REFS)) {
    if (ref === raw) return ref;
    const label = (client.label ?? "").toLowerCase().replace(/^www\./, "");
    if (label && label === raw) return ref;
  }
  return null;
}

/**
 * Who this identifier and password belong to, or null.
 *
 * The identifier is their email OR their website address. Null for a wrong
 * password, an unknown identifier, and a client with no password set — the
 * same answer for all three. Anything else turns this form into a way to ask
 * whether a given business is one of ours.
 */
export async function identify(identifier: string, password: string): Promise<ClientIdentity | null> {
  if (!identifier || !password) return null;

  /* Their website address or their email, resolved to one of our references
     either way. The row itself is keyed on email — see hostingRow. */
  const ref = refForSiteAddress(identifier) ?? refForEmail(identifier);
  if (!ref) return null;

  const row = await rowForRef(ref);
  if (!row?.subscription_id) return null;
  if (!(await passwordMatchesFor(ref, password))) return null;

  return { subscriptionId: row.subscription_id, ref, email: row.email };
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
