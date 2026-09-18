import { NextRequest, NextResponse } from "next/server";
import { confirmUpload, resolveActor, vaultErrorResponse } from "@/lib/clientVault";

export const runtime = "nodejs";

/**
 * Step 2 of an upload, and the only step that enforces anything.
 *
 * By the time this runs the object is already in storage, so this is where the
 * real size is read back, the type is sniffed from the first bytes, and the
 * object is deleted again if it broke the per-file limit or the quota. The row
 * is written last, which is what makes the rule "a file the client can see is
 * a file that passed" true rather than hopeful.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { path?: string; name?: string; email?: string }
    | null;
  if (!body?.path || !body?.name) {
    return NextResponse.json({ error: "path and name required" }, { status: 400 });
  }

  const actor = await resolveActor(body.email);
  if (!actor) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const result = await confirmUpload(actor.email, body.path, body.name, actor.by);
  if (!result.ok) {
    const { status, error } = vaultErrorResponse(result.reason);
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ file: result.value });
}
