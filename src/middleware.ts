import { NextResponse, type NextRequest } from "next/server";

/**
 * Sets x-pathname on the REQUEST so server components / layouts can read it.
 * Next.js doesn't pass pathname to layouts by default.
 */
export function middleware(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
