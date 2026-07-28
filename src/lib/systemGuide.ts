/**
 * SYSTEM GUIDE — the living explanation of how Servolia actually works.
 * Rendered at /admin/system.
 *
 * WORKING RULE: whenever we build or change something important, add/update it
 * here — what it is, how it works, how to use it, what it costs, what it earns.
 * This is the founder's manual for their own machine. Keep it truthful: if a
 * number is an estimate, say so.
 */

/* ── 1. The end-to-end flow ─────────────────────────────────────────────── */
export interface FlowStep { step: string; detail: string }

export const MAIN_FLOW: FlowStep[] = [
  { step: "1. Attention", detail: "SEO (niche + country landing pages) and outbound bring a clinic owner to the site." },
  { step: "2. Capture", detail: "They land on /free-audit (or /fr/audit) or talk to Solia, the site chatbot. Either way a lead row is created and you get a Telegram ping." },
  { step: "3. Qualify", detail: "You work the lead in the Pipeline. A written scope document is generated and sent for e-signature." },
  { step: "4. Payment", detail: "They pay a 50% deposit through Stripe Checkout. Buyers from a /fr/ page get a French-language Stripe page and lang:\"fr\" in the session metadata. The webhook creates/updates the build and marks the lead deposit_paid." },
  { step: "5. Intake", detail: "They complete the intake — /onboarding in English, /fr/demarrage in French (Stripe sends them to the right one). Their answers land on the build as intake_data — this is what the generator reads, so French answers in means a French site out." },
  { step: "6. Generate", detail: "You click Generate on the build. configFromIntake() builds the mechanical draft, then Claude writes the copy. Result: a DRAFT client site." },
  { step: "7. Approve", detail: "The draft is private — only you can see it. You review, then hit Publish. Only then is it public." },
  { step: "8. Live + recurring", detail: "The site runs their AI receptionist and booking form. They subscribe to a Care plan; leads, reports and add-ons show in their portal." },
];

/* ── 2. Data model ──────────────────────────────────────────────────────── */
export interface SchemaTable { name: string; group: string; purpose: string; key: string }

export const SCHEMA: SchemaTable[] = [
  // Acquisition
  { name: "leads", group: "Acquisition & CRM", purpose: "Every inbound prospect. The pipeline lives here.", key: "stage (new→audit_sent→qualified→deposit_paid), source, niche, value_estimate" },
  { name: "lead_activities", group: "Acquisition & CRM", purpose: "Timeline of what happened on a lead (notes, payments, scope events).", key: "lead_id, type, description" },
  { name: "prospects", group: "Acquisition & CRM", purpose: "Hand-researched outbound targets before they become leads.", key: "business, city, rating, notes" },
  { name: "bookings", group: "Acquisition & CRM", purpose: "Discovery calls booked with you via /call.", key: "slot_start, status, lead_id" },
  { name: "email_subscribers", group: "Acquisition & CRM", purpose: "Newsletter / lead-magnet list.", key: "email, source" },
  { name: "page_views", group: "Acquisition & CRM", purpose: "Every pageview on servolia.com AND on each client site. Cookie-free, no IP stored.", key: "site_slug (null = servolia.com), path, referrer_host, visitor_hash, session_id, is_entry" },
  { name: "reactivation_contacts", group: "Acquisition & CRM", purpose: "Dormant leads targeted by reactivation campaigns.", key: "lead_id, campaign, sent_at" },
  { name: "case_studies", group: "Acquisition & CRM", purpose: "Published proof used on the marketing site.", key: "business, result, published" },

  // Delivery
  { name: "builds", group: "Delivery", purpose: "A paid project. The spine of delivery.", key: "plan, deposit_paid, balance_due, status (intake→building→review→delivered→live), intake_data" },
  { name: "scope_acceptances", group: "Delivery", purpose: "The written scope + the client's e-signature acceptance.", key: "token, scope_text, accepted_at, ip" },
  { name: "client_sites", group: "Delivery", purpose: "The generated website config for a build. One row = one client site.", key: "slug, config (JSON), status (draft/published), build_id" },
  { name: "custom_requests", group: "Delivery", purpose: "Personalized extra work outside the plan, plus its one-off payment.", key: "title, amount_eur, status (quoted/paid/done), payment_url" },

  // Recurring
  { name: "clients", group: "Recurring revenue", purpose: "Active Care-plan subscribers.", key: "plan, monthly_amount, status, subscription_id" },
  { name: "client_reports", group: "Recurring revenue", purpose: "The monthly results report sent to each client.", key: "period, metrics, sent_at" },

  // Client relationship
  { name: "client_messages", group: "Client relationship", purpose: "The two-way thread between you and a client in the portal.", key: "sender, body, attachment_url, read_at" },
  { name: "client_auth", group: "Client relationship", purpose: "Portal login — magic-link tokens and optional password.", key: "email, token, password_hash" },
  { name: "chat_notification_prefs", group: "Client relationship", purpose: "Per-conversation mute settings for chat alerts.", key: "session_id, muted" },

  // AI capture
  { name: "chat_sessions", group: "AI capture", purpose: "Every AI receptionist conversation AND every booking-form submission on a client site. This is what the client's portal 'My leads' reads.", key: "site_slug, messages, qualified, email_captured, phone_captured, utm" },

  // Content engine
  { name: "blog_posts", group: "Content engine", purpose: "AI-drafted articles, approved via Telegram before publishing.", key: "slug, status (draft/published), title" },
  { name: "linkedin_drafts", group: "Content engine", purpose: "AI-drafted LinkedIn posts awaiting your approval.", key: "body, status, posted_at" },
];

/* ── 3. Features ────────────────────────────────────────────────────────── */
export interface SystemFeature {
  name: string;
  summary: string;
  how: string[];
  use: string[];
  cost: string;
  value: string;
  code: string;
}

