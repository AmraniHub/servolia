import { NextRequest, NextResponse } from "next/server";
import { createAdminSession, getCookieName, getSessionMaxAge } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json() as { password?: string };
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: "Admin password not configured" }, { status: 503 });
  }
  if (!password || password !== expected) {
    // Small delay to slow brute-force
    await new Promise(r => setTimeout(r, 500));
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await createAdminSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(getCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getSessionMaxAge(),
  });
  return res;
}
