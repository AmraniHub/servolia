import { NextRequest, NextResponse } from "next/server";
import { signUpload, resolveActor, vaultErrorResponse } from "@/lib/clientVault";

export const runtime = "nodejs";

/**
 * Step 1 of an upload: hand the browser a signed URL to PUT the file straight
 * into private storage.
 *
 * The file itself never comes through here — that is the point. A serverless
 * request body caps out around 4.5MB on Vercel, which is exactly why chat
 * attachments are limited to 4MB; going direct is what allows 25MB.
 *
 * The limits checked here are a courtesy so a doomed upload fails before it
 * spends bandwidth on a 4G connection. They are NOT the enforcement — the
 * browser could claim any size it likes. /confirm reads the real size back
 * from storage and deletes the object if it lied.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { name?: string; size?: number; email?: string }
    | null;
  if (!body?.name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const actor = await resolveActor(body.email);
  if (!actor) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const result = await signUpload(actor.email, body.name, Number(body.size ?? 0));
  if (!result.ok) {
    const { status, error } = vaultErrorResponse(result.reason);
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json(result.value);
}
