import { createHash } from "node:crypto";

/**
 * "EMAIL ME MY LINK" BY EMAIL ADDRESS — the way back to /hosting/account for
 * a client who paid, has no password, and cannot find the receipt.
 *
 * THE ANSWER NEVER SAYS WHETHER THE ADDRESS IS A CLIENT. The route answers the
 * same `{ ok: true }` for every well-formed address and does the lookup and
 * the send AFTER the response (next/server `after`), so neither the body nor
 * the time taken tells a stranger which businesses we host. The link goes
 * only to the address already on the row — never to anything the browser
 * could choose — so asking for someone else's link just emails it to them.
 *
 * Rate limits are taken BEFORE the lookup and do not depend on it, so a 429
 * says "you asked too often", never "this one exists".
 */

/** A plausible email, lowercased; null otherwise. No wildcard characters. */
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const e = input.trim().toLowerCase();
  if (!e || e.length > 254) return null;
  return /^[a-z0-9.!#$&'+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(e) ? e : null;
}

/** The rate-limit key for an address: hashed, so the table never stores it. */
export function emailKey(email: string): string {
  return createHash("sha256").update(email).digest("hex").slice(0, 24);
}

export interface LinkRow {
  id: string;
  email: string | null;
  subscription_id: string | null;
  business: string | null;
  is_test?: boolean | null;
}

export interface LinkDeps {
  /** Candidate rows for the address (case-insensitive), newest first. */
  findRows: (email: string) => Promise<LinkRow[]>;
  /** Email the service-page link for this row to the row's own address. */
  send: (row: LinkRow) => Promise<boolean>;
}

/**
 * Look the address up and, if it is a live hosting client, send their link.
 * The return value is for logs and tests; it must never reach the browser.
 */
export async function sendLinkForEmail(email: string, deps: LinkDeps): Promise<"sent" | "failed" | "no-row"> {
  const rows = await deps.findRows(email).catch(() => [] as LinkRow[]);
  /* Exact match in code as well as in the query: a pattern match is a
     pattern match, and an underscore in an address is a wildcard to SQL. */
  const row = rows.find((r) => (r.email ?? "").trim().toLowerCase() === email && r.subscription_id);
  if (!row) return "no-row";
  return (await deps.send(row).catch(() => false)) ? "sent" : "failed";
}
