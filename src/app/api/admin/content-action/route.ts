import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { publishBlogPost, rejectBlogPost, postLinkedInDraft, rejectLinkedInDraft } from "@/lib/contentActions";

export const runtime = "nodejs";

/** Publish/reject a blog post or LinkedIn draft from the CRM UI. Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { kind, id, action } = (await req.json().catch(() => ({}))) as {
    kind?: "blog" | "linkedin";
    id?: string;
    action?: "publish" | "reject";
  };
  if (!kind || !id || !action) {
    return NextResponse.json({ error: "kind, id, and action required" }, { status: 400 });
  }

  let result: { ok: boolean; message: string };
  if (kind === "blog") {
    result = action === "publish" ? await publishBlogPost(id) : await rejectBlogPost(id);
  } else {
    result = action === "publish" ? await postLinkedInDraft(id) : await rejectLinkedInDraft(id);
  }

  return NextResponse.json(result);
}
