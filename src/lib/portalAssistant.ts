import { supabaseAdmin, type Build, type Client } from "@/lib/supabase";
import { resolvePlan, PLANS, PLAN_ORDER, SETUP_PLAN, ADDONS } from "@/lib/pricing";
import { complianceFor, monthKey } from "@/lib/zeroMiss";

/**
 * PORTAL ASSISTANT — the client's own help desk, grounded in their real account.
 *
 * This is NOT the receptionist. The receptionist (src/lib/clientPrompt.ts) speaks
 * AS the clinic, to the clinic's patients, on the clinic's public site. This one
 * speaks AS Servolia, to the clinic OWNER, inside the portal, about the system
 * they bought. Different audience, different voice, different facts.
 *
 * Why it exists: every "how do I change my hours?" currently lands in the
 * founder's Telegram and waits hours for a reply that a machine could give in
 * two seconds from data the portal already holds. The human channel stays —
 * it just stops being the first stop for questions with a factual answer.
 *
 * TWO HARD RULES, both load-bearing:
 *  1. NEVER invent an account fact. Everything about their plan, site, build
 *     stage, leads or guarantee comes from the context block below. If it
 *     isn't there, the honest answer is "I can't see that — ask Abdelali",
 *     and the escalation button is right there.
 *  2. NEVER promise work, dates, discounts, refunds or scope. Those are the
 *     founder's to give. The assistant explains and points; it does not commit
 *     Servolia to anything.
 */

export interface AssistantContext {
  email: string;
  businessName: string | null;
  planName: string | null;
  monthlyAmount: number | null;
  subscriptionStatus: string | null;
  conversationsIncluded: number | null;
  siteSlug: string | null;
  siteStatus: string | null;
  buildStatus: string | null;
  buildDeadline: string | null;
  leadCount: number | null;
  /** This month's measured response record, for guarantee questions. */
  guarantee: { measured: number; misses: number; slowestMs: number | null } | null;
  lang: "en" | "fr";
}

/** Gather everything the assistant is allowed to know about this client. */
export async function loadAssistantContext(email: string, lang: "en" | "fr"): Promise<AssistantContext> {
  const ctx: AssistantContext = {
    email,
    businessName: null, planName: null, monthlyAmount: null, subscriptionStatus: null,
    conversationsIncluded: null, siteSlug: null, siteStatus: null,
    buildStatus: null, buildDeadline: null, leadCount: null, guarantee: null, lang,
  };

  const db = supabaseAdmin();
  if (!db) return ctx;

  try {
    const { data: client } = await db.from("clients").select("*").eq("email", email)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const c = client as Client | null;
    if (c) {
      ctx.businessName = c.business ?? null;
      ctx.monthlyAmount = Number(c.monthly_amount) || null;
      ctx.subscriptionStatus = c.status ?? null;
      const plan = resolvePlan(c.plan);
      ctx.planName = plan ? plan.name : (c.plan ?? null);
      ctx.conversationsIncluded = plan?.conversations ?? null;
    }

    const { data: builds } = await db.from("builds").select("*").eq("email", email)
      .order("created_at", { ascending: false }).limit(1);
    const b = (builds as Build[] | null)?.[0];
    if (b) {
      ctx.buildStatus = b.status ?? null;
      ctx.buildDeadline = b.deadline ?? null;
      if (!ctx.businessName && b.business && b.business !== "Pending intake") ctx.businessName = b.business;

      const { data: site } = await db.from("client_sites")
        .select("slug, status").eq("build_id", b.id).maybeSingle();
      if (site) {
        ctx.siteSlug = (site as { slug: string }).slug;
        ctx.siteStatus = (site as { status: string }).status;
      }
    }

    if (ctx.siteSlug) {
      const { count } = await db.from("chat_sessions")
        .select("id", { count: "exact", head: true })
        .eq("site_slug", ctx.siteSlug).eq("qualified", true);
      ctx.leadCount = count ?? null;

      const rep = await complianceFor(ctx.siteSlug, monthKey(new Date()));
      ctx.guarantee = { measured: rep.measured, misses: rep.misses.length, slowestMs: rep.slowestMs };
    }
  } catch {
    // Partial context is fine — the prompt tells the assistant to say what it
    // cannot see rather than guess.
  }

  return ctx;
}

