import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { attachSiteDomain, detachSiteDomain } from "@/lib/siteDomain";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/admin/site-domain { slug, domain, action: "attach" | "detach" }
 *
 * C2: put a practice's generated site on her OWN domain (src/lib/siteDomain.ts).
 * Attach answers with the exact DNS lines to send her; the go-live email goes
 * by itself from /api/cron/domain-live the first time her domain serves the
 * site — never from here, so it is never sent before it is true.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { slug?: string; domain?: string; action?: string };
  const slug = typeof body.slug === "string" ? body.slug.slice(0, 60) : "";
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  if (body.action === "detach") {
    const ok = await detachSiteDomain(slug);
    return NextResponse.json({ ok }, { status: ok ? 200 : 409 });
  }

  const out = await attachSiteDomain(slug, String(body.domain ?? ""));
  if (!out.ok) {
    const status = out.reason === "not-found" ? 404 : out.reason === "vercel" || out.reason === "write-failed" || out.reason === "no-db" ? 502 : 400;
    return NextResponse.json(out, { status });
  }
  await sendTelegramMessage(
    `Domain attached - ${slug} -> ${out.domain}\n` +
    `Send her these DNS lines:\n${out.dns.map((d) => `${d.type}  ${d.name}  ${d.value}`).join("\n")}\n` +
    `The go-live email goes by itself when https://${out.domain} serves her site.`,
    undefined, { plain: true, silent: true },
  ).catch(() => {});
  return NextResponse.json(out);
}
