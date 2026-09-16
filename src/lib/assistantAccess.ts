import { supabaseAdmin } from "@/lib/supabase";
import type { ClientSiteConfig } from "@/lib/clientSites";

/**
 * IS THIS ASSISTANT PAID FOR?
 *
 * The switch is the hosting_clients row, not a flag on the config. That is
 * deliberate: the row already moves with Stripe — active on payment, past_due
 * on a failed charge, suspended when the grace period runs out, churned on
 * cancellation — through code that has been exercised by real clients. A
 * separate "assistant enabled" flag would have needed every one of those
 * transitions written a second time, and the first one somebody forgot would
 * be a client paying for an assistant that had gone quiet.
 *
 * So:
 *   - a config with features.chat === false is off, always (admin kill switch)
 *   - a demo is on (it is the pitch)
 *   - a Servolia-built site is on — its own billing gates the whole site
 *   - an assistant-only config is on while a chatbot subscription under its
 *     billing email is active or inside the dunning grace period
 *
 * past_due counts as on: Stripe retries a declined card for days, and cutting
 * the assistant off on the first failed retry would punish a client whose
 * card simply expired. The dunning cron ends the grace period; that is where
 * it stops.
 */
export async function assistantEnabled(config: ClientSiteConfig): Promise<boolean> {
  if (config.features?.chat === false) return false;
  if (config.isDemo) return true;
  if (!config.assistantOnly) return true;

  const email = (config.hostingEmail ?? "").trim().toLowerCase();
  if (!email) return false;
  const db = supabaseAdmin();
  if (!db) return false;
  const { data } = await db
    .from("hosting_clients")
    .select("id")
    .eq("plan", "chatbot")
    .ilike("email", email)
    .in("status", ["active", "past_due"])
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Same question, from the billing side: does this hosting row pay for an
 * assistant? Used by the admin page and the account page to decide whether
 * to show assistant controls at all.
 */
export function isAssistantPlan(plan: string | null | undefined): boolean {
  return (plan ?? "").toLowerCase() === "chatbot";
}

/**
 * How many conversations a slug had in the last N days. Lives here rather
 * than in the admin page because reading the clock inside a component's
 * render is impure, and the lint rule that says so is right.
 */
export async function conversationCount(slug: string, days = 30): Promise<number> {
  const db = supabaseAdmin();
  if (!db) return 0;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { count } = await db
    .from("chat_sessions")
    .select("id", { count: "exact", head: true })
    .eq("site_slug", slug)
    .gte("created_at", since);
  return count ?? 0;
}
