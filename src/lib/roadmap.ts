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
  { label: "Google Ads conversion id", envVars: ["NEXT_PUBLIC_GOOGLE_ADS_ID"], category: "Growth & ads", required: false, note: "AW-XXXXXXXXXX from Google Ads → Tools → Conversions. Fires site-wide alongside GA4; link GA4 key events in the Google Ads UI to import them as conversions" },
  { label: "LinkedIn (auto-post to Company Page)", envVars: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_ACCESS_TOKEN", "LINKEDIN_ORGANIZATION_URN"], category: "Growth & ads", required: false, note: "content engine drafts → approve → auto-posts. Token expires ~60 days, see roadmap" },
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
  { title: "Create the custom_requests + email_campaigns + client_profiles tables in Supabase", priority: 1, status: "done", detail: "custom_requests powers personalized extra work + its payment link; email_campaigns records broadcast history; client_profiles stores the client's photo, name, phone and marketing opt-in. Ran 2026-07-25." },
  { title: "Create the page_views table in Supabase", priority: 1, status: "done", detail: "Powers /admin/traffic (servolia.com visitors) AND the portal's Visitors tab (each client's own site traffic). Ran 2026-07-25." },
  { title: "Set ANALYTICS_SALT in Vercel", priority: 2, status: "todo", needs: "any long random string", detail: "Salts the daily visitor hash in /api/track. Without it a default is used, which still works but is guessable — set a real secret before treating visitor counts as private data." },
  { title: "Meta Pixel + Google Ads tag — decision made: keep both", priority: 3, status: "done", detail: "Resolved 2026-07-25: the RETIRED thing is the paid-ads-as-a-service OFFERING sold to clients (Ads Landing plan, pricing.ts) — not Servolia's own client-acquisition tracking. The founder runs Google Ads + Meta Ads to bring in Servolia's own clients, so both stay: Meta Pixel (Analytics.tsx, unchanged) + a new Google Ads conversion tag (NEXT_PUBLIC_GOOGLE_ADS_ID, same file). /legal/terms already discloses the pixel correctly — no change needed there." },
  { title: "Set NEXT_PUBLIC_GOOGLE_ADS_ID in Vercel", priority: 2, status: "todo", needs: "the AW-XXXXXXXXXX conversion id from Google Ads → Tools → Conversions", detail: "Code is wired (src/components/Analytics.tsx) — fires the tag site-wide (never on /sites/*) alongside GA4, same pattern as the Meta Pixel. Once set, link GA4 key events (e.g. Purchase) in the Google Ads UI to pull them in as conversions — no extra code needed for that step." },
  { title: "Collect real client reviews before showing any testimonials", priority: 2, status: "blocked", needs: "a first delivered client", detail: "The reviews section is deliberately NOT built with invented quotes or stock faces — fake social proof is the fastest way to lose credibility in a small referral-driven niche. Ask the first real client for a quote + photo, then it ships in EN and FR." },
  { title: "Complete Stripe account verification (KYC)", priority: 1, status: "blocked", needs: "business details + ID in the Stripe dashboard", detail: "Separate from live keys: Stripe must verify YOU before it will pay out to your bank. Money can be collected but not withdrawn until this clears." },
  { title: "Verify the send.servolia.com domain in Resend for bulk email", priority: 2, status: "todo", needs: "Resend dashboard → Domains", detail: "Broadcasts must go from the isolated subdomain, never from Google Workspace, or you risk the reputation of hello@servolia.com." },
  { title: "French version of /onboarding (paid-client intake)", priority: 1, status: "done", detail: "Shipped as /fr/demarrage. Buyers coming from /fr/tarifs get a French Stripe checkout and land on the French intake; the portal links FR clients there too. Both pages are noindex (post-payment)." },
  { title: "Client emails in the recipient's language", priority: 2, status: "todo", detail: "src/lib/email.ts is English-only — the deposit-received email still sends English to a French client who just filled a French intake, and its intake button points at /onboarding instead of /fr/demarrage. Stripe metadata now carries lang, so the webhook can pick the language." },
  { title: "French version of /call (book a discovery call)", priority: 2, status: "todo", detail: "A CTA target — the demo sites and ads point here." },
  { title: "French legal pages: privacy, terms, refund", priority: 2, status: "todo", detail: "/legal/cgv is already French; privacy, terms and refund are English-only. French clients need French terms." },
  { title: "French versions of /solutions/[slug] and /niches/*", priority: 3, status: "todo", detail: "10 SEO/funnel pages with no French equivalent — pure missed organic reach in the beachhead market." },
  { title: "French blog (/blog + /blog/[slug])", priority: 3, status: "todo", detail: "Biggest lift, lowest urgency. Would need the content engine to generate FR posts too." },
  { title: "Connect Twilio → SMS add-on auto-provisions", priority: 2, status: "todo", needs: "TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN" },
  { title: "Open Cloudflare Registrar → domain add-on automatic", priority: 2, status: "todo", needs: "CLOUDFLARE_API_TOKEN (+ account id)" },
  { title: "Pay-per-booking pricing — aesthetic/med-spa pilot unblocked, dental/medical stays blocked", priority: 1, status: "in_progress", needs: "checkout + monthly invoicing wiring", detail: "Resolved 2026-07-25: this was rotting as a single blanket 'blocked' line. It's now two separate things. (1) src/lib/pricing.ts defines PAY_PER_BOOKING (€990 setup + €60/attended consultation) and payPerBookingEligible(niche) — a hard gate that returns false for anything dental/medical-shaped and only true for aesthetic/med-spa/beauty. That's usable today for aesthetic clients. (2) Dental/medical stays blocked behind a French lawyer sign-off on 'compérage' rules (Ordre des Chirurgiens-Dentistes/Médecins) — do not call payPerBookingEligible for a dental niche true, and don't relax the regex without that legal review. STILL TODO before this earns real revenue: a checkout path for the setup fee (today's build-plan checkout assumes a 50% deposit against a flat total, which doesn't fit setup+per-result billing) and a monthly cron that tallies attended bookings per pay-per-booking client and creates a Stripe invoice — same shape as /api/cron/monthly-report, but invoicing instead of just reporting." },
  { title: "Google Workspace reseller → email add-on automatic", priority: 3, status: "todo", needs: "Google partner approval + GOOGLE_WORKSPACE_RESELLER_TOKEN" },
  { title: "B2B financing partner for builds", priority: 3, status: "todo", detail: "€0 upfront / €X/mo — financier pays us today, client pays them monthly." },
  { title: "White-label / multi-tenant for other agencies", priority: 3, status: "todo", detail: "Sell the platform to everyone who sells to clinics — the picks-and-shovels play." },
  { title: "GDPR DPA per client", priority: 3, status: "todo", detail: "We now process patient data across clinics — needs a data-processing agreement." },
  { title: "Reconcile the /niches/lawyers page against the P2 exclusion list", priority: 3, status: "todo", detail: "Found while retiring /niches/real-estate (2026-07-25): docs/PRINCIPLES.md:45 explicitly excludes 'legal' from the strategy, same as real estate — but /niches/lawyers is still a full dedicated funnel page with its own footer link and 2 blog-content clusters, same pattern real-estate had. Not touched yet since only real-estate was in scope of that fix — the founder should decide whether to retire it the same way or the exclusion list needs updating." },
  { title: "LinkedIn Company Page auto-posting", priority: 3, status: "done", detail: "LINKEDIN_CLIENT_ID/SECRET/ACCESS_TOKEN/ORGANIZATION_URN set in Vercel (2026-07-23). Content engine drafts a post → approve via Telegram or /admin/content → postLinkedInDraft() publishes to the Servolia Company Page automatically." },
  { title: "Redo the LinkedIn OAuth connect flow", priority: 2, status: "todo", needs: "recurring, every ~60 days", detail: "LinkedIn access tokens on the Development Tier expire in ~60 days and can't be refreshed silently — visit /api/admin/linkedin-oauth/start again, then paste the new LINKEDIN_ACCESS_TOKEN into Vercel. Until this is redone periodically, auto-posting silently falls back to 'copy the text and post manually' (see postLinkedInDraft in src/lib/contentActions.ts)." },
];

export const STATUS_META: Record<RoadmapStatus, { label: string; color: string; bg: string }> = {
  todo:        { label: "To do",       color: "#92400E", bg: "#FEF3C7" },
  in_progress: { label: "In progress", color: "#1D4ED8", bg: "#DBEAFE" },
  blocked:     { label: "Blocked",     color: "#B91C1C", bg: "#FEE2E2" },
  done:        { label: "Done",        color: "#166534", bg: "#DCFCE7" },
};
