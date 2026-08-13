import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import {
  beginEnrolment,
  cancelEnrolment,
  confirmEnrolment,
  disableTwoFactor,
  getTwoFactorState,
  regenerateRecoveryCodes,
} from "@/lib/admin2fa";

export const runtime = "nodejs";

/**
 * Admin 2FA management. Session-authed — you must already be logged in.
 *
 * GET            → status (enabled, where the secret lives, recovery codes left)
 * POST { action }
 *   setup        → mint a PENDING secret + otpauth URI. Enforces nothing yet.
 *   confirm      → { code } proves the app holds it → 2FA on + 8 recovery codes
 *                  (returned once, in plaintext, never again)
 *   cancel       → drop a half-finished enrolment
 *   regenerate   → { code } → a fresh set of 8, old ones dead
 *   disable      → { code } turn it off (code or recovery code required, so a
 *                  stolen session can't quietly strip the second factor)
 *
 * Two-phase on purpose: the old single-shot flow enabled 2FA the moment a
 * secret existed, so a QR that scanned wrong locked you out of your own admin
 * and only a Vercel env-var edit got you back in.
 */

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const s = await getTwoFactorState();
    return NextResponse.json({
      enabled: s.enabled,
      source: s.source,
      confirmedAt: s.confirmedAt,
      recoveryRemaining: s.recoveryRemaining,
      pending: !!s.pendingSecret,
      storageMissing: s.storageMissing,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { action?: string; code?: string };
  const code = (body.code ?? "").trim();

  try {
    switch (body.action) {
      case "setup": {
        const { secret, otpauth } = await beginEnrolment();
        return NextResponse.json({
          secret,
          otpauth,
          steps: [
            "Scan the QR with your authenticator (Google Authenticator, 1Password, Bitwarden…), or type the secret in by hand.",
            "Enter the 6-digit code it shows to confirm the pairing.",
            "Save the recovery codes you get back — they are shown once and are the way back in if you lose the phone.",
          ],
        });
      }

      case "confirm": {
        const r = await confirmEnrolment(code);
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
        return NextResponse.json({ ok: true, recoveryCodes: r.recoveryCodes });
      }

      case "cancel":
        await cancelEnrolment();
        return NextResponse.json({ ok: true });

      case "regenerate": {
        const r = await regenerateRecoveryCodes(code);
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
        return NextResponse.json({ ok: true, recoveryCodes: r.recoveryCodes });
      }

      case "disable": {
        const r = await disableTwoFactor(code);
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
