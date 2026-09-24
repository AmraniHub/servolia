import { supabaseAdmin } from "@/lib/supabase";
import { resolvePlan, planForConversations, type SubscriptionPlan } from "@/lib/pricing";
import { getClientSite } from "@/lib/clientSites";
import { sendEmail, conversationsEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * THE CONVERSATION CAP, MADE REAL.
 *
 * Every Servolia tier is priced by included AI conversations a month
 * (pricing.ts: 100 / 300 / 800). Until 2026-09-22 nothing read that number:
 * /api/chat answered without counting, the portal showed no meter, and the
 * only enforcement was a Telegram on the 1st asking the founder to move the
 * client up a plan by hand. Three tiers, one product.
 *
 * WHAT "ENFORCED" MEANS HERE — AND WHAT IT DOES NOT. The pricing page
 * promises "go over and we move you up a plan ourselves — never a surprise
 * bill". A receptionist that stops answering a practice's patients on the
 * 24th because the practice was popular would break the one thing the
 * practice pays for. So the cap is not a cut-off. It is:
 *   - a real, metered number the client can see (the portal meter);
 *   - one email at 80 % and one at 100 %, per month, with two honest ways
 *     forward — a one-off top-up pack, or the next tier;
 *   - the founder told at 100 %, so the plan move the page promises happens;
 *   - top-ups recorded on the client's row and added to the month's allowance.
 *
 * TOP-UP PRICES are deliberately above the per-conversation rate of moving
 * up a tier (Essentiel→Croissance is EUR 0.50 a conversation; a pack is
 * EUR 0.89–0.98): a pack is for a spike, the tier for growth. Cost to serve
 * is about EUR 0.02 a conversation (Haiku, ~6 turns). Change the numbers in
 * TOPUP_PACKS and nothing else.
 *
 * Both notification marks and top-ups live on clients.notes as marker lines,
 * the same pattern as fulfilment.ts and draftPreview.ts — no migration, and
 * keepMarkers() carries them through any wholesale rewrite.
 */

export interface TopupPack {
  key: string;
  conversations: number;
  priceEur: number;
  name: string;
  nameFr: string;
}

export const TOPUP_PACKS: Record<string, TopupPack> = {
  pack50:  { key: "pack50",  conversations: 50,  priceEur: 49, name: "50 extra conversations",  nameFr: "50 conversations supplémentaires" },
  pack100: { key: "pack100", conversations: 100, priceEur: 89, name: "100 extra conversations", nameFr: "100 conversations supplémentaires" },
};

/** "2026-09" — the month a count or a top-up belongs to. */
export function monthKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const TOPUP = "servolia-topup:";
const NOTIFIED = "servolia-cap-notified:";

/* ── markers on clients.notes ──────────────────────────────────────────── */

/** Conversations bought as top-ups for this month. */
export function topupsFor(notes: string | null | undefined, month: string): number {
  let sum = 0;
  for (const l of (notes ?? "").split("\n")) {
    if (!l.startsWith(TOPUP)) continue;
    const m = l.match(/\+(\d+)\s*\|\s*month:\s*(\d{4}-\d{2})/);
    if (m && m[2] === month) sum += Number(m[1]);
  }
  return sum;
}

/** Record a bought pack. Idempotent on the Stripe session id: a replayed
 *  webhook must not credit the same purchase twice. */
export function writeTopup(
  notes: string | null | undefined,
  rec: { conversations: number; month: string; session: string },
): string {
  const lines = (notes ?? "").split("\n").filter((l) => l.trim() !== "");
  if (lines.some((l) => l.startsWith(TOPUP) && l.includes(`session: ${rec.session}`))) return lines.join("\n");
  return [...lines, `${TOPUP} +${rec.conversations} | month: ${rec.month} | session: ${rec.session}`].join("\n");
}

/** Which thresholds the client has already been emailed about this month. */
export function capNotified(notes: string | null | undefined, month: string): Set<80 | 100> {
  const out = new Set<80 | 100>();
  for (const l of (notes ?? "").split("\n")) {
    if (!l.startsWith(NOTIFIED)) continue;
    const m = l.match(/(\d{4}-\d{2})\s*\|\s*level:\s*(80|100)/);
    if (m && m[1] === month) out.add(Number(m[2]) as 80 | 100);
  }
  return out;
}

export function writeCapNotified(notes: string | null | undefined, month: string, level: 80 | 100): string {
  const lines = (notes ?? "").split("\n").filter((l) => l.trim() !== "");
  if (capNotified(lines.join("\n"), month).has(level)) return lines.join("\n");
  return [...lines, `${NOTIFIED} ${month} | level: ${level}`].join("\n");
}

/* ── the state ─────────────────────────────────────────────────────────── */

export interface CapState {
  clientId: string;
  email: string | null;
  business: string;
  plan: SubscriptionPlan;
  month: string;
  included: number;
  topups: number;
  used: number;
  /** included + topups − used, floored at 0 */
  remaining: number;
  /** used / (included + topups), as a whole percentage */
  pct: number;
  notes: string | null;
  language: "en" | "fr";
  slug: string;
}

/**
 * Where a site stands against its plan this month. Null when the slug is
 * not a paying Servolia client (a demo, an assistant-only hosting client,
 * a site with no clients row) — those are metered elsewhere or not at all.
 */
export async function capStateForSlug(slug: string): Promise<CapState | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data: site } = await db.from("client_sites").select("build_id").eq("slug", slug).maybeSingle();
  const buildId = (site as { build_id?: string | null } | null)?.build_id;
  if (!buildId) return null;

  const { data: client } = await db.from("clients")
    .select("id, email, business, plan, status, notes")
    .eq("build_id", buildId).in("status", ["active", "past_due", "paused"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const c = client as { id: string; email: string | null; business: string; plan: string; notes: string | null } | null;
  if (!c) return null;
  const plan = resolvePlan(c.plan);
  if (!plan) return null;

  const month = monthKey();
  const from = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)).toISOString();
  const { count } = await db.from("chat_sessions")
    .select("id", { count: "exact", head: true })
    .eq("site_slug", slug).gte("created_at", from);
  const used = count ?? 0;
  const topups = topupsFor(c.notes, month);
  const allowance = plan.conversations + topups;
  const config = await getClientSite(slug);

  return {
    clientId: c.id, email: c.email, business: c.business, plan, month,
    included: plan.conversations, topups, used,
    remaining: Math.max(0, allowance - used),
    pct: allowance > 0 ? Math.round((used / allowance) * 100) : 0,
    notes: c.notes,
    language: config?.language === "fr" ? "fr" : "en",
    slug,
  };
}

