import { createHmac, randomBytes, timingSafeEqual } from "crypto";
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

/** Verify a 6-digit TOTP code with ±1 time-step tolerance (30s steps). */
export function verifyTotp(base32Secret: string, code: string): boolean {
  const clean = (code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const secret = base32Decode(base32Secret);
  if (secret.length < 10) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (const t of [step - 1, step, step + 1]) {
    if (timingSafeEqualStr(hotp(secret, t), clean)) return true;
  }
  return false;
}

/** Fresh 160-bit TOTP secret, base32 — paste into an authenticator app. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** otpauth:// URI for QR/manual setup in Google Authenticator, 1Password, etc. */
export function otpauthUri(base32Secret: string, account = "admin", issuer = "Servolia"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${base32Secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
