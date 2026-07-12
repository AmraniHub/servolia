import { NextRequest, NextResponse } from "next/server";
import { getClientEmail } from "@/lib/clientAuth";
import { setPassword, verifyPassword, hasPassword, passwordProblem } from "@/lib/clientPassword";

export const runtime = "nodejs";

/**
 * Set or change the logged-in client's portal password.
 * Requires an active session (they logged in via magic link or existing password).
 * If a password already exists, the current one must be supplied.
 */
export async function POST(req: NextRequest) {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Please log in first" }, { status: 401 });

  const { currentPassword, newPassword } = (await req.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
  };

  const problem = passwordProblem(newPassword ?? "");
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  // If they already have a password, verify the current one before changing.
  if (await hasPassword(email)) {
    if (!currentPassword || !(await verifyPassword(email, currentPassword))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
    }
  }

  const ok = await setPassword(email, newPassword!);
  if (!ok) return NextResponse.json({ error: "Could not save password" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/** Whether the logged-in client already has a password set (drives the UI copy). */
export async function GET() {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Please log in first" }, { status: 401 });
  return NextResponse.json({ hasPassword: await hasPassword(email) });
}