/** The same state, from the client's side (the portal): by the build they own. */
export async function capStateForBuild(buildId: string): Promise<CapState | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data: site } = await db.from("client_sites").select("slug").eq("build_id", buildId).maybeSingle();
  const slug = (site as { slug?: string } | null)?.slug;
  return slug ? capStateForSlug(slug) : null;
}

/* ── the check, after every recorded conversation ──────────────────────── */

/**
 * Called after a conversation is recorded. Never throws, never blocks a
 * reply. Emails the client once at 80 % and once at 100 % a month; tells the
 * founder at 100 % so the promised plan move happens.
 */
export async function checkConversationCap(slug: string, origin = "https://servolia.com"): Promise<void> {
  try {
    const s = await capStateForSlug(slug);
    if (!s) return;
    const already = capNotified(s.notes, s.month);
    const level: 80 | 100 | null = s.pct >= 100 && !already.has(100) ? 100 : s.pct >= 80 && !already.has(80) ? 80 : null;
    if (!level) return;

    const next = planForConversations(s.used);
    const db = supabaseAdmin();
    if (s.email) {
      const tpl = conversationsEmail({
        businessName: s.business, level, used: s.used, allowance: s.included + s.topups,
        planName: s.language === "fr" ? s.plan.nameFr : s.plan.name,
        nextPlan: next.key !== s.plan.key ? { name: s.language === "fr" ? next.nameFr : next.name, monthlyEur: next.monthlyEur } : null,
        topupUrl: `${origin}/portal?topup=1`,
        lang: s.language,
      });
      const ok = await sendEmail(s.email, tpl.subject, tpl.html).catch(() => false);
      if (ok && db) {
        await db.from("clients").update({ notes: writeCapNotified(s.notes, s.month, level) }).eq("id", s.clientId);
      }
    }
    if (level === 100) {
      await sendTelegramMessage(
        `Conversation cap reached - ${s.business}\n` +
        `${s.used} of ${s.included + s.topups} this month (${s.plan.name}${s.topups ? ` + ${s.topups} top-up` : ""}).\n` +
        (next.key !== s.plan.key
          ? `The page promises a plan move: ${s.plan.name} -> ${next.name} (EUR ${next.monthlyEur}/mo). Change it in Stripe when they agree.\n`
          : `Already on the top tier - talk to them.\n`) +
        `The client was emailed with the top-up option.`,
        undefined, { plain: true },
      ).catch(() => {});
    }
  } catch (e) {
    console.error("[conversation-cap]", e instanceof Error ? e.message : e);
  }
}
