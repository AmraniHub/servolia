/**
 * ONE-OFF WORK SOMEONE HAS PAID FOR, AND WHEN IT IS DUE.
 *
 * The multilingual search setup ($145 once) promises "within five working
 * days". Until 2026-09-25 its payment left no record at all: the webhook sent
 * an email and a Telegram (both fire-and-forget, and both lost in the first
 * live test purchase), and the promise lived nowhere else. A promise that is
 * only in a chat scrollback is a promise that gets missed.
 *
 * So the order is written down where the admin already looks:
 *
 *   - on the site's hosting_clients row, as one `servolia-oneoff:` line in
 *     its notes (the same one-line marker style as the domain, fulfilment and
 *     top-up records — no migration), when a row for that client exists;
 *   - otherwise as a lead (source "one-off", raw_data.type "oneoff"), so a
 *     buyer we do not host yet is still on file with their address.
 *
 * Both are keyed on the Stripe checkout session, so a redelivered event finds
 * its order and does nothing twice. /admin/today lists every open one as
 * "<service> for <site> — due <date>" until it is marked done there.
 */

const MARKER = "servolia-oneoff:";

export interface OneOffOrder {
  /** Product key, e.g. seo_multilingual. */
  service: string;
  /** Stripe checkout session (cs_…): the idempotency key. */
  session: string;
  /** YYYY-MM-DD the payment cleared. */
  paidAt: string;
  /** YYYY-MM-DD the work is promised by. */
  dueAt: string;
  amountUsd: number;
  /** YYYY-MM-DD it was delivered; absent while open. */
  doneAt?: string;
}

/** What a lead row carries in raw_data for an order with no hosting row. */
export interface OneOffLeadData extends OneOffOrder {
  type: "oneoff";
  siteLabel: string;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** `from` plus `n` working days (Saturday and Sunday skipped, UTC), as YYYY-MM-DD.
 *  Paid on a Friday, five working days is the next Friday. */
export function addWorkingDays(from: Date, n: number): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left--;
  }
  return ymd(d);
}

function parse(line: string): OneOffOrder | null {
  const kv: Record<string, string> = {};
  for (const part of line.slice(MARKER.length).split("|")) {
    const i = part.indexOf(":");
    if (i > 0) kv[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  const amount = Number(kv.amount);
  if (!kv.service || !kv.session || !kv.due) return null;
  return {
    service: kv.service,
    session: kv.session,
    paidAt: kv.paid ?? "",
    dueAt: kv.due,
    amountUsd: Number.isFinite(amount) ? amount : 0,
    ...(kv.done ? { doneAt: kv.done } : {}),
  };
}

function render(o: OneOffOrder): string {
  const parts = [`service: ${o.service}`, `session: ${o.session}`, `paid: ${o.paidAt}`, `due: ${o.dueAt}`, `amount: ${o.amountUsd}`];
  if (o.doneAt) parts.push(`done: ${o.doneAt}`);
  return `${MARKER} ${parts.join(" | ")}`;
}

export function readOneOffs(notes: string | null | undefined): OneOffOrder[] {
  return (notes ?? "")
    .split("\n")
    .filter((l) => l.startsWith(MARKER))
    .map(parse)
    .filter((o): o is OneOffOrder => o !== null);
}

export function hasOneOff(notes: string | null | undefined, session: string): boolean {
  return readOneOffs(notes).some((o) => o.session === session);
}

/** Add or replace the order for `rec.session`, leaving every other line alone. */
export function writeOneOff(notes: string | null | undefined, rec: OneOffOrder): string {
  const keep = (notes ?? "")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .filter((l) => !(l.startsWith(MARKER) && parse(l)?.session === rec.session));
  return [...keep, render(rec)].join("\n");
}

/** The notes with that order marked done today (unchanged when it is not there). */
export function markOneOffDone(notes: string | null | undefined, session: string, on: Date = new Date()): string | null {
  const o = readOneOffs(notes).find((x) => x.session === session);
  if (!o) return null;
  return writeOneOff(notes, { ...o, doneAt: o.doneAt ?? ymd(on) });
}
