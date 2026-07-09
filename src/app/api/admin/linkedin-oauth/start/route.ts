import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** Kicks off the LinkedIn OAuth flow to authorize posting as the Servolia Company Page. Admin-only. */
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "LINKEDIN_CLIENT_ID not configured in Vercel" }, { status: 503 });
  }

  const origin = req.headers.get("origin") ?? "https://servolia.com";
  const redirectUri = `${origin}/api/admin/linkedin-oauth/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "w_organization_social r_organization_social rw_organization_admin",
    state: "servolia_admin",
  });

  return NextResponse.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
}
