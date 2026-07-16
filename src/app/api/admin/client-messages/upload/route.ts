import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { uploadChatImage, uploadErrorResponse } from "@/lib/chatAttachments";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadChatImage(buffer);
  if (!result.ok) {
    const { status, error } = uploadErrorResponse(result.reason);
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ url: result.url, type: result.mime });
}
