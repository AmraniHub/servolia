/**
 * FOUNDER "WHAT'S LEFT" — single source of truth for /admin/settings.
 *
 * WORKING RULE: whenever something is left undone — an unset secret, an idea
 * not built yet, a manual step waiting on an account — ADD IT HERE so it shows
 * up in the admin Settings panel. This is the founder's live to-do surface.
 * Keep it honest: move items to status "done" (or delete) when they ship.
 */

/* ── Integrations / secrets the app looks for ──────────────────────────────
 * The Settings page checks process.env for each `envVars` entry (server-side,
 * values are NEVER exposed — only whether they are set). */
export type IntegrationCategory =
  | "Core" | "Payments" | "AI" | "Email & alerts" | "Growth & ads" | "Add-on providers";

export interface Integration {
  label: string;
  envVars: string[]; // all must be set to count as configured
  category: IntegrationCategory;
  required: boolean; // required = the app is degraded without it
  note?: string;
}

export const INTEGRATIONS: Integration[] = [
  // Core
  { label: "Supabase URL", envVars: ["NEXT_PUBLIC_SUPABASE_URL"], category: "Core", required: true },
  { label: "Supabase service key", envVars: ["SUPABASE_SERVICE_ROLE_KEY"], category: "Core", required: true, note: "server-side DB" },
  { label: "Admin password", envVars: ["ADMIN_PASSWORD"], category: "Core", required: true },
  { label: "Admin JWT secret", envVars: ["ADMIN_JWT_SECRET"], category: "Core", required: true, note: "signs your session (32+ chars)" },
  // Payments
  { label: "Stripe secret key", envVars: ["STRIPE_SECRET_KEY"], category: "Payments", required: true, note: "checkout, Care, add-ons" },
  { label: "Stripe webhook secret", envVars: ["STRIPE_WEBHOOK_SECRET"], category: "Payments", required: true, note: "confirms payments + provisions add-ons" },
  // AI
  { label: "Anthropic API key", envVars: ["ANTHROPIC_API_KEY"], category: "AI", required: true, note: "client receptionists + copy generation" },
  { label: "Cloudflare AI (fallback)", envVars: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_AI_TOKEN"], category: "AI", required: false, note: "Llama fallback when Claude is down" },
  // Email & alerts
  { label: "Resend (transactional email)", envVars: ["RESEND_API_KEY"], category: "Email & alerts", required: true },
  { label: "Email from-address", envVars: ["EMAIL_FROM"], category: "Email & alerts", required: false },
  { label: "Telegram bot token", envVars: ["TELEGRAM_BOT_TOKEN"], category: "Email & alerts", required: false, note: "instant lead + add-on alerts" },
  { label: "Telegram chat id", envVars: ["TELEGRAM_CHAT_ID"], category: "Email & alerts", required: false },
  // Growth & ads
  { label: "Meta pixel id", envVars: ["NEXT_PUBLIC_META_PIXEL_ID"], category: "Growth & ads", required: false },
  { label: "Meta Conversions API token", envVars: ["META_CAPI_ACCESS_TOKEN"], category: "Growth & ads", required: false, note: "server-side ad conversion tracking" },
  { label: "GA4 service account", envVars: ["GOOGLE_SERVICE_ACCOUNT_KEY"], category: "Growth & ads", required: false, note: "Daily Stats + Weekly SEO" },
  { label: "GA4 property id", envVars: ["GA4_PROPERTY_ID"], category: "Growth & ads", required: false },
  // Add-on providers (the reseller layer — mostly NOT set yet)
  { label: "Twilio (SMS add-on)", envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"], category: "Add-on providers", required: false, note: "auto-provisions the SMS reminders add-on" },
  { label: "Cloudflare Registrar (domain add-on)", envVars: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"], category: "Add-on providers", required: false, note: "auto-registers client domains" },
  { label: "Google Workspace reseller (email add-on)", envVars: ["GOOGLE_WORKSPACE_RESELLER_TOKEN"], category: "Add-on providers", required: false, note: "needs Google partner approval first" },
];

/* ── Roadmap: what's left to build / decide / set up ───────────────────── */
export type RoadmapStatus = "todo" | "in_progress" | "blocked" | "done";

export interface RoadmapItem {
  title: string;
  detail?: string;
  status: RoadmapStatus;
  priority: 1 | 2 | 3; // 1 = do now
  needs?: string;      // account/secret/decision it waits on
}

export const ROADMAP: RoadmapItem[] = [
  { title: "Switch Stripe to LIVE keys", priority: 1, status: "blocked", needs: "sk_live_… in Vercel", detail: "Production is on test keys — nothing charges real money until live keys are set." },
  { title: "Land the first real clients", priority: 1, status: "in_progress", detail: "The whole machine exists (demo → generate → publish → Care + add-ons). Outbound to the dental-France beachhead; country pages catch SEO inbound." },
  { title: "Create the custom_requests + email_campaigns tables in Supabase", priority: 1, status: "todo", needs: "run the two SQL blocks at the end of supabase/schema.sql", detail: "custom_requests powers personalized extra work + its payment link; email_campaigns records broadcast history. Both features warn (but don't break) until the tables exist." },
  { title: "Complete Stripe account verification (KYC)", priority: 1, status: "blocked", needs: "business details + ID in the Stripe dashboard", detail: "Separate from live keys: Stripe must verify YOU before it will pay out to your bank. Money can be collected but not withdrawn until this clears." },
  { title: "Verify the send.servolia.com domain in Resend for bulk email", priority: 2, status: "todo", needs: "Resend dashboard → Domains", detail: "Broadcasts must go from the isolated subdomain, never from Google Workspace, or you risk the reputation of hello@servolia.com." },
  { title: "French version of /onboarding (paid-client intake)", priority: 1, status: "todo", detail: "A French clinic that already PAID has to fill an 8-minute intake in English. Worst-placed English-only page in the whole funnel." },
  { title: "French version of /call (book a discovery call)", priority: 2, status: "todo", detail: "A CTA target — the demo sites and ads point here." },
  { title: "French legal pages: privacy, terms, refund", priority: 2, status: "todo", detail: "/legal/cgv is already French; privacy, terms and refund are English-only. French clients need French terms." },
  { title: "French versions of /solutions/[slug] and /niches/*", priority: 3, status: "todo", detail: "10 SEO/funnel pages with no French equivalent — pure missed organic reach in the beachhead market." },
  { title: "French blog (/blog + /blog/[slug])", priority: 3, status: "todo", detail: "Biggest lift, lowest urgency. Would need the content engine to generate FR posts too." },
  { title: "Connect Twilio → SMS add-on auto-provisions", priority: 2, status: "todo", needs: "TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN" },
  { title: "Open Cloudflare Registrar → domain add-on automatic", priority: 2, status: "todo", needs: "CLOUDFLARE_API_TOKEN (+ account id)" },
  { title: "Legal check: pay-per-booking before dental/medical", priority: 2, status: "blocked", needs: "French lawyer review", detail: "Flagged in the micro-monopoly research note — regulated for medical." },
  { title: "Google Workspace reseller → email add-on automatic", priority: 3, status: "todo", needs: "Google partner approval + GOOGLE_WORKSPACE_RESELLER_TOKEN" },
  { title: "B2B financing partner for builds", priority: 3, status: "todo", detail: "€0 upfront / €X/mo — financier pays us today, client pays them monthly." },
  { title: "White-label / multi-tenant for other agencies", priority: 3, status: "todo", detail: "Sell the platform to everyone who sells to clinics — the picks-and-shovels play." },
  { title: "GDPR DPA per client", priority: 3, status: "todo", detail: "We now process patient data across clinics — needs a data-processing agreement." },
];

export const STATUS_META: Record<RoadmapStatus, { label: string; color: string; bg: string }> = {
  todo:        { label: "To do",       color: "#92400E", bg: "#FEF3C7" },
  in_progress: { label: "In progress", color: "#1D4ED8", bg: "#DBEAFE" },
  blocked:     { label: "Blocked",     color: "#B91C1C", bg: "#FEE2E2" },
  done:        { label: "Done",        color: "#166534", bg: "#DCFCE7" },
};
