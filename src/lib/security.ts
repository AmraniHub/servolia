import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Security primitives shared by the auth surfaces:
 *  - timing-safe string comparison (password/code checks)
 *  - cross-instance rate limiting (Supabase-backed, in-memory fallback)
 *  - TOTP two-factor (RFC 6238, no dependencies — node crypto only)
 */

/* ── timing-safe compare ──────────────────────────────────────────────── */

/** Constant-time string equality — never use === for secrets. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // timingSafeEqual requires equal lengths; compare against self on mismatch
  // so the work done is identical either way.
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/* ── rate limiting ────────────────────────────────────────────────────── */

/**
 * Cross-instance limiter backed by the rate_limits table (see the security
 * block at the end of supabase/schema.sql). Falls back to a per-instance
 * in-memory window when the DB or table is unavailable — weaker on
 * serverless, but never locks the founder out because a table is missing.
 * Returns true when the caller should be BLOCKED.
 */
const memory = new Map<string, { n: number; start: number }>();

export async function rateLimited(key: string, max: number, windowSec: number): Promise<boolean> {
  const db = supabaseAdmin();
  if (db) {
    try {
      const now = Date.now();
      const { data } = await db.from("rate_limits").select("count, window_start").eq("key", key).maybeSingle();
      const row = data as { count: number; window_start: string } | null;
      if (!row || now - new Date(row.window_start).getTime() > windowSec * 1000) {
        await db.from("rate_limits").upsert({ key, count: 1, window_start: new Date().toISOString() }, { onConflict: "key" });
        return false;
      }
      if (row.count >= max) return true;
      await db.from("rate_limits").update({ count: row.count + 1 }).eq("key", key);
      return false;
    } catch {
      /* table not created yet — fall through to memory */
    }
  }
  const now = Date.now();
  const rec = memory.get(key);
  if (!rec || now - rec.start > windowSec * 1000) {
    memory.set(key, { n: 1, start: now });
    return false;
  }
  rec.n += 1;
  return rec.n > max;
}

/** First non-spoofable-ish client IP (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/* ── TOTP (RFC 6238) ──────────────────────────────────────────────────── */

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Tolerant on purpose: people paste secrets with spaces, dashes, lowercase. */
function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of clean) {
    value = (value << 5) | B32_ALPHABET.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const offset = h[h.length - 1] & 0x0f;
  const code = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

/**
 * Verify a TOTP code and return the TIME STEP it matched, or null.
 *
 * The step is the whole point: persist it and pass `minStep = lastStep + 1`
 * next time, and a code that has already been used verifies nowhere — even
 * inside its own 30-second life. Without that, a code read over your shoulder
 * or captured in a screen-share stays valid until the window rolls, which is
 * the one realistic attack against an authenticator app.
 *
 * ±1 step tolerance absorbs the clock drift real phones have.
 */
export function verifyTotpStep(
  base32Secret: string,
  code: string,
  opts: { minStep?: number; window?: number } = {},
): number | null {
  const clean = (code ?? "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const secret = base32Decode(base32Secret);
  if (secret.length < 10) return null;

  const { minStep = 0, window = 1 } = opts;
  const centre = Math.floor(Date.now() / 1000 / 30);
  for (let offset = -window; offset <= window; offset++) {
    const step = centre + offset;
    if (step < minStep) continue;
    if (timingSafeEqualStr(hotp(secret, step), clean)) return step;
  }
  return null;
}

/** Boolean form, for callers that don't track replay. Prefer verifyTotpStep. */
export function verifyTotp(base32Secret: string, code: string): boolean {
  return verifyTotpStep(base32Secret, code) !== null;
}

/**
 * Recovery codes — the way back in when the phone is lost or wiped.
 *
 * Without these, losing the authenticator means editing an env var in Vercel
 * and redeploying to get into your own admin. Ten base32 characters, grouped
 * as XXXXX-XXXXX so they can be written on paper without transcription errors.
 * Only ever stored as SHA-256 hashes.
 */
export function newRecoveryCodes(count = 8): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = base32Encode(randomBytes(7)).slice(0, 10);
    out.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return out;
}

/** One canonical form, so "abcde-fghij" and "ABCDE FGHIJ" hash identically. */
export function normalizeRecoveryCode(code: string): string {
  return String(code ?? "").toUpperCase().replace(/[^A-Z2-7]/g, "");
}

/** Hash a recovery code for storage/comparison. */
export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

/** Fresh 160-bit TOTP secret, base32 — paste into an authenticator app. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** otpauth:// URI for QR/manual setup in Google Authenticator, 1Password, etc. */
export function otpauthUri(base32Secret: string, account = "admin", issuer = "Servolia"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${base32Secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
