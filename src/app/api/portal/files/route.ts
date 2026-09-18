import { NextRequest, NextResponse } from "next/server";
import {
  listFiles,
  usedBytes,
  resolveActor,
  QUOTA_BYTES,
  MAX_FILE_BYTES,
} from "@/lib/clientVault";

export const runtime = "nodejs";

/**
 * The client's own file list, plus the numbers the quota bar needs.
 *
 * `?email=` is only honoured for an admin session (see resolveActor) — a client
 * session always reads its own vault and the parameter is ignored, so passing
 * somebody else's address does nothing.
 */
export async function GET(req: NextRequest) {
  const actor = await resolveActor(req.nextUrl.searchParams.get("email"));
  if (!actor) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const [files, used] = await Promise.all([listFiles(actor.email), usedBytes(actor.email)]);

  return NextResponse.json({
    files,
    used,
    quota: QUOTA_BYTES,
    maxFile: MAX_FILE_BYTES,
    actingAs: actor.by,
  });
}
