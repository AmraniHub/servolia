import { NextRequest, NextResponse } from "next/server";
import { createLoginLinkToken } from "@/lib/clientAuth";
import { sendEmail, portalLoginEmail } from "@/lib/email";
import { rateLimited, clientIp } from "@/lib/security";

export const runtime = "nodejs";

/** Client requests a magic login link. Always returns success — never reveals whether an email has an account. */
export async function POST(req: NextRequest) {
  const { email, lang } = (await req.json().catch(() => ({}))) as { email?: string; lang?: string };
  if (!email || !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  // Blunt both email-bombing a victim and burning Resend credits:
  // 5 links / 15 min per IP, and 3 / 15 min per target address.
  const ip = clientIp(req.headers);
  if (await rateLimited(`req-link:ip:${ip}`, 5, 15 * 60) ||
      await rateLimited(`req-link:email:${email.toLowerCase().trim()}`, 3, 15 * 60)) {
    // Same shape as success — a limited caller learns nothing about accounts.
    return NextResponse.json({ ok: true, emailSent: false });
  }

  const token = await createLoginLinkToken(email.toLowerCase().trim());
  const origin = req.headers.get("origin") ?? "https://servolia.com";
  const loginUrl = `${origin}/api/portal/verify?token=${encodeURIComponent(token)}`;

  const tpl = portalLoginEmail(loginUrl, lang === "fr" ? "fr" : "en");
  const sent = await sendEmail(email, tpl.subject, tpl.html);

  return NextResponse.json({ ok: true, emailSent: sent });
}
