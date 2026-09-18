import { NextRequest, NextResponse } from "next/server";
import { deleteFile, resolveActor, vaultErrorResponse } from "@/lib/clientVault";

export const runtime = "nodejs";

/**
 * Delete one file. Scoped by the session's email inside deleteFile, so an id
 * belonging to another client reads as not-found rather than as forbidden —
 * there is no way to probe whether somebody else's id exists.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const actor = await resolveActor(req.nextUrl.searchParams.get("email"));
  if (!actor) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const result = await deleteFile(actor.email, id);
  if (!result.ok) {
    const { status, error } = vaultErrorResponse(result.reason);
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ ok: true });
}
