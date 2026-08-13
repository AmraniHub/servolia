import { supabaseAdmin } from "@/lib/supabase";
import {
  generateTotpSecret,
  hashRecoveryCode,
  newRecoveryCodes,
  otpauthUri,
  verifyTotpStep,
} from "@/lib/security";

/**
 * Admin 2FA state — the secret, the replay guard, and the recovery codes.
 *
 * WHY THIS MOVED OUT OF AN ENV VAR
 * The old design put the TOTP secret in ADMIN_TOTP_SECRET. It worked, but
 * every state change was a deploy: turning 2FA on meant pasting a secret into
 * Vercel and redeploying, turning it off meant the same, and a lost phone meant
 * getting to a laptop with Vercel access before you could open your own admin.
 * There was also no way to know a code had already been used, and no way back
 * in that didn't involve the hosting dashboard.
 *
 * Now it is one row in `admin_2fa`:
 *   - two-phase enrolment (pending_secret → confirmed), so a QR that scanned
 *     wrong is caught while you are still logged in, not at the next login
 *   - last_step, so a code that has been spent is refused even inside its own
 *     30-second window
 *   - eight single-use recovery codes, stored only as SHA-256 hashes
 *
 * MIGRATION SAFETY: if the table isn't there yet, everything falls back to
 * ADMIN_TOTP_SECRET exactly as before. Deploying this code without running the
 * migration changes nothing; running the migration later picks it up. What it
 * will NOT do is fail open — if the table exists and the read fails, login is
 * refused rather than waved through.
 */

export const TWOFA_ROW_ID = "admin";

export type TwoFactorSource = "db" | "env" | "none";

export type TwoFactorState = {
  enabled: boolean;
  source: TwoFactorSource;
  secret: string | null;
  pendingSecret: string | null;
  lastStep: number;
  recoveryRemaining: number;
  confirmedAt: string | null;
  /** True when the DB table is missing — the UI explains the migration is pending. */
  storageMissing: boolean;
};

type Row = {
  secret: string | null;
  pending_secret: string | null;
  confirmed_at: string | null;
  last_step: number | null;
  recovery_hashes: string[] | null;
};

/** Postgres/PostgREST codes that mean "the table simply isn't there yet". */
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = err.code ?? "";
  if (code === "42P01" || code === "PGRST205" || code === "PGRST204") return true;
  return /relation .* does not exist|could not find the table/i.test(err.message ?? "");
}

async function readRow(): Promise<{ row: Row | null; storageMissing: boolean }> {
  const supabase = supabaseAdmin();
  // No Supabase configured at all — same posture as "table not there yet":
  // the env-var secret still governs, nothing silently loses a factor.
  if (!supabase) return { row: null, storageMissing: true };
  const { data, error } = await supabase
    .from("admin_2fa")
    .select("secret, pending_secret, confirmed_at, last_step, recovery_hashes")
    .eq("id", TWOFA_ROW_ID)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return { row: null, storageMissing: true };
    // Any OTHER error (network, permissions, timeout) must not silently
    // downgrade to password-only. Let it throw; callers fail closed.
    throw new Error(`admin_2fa read failed: ${error.message}`);
  }
  return { row: (data as Row | null) ?? null, storageMissing: false };
}

export async function getTwoFactorState(): Promise<TwoFactorState> {
  const envSecret = process.env.ADMIN_TOTP_SECRET?.trim() || null;

  let row: Row | null = null;
  let storageMissing = false;
  try {
    ({ row, storageMissing } = await readRow());
  } catch {
    // Storage is configured but unreachable. If an env secret exists we can
    // still enforce 2FA with it; otherwise report enabled-but-unverifiable so
    // the login route refuses rather than letting a password through alone.
    return {
      enabled: true,
      source: envSecret ? "env" : "db",
      secret: envSecret,
      pendingSecret: null,
      lastStep: 0,
      recoveryRemaining: 0,
      confirmedAt: null,
      storageMissing: false,
    };
  }

  const dbActive = !!row?.secret && !!row?.confirmed_at;
  if (dbActive) {
    return {
      enabled: true,
      source: "db",
      secret: row!.secret,
      pendingSecret: row!.pending_secret ?? null,
      lastStep: Number(row!.last_step ?? 0),
      recoveryRemaining: (row!.recovery_hashes ?? []).length,
      confirmedAt: row!.confirmed_at,
      storageMissing,
    };
  }

  if (envSecret) {
    return {
      enabled: true,
      source: "env",
      secret: envSecret,
      pendingSecret: row?.pending_secret ?? null,
      lastStep: 0,
      recoveryRemaining: 0,
      confirmedAt: null,
      storageMissing,
    };
  }

  return {
    enabled: false,
    source: "none",
    secret: null,
    pendingSecret: row?.pending_secret ?? null,
    lastStep: 0,
    recoveryRemaining: 0,
    confirmedAt: null,
    storageMissing,
  };
}

