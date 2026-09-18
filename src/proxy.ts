import { NextResponse, type NextRequest } from "next/server";

/**
 * Sets x-pathname on the REQUEST so server components / layouts can read it.
 * Next.js doesn't pass pathname to layouts by default.
 *
 * Called `proxy`, in proxy.ts: Next 16 renamed this convention and warns on
 * every dev start until the file moves. The export name must match the file
 * name or Next refuses to load it and silently runs no proxy at all — which
 * would strip x-pathname from every request and break the layouts that read
 * it, with nothing in the log but the deprecation notice that is already there.
 */
export function proxy(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
