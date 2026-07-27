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
  { label: "Google Places API (prospect import)", envVars: ["GOOGLE_PLACES_API_KEY"], category: "Growth & ads", required: false, note: "powers the Google Maps button on /admin/prospects — ~$0.035 per search (per click, returns up to 20 businesses), first ~1,000 searches/mo free. Enable 'Places API (New)' in Google Cloud Console" },
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
  { title: "Google Ads conversion tag live", priority: 3, status: "done", detail: "AW-9742210978 (from customer id 974-221-0978) hardcoded as the default in src/components/Analytics.tsx, same pattern as the GA4/Pixel defaults — fires site-wide (never on /sites/*) alongside GA4. Next: link GA4 key events (e.g. Purchase) in the Google Ads UI to pull them in as conversions — no code needed for that step, it's a Google Ads UI setting." },
  { title: "Collect real client reviews before showing any testimonials", priority: 2, status: "blocked", needs: "a first delivered client", detail: "The reviews section is deliberately NOT built with invented quotes or stock faces — fake social proof is the fastest way to lose credibility in a small referral-driven niche. Ask the first real client for a quote + photo, then it ships in EN and FR." },
  { title: "Complete Stripe account verification (KYC)", priority: 1, status: "blocked", needs: "business details + ID in the Stripe dashboard", detail: "Separate from live keys: Stripe must verify YOU before it will pay out to your bank. Money can be collected but not withdrawn until this clears." },
  { title: "send.servolia.com in Resend — deferred until real broadcast volume", priority: 3, status: "blocked", needs: "Resend Pro ($20/mo) — only worth it past ~50 outbound sends/mo or when broadcasts start", detail: "Decision 2026-07-27: servolia.com is verified and sending on the free plan (1 domain slot). The isolated send. subdomain was reputation insurance for BULK email; current volume is transactional + a few founder-led cold emails/day, which doesn't justify $20/mo. Revisit when broadcasts actually launch — then upgrade, add send.servolia.com, and point the broadcast sender at it." },
  { title: "French version of /onboarding (paid-client intake)", priority: 1, status: "done", detail: "Shipped as /fr/demarrage. Buyers coming from /fr/tarifs get a French Stripe checkout and land on the French intake; the portal links FR clients there too. Both pages are noindex (post-payment)." },
  { title: "Client emails in the recipient's language", priority: 2, status: "done", detail: "Completed 2026-07-27: every client-facing template in src/lib/email.ts is now EN+FR — deposit-received and call-booking already were; added FR to audit confirmation (lang from the form's language field), portal magic-link (login page sends its UI language), portal-message notification (language read from the client's own site config via build_id), and the go-live email. NOTE the go-live email (liveEmail) is written but not wired to any route — sending it when a build flips to live is still manual." },
  { title: "French version of /call (book a discovery call)", priority: 2, status: "done", detail: "Shipped 2026-07-27 as /fr/appel — BookingWidget already spoke French (lang prop), so this wraps it in the FR nav/footer with hreflang + sitemap. Point French demo sites and ads at /fr/appel." },
  { title: "French legal pages: privacy, CGV, refund", priority: 2, status: "done", detail: "Shipped 2026-07-27: /fr/legal/confidentialite, /fr/legal/cgv (NOTE: the old /legal/cgv page had a CGV *title* but English *content* — the /fr/ version is the first actual French legal text on the site), /fr/legal/remboursement. All hreflang-paired with the EN pages, linked from the FR footer, in the sitemap. Still English-only: /legal/terms (site usage terms — lowest legal priority since CGV governs sales)." },
  { title: "French versions of /solutions/[slug] and /niches/*", priority: 3, status: "in_progress", detail: "10 SEO/funnel pages with no French equivalent — pure missed organic reach in the beachhead market. FIRST TRANCHE SHIPPED 2026-07-27: /fr/[niche]/[ville] (dentiste, clinique-esthetique, services-a-domicile × 15 top FR cities = 45 geo pages) + /fr/villes hub. Uses FAQPage + LocalBusiness/Service JSON-LD so LLMs (Perplexity, Google AI Overviews, ChatGPT) can lift the answers. SECOND TRANCHE SHIPPED 2026-07-27: /fr/esthetique — the dedicated aesthetic funnel matching /fr/dentistes depth, leading with the pay-per-booking offer (the only niche allowed to see it); linked from the FR footer + homepage industry grid. STILL TODO: French /solutions/[slug] equivalents, plus a translation of the English /niches/* long-form content." },
  { title: "French blog (/blog + /blog/[slug])", priority: 3, status: "todo", detail: "Biggest lift, lowest urgency. Would need the content engine to generate FR posts too." },
  { title: "Connect Twilio → SMS add-on auto-provisions", priority: 2, status: "todo", needs: "TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN" },
  { title: "Open Cloudflare Registrar → domain add-on automatic", priority: 2, status: "todo", needs: "CLOUDFLARE_API_TOKEN (+ account id)" },
  { title: "Pay-per-booking — code complete; run the SQL block to switch it on", priority: 1, status: "blocked", needs: "run the pay-per-booking SQL block at the end of supabase/schema.sql (+ live Stripe keys)", detail: "CODE SHIPPED 2026-07-27: (1) /api/checkout-ppb charges the €990 setup in full (card saved for off-session billing) — POST returns {url}, or send the GET link directly: servolia.com/api/checkout-ppb?niche=aesthetic&lang=fr. Server-side payPerBookingEligible() gate refuses dental/medical no matter what the link says. (2) The Stripe webhook's ppb_setup branch creates the build + an active clients row with billing_mode per_booking and the rate snapshot. (3) /api/cron/monthly-invoice runs the 1st at 09:00 (vercel.json): tallies unbilled qualified bookings per client, writes one pay_per_booking_invoices ledger row per period (unique constraint = re-runs can't double-charge), stamps chat_sessions.billed_at, creates+sends the real Stripe invoice (7 days to pay), Telegram summary. ATTENDANCE is manual-by-exception: void/adjust no-shows in the Stripe dashboard within the 7-day window — the Telegram ping is the review prompt. Dental/medical stays blocked behind the French lawyer sign-off on compérage (unchanged)." },
  { title: "Google Workspace reseller → email add-on automatic", priority: 3, status: "todo", needs: "Google partner approval + GOOGLE_WORKSPACE_RESELLER_TOKEN" },
  { title: "B2B financing partner for builds", priority: 3, status: "todo", detail: "€0 upfront / €X/mo — financier pays us today, client pays them monthly." },
  { title: "White-label / multi-tenant for other agencies", priority: 3, status: "todo", detail: "Sell the platform to everyone who sells to clinics — the picks-and-shovels play." },
  { title: "GDPR DPA per client", priority: 3, status: "todo", detail: "We now process patient data across clinics — needs a data-processing agreement." },
  { title: "Retired /niches/lawyers to match the P2 exclusion list", priority: 3, status: "done", detail: "Same treatment as real-estate (2026-07-25): removed the 'lawyers' entry from the industries array in src/lib/content/pages.ts (this also auto-removes it from the sitemap and the /solutions page nav, since both derive from that array), dropped the Footer link and the 2 law-firm blog clusters, and added a permanent redirect /niches/lawyers → /contact. Law-firm prospects still self-identify via forms/chat, same as real-estate." },
  { title: "LinkedIn Company Page auto-posting", priority: 3, status: "done", detail: "LINKEDIN_CLIENT_ID/SECRET/ACCESS_TOKEN/ORGANIZATION_URN set in Vercel (2026-07-23). Content engine drafts a post → approve via Telegram or /admin/content → postLinkedInDraft() publishes to the Servolia Company Page automatically." },
  { title: "Redo the LinkedIn OAuth connect flow", priority: 2, status: "todo", needs: "recurring, every ~60 days", detail: "LinkedIn access tokens on the Development Tier expire in ~60 days and can't be refreshed silently — visit /api/admin/linkedin-oauth/start again, then paste the new LINKEDIN_ACCESS_TOKEN into Vercel. Until this is redone periodically, auto-posting silently falls back to 'copy the text and post manually' (see postLinkedInDraft in src/lib/contentActions.ts)." },
  { title: "Enable Stripe events invoice.payment_failed + invoice.paid on the webhook", priority: 1, status: "todo", needs: "Stripe dashboard → Developers → Webhooks", detail: "Powers the payment-failed banner in the client portal, the shut-off on /sites/[slug], and the past-due badge in /admin/clients. Also add the new columns via the SQL block at the bottom of supabase/schema.sql (payment_status, past_due_since, suspend_at, suspended_at, last_payment_failure_reason, open_invoice_url). Grace window is 14 days — see GRACE_DAYS in /api/webhooks/stripe/route.ts." },
  { title: "Extend /admin/data-room into the exit brochure (Priestley)", priority: 3, status: "todo", detail: "A data room ALREADY EXISTS at /admin/data-room (diligence-ready export center with consent-basis documentation) — do NOT build a second one. When 6+ paying clients exist, EXTEND it with the three Priestley brochure pieces: (1) 5-year financial forecast from clients MRR + growth, (2) asset register (sites, content, integrations, SOPs), (3) key-clients page (top clients by lifetime value). Until then the existing export center is enough." },
  { title: "Google Places prospect import — code shipped, needs the API key", priority: 2, status: "blocked", needs: "GOOGLE_PLACES_API_KEY (Google Cloud Console → enable 'Places API (New)')", detail: "SHIPPED 2026-07-27: the Google Maps button on /admin/prospects takes a plain search ('clinique esthétique Lyon') and imports up to 20 businesses with phone, website, city and Google rating via the Places Text Search API — duplicates skipped by business name. ~$0.035/search, first ~1,000/mo free. Until the key is set the endpoint returns a clear 503. Flow: Google Maps import → mystery-shop the best-rated → Generate demo → Email." },
  { title: "Per-prospect custom domain for cold-outreach demos", priority: 3, status: "todo", needs: "Cloudflare Registrar API token + a Vercel domain-add API path", detail: "Right now the outbound preview URL is servolia.com/sites/{slug}. Servolia.com is already a branded custom domain (Vercel is invisible on the wire), but the /sites/ path signals 'template on someone else's platform' — which hurts cold-open rates. Better: register a short throwaway domain per prospect (e.g. metay-lyon-demo.com) via Cloudflare Registrar, attach it to Vercel via the API, and rewrite to /sites/{slug} internally. ~$10/domain amortised across expected 3-week outbound window. Build only when outbound volume justifies the per-prospect cost (>50 sends/mo)." },
  { title: "Retired webapp + mobile plans; deleted diag crons; pruned excluded-niche residue", priority: 3, status: "done", detail: "2026-07-27 full-system audit outcome: generic Web App / SaaS and Mobile App offers diluted the clinic-niche monopoly positioning — marked retired:true in pricing.ts (old builds still render their names) and removed their sections + FAQs from /pricing and /fr/tarifs. Deleted diag-latest-build + diag-trigger-cancel debug cron routes. Pruned real-estate / lawyers / law-firm / wealth-management / luxury-real-estate values from estimateLeadValue (supabase.ts), scoring.ts, valueEquation.ts, pollinations.ts, and the generator prompt — excluded niches now fall through to defaults. Dental funnel kept (deepest asset, still a served niche, just not the ad spearhead)." },
];

export const STATUS_META: Record<RoadmapStatus, { label: string; color: string; bg: string }> = {
  todo:        { label: "To do",       color: "#92400E", bg: "#FEF3C7" },
  in_progress: { label: "In progress", color: "#1D4ED8", bg: "#DBEAFE" },
  blocked:     { label: "Blocked",     color: "#B91C1C", bg: "#FEE2E2" },
  done:        { label: "Done",        color: "#166534", bg: "#DCFCE7" },
};
