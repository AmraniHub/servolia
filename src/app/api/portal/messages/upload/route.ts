import { NextRequest, NextResponse } from "next/server";
import { getClientEmail } from "@/lib/clientAuth";
import { uploadChatImage, uploadErrorResponse } from "@/lib/chatAttachments";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

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
