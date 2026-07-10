import { NextRequest, NextResponse } from "next/server";
import { createLoginLinkToken } from "@/lib/clientAuth";
import { sendEmail, portalLoginEmail } from "@/lib/email";

export const runtime = "nodejs";

/** Client requests a magic login link. Always returns success — never reveals whether an email has an account. */
export async function POST(req: NextRequest) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (!email || !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const token = await createLoginLinkToken(email.toLowerCase().trim());
  const origin = req.headers.get("origin") ?? "https://servolia.com";
  const loginUrl = `${origin}/api/portal/verify?token=${encodeURIComponent(token)}`;

  const tpl = portalLoginEmail(loginUrl);
  const sent = await sendEmail(email, tpl.subject, tpl.html);

  return NextResponse.json({ ok: true, emailSent: sent });
}
