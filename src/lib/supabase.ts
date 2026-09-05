import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SETUP_PLAN, PLANS } from "@/lib/pricing";

/**
 * Supabase clients. We support two roles:
 *   - admin (service_role key) — used in server routes for full DB access
 *   - public (anon key)        — would be used in browser code, but we don't expose tables
 *
 * If env vars are missing, exports null — call sites must handle that case
 * so the site keeps working before Supabase is configured.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient | null {
  if (!url || !serviceKey) return null;
  if (_admin) return _admin;
  _admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

export const isSupabaseConfigured = (): boolean => !!(url && serviceKey);

// ============================================================================
// Types
// ============================================================================

export type LeadStage = "new" | "audit_sent" | "qualified" | "deposit_paid" | "live" | "lost";
export type LeadSource = "chatbot" | "free-audit" | "contact" | "cold-email" | "referral" | "intake" | "unknown";

export interface Lead {
  id: string;
  created_at: string;
  updated_at: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  business?: string | null;
  website?: string | null;
  country?: string | null;
  city?: string | null;
  language?: string;
  niche?: string | null;
  problems?: string[] | null;
  client_value?: string | null;
  plan_interest?: string | null;
  source: LeadSource;
  stage: LeadStage;
  status: string;
  value_estimate: number;
  last_contacted_at?: string | null;
  notes?: string | null;
  raw_data?: Record<string, unknown> | null;
}

export interface Build {
  id: string;
  created_at: string;
  updated_at: string;
  lead_id?: string | null;
  business: string;
  email?: string | null;
  plan: string;
  plan_name?: string | null;
  total_price: number;
  deposit_paid: number;
  balance_due: number;
  status: "intake" | "building" | "review" | "delivered" | "live";
  started_at?: string | null;
  delivered_at?: string | null;
  live_at?: string | null;
  deadline?: string | null;
  checkout_session_id?: string | null;
  customer_id?: string | null;
  intake_data?: Record<string, unknown> | null;
  notes?: string | null;
}

export interface Client {
  id: string;
  created_at: string;
  updated_at: string;
  build_id?: string | null;
  business: string;
  email?: string | null;
  plan: string;
  monthly_amount: number;
  status: "active" | "paused" | "churned";
  customer_id?: string | null;
  subscription_id?: string | null;
  started_at: string;
  churned_at?: string | null;
  payment_status?: "ok" | "past_due" | "suspended";
  past_due_since?: string | null;
  suspend_at?: string | null;
  suspended_at?: string | null;
  last_payment_failure_reason?: string | null;
  open_invoice_url?: string | null;
}

export interface ClientSiteRow {
  id: string;
  created_at: string;
  updated_at: string;
  slug: string;
  build_id?: string | null;
  business: string;
  niche?: string | null;
  config: Record<string, unknown>;
  status: "draft" | "published";
  notes?: string | null;
}

export interface CrmKpis {
  leads_30d: number;
  leads_7d: number;
  awaiting_response: number;
  qualified: number;
  active_builds: number;
  live_clients: number;
  mrr: number;
  deposits_30d: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Estimate the value of a lead based on niche + plan interest.
 *
 * A lead is worth its FIRST YEAR: the one-time installation fee plus twelve
 * months of the tier they're most likely to land on. The subscription IS the
 * product now, so scoring a lead at a one-time build price undercounted it by
 * roughly an order of magnitude.
 *
 * Retired plan keys still map to the one-time price they were actually sold
 * at, so leads quoted under the old model keep scoring as they were quoted.
 *
 * Used for pipeline value calculation in the CRM.
 */
export function estimateLeadValue(niche?: string | null, plan?: string | null): number {
  // First-year value: installation + 12 months. Prices from src/lib/pricing.ts.
  const firstYear = (monthlyEur: number) => SETUP_PLAN.totalEur + monthlyEur * 12;

  // Order matters — the first key found inside the plan string wins, so the
  // subscription tier (the real signal) is checked before the setup fee.
  const planValues: Record<string, number> = {
    performance: firstYear(PLANS.performance.monthlyEur),  // 690 + 12 × 449
    croissance: firstYear(PLANS.croissance.monthlyEur),    // 690 + 12 × 249
    essentiel: firstYear(PLANS.essentiel.monthlyEur),      // 690 + 12 × 149
    // Only "they want the installation" — assume the anchor tier.
    setup: firstYear(PLANS.croissance.monthlyEur),
    installation: firstYear(PLANS.croissance.monthlyEur),
    "mise en place": firstYear(PLANS.croissance.monthlyEur),

    // Retired 2026-07-28 — the old one-time build prices, kept so historical
    // leads still score at what they were actually quoted.
    starter: 290, website: 290,
    growth: 590, booking: 590,
    pro: 990, client: 990,
    landing: 290,
    mobile: 490,
    webapp: 290,
  };

  if (plan) {
    for (const [k, v] of Object.entries(planValues)) {
      if (plan.toLowerCase().includes(k)) return v;
    }
  }

  // Niche-based defaults if no plan specified — same first-year basis, using
  // the tier that niche typically lands on.
  // Excluded niches (real-estate, legal, wealth) pruned 2026-07-27 — a lead
  // that self-identifies as one of those just gets the default estimate.
  const nicheValues: Record<string, number> = {
    dental: firstYear(PLANS.croissance.monthlyEur),
    aesthetic: firstYear(PLANS.performance.monthlyEur),
    "med-spa": firstYear(PLANS.performance.monthlyEur),
    "home-services": firstYear(PLANS.croissance.monthlyEur),
    "cosmetic-surgery": firstYear(PLANS.performance.monthlyEur),
    veterinary: firstYear(PLANS.croissance.monthlyEur),
  };

  if (niche) {
    const n = niche.toLowerCase().replace(/[\s_]+/g, "-");
    for (const [k, v] of Object.entries(nicheValues)) {
      if (n.includes(k)) return v;
    }
  }

  return firstYear(PLANS.croissance.monthlyEur); // default: a year on the anchor tier
}
