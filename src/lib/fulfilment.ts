/**
 * WHICH PAYMENT HAS ALREADY BEEN ACTED ON.
 *
 * The webhook used to answer that question with the database insert: a
 * duplicate-key error on hosting_clients meant "we have seen this before",
 * and everything that follows the insert — switching the site on, emailing
 * the client, telling the operator — was skipped. Excellence Agency paid on
 * 2026-09-16 and their site stayed dark, because the row already existed:
 * the insert failing said nothing about whether the site had been lifted.
 *
 * The right key is "this checkout session was fulfilled", recorded AFTER the
 * work is done. It lives on the row's `notes` in the same one-line format
 * the domain record uses (see domainSales.ts), so no migration stands
 * between this fix and the next payment. A Stripe retry then finds the
 * marker and does nothing; a first delivery that died halfway finds no
 * marker and finishes the job, and every step it repeats is itself safe to
 * repeat (the gate compares before it writes, the installer skips tagged
 * pages, the domain step checks the domain record).
 */

const MARKER = "servolia-fulfilled:";

export interface FulfilmentRecord {
  /** The Stripe checkout session (cs_…) whose work was completed. */
  session: string;
  at: string;
  plan: string;
}

export function readFulfilment(notes: string | null | undefined): FulfilmentRecord | null {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith(MARKER));
  if (!line) return null;
  const [session, ...rest] = line.slice(MARKER.length).split(" | ");
  const kv: Record<string, string> = {};
  for (const p of rest) {
    const i = p.indexOf(":");
    if (i > 0) kv[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  const s = session.trim();
  return s ? { session: s, at: kv.at ?? "", plan: kv.plan ?? "" } : null;
}

export function writeFulfilment(notes: string | null | undefined, rec: FulfilmentRecord): string {
  const kept = (notes ?? "").split("\n").filter((l) => !l.startsWith(MARKER) && l.trim() !== "");
  const line = `${MARKER} ${rec.session} | at: ${rec.at} | plan: ${rec.plan}`;
  return [...kept, line].join("\n");
}

/** True when this exact checkout session has already been acted on. */
export function alreadyFulfilled(notes: string | null | undefined, sessionId: string): boolean {
  const rec = readFulfilment(notes);
  return Boolean(rec && sessionId && rec.session === sessionId);
}
