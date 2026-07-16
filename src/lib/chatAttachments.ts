import { randomUUID } from "crypto";
import { supabaseAdmin } from "./supabase";

/**
 * Chat image attachments. Security posture:
 *   - File type is determined by sniffing magic bytes, never trusted from the
 *     client's declared MIME type or filename extension (a renamed .html/.svg
 *     could otherwise slip through as "image/jpeg").
 *   - SVG is never allowed — it can embed <script>, a classic image-upload XSS
 *     vector. Only raster formats (JPEG/PNG/WEBP/GIF) are accepted.
 *   - Stored under a random UUID filename (no user-controlled path/name), so
 *     there's no path traversal or overwrite risk.
 *   - Served from Supabase Storage as a static object with the sniffed
 *     content-type set explicitly at upload time — never executed, never
 *     served with a browser-guessable/sniffable wrong content-type.
 *   - Capped at 4MB, safely under Vercel's serverless request body ceiling,
 *     so an oversized upload fails with our own clear error, not a raw 413.
 */

export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

const SIGNATURES: { ext: string; mime: string; check: (b: Buffer) => boolean }[] = [
  { ext: "jpg", mime: "image/jpeg", check: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", check: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: "webp", mime: "image/webp", check: (b) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
  { ext: "gif", mime: "image/gif", check: (b) => b.length > 6 && (b.toString("ascii", 0, 6) === "GIF87a" || b.toString("ascii", 0, 6) === "GIF89a") },
];

export function sniffImageType(buffer: Buffer): { ext: string; mime: string } | null {
  for (const sig of SIGNATURES) if (sig.check(buffer)) return { ext: sig.ext, mime: sig.mime };
  return null;
}

const BUCKET = "chat-attachments";
let bucketReady = false;

async function ensureBucket() {
  if (bucketReady) return;
  const db = supabaseAdmin();
  if (!db) return;
  // Idempotent — ignore "already exists" (or any) error, the upload call below
  // is the real source of truth if something's actually wrong.
  await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_ATTACHMENT_BYTES }).catch(() => {});
  bucketReady = true;
}

export type UploadResult =
  | { ok: true; url: string; mime: string }
  | { ok: false; reason: "too_large" | "invalid_type" | "not_configured" | "upload_failed" };

/** Validates + uploads. Distinguishes failure reasons so the route can return an accurate error, not a generic catch-all. */
export async function uploadChatImage(buffer: Buffer): Promise<UploadResult> {
  if (buffer.length > MAX_ATTACHMENT_BYTES) return { ok: false, reason: "too_large" };
  const sig = sniffImageType(buffer);
  if (!sig) return { ok: false, reason: "invalid_type" };

  const db = supabaseAdmin();
  if (!db) return { ok: false, reason: "not_configured" };
  await ensureBucket();

  const path = `${randomUUID()}.${sig.ext}`;
  const { error } = await db.storage.from(BUCKET).upload(path, buffer, { contentType: sig.mime, upsert: false });
  if (error) return { ok: false, reason: "upload_failed" };

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl, mime: sig.mime };
}

export function uploadErrorResponse(reason: Exclude<UploadResult, { ok: true }>["reason"]): { status: number; error: string } {
  switch (reason) {
    case "too_large": return { status: 400, error: "Image must be under 4MB" };
    case "invalid_type": return { status: 400, error: "Only JPEG, PNG, WEBP, or GIF images are allowed" };
    case "not_configured": return { status: 503, error: "Image storage isn't configured yet" };
    case "upload_failed": return { status: 500, error: "Upload failed — try again" };
  }
}