const na = (v: unknown, fallback = "not visible to me") =>
  v === null || v === undefined || v === "" ? fallback : String(v);

/** The system prompt: who it is, what it knows, and what it must never do. */
export function buildAssistantPrompt(ctx: AssistantContext): string {
  const fr = ctx.lang === "fr";
  const plans = PLAN_ORDER.map((k) => {
    const p = PLANS[k];
    return `${p.name}: €${p.monthlyEur}/mo, ${p.conversations} AI conversations/mo`;
  }).join(" | ");
  const addons = Object.values(ADDONS)
    .map((a) => `${a.name} €${a.priceEur}/${a.interval}${a.includedFrom ? ` (included from ${a.includedFrom})` : ""}`)
    .join(" | ");

  const g = ctx.guarantee;
  const guaranteeLine = g
    ? `${g.measured} replies measured this month, ${g.misses} over the 60s guarantee, slowest ${g.slowestMs != null ? (g.slowestMs / 1000).toFixed(1) + "s" : "n/a"}`
    : "no measured replies yet this month";

  return `You are the Servolia assistant inside a CLIENT's private portal. You are talking to the business OWNER about the system they bought from Servolia. You are not their website receptionist and you never speak to their patients.

Reply in ${fr ? "FRENCH" : "ENGLISH"}.

# THIS CLIENT (the only account facts you have)
Business: ${na(ctx.businessName)}
Account email: ${ctx.email}
Plan: ${na(ctx.planName)}${ctx.monthlyAmount ? ` — €${ctx.monthlyAmount}/mo` : ""}${ctx.subscriptionStatus ? ` (${ctx.subscriptionStatus})` : ""}
Included AI conversations: ${na(ctx.conversationsIncluded)}
Their site: ${ctx.siteSlug ? `servolia.com/sites/${ctx.siteSlug} (${na(ctx.siteStatus)})` : "not published yet"}
Build stage: ${na(ctx.buildStatus)}${ctx.buildDeadline ? ` — due ${ctx.buildDeadline}` : ""}
Qualified enquiries captured: ${na(ctx.leadCount)}
Response-time guarantee this month: ${guaranteeLine}

# HOW SERVOLIA WORKS (general product facts, safe to explain)
Installation €${SETUP_PLAN.totalEur} once (waived on annual), delivered in ${SETUP_PLAN.delivery}, then a monthly plan. Plans: ${plans}. Annual = 10 months' price for 12. Add-ons: ${addons}.
Going over the included conversations moves them up a plan — never a surprise bill.
Guarantees: live in 7 days or 10% back per day late capped at 50%; every enquiry answered within 60 seconds or that month's plan fee is refunded; cancel any time with 30 days' notice.
The portal tabs are: Overview, My leads, Visitors, Reports, Help (you), Messages (the founder), Account.
Servolia never does sales calls — everything is written and async.

# WHAT YOU DO
Answer questions about their account, their plan, how to use the portal, what the product does, and what their numbers mean. Be brief: 1–4 sentences. Warm, plain language, no jargon, no hype.

# WHAT YOU MUST NEVER DO
- Never invent an account fact. If something is "not visible to me", say so plainly and suggest they message Abdelali.
- Never promise work, a delivery date, a change to their site, a discount, a refund, or anything about scope or price beyond the published figures above. Those are Abdelali's to give. Say "Abdelali will confirm that" and point to the Messages tab.
- Never share other clients' information — you only ever see this one account.
- Never claim results, patient numbers or medical advice.

# ESCALATION
When the answer needs a human — a change to their site, anything about money owed, anything you cannot see, or if they simply ask for a person — say so in one sentence and tell them to use the Messages tab, which reaches Abdelali directly. Do not apologise repeatedly; one clear handoff is enough.`;
}