async function upsert(patch: Record<string, unknown>): Promise<void> {
  const supabase = supabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured — 2FA state has nowhere to live.");
  const { error } = await supabase
    .from("admin_2fa")
    .upsert({ id: TWOFA_ROW_ID, ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) {
    if (isMissingTable(error)) {
      throw new Error("2FA storage not set up — run supabase/pending-migration.sql section 8 first.");
    }
    throw new Error(error.message);
  }
}

/** Phase 1: mint a secret and park it as pending. Nothing is enforced yet. */
export async function beginEnrolment(account = "admin"): Promise<{ secret: string; otpauth: string }> {
  const secret = generateTotpSecret();
  await upsert({ pending_secret: secret });
  return { secret, otpauth: otpauthUri(secret, account) };
}

/**
 * Phase 2: a valid code proves the authenticator actually holds the secret.
 * Only now does 2FA switch on — which is why a mis-scanned QR can't lock you out.
 * Returns the recovery codes ONCE, in plaintext. They are stored hashed.
 */
export async function confirmEnrolment(
  code: string,
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: string }> {
  const { row, storageMissing } = await readRow();
  if (storageMissing) {
    return { ok: false, error: "2FA storage not set up — run supabase/pending-migration.sql section 8 first." };
  }
  const pending = row?.pending_secret;
  if (!pending) return { ok: false, error: "No enrolment in progress. Start again." };

  const step = verifyTotpStep(pending, code);
  if (step === null) return { ok: false, error: "That code didn't match. Check your authenticator and try the next one." };

  const recoveryCodes = newRecoveryCodes(8);
  await upsert({
    secret: pending,
    pending_secret: null,
    confirmed_at: new Date().toISOString(),
    last_step: step,
    recovery_hashes: recoveryCodes.map(hashRecoveryCode),
  });
  return { ok: true, recoveryCodes };
}

/** Abandon a half-finished enrolment. */
export async function cancelEnrolment(): Promise<void> {
  await upsert({ pending_secret: null });
}

/**
 * Turn 2FA off. Requires a live code or a recovery code — otherwise anyone who
 * got hold of a session cookie could strip the second factor and keep the door
 * open. The env-var secret is deliberately NOT disableable from here; that one
 * lives in Vercel and is removed there.
 */
export async function disableTwoFactor(code: string): Promise<{ ok: boolean; error?: string }> {
  const state = await getTwoFactorState();
  if (!state.enabled) return { ok: true };
  if (state.source === "env") {
    return { ok: false, error: "This secret comes from ADMIN_TOTP_SECRET. Remove that env var in Vercel and redeploy." };
  }
  const result = await consumeSecondFactor(code);
  if (!result.ok) return { ok: false, error: result.error };

  await upsert({ secret: null, pending_secret: null, confirmed_at: null, last_step: 0, recovery_hashes: [] });
  return { ok: true };
}

export type SecondFactorResult =
  | { ok: true; usedRecovery: boolean; recoveryRemaining: number }
  | { ok: false; error: string };

/**
 * Verify a second factor and SPEND it.
 *
 * A TOTP code must beat last_step, so replaying one that already worked fails
 * even a second later. A recovery code is removed from the row on use, so each
 * of the eight works exactly once.
 */
export async function consumeSecondFactor(input: string): Promise<SecondFactorResult> {
  const state = await getTwoFactorState();
  if (!state.enabled) return { ok: true, usedRecovery: false, recoveryRemaining: 0 };
  if (!state.secret) {
    // Enabled but unverifiable (storage unreachable). Refuse — never fail open.
    return { ok: false, error: "Two-factor check unavailable. Try again shortly." };
  }

  const raw = String(input ?? "").trim();
  if (!raw) return { ok: false, error: "Enter the 6-digit code from your authenticator." };

  // Digits-only → treat as TOTP. Anything else → recovery code.
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 6 && /^[\d\s-]+$/.test(raw)) {
    const step = verifyTotpStep(state.secret, digits, { minStep: state.lastStep + 1 });
    if (step === null) return { ok: false, error: "Invalid or already-used code." };
    if (state.source === "db") {
      await upsert({ last_step: step });
    }
    return { ok: true, usedRecovery: false, recoveryRemaining: state.recoveryRemaining };
  }

  if (state.source !== "db") {
    return { ok: false, error: "Invalid or already-used code." };
  }

  const { row } = await readRow();
  const hashes = row?.recovery_hashes ?? [];
  const target = hashRecoveryCode(raw);
  const idx = hashes.indexOf(target);
  if (idx === -1) return { ok: false, error: "Invalid or already-used code." };

  const remaining = hashes.filter((_, i) => i !== idx);
  await upsert({ recovery_hashes: remaining });
  return { ok: true, usedRecovery: true, recoveryRemaining: remaining.length };
}

/** Fresh set of eight, invalidating the old ones. Requires a live code. */
export async function regenerateRecoveryCodes(
  code: string,
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: string }> {
  const state = await getTwoFactorState();
  if (!state.enabled || state.source !== "db") {
    return { ok: false, error: "Recovery codes need DB-backed 2FA. Enrol here first." };
  }
  const result = await consumeSecondFactor(code);
  if (!result.ok) return { ok: false, error: result.error };

  const recoveryCodes = newRecoveryCodes(8);
  await upsert({ recovery_hashes: recoveryCodes.map(hashRecoveryCode) });
  return { ok: true, recoveryCodes };
}
