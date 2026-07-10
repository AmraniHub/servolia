import { NextResponse } from "next/server";
import { getClientCookieName } from "@/lib/clientAuth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(getClientCookieName(), "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
