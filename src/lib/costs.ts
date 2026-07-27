import type { IntegrationCategory } from "@/lib/roadmap";

/**
 * COSTS — every third-party service the app depends on, what it actually
 * bills, and whether it's live right now. Feeds the "Costs & subscriptions"
 * panel on /admin/settings.
 *
 * WORKING RULE: same as roadmap.ts — whenever a new paid service is wired
 * in, add it here. Never invent a precise number for something usage-based;
 * mark it as an estimate and point at the real dashboard. This is the
 * founder's own money — wrong-but-confident numbers are worse than none.
 */

export type Billing = "flat" | "usage" | "free";

export interface ServiceCost {
  key: string;
  label: string;
  category: IntegrationCategory | "Infrastructure";
  billing: Billing;
  /** Typical monthly EUR for "flat" billing. null for usage-based/free. */
  monthlyEur: number | null;
  note: string;
  /** "always" = infra cost that exists the moment the app is deployed, regardless of feature env vars. */
  activeWhen: "always" | string[];
  dashboardHint?: string;
  /** True when monthlyEur is a typical-tier guess, not a confirmed bill — always show a "confirm this" flag. */
  isEstimate?: boolean;
}

export const SERVICE_COSTS: ServiceCost[] = [
  // ── Infrastructure — exists the moment the app is live, not tied to a feature env var ──
  {
    key: "vercel", label: "Vercel hosting", category: "Infrastructure", billing: "flat", monthlyEur: 20,
    note: "Assumed Pro tier ($20/mo/seat) — the free Hobby tier caps cron jobs (this app now runs 3: daily-brief, monthly-report, monthly-invoice) and disallows commercial use.",
    activeWhen: "always", dashboardHint: "vercel.com → your team → Settings → Billing", isEstimate: true,
  },
  {
    key: "supabase", label: "Supabase database", category: "Infrastructure", billing: "flat", monthlyEur: 25,
    note: "Assumed Pro tier ($25/mo) — the free tier auto-pauses a project after 7 days of inactivity, which would silently take down a live CRM.",
    activeWhen: "always", dashboardHint: "supabase.com → project → Settings → Billing", isEstimate: true,
  },
  {
    key: "domain", label: "servolia.com domain", category: "Infrastructure", billing: "flat", monthlyEur: 1,
    note: "Typical .com renewal ≈ €12–15/yr, shown here as a monthly equivalent.",
    activeWhen: "always", isEstimate: true,
  },
  {
    key: "github-archive", label: "GitHub client-site archive", category: "Core", billing: "free", monthlyEur: 0,
    note: "Private repo on your existing GitHub account — no incremental cost.",
    activeWhen: ["GITHUB_ARCHIVE_TOKEN", "GITHUB_ARCHIVE_REPO"],
  },

  // ── Payments ──
  {
    key: "stripe-fees", label: "Stripe processing fees", category: "Payments", billing: "usage", monthlyEur: null,
    note: "No monthly fee. Roughly 1.5%+€0.25 per EU card charge, ~2.9%+€0.25 international — scales with revenue, not a fixed cost.",
    activeWhen: ["STRIPE_SECRET_KEY"], dashboardHint: "dashboard.stripe.com → Balance → see your actual blended rate",
  },

  // ── AI ──
  {
    key: "anthropic", label: "Anthropic API (Claude)", category: "AI", billing: "usage", monthlyEur: null,
    note: "Pay-as-you-go. Drives: client receptionist replies, site-copy generation, cold-email drafts, blog/LinkedIn generation, monthly client-report narratives, Linda the copilot. Cents per interaction — total scales with client count and traffic.",
    activeWhen: ["ANTHROPIC_API_KEY"], dashboardHint: "console.anthropic.com → Settings → Billing",
  },
  {
    key: "cloudflare-ai", label: "Cloudflare Workers AI (fallback)", category: "AI", billing: "free", monthlyEur: 0,
    note: "Only used when Claude is unavailable. Free tier is generous enough that this is effectively €0 at current volume.",
    activeWhen: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_AI_TOKEN"],
  },

  // ── Email & alerts ──
  {
    key: "resend", label: "Resend (transactional email)", category: "Email & alerts", billing: "free", monthlyEur: 0,
    note: "Free tier: 3,000 emails/mo, 1 domain. Deliberately staying on free until broadcast volume or the send.servolia.com subdomain is needed (Pro is $20/mo — see roadmap).",
    activeWhen: ["RESEND_API_KEY"],
  },
  {
    key: "telegram", label: "Telegram bot alerts", category: "Email & alerts", billing: "free", monthlyEur: 0,
    note: "Telegram's Bot API has no cost, ever.",
    activeWhen: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
  },

  // ── Growth & ads ──
  {
    key: "ga4", label: "Google Analytics 4", category: "Growth & ads", billing: "free", monthlyEur: 0,
    note: "Free.", activeWhen: ["GA4_PROPERTY_ID"],
  },
  {
    key: "meta-pixel", label: "Meta Pixel + Conversions API", category: "Growth & ads", billing: "free", monthlyEur: 0,
    note: "Free to integrate. Ad spend itself is a marketing-budget decision, not a platform cost — not counted here.",
    activeWhen: ["NEXT_PUBLIC_META_PIXEL_ID"],
  },
  {
    key: "google-ads-tag", label: "Google Ads conversion tag", category: "Growth & ads", billing: "free", monthlyEur: 0,
    note: "Free to integrate. Ad spend excluded, same reasoning as the Meta Pixel.",
    activeWhen: ["NEXT_PUBLIC_GOOGLE_ADS_ID"],
  },
  {
    key: "places", label: "Google Places API (prospect import)", category: "Growth & ads", billing: "usage", monthlyEur: null,
    note: "~$0.035 per search (Enterprise tier, returns up to 20 businesses), ~1,000 free searches/mo per SKU — effectively €0 at founder prospecting volume.",
    activeWhen: ["GOOGLE_PLACES_API_KEY"], dashboardHint: "console.cloud.google.com → Billing",
  },
  {
    key: "linkedin", label: "LinkedIn Company Page API", category: "Growth & ads", billing: "free", monthlyEur: 0,
    note: "Free. Token needs re-pairing roughly every 60 days (see roadmap).",
    activeWhen: ["LINKEDIN_ACCESS_TOKEN"],
  },

  // ── Add-on providers — mostly not enabled yet; costs only apply once a client buys the add-on ──
  {
    key: "twilio", label: "Twilio (SMS add-on)", category: "Add-on providers", billing: "usage", monthlyEur: null,
    note: "~$0.0079/SMS + ~$1/mo per phone number, once enabled. Billed to you; resold to the client at a markup via the add-on price in pricing.ts.",
    activeWhen: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"], dashboardHint: "console.twilio.com → Billing",
  },
  {
    key: "cf-registrar", label: "Cloudflare Registrar (domain add-on)", category: "Add-on providers", billing: "usage", monthlyEur: null,
    note: "At-cost domain pricing (Cloudflare adds no markup), per domain registered for a client, once enabled.",
    activeWhen: ["CLOUDFLARE_API_TOKEN"],
  },
  {
    key: "workspace", label: "Google Workspace reseller (email add-on)", category: "Add-on providers", billing: "usage", monthlyEur: null,
    note: "Variable per mailbox once partner-approved and enabled — not active yet.",
    activeWhen: ["GOOGLE_WORKSPACE_RESELLER_TOKEN"],
  },
];

export function isActive(c: ServiceCost): boolean {
  if (c.activeWhen === "always") return true;
  return c.activeWhen.every((v) => !!process.env[v]?.trim());
}

/** Sum of ACTIVE flat-fee services — the real fixed monthly overhead. Usage-based costs are never summed (they'd be a guess). */
export function totalFixedMonthlyEur(): number {
  return SERVICE_COSTS
    .filter((c) => c.billing === "flat" && isActive(c))
    .reduce((sum, c) => sum + (c.monthlyEur ?? 0), 0);
}
