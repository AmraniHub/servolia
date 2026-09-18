import { createHash, timingSafeEqual } from "node:crypto";

/**
 * THE PASSWORD LOGIC, WITH NOTHING FROM NEXT IN IT.
 *
 * Split out of siteEditorAuth so it can be tested. That module reaches for
 * `next/headers` to read the session cookie, which cannot resolve outside a
 * Next runtime — so every rule about what makes a password acceptable, and
 * every line of the parser that decides whose password is whose, was
 * unreachable from a test. That is precisely the code that should not be.
 *
 * Everything here is pure: same input, same answer, no clock, no database.
 */

/** The env var holding one site's password hash, e.g. EDITOR_PW_GOODSCOCHINA. */
export function passwordEnvName(ref: string): string {
  return `EDITOR_PW_${ref.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`;
}

/**
 * The hash for a password, salted with the site it belongs to.
 *
 * Not bcrypt: the passwords this guards are long ones, and the salt is the
 * client reference so one client's hash cannot be replayed against another's
 * site. If a client ever picks something short, the floor in passwordProblem()
 * is what stands between that and an offline guess — which is why the floor is
 * length rather than a symbol-and-capital rule that produces "Password1!".
 */
export function hashPassword(ref: string, password: string): string {
  return createHash("sha256").update(`${ref}:${password}`).digest("hex");
}

/** Constant-time compare of a candidate against a stored hash. */
export function hashMatches(ref: string, password: string, expected: string | null | undefined): boolean {
  if (!expected || !password) return false;
  const a = Buffer.from(hashPassword(ref, password), "utf8");
  const b = Buffer.from(expected.trim(), "utf8");
  // timingSafeEqual throws on a length mismatch, which would itself leak.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** The password we set by hand, if there is one. */
export function envPasswordHash(ref: string): string | null {
  return process.env[passwordEnvName(ref)] ?? null;
}

/* ── the hash the client can change, kept in their own row ──────────────── */

const PW_MARKER = "servolia-editor-pw:";

/**
 * The stored hash out of a notes field, or null.
 *
 * The 64-hex shape is required, not assumed. This column is shared with the
 * trial, fulfilment and invite markers and is edited by hand in the admin, so
 * a half-typed value must read as "no password set" rather than as a password
 * nobody can ever match.
 */
export function readStoredHash(notes: string | null | undefined): string | null {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith(PW_MARKER));
  if (!line) return null;
  const m = /hash:\s*([0-9a-f]{64})\b/i.exec(line);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Put a new hash into a notes field, replacing any previous one.
 *
 * Every other line is carried through untouched. This column also holds the
 * trial window and the invitation record, and a writer careless with lines it
 * does not own would end a client's trial as a side effect of that client
 * changing their password.
 *
 * The date is kept beside the hash because "when did this last change" is the
 * first question asked when a client says someone else has been editing their
 * site, and a hash on its own cannot answer it.
 */
export function writeStoredHash(notes: string | null | undefined, hash: string, whenISO: string): string {
  const kept = (notes ?? "").split("\n").filter((l) => !l.startsWith(PW_MARKER) && l.trim() !== "");
  return [...kept, `${PW_MARKER} hash: ${hash} | set: ${whenISO}`].join("\n");
}

/**
 * What a password must be before it guards a live business's website.
 *
 * Ten characters and not one of the handful everybody tries. Deliberately not
 * a complexity rule: forcing a symbol and a capital produces `Password1!` and
 * a sticky note, while length is the thing that actually costs an attacker.
 */
const TOO_COMMON = new Set([
  "password12", "1234567890", "qwertyuiop", "password123", "letmein123", "12345678910",
]);

export function passwordProblem(pw: string): string | null {
  const p = (pw ?? "").trim();
  if (p.length < 10) return "Use at least 10 characters — length is what makes a password hard to guess.";
  if (p.length > 200) return "That is longer than we can store.";
  if (TOO_COMMON.has(p.toLowerCase())) return "That one is on every guessing list. Please choose another.";
  if (/^(.)\1+$/.test(p)) return "That is the same character repeated — please choose another.";
  return null;
}

/* ── a temporary way in, for us ─────────────────────────────────────────── */

/**
 * OUR OWN PASSWORD FOR A CLIENT'S EDITOR, FOR AS LONG AS WE NEED IT.
 *
 * Separate from the client's on purpose. Looking at what a client sees should
 * not mean holding, reusing, or asking for the password they use — and once
 * they change theirs, ours must not quietly keep working.
 *
 * `EDITOR_STAFF_<REF>` holds `<sha256>|<ISO expiry>`. The expiry is inside the
 * value rather than in a calendar reminder because the failure mode here is
 * not misuse, it is forgetting: a second working password on a live client's
 * website, left behind after the afternoon it was needed for, is exactly the
 * kind of thing nobody notices for a year. This one stops working by itself.
 *
 * Revoking early is still one command — remove the variable and redeploy — and
 * that is the right move the moment it is no longer wanted.
 */
export function staffEnvName(ref: string): string {
  return `EDITOR_STAFF_${ref.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`;
}

export interface StaffSecret {
  hash: string;
  /** Epoch ms. */
  until: number;
}

export function readStaffSecret(raw: string | null | undefined): StaffSecret | null {
  if (!raw) return null;
  const [hash, until] = raw.trim().split("|").map((s) => s.trim());
  if (!/^[0-9a-f]{64}$/i.test(hash ?? "")) return null;
  const at = Date.parse(until ?? "");
  // No expiry, or one we cannot read, is not a valid secret. A permanent
  // staff password is the thing this format exists to make impossible.
  if (!Number.isFinite(at)) return null;
  return { hash: hash.toLowerCase(), until: at };
}

export function staffPasswordOk(
  ref: string,
  password: string,
  raw: string | null | undefined,
  now = Date.now(),
): boolean {
  const secret = readStaffSecret(raw);
  if (!secret || secret.until <= now) return false;
  return hashMatches(ref, password, secret.hash);
}

/** The value to put in the variable, for a password we are about to use. */
export function staffSecretValue(ref: string, password: string, until: Date): string {
  return `${hashPassword(ref, password)}|${until.toISOString()}`;
}