export const FEATURES: SystemFeature[] = [
  {
    name: "Traffic analytics (first-party)",
    summary: "Our own visitor analytics for servolia.com and for every client site — living in the same database as leads and bookings.",
    how: [
      "PageTracker (in the root layout) posts one row to /api/track on every route change.",
      "A client site is served at /sites/{slug}, so the tracker tags those views with that slug — one tracker covers every client automatically.",
      "No cookie is set and no IP is stored: a visitor is sha256(ip + user-agent + today + ANALYTICS_SALT), which rotates daily and can't be reversed.",
      "Bots are dropped at the endpoint by user-agent, and /admin pages are never counted.",
      "/admin/traffic reads rows where site_slug is null (servolia.com). The portal's Visitors tab reads the slugs owned by that client.",
    ],
    use: [
      "Check /admin/traffic after publishing content or launching an ad — referrers and utm_campaign tell you what actually landed.",
      "In a renewal conversation, open the client's Visitors tab: visitors → enquiries in one screen is the whole argument for the care plan.",
    ],
    cost: "None — no third-party analytics bill, just Supabase rows.",
    value: "GA can tell a client how many people visited. It can't tell them how many of those became enquiries, because it doesn't know what a booking is. Ours can, because traffic and leads sit in the same database. That funnel is the retention story.",
    code: "src/lib/traffic.ts · src/app/api/track · src/components/PageTracker.tsx · src/app/admin/traffic · src/app/api/portal/traffic",
  },
  {
    name: "Analytics separation (Servolia vs client sites)",
    summary: "Servolia's GA4/Pixel never fire on a client site, and a client's own tags fire only on theirs.",
    how: [
      "Client sites are served at /sites/{slug} and inherit the root layout, so they used to load Servolia's GA4 property and Meta Pixel — mixing their visitors into our numbers and sending their traffic to an account they don't own.",
      "Analytics.tsx now returns null on any /sites/ path.",
      "ClientAnalytics.tsx fires the client's own ga4Id / metaPixelId from their site config, and nothing at all when they have neither.",
      "ga4Id is filled automatically from the 'Existing Google Analytics ID' answer in the intake form.",
    ],
    use: [
      "If a client asks for Google Analytics, put their G-XXXXXXXX in the site config — nothing else is needed.",
      "A client with no GA still gets full numbers in their portal Visitors tab, because first-party tracking is independent of GA.",
    ],
    cost: "None.",
    value: "Keeps Servolia's own traffic data honest, and avoids piping a client's visitor data into our Google account — which would be hard to defend under GDPR.",
    code: "src/components/Analytics.tsx · src/components/ClientAnalytics.tsx · src/lib/clientSites.ts (ga4Id)",
  },
  {
    name: "Ad landing page (free audit)",
    summary: "Where paid traffic lands and becomes a lead. Pain-led page: names the three leaks, shows the live demo as proof, then asks for 3 fields.",
    how: [
      "Visitor lands on /free-audit (EN) or /fr/audit (FR).",
      "Hero names the pain → 'three leaks' → live demo proof → what they receive → form → FAQ.",
      "Form posts to /api/contact with type 'free-audit' → creates a lead + Telegram ping + Google Sheets backup.",
    ],
    use: ["Point every ad at /fr/audit for French traffic.", "Match the ad's headline to the page headline — that's the single biggest conversion lever."],
    cost: "None beyond hosting.",
    value: "Turns paid clicks into qualified leads. Only 3 required fields, so cold traffic actually completes it.",
    code: "src/components/AuditForm.tsx · src/app/{free-audit,fr/audit}",
  },
  {
    name: "Solia — the site chatbot",
    summary: "Servolia's own AI receptionist on the marketing site. Qualifies visitors and captures leads 24/7.",
    how: [
      "Visitor chats → /api/chat with no siteSlug → answers using Servolia's pricing + niches.",
      "When it has a business type + email it tags [QUALIFIED], creates a lead and pings Telegram.",
      "Every conversation is stored in chat_sessions.",
    ],
    use: ["Read conversations in Admin → Chat inbox.", "If the AI backend is down it degrades to a lead-capture form — you never lose the enquiry."],
    cost: "Claude Haiku — a few cents per conversation. Cloudflare Workers AI is the free fallback.",
    value: "Captures after-hours interest that would otherwise bounce.",
    code: "src/app/api/chat/route.ts",
  },
  {
    name: "Scope document + e-signature",
    summary: "A written scope (what's included, price, deadline) the client accepts online before work starts.",
    how: [
      "From a lead, you generate a scope link. It creates a scope_acceptances row with a unique token.",
      "Client opens /scope/[token], types their name and accepts. Name + IP + timestamp + user-agent are stored.",
      "They get a confirmation email; you get a Telegram ping; the lead advances to qualified.",
    ],
    use: ["Send the scope link before taking the deposit.", "Direct /pricing purchases auto-create a scope so nobody pays without one."],
    cost: "Free (email via Resend).",
    value: "Protects you in a dispute and removes 'that's not what I ordered' arguments.",
    code: "src/lib/scopeDocument.ts · src/app/scope/[token] · /api/scope/[token]/accept",
  },
  {
    name: "Payments (Stripe)",
    summary: "Four money paths: build deposits, Care subscriptions, add-ons, and one-off custom work.",
    how: [
      "Build: 50% deposit via Checkout → webhook creates/updates the build (status stays 'intake' until they fill the form).",
      "Care: monthly or annual subscription (annual = 11× monthly, one month free) → creates a client row.",
      "Add-ons: self-serve recurring subscription from the portal → triggers provisioning.",
      "Custom work: one-off payment link created from the build page → marks the request paid.",
    ],
    use: ["Everything is metadata-tagged (kind: care_plan / addon / custom_request) so the webhook routes it correctly.", "Check /admin/settings for whether Stripe is in LIVE or TEST mode."],
    cost: "Stripe's standard per-transaction fee — see your Stripe dashboard for the exact rate on your account.",
    value: "Deposits fund the build; annual prepay brings a year of cash up front; add-ons and custom work add margin with no new client acquisition.",
    code: "src/lib/pricing.ts · /api/checkout · /api/checkout-subscription · /api/checkout-addon · /api/webhooks/stripe",
  },
  {
    name: "Client site generator",
    summary: "Turns a build's intake answers into a complete, multi-page client website with its own AI receptionist.",
    how: [
      "configFromIntake() builds the mechanical draft (slug, contacts, colours, structure).",
      "For dental clients the niche template adds the full layout: multi-page nav, photo banners, patient journey, clinic values, aftercare advice.",
      "aiEnrichConfig() has Claude write the copy — hero, about, services, FAQs, highlights, solutions, expertise — grounded ONLY in their intake. It never invents prices, years or team members.",
      "The result is saved to client_sites as a DRAFT.",
    ],
    use: ["Admin → Client Sites → Generate on a paid build.", "Review the draft, then Publish.", "For bespoke tweaks use the 'Edit locally with Claude Code' button on the build page."],
    cost: "One Claude call per generation — cents. Editing locally with Claude Code costs no API credits.",
    value: "A site that used to take days of manual work is delivered in minutes, consistently, at the same quality.",
    code: "src/lib/clientSites.ts · src/lib/generateSiteCopy.ts · src/lib/niches/dental.ts",
  },
  {
    name: "Draft → publish approval gate",
    summary: "Nothing a client's intake generates is public until you approve it.",
    how: [
      "Generated sites are created with status 'draft'.",
      "A draft 404s for the public. Only an authenticated admin can preview it, with a 'DRAFT' ribbon.",
      "Clicking Publish sets status 'published' — only then is it reachable.",
    ],
    use: ["Admin → Client Sites → Publish / Unpublish."],
    cost: "None.",
    value: "No half-finished or wrong-content site is ever visible under your brand.",
    code: "src/lib/draftGate.tsx · /api/admin/set-site-status",
  },
  {
    name: "The client's website + AI receptionist",
    summary: "What the clinic actually gets: a multi-page site, a 24/7 AI receptionist trained on their business, and a booking form.",
    how: [
      "The receptionist answers as the clinic (never mentions Servolia), using their services, hours and FAQs.",
      "When a visitor wants to book it tags [BOOKING] and stores the conversation against site_slug.",
      "The booking form posts to /api/sites/[slug]/lead and is stored the same way, so both show up together.",
      "If the client has their own Meta pixel, a Lead event fires on their ad account.",
    ],
    use: ["Demo it to prospects at /sites/demo-metay — including its dashboard at /sites/demo-metay/dashboard."],
    cost: "Cents per conversation (Claude Haiku).",
    value: "This is the product. It captures the after-hours and missed-call patients the clinic was losing.",
    code: "src/components/ClientSite.tsx · src/lib/clientPrompt.ts · /api/sites/[slug]/lead",
  },
  {
    name: "Client value delivery — instant lead alerts, portal pipeline, Sheets, GDPR",
    summary: "The felt-value layer of every plan: the clinic owner gets an instant '🌙 caught while you were closed' email with one-tap WhatsApp reply the moment their assistant captures a lead, works a real pipeline in their portal, can sync to their own Google Sheet, and ships with a GDPR page — every pricing-page promise now has a real feature behind it.",
    how: [
      "Instant alerts (clientNotify.ts): both lead entry points — the booking form (/api/sites/[slug]/lead) and the AI receptionist (/api/chat, on the FIRST message a conversation turns into a booking, never again for the same session) — email the clinic owner immediately. Recipient = site config email, falling back to the build's email. Bilingual by the site's language.",
      "The unique framing: a Europe/Paris heuristic (Mon–Sat 08:00–19:00) tags each lead as caught during or OUTSIDE opening hours. The after-hours subject line ('🌙 New enquiry caught while you were closed') is Servolia's whole pitch arriving as a real-time push — plus the '5-minute reply wins' nudge and one-tap buttons: wa.me link to the LEAD's phone with a prefilled greeting, tel:, mailto:, portal.",
      "Portal pipeline: each lead in 'My leads' has a status chip (new → contacted → booked → won/lost) and an expandable private note. PATCH /api/portal/leads is scoped server-side to the client's own site slugs. Needs the pipeline SQL block (chat_sessions.client_status/client_note).",
      "Google Sheets sync: set sheetsWebhookUrl in a site's config (an Apps Script web-app URL, same pattern as Servolia's own sheet) and every lead POSTs a row: timestamp, source, name, phone, email, service, message, after_hours.",
      "GDPR page: /sites/{slug}/confidentialite renders a bilingual privacy notice auto-populated from the config (controller name, city, contact email, CNIL recourse) and is linked from every client-site footer. Demo sites never send alerts and never store form submissions.",
    ],
    use: [
      "Run the client-lead-pipeline SQL block with the others — statuses/notes silently no-op until then, everything else works now.",
      "When a client asks for their Google Sheet: create an Apps Script doPost that appends rows, deploy as web app, paste its URL into the site config's sheetsWebhookUrl.",
      "In sales conversations: the after-hours alert email IS the demo — 'this is the email you'll get at 11pm when we catch a patient you'd have lost.'",
    ],
    cost: "Resend emails (free tier) — no new services.",
    value: "This is the moment the subscription justifies itself: not a monthly report a month later, but a push at 11pm saying 'your assistant just caught a €500 client while you were closed — tap to reply on WhatsApp.' Nobody selling websites in this niche does that.",
    code: "src/lib/clientNotify.ts · /api/sites/[slug]/lead · /api/chat · /api/portal/leads (PATCH) · src/components/PortalDashboard.tsx · src/app/sites/[slug]/confidentialite · supabase/schema.sql (pipeline block)",
  },
  {
    name: "Costs & subscriptions overview",
    summary: "Every dollar this app can cost you, in one place — what's a fixed subscription, what scales with usage, and what's free — with the live active/inactive state pulled from your actual env vars.",
    how: [
      "src/lib/costs.ts is the single data file: one entry per service, tagged flat / usage / free, with a note explaining the pricing model and a dashboardHint for where to verify the real number.",
      "'Fixed' entries (Vercel, Supabase, the domain) are marked active:always — they're billed the moment the app is deployed, whether or not any feature env var is set. Everything else is active only when its env vars are actually configured, same detection as the Integrations panel above it.",
      "'Usage-based' entries (Stripe fees, Anthropic, Google Places, Twilio, Cloudflare Registrar) are deliberately NEVER summed into a total — a made-up usage number is worse than none. They scale with clients and traffic.",
      "The fixed-overhead total only adds up active flat-fee services, and anything guessed at a typical plan tier (Vercel Pro, Supabase Pro) carries an ESTIMATE flag — confirm against the real dashboard before trusting it as accounting.",
    ],
    use: [
      "Live numbers, always current: /admin/settings → 'Costs & subscriptions'.",
      "Adding a new paid service: add one entry to costs.ts (same file the founder rule in roadmap.ts describes for integrations) — it appears automatically, correctly bucketed.",
    ],
    cost: "N/A — this feature describes cost, it doesn't add any.",
    value: "Answers 'what does running Servolia actually cost me this month' without opening five different billing dashboards — and keeps AI/Stripe/SMS costs visibly separate from fixed overhead so a good month doesn't get misread as the business getting more expensive.",
    code: "src/lib/costs.ts · src/app/admin/settings/page.tsx",
  },
  {
    name: "Delivery pipeline — niche template × plan template × GitHub archive",
    summary: "How a paid build becomes exactly what the pricing page sold, fast: the niche template writes the content, the plan template switches the features, and every published site is version-archived to GitHub for reuse or restore.",
    how: [
      "Generation = niche template × plan template. Niche (src/lib/niches/: dental, aesthetic, home-services) decides structure, tone and imagery. Plan (planFeatures() in clientSites.ts) decides features: Website System €290 ships the site + booking/contact form WITHOUT the AI receptionist; Booking €590, Client €990 and pay-per-booking ship everything.",
      "Niche blocks folded 2026-07-28 (first 'go linda'): every generated DENTAL site now ships the urgences strip (emergencyNote — one-tap call for same-day pain slots) + the Infos pratiques section (Carte Vitale/mutuelles, payment, accessibility, first-visit prep); every AESTHETIC site ships its own practicalInfo (discretion/cabine privée, payment, hygiene, first-visit prep). All generic-true phrasing — location specifics stay the client's to add.",
      "Two showcase demos now exist as the sales assets: /sites/demo-metay (dental, Cabinet Nicolas Metay) and /sites/demo-lumea (aesthetic, Institut Luméa — linked from /fr/esthetique's hero). Both fictional, full-depth, and pixel-identical to what a paying client receives.",
      "The plan gate is enforced twice: the ChatWidget isn't rendered, AND /api/chat returns 403 for that slug — a starter client can't consume inference by calling the API directly. Prospect demos always show the full product (the demo IS the pitch).",
      "Archive: the moment you hit Publish, the full site row (config + business + niche + build link) is committed to the private archive repo as sites/{slug}.json — fire-and-forget, a GitHub outage can never block a delivery. Updating the same file on each publish means the repo's git history is the site's version history.",
      "Restore / reuse: POST /api/admin/archive-site {slug, restore: true} pulls the snapshot back into client_sites as a DRAFT (never auto-publishes). To reuse a great site as a starting template for a new client, restore it, change the slug/business, regenerate copy.",
    ],
    use: [
      "One-time setup: create a PRIVATE repo (client configs contain contact details), make a fine-grained PAT with Contents read/write on just that repo, set GITHUB_ARCHIVE_TOKEN + GITHUB_ARCHIVE_REPO in Vercel.",
      "Nothing to do per client — publish as usual and the snapshot happens. GET /api/admin/archive-site lists what's archived.",
      "After a bad edit: restore the slug, review the draft, republish.",
    ],
    cost: "Free — a private GitHub repo and a few KB of JSON per client.",
    value: "Delivery always matches the invoice (no more giving €990 features to €290 clients), and no client's site can ever be lost to a fat-fingered edit or a database accident. The archive doubles as a growing template library — every delivered site is a reusable starting point.",
    code: "src/lib/clientSites.ts (planFeatures) · src/components/ClientSite.tsx · /api/chat (gate) · src/lib/siteArchive.ts · /api/admin/archive-site · /api/admin/set-site-status (auto-archive)",
  },
  {
    name: "Security model — logins, rate limits, 2FA",
    summary: "How the admin and client doors are locked: fail-closed JWT secrets, constant-time checks, cross-instance rate limiting, optional TOTP 2FA for the admin, and site-wide security headers.",
    how: [
      "Sessions: both admin and portal sessions are signed JWTs in httpOnly/secure/sameSite cookies. Since 2026-07-27 the signing secret FAILS CLOSED — production throws if ADMIN_JWT_SECRET is unset instead of silently using a fallback string that lives in the public repo.",
      "Admin login: password compared in constant time (no timing oracle), 8 attempts / 15 min per IP via the shared rate limiter, and — when ADMIN_TOTP_SECRET is set — a mandatory 6-digit authenticator code. Wrong password and wrong code return the identical error.",
      "Admin 2FA setup: while logged in, GET /api/admin/2fa-setup → fresh secret + otpauth URI; add to your authenticator, put the secret in Vercel as ADMIN_TOTP_SECRET, redeploy. POST {code} to the same endpoint dry-runs a code. Lost phone = delete the env var and redeploy (password-only again).",
      "Client portal: magic links (15-min tokens) stay the default; optional bcrypt passwords. Magic-link requests are limited 5/15min per IP and 3/15min per target address — silently, so no account enumeration. Password login shares the same DB-backed limiter.",
      "Rate limiter: rate_limits table in Supabase (one row per key) = one global window across all serverless instances; degrades gracefully to per-instance memory until the SQL block is run.",
      "Headers on every response: HSTS (1 year), X-Content-Type-Options nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy denying camera/mic/geo/payment.",
      "Already solid before this pass: Stripe webhook signature verification, Bearer-token crons, admin-auth checks on every /api/admin route, portal-session checks on every /api/portal route, server-side upload validation, no Supabase anon key in the browser.",
    ],
    use: [
      "Enable 2FA today: log in → open /api/admin/2fa-setup in the browser → follow the 4 instructions in the response.",
      "Run the security SQL block (end of supabase/schema.sql) with the other pending blocks to upgrade rate limiting from per-instance to global.",
      "If you ever rotate ADMIN_JWT_SECRET, every admin and client session is invalidated at once — that's the emergency logout lever.",
    ],
    cost: "None.",
    value: "The CRM holds every lead, client conversation and revenue number. This pass closes the realistic attack paths (forged sessions, brute force, email bombing, clickjacking) at zero recurring cost.",
    code: "src/lib/security.ts · src/lib/auth.ts · src/lib/clientAuth.ts · /api/admin/login · /api/admin/2fa-setup · /api/portal/request-link · /api/portal/login-password · next.config.ts (headers) · supabase/schema.sql (rate_limits)",
  },
  {
    name: "Telegram notification policy — the phone only buzzes for money",
    summary: "Three tiers so the bot stays worth reading: real events buzz, routine digests arrive silently, and config nags aren't sent at all.",
    how: [
      "LOUD (default): a captured lead, a payment, a scope accepted, a failed charge, a new subscriber, a client portal message, and the morning brief WHEN it has hot leads or 48h-silent leads. These are the ones worth interrupting you.",
      "SILENT (`sendTelegramMessage(text, buttons, { silent: true })` → Telegram's disable_notification): daily traffic stats, weekly SEO, 48h follow-up summaries, monthly client-report summaries. They land in the chat for when you look, without a buzz.",
      "NOT SENT AT ALL: config nags. daily-stats and weekly-seo used to Telegram 'GA4 not connected yet' every single day/week forever — an unset secret is a /admin/settings concern, not a push notification.",
      "ZERO-ACTIVITY SUPPRESSION: the morning brief skips entirely when there are no leads, no builds and nothing actionable; daily stats skip when yesterday had 0 visitors and the week had 0 leads. A '0 / 0 / 0' report teaches you to ignore the bot.",
      "Content approvals (blog + LinkedIn drafts with Publish/Skip buttons) stay loud — they're a decision waiting on you, and tapping a button IS the workflow.",
    ],
    use: [
      "Adding a new notification: default to silent unless a human would want to stop what they're doing for it. If it repeats on a schedule and says the same thing when nothing happened, guard it with a zero-activity check.",
      "Too noisy again? The lever is `{ silent: true }` plus a zero-activity guard — not muting the bot, which would also hide the money alerts.",
    ],
    cost: "None.",
    value: "Before this, a Monday morning delivered up to 6 pushes before 10am — several of them config nags or empty reports. A bot you mute is a bot that can't tell you a €990 lead just came in at 23:00.",
    code: "src/lib/telegram.ts (SendOptions) · /api/cron/daily-brief · daily-stats · weekly-seo · follow-up · client-reports",
  },
  {
    name: "Scheduled jobs map (Vercel crons vs GitHub Actions)",
    summary: "Every automated job, where it's scheduled, and why there are two systems — so nobody 'rediscovers' this topology again.",
    how: [
      "VERCEL CRONS (vercel.json, GET, Authorization auto-injected from CRON_SECRET): daily-brief 07:00 · monthly-report 08:00 on the 1st · monthly-invoice 09:00 on the 1st (pay-per-booking).",
      "GITHUB ACTIONS (.github/workflows/*.yml, POST via curl with the CRON_SECRET repo secret — set 2026-07-15): follow-up daily 09:30 UTC (48h lead nudge) · daily-stats 07:15 (GA4 → Telegram) · weekly-seo Monday 08:15 · client-reports 5th 08:00 (AI narrative per care client) · blog-generator Mon/Wed/Fri 08:00 · linkedin-generator Mon/Wed/Fri 07:00 · uptime every ~2h (independent of Vercel, alerts even if the site is down).",
      "Why two systems: Actions workflows POST (Vercel crons can only GET), give a manual 'Run workflow' button, survive a Vercel outage (uptime), and don't count against Vercel's cron limits.",
      "monthly-report (1st) and client-reports (5th) are NOT duplicates: the 1st sends the metrics snapshot; the 5th sends the Claude-written narrative + recommendation for active care clients.",
    ],
    use: [
      "Check a failing job: GitHub → Actions tab → the workflow's runs (blog-generator now prints the HTTP status + body on failure).",
      "Run any Actions job manually with its 'Run workflow' button — useful for testing without waiting for the schedule.",
      "If CRON_SECRET is ever rotated, update BOTH Vercel env AND the GitHub repo secret.",
    ],
    cost: "GitHub Actions minutes — a few seconds per run, far inside the free tier.",
    value: "Follow-ups, reports and content generation run without the founder remembering anything — and the uptime watch alerts even when Vercel itself is down.",
    code: "vercel.json · .github/workflows/*.yml · src/app/api/cron/*",
  },
  {
    name: "Pay-per-booking billing (aesthetic/med-spa wedge)",
    summary: "The results-only offer: €990 setup, then €60 per AI-booked consultation, invoiced monthly. The strongest close for a skeptical clinic owner — Servolia only earns when her agenda fills.",
    how: [
      "Checkout: /api/checkout-ppb charges the setup fee in full and saves the card for off-session billing. Founder-led: POST for a {url}, or just send servolia.com/api/checkout-ppb?niche=aesthetic&lang=fr in a DM — it redirects straight into Stripe.",
      "LEGAL GATE: payPerBookingEligible(niche) runs server-side — dental/medical is refused no matter what the link says (French compérage rules; see pricing.ts). Never weaken it.",
      "On payment the webhook (kind=ppb_setup) creates the build + an active clients row with billing_mode 'per_booking' and the €60 rate snapshotted (a later price change never re-prices existing clients).",
      "On the 1st at 09:00, /api/cron/monthly-invoice tallies each per-booking client's unbilled qualified bookings, writes ONE pay_per_booking_invoices ledger row per period (unique constraint — re-runs are no-ops, never double-charges), stamps chat_sessions.billed_at, then creates and sends a real Stripe invoice with 7 days to pay.",
      "invoice.paid marks the ledger row paid; a failed invoice flows into the same dunning path as Care plans (banner → grace → suspend).",
    ],
    use: [
      "Close an aesthetic prospect by sending the GET checkout link with their niche — nothing to build manually.",
      "When the monthly Telegram summary arrives, review for no-shows and void/adjust line items in the Stripe dashboard within the 7-day due window — that's how 'attended' stays honest.",
      "A 'PENDING (no Stripe customer)' line in the summary means the client has no card on file — chase manually.",
    ],
    cost: "Stripe's per-transaction fee on the setup + each monthly invoice.",
    value: "Removes the biggest objection in the niche ('what if it doesn't work?') by pricing on results. 15 attended bookings/month = €900/mo recurring from one client — triple a Scale care plan.",
    code: "src/lib/pricing.ts (PAY_PER_BOOKING, payPerBookingEligible) · /api/checkout-ppb · /api/webhooks/stripe (ppb_setup) · /api/cron/monthly-invoice · supabase/schema.sql (pay-per-booking block)",
  },
  {
    name: "FR Geo-SEO + GEO (LLM-answer) surface",
    summary: "Programmatic city × niche landing pages at /fr/[niche]/[ville] — 45 pages covering the top 15 French cities × 3 niches (dentaire, esthétique, services à domicile). Optimised for BOTH classic Google local search AND generative-engine answers (ChatGPT, Perplexity, Google AI Overviews).",
    how: [
      "Data lives in src/lib/content/frGeo.ts — FR_CITIES (15 entries with region, population, and one genuine local hook each) × FR_GEO_NICHES (3 entries: dentiste, clinique-esthetique, services-a-domicile). Niche slugs are SINGULAR to avoid colliding with the existing /fr/dentistes/ static route (plural).",
      "The dynamic route /fr/[niche]/[ville]/page.tsx statically generates every combo via generateStaticParams. Each page has a unique <title>, canonical URL, OG tags, and a local-context paragraph (city hook + niche pain-point) that makes it non-templated.",
      "Every page emits two JSON-LD blocks: Service+LocalBusiness (Google Maps / classic SEO — areaServed = City containedInPlace AdministrativeArea) AND FAQPage (the block LLM search engines lift into answers, so 'best AI receptionist for dentists in Lyon' can pull Servolia's Q&A directly).",
      "The FAQ block is BOTH machine-readable (schema) AND human-readable (interactive <details> on the page) — no keyword-stuffing, real answers.",
      "Hub page at /fr/villes internally links all 45 combos grouped by region — kills the 'orphan page' problem that would otherwise hurt indexing.",
      "Sitemap.ts includes every combo + the hub, so Google discovers them on the next crawl.",
    ],
    use: [
      "Send FR outbound at these pages instead of the generic /fr — the pitch reads more relevant when it references the recipient's own city.",
      "For a new city: add one entry to FR_CITIES (slug, name, region, population, one honest local hook) — the 3 niche pages generate automatically.",
      "For a new niche: add one entry to FR_GEO_NICHES with singular slug (avoid /fr/dentistes/ etc), then 15 city pages ship at once.",
      "Do NOT invent local case studies or fake review counts per city — Google downranks doorway pages that only differ by city name.",
    ],
    cost: "Zero — no LLM calls per request, all content is authored in the data file.",
    value: "Local intent is where clinic-owner search actually happens ('dentiste Lyon site web', not 'best dental website builder'). And FAQPage schema is the single highest-ROI thing you can do for LLM answer inclusion right now — the same 45 pages give you both classic SEO and GEO coverage in one shot.",
    code: "src/lib/content/frGeo.ts · src/app/fr/[niche]/[ville]/page.tsx · src/app/fr/villes/page.tsx · src/app/sitemap.ts",
  },
  {
    name: "Cold outbound: prospect → live demo → AI-drafted cold email → send",
    summary: "The full outbound pipeline sits on /admin/prospects. Add a prospect (single row or CSV), one-click generate a live demo site in their name, then AI-draft a personalized cold email pointing at it and send via Resend — all without them lifting a finger.",
    how: [
      "Add prospects: the 'Google Maps' button imports up to 20 businesses from a plain search ('clinique esthétique Lyon') with phone, website, city and rating (needs GOOGLE_PLACES_API_KEY, ~$0.035/search — per click, not per business — and Google's free tier covers ~1,000 searches/mo, so effectively €0 at founder scale; dupes auto-skipped). 'Add one' is a quick manual form; 'Import CSV' handles bulk lists.",
      "Generate demo: 'Generate demo' calls /api/admin/demo, which runs the same configFromIntake + aiEnrichConfig pipeline a paid client uses — the prospect gets pixel-identical output. Result is stamped isDemo=true, published, and its slug is written to prospects.demo_slug.",
      "Cold email: once demo_slug + email exist, the 'Email' button opens a modal. /api/admin/prospects/cold-email drafts the email with Claude Haiku, in French (default for the French beachhead) or English, referencing the mystery-shop notes when present. You can edit subject + body inline.",
      "Send: hits /api/admin/prospects/cold-email again with mode='send'. Resend delivers from EMAIL_FROM. Prospect gets a touch logged and stage advances to demo_sent if it wasn't already ahead.",
    ],
    use: [
      "Beachhead workflow: paste 20 FR clinics via CSV → mystery-shop the top-rated ones (log notes) → Generate demo → Email. The mystery-shop notes give the email its wedge ('I called Tuesday afternoon and no one picked up').",
      "The preview URL is servolia.com/sites/{slug} — servolia.com is already a branded custom domain, so no Vercel URL is exposed. Roadmap has an entry for per-prospect throwaway domains once volume justifies the cost.",
      "If the prospect has no email, the Email button is disabled — fall back to WhatsApp ('Shop' button) with the demo link pasted in.",
    ],
    cost: "Cents of Claude Haiku per email draft. Resend is free up to 3,000 emails/month. Demos cost one Claude call each.",
    value: "Turns a cold clinic into a self-service demo they can *play with* before you ever speak. The demo is the pitch — no slides, no meeting to schedule, no imagination required from them.",
    code: "src/components/admin/ProspectsManager.tsx · src/app/api/admin/demo · src/app/api/admin/prospects · src/app/api/admin/prospects/cold-email",
  },
  {
    name: "Payment dunning + suspend for non-payment",
    summary: "Vercel-style: a red banner in the client portal the moment a Stripe recurring invoice fails, a 14-day grace window, then the site + AI receptionist go offline until they pay.",
    how: [
      "Stripe fires invoice.payment_failed → the webhook flips clients.payment_status to 'past_due', stamps past_due_since = now, sets suspend_at = now + 14 days, stores the hosted invoice URL and the failure reason, and pings Telegram.",
      "The portal reads clients via paymentAlertFrom() and shows a red bar at the top with the exact days left, a 'Pay open invoice' button that deep-links to Stripe's hosted invoice, and falls back to 'Manage billing' if we don't have the URL.",
      "/sites/[slug] also reads the client (via client_sites.build_id → clients.build_id). Once suspend_at passes, paymentAlertFrom() auto-promotes past_due → suspended, and the site renders a minimal 'temporarily unavailable' page in the client's own language instead of the real site.",
      "The moment invoice.paid or invoice.payment_succeeded arrives, everything resets to 'ok' — banner disappears, site is live again, no cron needed.",
    ],
    use: [
      "Enable invoice.payment_failed and invoice.paid on the Stripe webhook (see /admin/settings — the roadmap will nag until it's done).",
      "Watch the past-due badge in /admin/clients to know which relationships are wobbling.",
      "Tune GRACE_DAYS at the top of /api/webhooks/stripe/route.ts if 14 days is wrong for you.",
    ],
    cost: "None — piggybacks on the Stripe webhook you already run.",
    value: "Turns silent churn (card expires → nothing happens → three months later they've forgotten why they ever paid) into a self-service recovery flow. The visible countdown makes people update the card. The eventual shutoff makes sure a dead card can't cost you inference forever.",
    code: "src/lib/clientBilling.ts · src/app/api/webhooks/stripe/route.ts · src/components/PortalDashboard.tsx · src/app/sites/[slug]/page.tsx · src/app/admin/clients/page.tsx",
  },
  {
    name: "Client portal (bilingual tool hub)",
    summary: "Where the client logs in to run their whole system: branded greeting, one-tap tools, a real lead pipeline, results, billing — and a plan-aware upgrade card that sells the next tier for you.",
    how: [
      "Magic-link or password login (client_auth). Full EN/FR with a language switch; greeting uses their saved profile name, falling back to their business name.",
      "Overview = tool hub: Quick actions (view site, copy link, share on WhatsApp, copy email signature, message us) + lifetime value card + subscription + monthly stats + build status + add-ons.",
      "Upgrade card: reads the client's highest plan tier and pitches exactly the next step — starter sees the AI receptionist, growth sees the Client System, pro without a subscription sees Care plans. The CTA drops a prefilled message into the Messages tab, so every upsell lands as a warm founder-led conversation.",
      "My leads: pipeline statuses (new→contacted→booked→won/lost), private notes, one-tap call/WhatsApp/email buttons per lead, search, filters, CSV export.",
      "Visitors: their own site's traffic funnel. Reports: monthly numbers. Messages: direct thread with you (with photos).",
    ],
    use: ["Send them /portal/login.", "Reply to their messages in Admin → Messages.", "Watch for upgrade-prefill messages — those are the hottest upsell signals the system produces."],
    cost: "None beyond hosting.",
    value: "Makes the value visible every day (not just the monthly report) and turns the portal itself into a sales channel — the upgrade card only ever proposes the one thing that tier is missing.",
    code: "src/components/PortalDashboard.tsx · src/components/portal/* · /api/portal/*",
  },
  {
    name: "Custom requests",
    summary: "Personalized work a client asks for outside their plan — recorded and billed, not done as a free favour.",
    how: [
      "On the build page, add a request: title, details, price.",
      "The row is saved first, then a one-off Stripe payment link is created.",
      "You send the link. On payment the webhook marks it paid and pings you.",
    ],
    use: ["Admin → Builds → open a build → Custom requests → Add.", "Mark done when shipped."],
    cost: "Stripe's per-transaction fee.",
    value: "Stops scope creep becoming unpaid work, and turns one-off demands into recorded revenue.",
    code: "src/components/admin/CustomRequests.tsx · /api/admin/custom-requests",
  },
  {
    name: "Edit locally with Claude Code",
    summary: "A build-scoped command that opens Claude Code on your laptop for bespoke edits, without spending Anthropic API credits.",
    how: [
      "The build page generates a command containing the client's name, site slug and build id.",
      "Copy it, paste in your terminal — Claude Code opens already knowing the context.",
      "A vscode:// link opens the project directly; an optional one-time Windows protocol setup makes it true one-click.",
    ],
    use: ["Admin → Builds → open a build → Edit locally with Claude Code."],
    cost: "Zero API cost — it uses your Claude Code subscription.",
    value: "Bespoke client work without per-token billing.",
    code: "src/components/admin/OpenInClaudeCode.tsx",
  },
  {
    name: "Retention — the 'Since you joined' number",
    summary: "The first thing a client sees in their portal: the cumulative value delivered since day one. This is the anti-churn artifact.",
    how: [
      "The portal totals every enquiry their assistant handled since they joined — not just this month.",
      "It splits out booking requests and, crucially, how many arrived outside opening hours (before 08:00, after 19:00, or at the weekend).",
      "Shown at the very top of Overview, in their language.",
    ],
    use: [
      "Nothing to run — it fills itself from their real data.",
      "Reference it when a client asks 'is this worth it?'. The after-hours number is the one that answers.",
      "Push annual prepay (one month free): a year paid up front is a year retained.",
    ],
    cost: "None — reuses data already captured.",
    value: "Churn happens when a client stops seeing value, not when value stops. A monthly report can look thin; a lifetime total rarely does.",
    code: "src/components/PortalDashboard.tsx · /api/portal/leads (lifetime)",
  },
  {
    name: "Homepage showcase slider",
    summary: "Shows the four parts of the system — site, AI receptionist, bookings, dashboard — as small mocks of the real UI, on both homepages.",
    how: [
      "Four slides, auto-advancing every 6s, pausing on hover/focus and stopping entirely for prefers-reduced-motion.",
      "Arrows, dots and left/right keys all work; the copy is announced politely to screen readers.",
      "Each slide links straight to the live demo.",
    ],
    use: ["Runs itself on / and /fr. Edit the copy in ShowcaseSlider's T dictionary."],
    cost: "None — pure CSS mocks, no images to load.",
    value: "Shows the product instead of describing it, without stock photos pretending to be product or invented testimonials.",
    code: "src/components/ShowcaseSlider.tsx",
  },
  {
    name: "Client profile + marketing opt-in",
    summary: "In the portal, a client sets their photo, name and phone — and decides for themselves whether to receive marketing email.",
    how: [
      "Account tab → Your profile. The photo goes through the same validated image pipeline as chat attachments and saves immediately.",
      "The marketing toggle is real consent: switching it on adds them to email_subscribers with a consent timestamp; switching it off unsubscribes them.",
      "That's the same table the broadcast tool reads, so a client can always remove themselves.",
    ],
    use: ["Nothing to run. Clients who opt in appear in the 'subscribers' audience under Email your list."],
    cost: "Image storage only.",
    value: "Grows a consented marketing list from people who already pay you — the warmest audience there is — without you asking manually.",
    code: "src/components/PortalDashboard.tsx (ProfileCard) · /api/portal/profile · /api/portal/profile/avatar",
  },
  {
    name: "Email your list (broadcast)",
    summary: "Send a one-off email from the admin to your newsletter subscribers or your leads, with a real unsubscribe and opt-out protection.",
    how: [
      "Pick the audience — subscribers (opted in via the site) or leads (people who contacted you). The live count is shown for each.",
      "Write a subject and an HTML body. Send yourself a test first to see the real thing.",
      "On send, anyone who ever unsubscribed is removed, addresses are de-duplicated, and each email gets its own signed one-click unsubscribe link.",
      "Sends go out in small batches, capped per click, and the campaign is recorded in email_campaigns.",
    ],
    use: [
      "Admin → Email your list. Always send the test to yourself before the real send.",
      "Send from Resend on the send.servolia.com subdomain — NOT from Google Workspace. Bulk sending from your main domain would damage the reputation of hello@servolia.com.",
      "Keep it relevant and easy to opt out of — B2B outreach in the EU still needs a working unsubscribe.",
    ],
    cost: "Resend's per-email cost — free tier covers early volume.",
    value: "Reactivates dormant leads and keeps your list warm without another tool or subscription.",
    code: "src/components/admin/BroadcastComposer.tsx · /api/admin/broadcast · src/lib/unsubscribe.ts · /unsubscribe",
  },
  {
    name: "Monthly client reports",
    summary: "An automated monthly results email + portal report per client.",
    how: ["A cron runs monthly, aggregates each client's chat_sessions into metrics, stores a client_reports row and emails it."],
    use: ["Nothing manual — check Admin → Clients. Clients see it under Reports in their portal."],
    cost: "Email send only.",
    value: "Proves ROI every month. This is what justifies the Care plan renewing.",
    code: "/api/cron/monthly-report · /api/portal/reports",
  },
  {
    name: "Content engine",
    summary: "AI drafts blog posts and LinkedIn posts; you approve them from Telegram before anything publishes.",
    how: ["Crons generate drafts → you get a Telegram message with Approve/Reject → approved content publishes."],
    use: ["Admin → Content Engine to see the queue."],
    cost: "A few cents per draft.",
    value: "Keeps SEO and social alive without you writing.",
    code: "/api/cron/generate-blog · /api/cron/generate-linkedin · /api/telegram/webhook",
  },
  {
    name: "Settings — what's left",
    summary: "Live status of every secret/integration plus the prioritised roadmap of everything not done yet.",
    how: ["Checks process.env for each integration (never exposes values) and detects whether Stripe is LIVE or TEST."],
    use: ["Admin → Settings. Anything left to do is listed there with what it's waiting on."],
    cost: "None.",
    value: "You always know what's missing without digging through code.",
    code: "src/lib/roadmap.ts · src/app/admin/settings",
  },
];

/* ── 4. What it costs to run ────────────────────────────────────────────── */
export interface CostLine { item: string; cost: string; note: string }

export const RUNNING_COSTS: CostLine[] = [
  { item: "Vercel (hosting)", cost: "Free → Pro", note: "The whole site, admin and every client site run here." },
  { item: "Supabase (database)", cost: "Free tier → paid as you grow", note: "All 19 tables. Free tier covers early clients comfortably." },
  { item: "Anthropic (Claude Haiku)", cost: "Cents per conversation / generation", note: "Powers the receptionists and copy generation. The main variable cost." },
  { item: "Cloudflare Workers AI", cost: "Free tier", note: "Fallback when Claude is unavailable — keeps chat alive." },
  { item: "Resend (email)", cost: "Free tier → paid", note: "Scope docs, receipts, reports, magic links." },
  { item: "Stripe", cost: "Per-transaction fee", note: "Check your Stripe dashboard for your exact rate — it varies by card and country." },
  { item: "Twilio (SMS add-on)", cost: "Approx. per message", note: "Only if you enable the SMS reminders add-on. Not connected yet." },
];
