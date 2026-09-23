import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getClientSite } from "@/lib/clientSites";
import { previewGrantsView, PREVIEW_COOKIE } from "@/lib/draftPreview";
import { publishSite } from "@/lib/publishSite";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

/**
 * POST /sites/<slug>/go { action: "go" | "change", message? } — C3: the
 * client's own answer to her draft, from the draft itself.
 *
 * Until 2026-09-23 the ribbon over her draft said "reply to our email — we
 * take it live when you say so", and nothing but a person reading that reply
 * made it true. Now:
 *   go      her site is published on the spot (src/lib/publishSite.ts: the
 *           same code as the founder's Publish button), her build is marked
 *           live, the go-live email follows — or, with her own domain
 *           attached, it follows the moment that domain answers (C2);
 *   change  her words reach the founder on Telegram and on /admin/today.
 *
 * Only the holder of her signed preview link can do either: it lives under
 * /sites/ so the preview cookie (path /sites) reaches it, and the token is
 * checked against THIS site's build exactly as viewing is. The founder's own
 * admin session is not accepted here — his button is on /admin/sites.
 */

const recent = new Map<string, number[]>();
function tooMany(slug: string): boolean {
  const now = Date.now();
  const hits = (recent.get(slug) ?? []).filter((t) => now - t < 3_600_000);
  hits.push(now);
  recent.set(slug, hits);
  if (recent.size > 2000) recent.clear();
  return hits.length > 6;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; message?: string; token?: string };
  const config = await getClientSite(slug);
  if (!config || config.assistantOnly || config.isDemo) return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });

  const token = (typeof body.token === "string" ? body.token.slice(0, 2000) : "") || (await cookies()).get(PREVIEW_COOKIE)?.value || null;
  if (!(await previewGrantsView(config, token))) {
    // Already live (a second click, another tab) is not an error for her.
    if (config.status === "published" && body.action === "go") return NextResponse.json({ ok: true, already: true });
    return NextResponse.json({ ok: false, reason: "not-allowed" }, { status: 403 });
  }
  if (tooMany(slug)) return NextResponse.json({ ok: false, reason: "rate" }, { status: 429 });

  if (body.action === "go") {
    const out = await publishSite(config.slug, { by: "client", markBuildLive: true });
    if (!out.ok) return NextResponse.json({ ok: false, reason: out.reason }, { status: 500 });
    const wanted = !config.customDomain ? await wantedDomain(out.buildId) : null;
    sendTelegramMessage(
      `She said GO - ${config.businessName}\n` +
      (out.published ? "Her site is published now" : "It was already published") +
      (config.customDomain
        ? ` and goes live on ${config.customDomain} when its DNS answers (the email follows then).`
        : ` at https://servolia.com/sites/${config.slug}${out.goLiveEmailed ? `; go-live email sent to ${out.to}.` : "."}`) +
      (wanted ? `\nShe gave ${wanted} at intake - attach it on /admin/sites and send her the DNS lines.` : ""),
      undefined, { plain: true },
    ).catch(() => {});
    return NextResponse.json({ ok: true, published: out.published, customDomain: config.customDomain ?? null });
  }

  if (body.action === "change") {
    const message = typeof body.message === "string" ? body.message.replace(/\s+/g, " ").trim().slice(0, 1500) : "";
    if (message.length < 3) return NextResponse.json({ ok: false, reason: "empty" }, { status: 400 });
    const db = supabaseAdmin();
    if (db) {
      // The latest request, on the row, for /admin/today — Telegram keeps the history.
      const { data } = await db.from("client_sites").select("id, notes").eq("slug", config.slug).maybeSingle();
      const row = data as { id: string; notes: string | null } | null;
      if (row) {
        const kept = (row.notes ?? "").split("\n").filter((l) => l.trim() && !l.startsWith(CHANGE_MARKER));
        await db.from("client_sites").update({ notes: [...kept, `${CHANGE_MARKER} ${new Date().toISOString()} | ${message}`].join("\n") }).eq("id", row.id);
      }
    }
    await sendTelegramMessage(
      `CHANGE requested on her draft - ${config.businessName}\n"${message}"\nhttps://servolia.com/admin/sites`,
      undefined, { plain: true },
    ).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, reason: "unknown-action" }, { status: 400 });
}

const CHANGE_MARKER = "servolia-change-request:";

/** The domain she typed at intake, if any — the founder attaches it. */
async function wantedDomain(buildId: string | null): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db || !buildId) return null;
  const { data } = await db.from("builds").select("intake_data").eq("id", buildId).maybeSingle();
  const intake = (data as { intake_data?: Record<string, unknown> | null } | null)?.intake_data;
  const d = intake?.domain ?? intake?.existingWebsite;
  return typeof d === "string" && d.trim() ? d.trim().slice(0, 120) : null;
}
