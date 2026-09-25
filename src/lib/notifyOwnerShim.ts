import { sendEmail, brandWrapper } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * TEMPORARY: the owner-notice helper, until the alerts-fix branch lands.
 *
 * alerts-fix adds src/lib/notify.ts with `notifyOwner(n: OwnerNotice)`. This
 * file has the SAME name, the SAME argument shape and the same result, so the
 * swap is one line in each caller — change the import from
 * "@/lib/notifyOwnerShim" to "@/lib/notify" — and then delete this file.
 * Callers today: src/lib/hostingSetupRun.ts.
 *
 * What it does meanwhile: a plain-text Telegram and an email to
 * OWNER_ALERT_EMAIL (default hello@servolia.com). During a founder test,
 * sendEmail reroutes to FOUNDER_EMAIL with "[TEST] " and Telegram is
 * prefixed "TEST — ". Never throws.
 */
export interface OwnerNotice {
  subject: string;
  /** Body lines. Falsy lines are dropped. */
  lines: (string | null | undefined | false)[];
  /** The admin page to open. */
  link?: string | null;
  /** Telegram without a buzz (the email is unaffected). */
  silent?: boolean;
}

export function ownerAlertAddress(): string {
  return process.env.OWNER_ALERT_EMAIL?.trim() || "hello@servolia.com";
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function notifyOwner(n: OwnerNotice): Promise<{ telegram: boolean; email: boolean }> {
  const lines = n.lines.filter((l): l is string => typeof l === "string" && l.length > 0);
  const all = n.link ? [...lines, n.link] : lines;
  const [telegram, email] = await Promise.all([
    sendTelegramMessage([n.subject, "", ...all].join("\n"), undefined, { plain: true, silent: n.silent === true })
      .then((r) => r !== null, () => false),
    sendEmail(
      ownerAlertAddress(),
      n.subject,
      brandWrapper(
        `<h1 style="margin:0 0 14px;font-size:19px;font-weight:900;">${esc(n.subject)}</h1>` +
        lines.map((l) => `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;">${esc(l)}</p>`).join("") +
        (n.link ? `<p style="margin:14px 0 0;font-size:14px;"><a href="${esc(n.link)}">${esc(n.link)}</a></p>` : ""),
        { preheader: lines[0] ?? n.subject, lang: "en" },
      ),
    ).catch(() => false),
  ]);
  return { telegram, email };
}
