/**
 * AWAITED, BOUNDED, NEVER THROWS — how a route sends its alerts and emails.
 *
 * Found 2026-09-25 in a live founder test purchase: the Stripe webhook wrote
 * the client and sent the [TEST] email, and no Telegram alert arrived. The
 * alert was started with a bare `fetch(...).catch(() => {})` and the
 * response returned without waiting for it. On Vercel a function may be
 * frozen the moment its response is out, and a request still in flight dies
 * with it — no error, no log, just silence on the one channel meant to be
 * loud. So nothing here is fire-and-forget: every send is awaited, and every
 * wait is capped so a slow Telegram, Resend or Meta cannot hold a webhook
 * open. `after()` from next/server would also keep the function alive, but
 * the webhook's founder test mode lives in an AsyncLocalStorage context
 * (src/lib/testContext.ts) that an after-callback is not promised to run in —
 * an awaited send runs inside it, by construction.
 *
 *   bounded(label, work)   one send, capped at SEND_TIMEOUT_MS; resolves to
 *                          its result, or undefined on a hang or a throw.
 *   alert(text)            one PLAIN Telegram message (no Markdown: an
 *                          interpolated jean_dupont@... cannot eat it).
 *   notifyOwner(notice)    a money event: the Telegram alert AND an email to
 *                          the owner (OWNER_ALERT_EMAIL, else
 *                          hello@servolia.com), side by side.
 *   new Sends()            a per-request list: `sends.add(...)` starts a send
 *                          now, `await sends.settled()` waits for all of them
 *                          together before the response goes — so a branch
 *                          with three alerts waits ~one timeout, not three,
 *                          and an early `return` cannot leave one behind.
 */
import { sendTelegramMessage, type SendOptions } from "@/lib/telegram";
import { sendEmail } from "@/lib/email";

export const SEND_TIMEOUT_MS = 5_000;

/** Await `work` for at most `ms`. Never rejects: a hang or a throw is logged
 *  and resolves to undefined. `work` may be a promise or a function
 *  returning one (a synchronous throw from it is caught too). */
export async function bounded<T>(
  label: string,
  work: Promise<T> | (() => Promise<T>),
  ms: number = SEND_TIMEOUT_MS,
): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let p: Promise<T>;
  try {
    p = typeof work === "function" ? Promise.resolve(work()) : work;
  } catch (err) {
    console.error(`[notify] ${label} failed:`, err);
    return undefined;
  }
  // A rejection that lands after the timeout must not become unhandled.
  p.catch(() => {});
  try {
    return await Promise.race([
      p,
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => {
          console.error(`[notify] ${label} still pending after ${ms} ms; not waiting any longer`);
          resolve(undefined);
        }, ms);
      }),
    ]);
  } catch (err) {
    console.error(`[notify] ${label} failed:`, err);
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * What an awaited, bounded sendEmail actually did, for an alert to say:
 *   true      → "sent"         (Resend accepted it)
 *   false     → "failed"       (Resend refused, or is not configured)
 *   undefined → "unconfirmed"  (no answer inside the 5 s cap — it may still
 *                               have gone; saying FAILED would send the owner
 *                               to email a client twice)
 */
export type EmailOutcome = "sent" | "failed" | "unconfirmed";
export function emailOutcome(result: boolean | undefined): EmailOutcome {
  return result === true ? "sent" : result === false ? "failed" : "unconfirmed";
}

/** One plain-text Telegram alert, awaited and bounded. "TEST — " is added by
 *  sendTelegramMessage itself during a founder test purchase. */
export function alert(text: string, opts: Omit<SendOptions, "plain"> = {}) {
  return bounded("telegram", sendTelegramMessage(text, undefined, { ...opts, plain: true }));
}

/* ── The owner, told of money by Telegram AND email ─────────────────────── */

export function ownerAlertEmail(): string {
  return process.env.OWNER_ALERT_EMAIL?.trim() || "hello@servolia.com";
}

const SYMBOL: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };

/** "€839", "$42.50", "MAD 120" — whole amounts without decimals. */
export function money(amount: number, currency: string): string {
  const code = (currency || "").toUpperCase();
  const n = Number.isFinite(amount) ? amount : 0;
  const s = Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return SYMBOL[code] ? `${SYMBOL[code]}${s}` : `${code} ${s}`.trim();
}

/** "💶 Paid: <what> — <amount> — <client>" */
export function paidSubject(what: string, amount: number, currency: string, who: string | null | undefined): string {
  return `💶 Paid: ${what} — ${money(amount, currency)} — ${who || "unknown client"}`;
}

/** "⚠️ Payment failed: <what> — <client>" (and the same shape for other trouble). */
export function troubleSubject(kind: string, what: string, who: string | null | undefined): string {
  return `⚠️ ${kind}: ${what} — ${who || "unknown client"}`;
}

export interface OwnerNotice {
  /** Built with paidSubject / troubleSubject. */
  subject: string;
  /** Body lines: what was bought, amount, client, next action. Falsy lines are dropped. */
  lines: (string | null | undefined | false)[];
  /** The admin page to open. */
  link?: string | null;
  /** Telegram without a buzz (the email is unaffected). */
  silent?: boolean;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Tell the owner about money: the plain Telegram alert and an email to
 * OWNER_ALERT_EMAIL (default hello@servolia.com), sent side by side, each
 * capped at SEND_TIMEOUT_MS. Never throws. Never reaches a client: the only
 * recipient is the owner. During a founder test purchase sendEmail routes the
 * email to FOUNDER_EMAIL with "[TEST] " on the subject, and Telegram gets
 * "TEST — " — both applied by the senders themselves.
 */
export async function notifyOwner(n: OwnerNotice): Promise<{ telegram: boolean; email: boolean }> {
  const lines = n.lines.filter((l): l is string => typeof l === "string" && l.length > 0);
  const text = [n.subject, ...lines, ...(n.link ? [n.link] : [])].join("\n");
  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6;color:#18181B;">` +
    lines.map((l) => `<p style="margin:0 0 8px;">${esc(l)}</p>`).join("") +
    (n.link ? `<p style="margin:16px 0 0;"><a href="${esc(n.link)}">${esc(n.link)}</a></p>` : "") +
    `</div>`;
  const [tg, mail] = await Promise.all([
    alert(text, { silent: n.silent }),
    bounded("owner email", sendEmail(ownerAlertEmail(), n.subject, html, [...lines, ...(n.link ? ["", n.link] : [])].join("\n"))),
  ]);
  return { telegram: Boolean(tg), email: mail === true };
}

/** Sends started during one request, all awaited before its response. */
export class Sends {
  private list: Promise<unknown>[] = [];

  /** Start `work` now (bounded); the returned promise can be awaited for its result. */
  add<T>(label: string, work: Promise<T> | (() => Promise<T>)): Promise<T | undefined> {
    const b = bounded(label, work);
    this.list.push(b);
    return b;
  }

  alert(text: string, opts: Omit<SendOptions, "plain"> = {}) {
    const b = alert(text, opts);
    this.list.push(b);
    return b;
  }

  owner(n: OwnerNotice) {
    const b = notifyOwner(n);
    this.list.push(b);
    return b;
  }

  /** Wait for every send, including any added while waiting. Never throws
   *  (each entry is already bounded and non-rejecting). */
  async settled(): Promise<void> {
    for (let i = 0; i < this.list.length; i++) await this.list[i];
  }
}
