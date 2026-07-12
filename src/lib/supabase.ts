import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
 * Used for pipeline value calculation in the CRM.
 */
export function estimateLeadValue(niche?: string | null, plan?: string | null): number {
  // Keep in sync with src/lib/pricing.ts (BUILD_PLANS)
  const planValues: Record<string, number> = {
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

  // Niche-based defaults if no plan specified
  const nicheValues: Record<string, number> = {
    dental: 590,
    aesthetic: 990,
    "med-spa": 990,
    "real-estate": 590,
    "home-services": 590,
    "luxury-real-estate": 990,
    "cosmetic-surgery": 990,
    veterinary: 590,
    "law-firm": 990,
    "wealth-management": 990,
  };

  if (niche) {
    const n = niche.toLowerCase().replace(/[\s_]+/g, "-");
    for (const [k, v] of Object.entries(nicheValues)) {
      if (n.includes(k)) return v;
    }
  }

  return 590; // default mid-tier estimate
}
