import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";

export const runtime = "nodejs";

function htmlPage(body: string, ok: boolean) {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>LinkedIn connection</title>
    <style>
      body{font-family:-apple-system,sans-serif;background:#FAFAF7;color:#18181B;max-width:640px;margin:60px auto;padding:0 20px;line-height:1.6;}
      .box{background:#fff;border:1px solid #E8E6E0;border-radius:16px;padding:28px;margin-top:16px;}
      code{background:#F5F4EF;padding:3px 8px;border-radius:6px;font-size:13px;word-break:break-all;display:inline-block;margin-top:6px;}
      h1{font-size:22px;} .label{font-weight:700;font-size:13px;color:#52525B;text-transform:uppercase;letter-spacing:.05em;margin-top:18px;}
      .warn{color:#92400E;background:#FEF3C7;border-radius:10px;padding:12px 16px;margin-top:16px;font-size:14px;}
    </style></head><body>
    <h1>${ok ? "✅ LinkedIn connected" : "⚠️ Something went wrong"}</h1>
    ${body}
    </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}

/** Receives LinkedIn's OAuth callback, exchanges the code for a token, and shows the values to paste into Vercel. Admin-only. */
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const errorParam = req.nextUrl.searchParams.get("error_description") ?? req.nextUrl.searchParams.get("error");
  if (errorParam) {
    return htmlPage(`<div class="box">LinkedIn returned an error: <code>${errorParam}</code></div>`, false);
  }
  if (!code) {
    return htmlPage(`<div class="box">No authorization code received. Try the connect link again.</div>`, false);
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return htmlPage(`<div class="box">LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET not set in Vercel yet.</div>`, false);
  }

  const origin = req.headers.get("origin") ?? "https://servolia.com";
  const redirectUri = `${origin}/api/admin/linkedin-oauth/callback`;

  try {
    // ── 1. Exchange the code for an access token ──────────────────────────
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      return htmlPage(`<div class="box">Token exchange failed:<br><code>${JSON.stringify(tokenJson)}</code></div>`, false);
    }
    const accessToken: string = tokenJson.access_token;
    const expiresInDays = Math.round((tokenJson.expires_in ?? 0) / 86400);

    // ── 2. Find which organization(s) this token can administer ───────────
    let orgLines = `<div class="warn">Couldn't auto-detect your organization ID — see the fallback method below.</div>`;
    try {
      const orgRes = await fetch(
        "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const orgJson = await orgRes.json();
      const elements: { organization?: string }[] = orgJson.elements ?? [];
      if (elements.length > 0) {
        orgLines = elements
          .map((e) => `<div class="label">Organization URN</div><code>${e.organization}</code>`)
          .join("");
      }
    } catch {
      /* fall back to manual lookup instructions below */
    }

    return htmlPage(
      `<div class="box">
        <p>Copy these into <strong>Vercel → Settings → Environment Variables</strong> (Production), then tell Claude to redeploy.</p>
        <div class="label">LINKEDIN_ACCESS_TOKEN</div><code>${accessToken}</code>
        ${orgLines}
        <p style="margin-top:18px;font-size:13px;color:#71717A;">This token expires in ~${expiresInDays} days. You'll need to redo this connect flow again after that (LinkedIn access tokens aren't permanent).</p>
        <p style="margin-top:10px;font-size:13px;color:#71717A;">If no Organization URN appeared above: go to your Company Page admin view — the number in the URL after <code>/company/</code> is your organization ID. Format it as <code>urn:li:organization:&lt;that number&gt;</code>.</p>
      </div>`,
      true
    );
  } catch (err) {
    return htmlPage(`<div class="box">Unexpected error: <code>${String(err)}</code></div>`, false);
  }
}
