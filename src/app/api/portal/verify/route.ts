import { NextRequest, NextResponse } from "next/server";
import { verifyLoginLinkToken, createClientSession, getClientCookieName, getClientSessionMaxAge } from "@/lib/clientAuth";

export const runtime = "nodejs";

/** Clicked from the magic-link email — verifies the short-lived token and sets the real session cookie. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const origin = req.headers.get("origin") ?? "https://servolia.com";

  if (!token) {
    return NextResponse.redirect(`${origin}/portal/login?error=missing`);
  }

  const email = await verifyLoginLinkToken(token);
  if (!email) {
    return NextResponse.redirect(`${origin}/portal/login?error=expired`);
  }

  const session = await createClientSession(email);
  const res = NextResponse.redirect(`${origin}/portal`);
  res.cookies.set(getClientCookieName(), session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getClientSessionMaxAge(),
  });
  return res;
}
