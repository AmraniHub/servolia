import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";
import { resolvePlan, planForConversations } from "@/lib/pricing";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Monthly plan-overage watch — runs on the 1st, reviews the previous month.
 *
 * (This route used to also invoice pay-per-booking clients. That model was
 * retired 2026-08-13 by operator decision — one model only: installation paid
 * up front, then a flat subscription. The route keeps its path so the
 * vercel.json cron entry stays valid; only the overage watch remains.)
 *
 * Backs the pricing page's promise "go over and we simply move you up a plan —
 * never a surprise bill". For each active flat-plan client it counts last
 * month's AI conversations against the plan's included volume and pings
 * Telegram when someone is over. Deliberately operator-in-loop rather than
 * auto-charging: the client's card must never move without a human deciding
 * it, and the promise is a plan CHANGE, not a retroactive overage fee.
 * Never bills.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, reason: "DB not configured" });

  // Previous calendar month.
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const period = monthStart.toISOString().slice(0, 7); // "2026-06"

  const overages: { client: string; used: number; included: number; move: string }[] = [];
  const { data: flatRows, error: clientsErr } = await db.from("clients")
    .select("id, business, plan, build_id, billing_mode, status")
    .eq("status", "active");
  if (clientsErr) {
    // Most likely the schema block hasn't been run yet — report, don't crash.
    return NextResponse.json({ ok: false, reason: clientsErr.message });
  }

  for (const c of (flatRows ?? []) as { id: string; business: string; plan: string | null; build_id: string | null; billing_mode?: string | null }[]) {
    if ((c.billing_mode ?? "flat") !== "flat" || !c.build_id) continue;
    const plan = resolvePlan(c.plan);
    if (!plan) continue;

    const { data: sites } = await db.from("client_sites").select("slug").eq("build_id", c.build_id);
    const slugs = ((sites ?? []) as { slug: string }[]).map((s) => s.slug);
    if (!slugs.length) continue;

    const { count } = await db.from("chat_sessions")
      .select("id", { count: "exact", head: true })
      .in("site_slug", slugs)
      .gte("created_at", monthStart.toISOString())
      .lt("created_at", monthEnd.toISOString());
    const used = count ?? 0;

    if (used > plan.conversations) {
      const target = planForConversations(used);
      overages.push({
        client: c.business,
        used,
        included: plan.conversations,
        move: target.key === plan.key ? "already top tier — talk to them" : `${plan.name} → ${target.name} (€${target.monthlyEur}/mo)`,
      });
    }
  }

  if (overages.length) {
    const lines = overages.map((o) => `• ${o.client}: ${o.used}/${o.included} conversations → ${o.move}`);
    await sendTelegramMessage(
      `📈 *Plan overages — ${period}*\n${lines.join("\n")}\n\n` +
      `The pricing page promises "we move you up a plan — never a surprise bill": update their subscription in Stripe (no back-charge, next cycle onward) and tell them why — it's good news, their receptionist is busy.`
    );
  }

  return NextResponse.json({ ok: true, period, overages });
}
