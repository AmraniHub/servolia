import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/security";

export const runtime = "nodejs";

/**
 * Admin 2FA setup helper. Admin-authed only.
 *
 * GET  → { enabled } plus, when NOT yet enabled, a fresh { secret, otpauth }
 *        to add to an authenticator app (Google Authenticator, 1Password…).
 *        Enabling = putting that secret into Vercel as ADMIN_TOTP_SECRET and
 *        redeploying. Env-var based on purpose: single admin, no DB row to
 *        steal, and losing the phone is fixed by deleting the env var.
 *
 * POST { code } → { valid } — dry-run a code against the CONFIGURED secret,
 *        so you can confirm the pairing worked before logging out.
 */

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const enabled = !!process.env.ADMIN_TOTP_SECRET;
  if (enabled) return NextResponse.json({ enabled: true });

  const secret = generateTotpSecret();
  return NextResponse.json({
    enabled: false,
    secret,
    otpauth: otpauthUri(secret),
    instructions: [
      "1. Add this secret to your authenticator app (scan the otpauth URI as a QR, or enter the secret manually).",
      "2. In Vercel → Settings → Environment Variables, add ADMIN_TOTP_SECRET with this exact value (Production).",
      "3. Redeploy. From then on, /admin/login requires password + 6-digit code.",
      "Locked out (lost phone)? Delete ADMIN_TOTP_SECRET in Vercel and redeploy — login falls back to password-only.",
    ],
  });
}

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const secret = process.env.ADMIN_TOTP_SECRET;
  if (!secret) return NextResponse.json({ valid: false, reason: "ADMIN_TOTP_SECRET not set yet" });
  return NextResponse.json({ valid: verifyTotp(secret, code ?? "") });
}
