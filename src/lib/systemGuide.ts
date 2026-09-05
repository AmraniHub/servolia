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
  { step: "4. Payment", detail: "They pay the €690 installation IN FULL through Stripe Checkout — nothing is owed on delivery. Buyers from a /fr/ page get a French-language Stripe page and lang:\"fr\" in the session metadata. The webhook creates/updates the build and moves the lead to the deposit_paid stage (column name predates the model change)." },
  { step: "5. Intake", detail: "They complete the intake — /onboarding in English, /fr/demarrage in French (Stripe sends them to the right one). Their answers land on the build as intake_data — this is what the generator reads, so French answers in means a French site out." },
  { step: "6. Generate", detail: "You click Generate on the build. configFromIntake() builds the mechanical draft, then Claude writes the copy. Result: a DRAFT client site." },
  { step: "7. Approve", detail: "The draft is private — only you can see it. You review, then hit Publish. Only then is it public." },
  { step: "8. Live + recurring", detail: "The site runs their AI receptionist and booking form. They subscribe to a monthly plan (Essentiel / Croissance / Performance); leads, reports and add-ons show in their portal." },
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
      "In a renewal conversation, open the client's Visitors tab: visitors → enquiries in one screen is the whole argument for the monthly plan.",
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
    use: ["Send the scope link before taking payment.", "Direct /pricing purchases auto-create a scope so nobody pays without one."],
    cost: "Free (email via Resend).",
    value: "Protects you in a dispute and removes 'that's not what I ordered' arguments.",
    code: "src/lib/scopeDocument.ts · src/app/scope/[token] · /api/scope/[token]/accept",
  },
  {
    name: "Payments (Stripe)",
    summary: "Four money paths: the one-time installation, monthly subscriptions, add-ons, and one-off custom work.",
    how: [
      "Installation: charged in full via Checkout → webhook creates/updates the build (status stays 'intake' until they fill the form). balance_due is written as 0 — nothing is owed on delivery.",
      "Subscription: monthly or annual (annual = 10× monthly, two months free) → creates a client row.",
      "Add-ons: self-serve recurring subscription from the portal → triggers provisioning.",
      "Custom work: one-off payment link created from the build page → marks the request paid.",
    ],
    use: ["Everything is metadata-tagged (kind: care_plan / addon / custom_request) so the webhook routes it correctly.", "Check /admin/settings/integrations for whether Stripe is in LIVE or TEST mode."],
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
    name: "The pricing model — installation + a metered subscription",
    summary: "One €690 installation, then the subscription IS the product: Essentiel €149 / Croissance €249 / Performance €449 per month, tiered by included AI conversations. Annual is pay 10, get 12.",
    how: [
      "src/lib/pricing.ts is the single source of truth. PLANS holds the three tiers with their included conversation volume (100 / 300 / 800 per month); SETUP_PLAN is the one-time €690 installation, waived when the client starts on annual.",
      "The tiers differ by VOLUME, not by whether the AI receptionist exists — every plan includes it. Going over the included conversations auto-upgrades to the next tier rather than billing surprise overage: predictable for them, automatic expansion revenue for you.",
      "resolvePlan() maps the retired care / care_growth / care_scale keys onto the new plans, so old Stripe metadata and any existing clients row keep working. Old build plans (€290/€590/€990) are marked retired rather than deleted so historical builds still render their real names.",
      "Why the meter is conversations and not bookings: a fee per patient booked is tied to patient volume, which French compérage rules restrict for regulated professions. Metering AI conversations is metering a technical resource, so the same grow-with-them property is available in the dental beachhead. UNCONFIRMED legally — see the roadmap item before using it in public copy.",
      "Pay-per-booking (€990 + €60/attended consultation, aesthetic-only) was RETIRED 2026-08-13 by operator decision: one model for every niche — the client pays the installation, Servolia delivers, the subscription runs. No results-contingent billing. /api/checkout-ppb, the webhook's ppb_setup branch, the monthly invoicing cron and the eligibility gate were all removed; the DB tables/columns stay (harmless, empty).",
    ],
    use: [
      "Changing a price: edit pricing.ts, then grep the repo for the old number — marketing pages hard-code display strings and cf-worker/ is a separate deploy that can't import the file.",
      "Selling: lead with annual. Two months free is real value for them, and for you it's a year of cash on day one plus twelve months locked against churn — the single most valuable thing a solo founder can get from a deal.",
      "Never unbundle domain, hosting and email from the plan. Bundled, leaving means losing their whole presence; itemised, each one becomes a line to cancel.",
    ],
    cost: "Stripe's per-transaction fee. Claude inference scales with conversations, which is exactly what the meter charges for — the tiers are designed so usage and cost move together.",
    value: "The old shape (€990 once + €49/mo) front-loaded the cash while the value and costs recurred, so income only existed while new clients kept closing. 20 clients on Croissance is €4,980/mo recurring versus €980 on the old Care plan — same work, and 20 clients is manageable solo. €249 is about 15% of the value of ONE extra implant patient.",
    code: "src/lib/pricing.ts · src/components/CarePlansSection.tsx · /api/checkout-subscription · src/lib/scopeDocument.ts",
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
      "Live numbers, always current: /admin/settings/costs.",
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
      "Generation = niche template × plan template. Niche (src/lib/niches/: dental, aesthetic, home-services) decides structure, tone and imagery. Plan (planFeatures() in clientSites.ts) decides features: the retired Website System €290 shipped the site + booking/contact form WITHOUT the AI receptionist; every current plan ships everything incl. the AI receptionist.",
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
    name: "Proof page — \"what we've actually built\"",
    summary: "/case-studies (and /fr/cas-clients) lead with a grid of live, openable sites in browser frames — modelled on the OpenX24 results page, adapted so real clients appear automatically.",
    how: [
      "src/lib/showcase.ts returns ONE list with two kinds of entry, distinguished structurally by a `kind` field rather than by styling: CLIENT (every published client_sites row, excluding prospect demos and the bundled showcases) and DEMO (the fictional showcases from the template registry). A demo can therefore never be rendered as a client by accident — this is the page a sceptical clinic owner opens to decide if Servolia is real, so one overstated card would be the most expensive lie on the site.",
      "No manual case-study entry to remember: deliver a client, publish their site, and it appears here at the top. Reals sort before demos because only real work persuades.",
      "Each card is a browser frame around a LIVE iframe, not a screenshot. A screenshot is a claim about a page; an iframe IS the page — it cannot go stale or flatter, and the visitor clicks straight through and uses the thing. Same 400%/scale(0.25) trick as the homepage showcase: exact fit at every breakpoint, no measurement.",
      "Spec rows (Type / City / Language / We built) come from each site's own config, and 'We built' reads planFeatures() so it never claims an AI receptionist on a site that does not ship one.",
      "The hero copy changes with reality: with zero clients it says plainly that Servolia is young and invites you to judge the craft; the moment a real client is published it switches to 'every site below is online right now'.",
    ],
    use: [
      "Send a sceptical prospect straight here — it is the fastest answer to 'are you real?'.",
      "Nothing to maintain. Publishing a client site adds it; there is no separate case-study form to fill in.",
      "The older illustrative scenarios still sit below the grid as a secondary section — evidence first, argument second.",
    ],
    cost: "Free — one indexed query, and the iframes are lazy.",
    value: "Replaces the weakest credibility pattern (invented scenarios) with the strongest available (a working product you can click), and grows itself as clients ship.",
    code: "src/lib/showcase.ts · src/components/BuiltGrid.tsx · src/app/case-studies · src/app/fr/cas-clients",
  },
  {
    name: "Client domains — we manage, the client owns",
    summary: "Every domain Servolia registers is in the CLIENT's name. Servolia holds the technical keys and runs DNS, and never takes ownership — written into CGV 7 bis and proven back to the client in their portal.",
    how: [
      "THE DECISION, and why: holding a client's domain buys lock-in and costs more than it is worth here. The beachhead is 200–500 dentists who all know each other, so one story of 'they wouldn't release my domain' travels the whole niche. And Servolia is one person — owning every domain means one unreachable founder takes down every clinic's site AND email simultaneously, which for a medical practice is not an inconvenience. The real moat is the bundle: leaving means losing site, receptionist, hosting, email and lead history together. That is earned switching cost; hostage is not.",
      "CGV 7 bis (EN + FR) states it: the client is the registrant, Servolia is technical contact, renewal is included while the plan runs, and on cancellation the transfer code is released free within 5 working days — explicitly never withheld as leverage in a dispute.",
      "src/lib/domains.ts wraps the Cloudflare Registrar API (verified against the docs 2026-08-01, beta): search, check, register. Contacts CAN be supplied at registration, which is the only reason the client-as-registrant model works. registerDomain() REFUSES to run without a registrant rather than falling back to the account default — defaulting would silently put Servolia on the WHOIS record, the exact outcome the model exists to avoid.",
      "THREE THINGS THE BETA API CANNOT DO, all of which shaped the design: it cannot RENEW (so expiry is tracked in client_domains and watched by a weekly cron — a lapsed domain kills a clinic's site and email and the name can be bought by anyone); it cannot TRANSFER (a client leaving is a dashboard action by hand); and it cannot UPDATE CONTACTS (so registrant details are effectively one-shot and must be right at registration).",
      "The portal panel shows the client their own name as registrant, the registrar, the expiry, and — deliberately — how to leave. A client who can see the exit does not feel trapped and does not go looking for it.",
    ],
    use: [
      "Registering for a client: always pass their name, organisation, email and country. Never your own.",
      "Renewals: act on the Monday alert. It is silent when nothing is due and loud when something is inside 14 days.",
      "A client leaving: hand over the transfer code from the Cloudflare dashboard within 5 working days. This is a contractual obligation, not a courtesy.",
      "Needs CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN with Registrar WRITE. Without them the code paths return a clear 'not configured' rather than failing oddly.",
    ],
    cost: "At cost — Cloudflare Registrar adds no markup (~€10/year for a .fr or .com), absorbed inside the monthly plan.",
    value: "Turns the thing most agencies use as a leash into a selling point. 'The domain is in your name and you can take it anywhere' is exactly what a clinic burned by a previous web agency needs to hear — and it removes a single point of failure that could otherwise take out every client at once.",
    code: "src/lib/domains.ts · /api/cron/domain-renewals · src/components/portal/DomainPanel.tsx · legal/cgv §7 bis (EN+FR) · client_domains table",
  },
  {
    name: "Ideas board — how work gets handed to Claude",
    summary: "A kanban at /admin/ideas of everything discussed but not built. Move a card to In progress, copy the brief, paste it into a message — that is the whole handover.",
    how: [
      "Two records, deliberately NOT duplicated. roadmap.ts is CODE: the honest log of what shipped, what is blocked, and why — only Claude edits it, and it drives /admin/settings/roadmap. The `ideas` table is DATA: the founder moves cards themselves, with no commit and no waiting.",
      "They are linked by a one-click import. The first time the board is empty it offers 'Import everything from the roadmap' — all 43 items arrive with their detail, priority and blocker, categorised from the title. Every row carries an external_key, so pressing it twice can never duplicate a card.",
      "Blocked roadmap items land in PLANNED rather than Idea, because 'waiting on a lawyer' is decided work, not a suggestion. Done items are imported too — a Done column that starts empty makes it look like nothing has ever shipped.",
      "THE BUTTON THAT MATTERS: 'Copy brief for Claude'. Claude works in the repo and cannot read Supabase, so a card moved to In progress is invisible to him. That button renders the column as plain text — title, detail, blocker, ordered by priority — ready to paste. Without it this is a pretty board that changes nothing.",
      "Cards move by button, not drag: drag targets are painful on a phone, and buttons announce themselves to a screen reader for free. Moves are optimistic so they feel instant, and roll back if the write fails.",
    ],
    use: [
      "Capture anything mid-conversation with New idea — that is what stops good ideas dying in a chat log.",
      "To get something built: move it to In progress —> Copy brief for Claude —> paste. Claude reports back what he finished; you move those to Done.",
      "Use Drop, not Delete, for anything you might reconsider. Delete is permanent.",
      "The table comes from supabase/pending-migration.sql section 6. Until that runs the page explains itself instead of erroring.",
    ],
    cost: "Free — one small table.",
    value: "Closes the loop between 'I want this' and 'it is built' without either side re-reading the whole conversation. The founder decides priority in the UI; Claude receives an unambiguous, ordered brief.",
    code: "src/lib/ideas.ts · /api/admin/ideas · src/components/admin/IdeasBoard.tsx · src/app/admin/ideas · seeds from src/lib/roadmap.ts",
  },
  {
    name: "Unit economics — the money model and offer, scored automatically",
    summary: "Hormozi's money model and value equation computed from your own rows at /admin/economics, so the decision 'may I spend to acquire a client' has a number instead of a feeling.",
    how: [
      "THE GATE: 30-day CAC payback. If a new client hasn't repaid what it cost to win them inside a month, growth eats cash however good the ROAS looks. The page shows the maximum CAC that still clears it — and Servolia's unusual edge is that €690 of that lands on DAY 0 as the installation, before a single subscription payment.",
      "MONEY MODEL: MRR, ARPU, fixed costs (from costs.ts, active flat-fee services only), gross margin, clients-to-break-even and LTV — all from clients/builds rows.",
      "VALUE EQUATION: two of the four levers are measurable and are measured — Time Delay from the median days across delivered builds, Perceived Likelihood from real delivered clients + published case studies. The other two are stated as what the offer claims and labelled as such.",
      "OFFER STRENGTH: the 7-point validation checklist. Checks data can settle are settled; 'Proof' is the one that currently FAILS, and it fails honestly — no delivered client, no published case study, so the live demos and the guarantees carry the whole lever.",
      "Every figure is tagged MEASURED / ASSUMED / NO DATA. With zero clients most of this is unknowable, and the page says so rather than rendering 0% margin as though it were a finding. Retention is a stated 12-month default until someone actually renews — assuming 12 before a first renewal would flatter LTV by design.",
    ],
    use: [
      "Before spending anything on ads or outreach tools: check the max-CAC number. Under it, spend freely; over it, you are buying revenue with cash you don't have.",
      "Watch the Proof check. It flips to passing the day your first client result is published, and that single flip is worth more to conversion than any copy change.",
      "The figures sharpen automatically as clients arrive — nothing to maintain.",
      "Linda (the admin copilot) reads all of this too: the payback ceiling, remaining build capacity, any Zero-Miss breach, and the open priority-1 board. Ask her 'can I afford to spend X on ads' or 'what next' and she answers from these numbers rather than from opinion — and will refuse to endorse a spend above the ceiling.",
    ],
    cost: "Free — three indexed queries per page load.",
    value: "Turns the two frameworks that actually decide whether a business compounds — payback speed and offer strength — from a spreadsheet you'd never update into a page that is always current.",
    code: "src/lib/economics.ts · src/app/admin/economics · reads src/lib/costs.ts + src/lib/pricing.ts",
  },
  {
    name: "Delivery deadlines + the self-deriving build checklist",
    summary: "The delivery board answers one question — who is blocking, you or the client — and it never drifts, because nothing is hand-ticked.",
    how: [
      "src/lib/buildProgress.ts derives a 6-step checklist from data that already exists: installation paid → scope accepted → intake in → site generated → published → monthly plan started. Every step is read from a real row, so a box can only be ticked by the thing actually happening.",
      "Each step records an OWNER — 'us' or 'client'. That's the important part: a build parked ten days because the client never sent their intake is a completely different situation from one you haven't started, and the CGV agree (client-caused delay doesn't count against the delivery guarantee).",
      "Refund exposure follows from that: atRiskEur is 10% per day late capped at 50%, but ZERO while the ball is in the client's court. The number shown in the admin is the one that would survive a dispute.",
      "src/lib/deadlines.ts aggregates five sources into /admin/deadlines: build deadlines, client suspensions from dunning, lead SLA (last contact +2 days), unsigned scopes (+3 days), and bookings. KIND_META holds literal Tailwind classes rather than inline styles so the admin dark theme can override them.",
      "Dates use LOCAL components via src/lib/dates.ts, never toISOString().slice(0,10) — that converts to UTC and rolls a Paris date back a day, which would silently show the wrong deadline.",
    ],
    use: [
      "Open /admin/deadlines each morning: it is sorted by what is closest to hurting, not by what is newest.",
      "On a build page, read the current step before messaging a client — if the owner is 'client', chase them; if it's 'us', the guarantee clock is running.",
    ],
    cost: "Free — derived from rows you already have, no extra storage.",
    value: "You cannot forget a step you never had to tick, and you can prove whose delay it was. That is what makes a written 7-day guarantee safe to offer as a solo operator.",
    code: "src/lib/buildProgress.ts · src/lib/deadlines.ts · src/lib/dates.ts · src/app/admin/deadlines · src/app/admin/builds/[id]",
  },
  {
    name: "Zero-Miss enforcement — how the 60-second guarantee is proven",
    summary: "The guarantee is only worth what it can be measured by. Reply latency is stamped server-side on every answer, watched daily, and shown to the client in their own portal.",
    how: [
      "MEASUREMENT: /api/chat starts a clock the moment an enquiry lands and stamps `ts` + `ms` onto the assistant message it persists. Both branches are instrumented — client sites and Servolia's own Solia. The clock is deliberately server-side only: network time to and from the visitor is not observable here, so it is never claimed. That is exactly what CGV 4 bis says is measured.",
      "COMPLIANCE: src/lib/zeroMiss.ts reports per site per calendar month — replies measured, breaches over 60s, slowest reply. Replies with no recorded latency count as UNMEASURED, never silently as compliant: `compliant` requires at least one measured reply AND zero breaches. Conversations from before this shipped fall in that bucket honestly.",
      "WATCHDOG: /api/cron/zero-miss runs daily at 07:00 UTC. A breach sends a LOUD Telegram naming the sites and what is owed; unverifiable replies send a quiet one; all-clear sends NOTHING — a daily 'everything is fine' is what trains you to stop reading the channel the real alert arrives on.",
      "CLIENT VIEW: the portal panel reads the same function the watchdog uses, so both sides always see identical numbers. On a breach it states plainly that the refund will be processed without them asking. That panel is a contractual obligation, not a feature — CGV 4 bis promises it.",
    ],
    use: [
      "Nothing routine — silence means compliant. Act only when Telegram fires.",
      "On a breach: the month's plan fee is owed. Refund it before the client asks; that is the whole point of watching.",
      "Before pushing the guarantee in outbound, make sure Anthropic credits are funded — it assumes the receptionist keeps answering.",
    ],
    cost: "Free — one indexed scan a day over chat_sessions.",
    value: "A guarantee nobody can audit is marketing; one the client can check in their own portal is a moat. It is also the reason the promise is safe to make: the AI genuinely never sleeps, and now there is proof.",
    code: "src/lib/zeroMiss.ts · /api/chat (stamping) · /api/cron/zero-miss · src/components/portal/ZeroMissPanel.tsx · legal/cgv §4 bis (EN+FR)",
  },
  {
    name: "Client support — AI assistant and the human thread, kept separate",
    summary: "A Messenger-style dock in the portal (2026-07-30) with two deliberately separate channels: an assistant that answers instantly from the client's own account data, and the direct line to you. Questions with a factual answer stop landing in your Telegram.",
    how: [
      "The dock is a floating launcher on every portal tab, like Messenger's popup — the full Messages tab still exists for reading a long thread. Inside it, two tabs that never mix: ASSISTANT (instant AI) and ABDELALI (the human thread in client_messages, unchanged).",
      "The assistant is grounded, not generic: src/lib/portalAssistant.ts loads that client's plan, included conversations, site slug and status, build stage, qualified-lead count and this month's Zero-Miss record, then hands it to Claude as the only account facts it may use. Context is loaded server-side from the session email — never from the request — so it can only ever answer about the account that is logged in.",
      "Two hard prompt rules: never invent an account fact (if it isn't in the context, the honest answer is 'I can't see that, ask Abdelali'), and never promise work, dates, discounts, refunds or scope — those are yours to give. It explains and points; it does not commit Servolia to anything.",
      "The client is never trapped with the bot. The human tab is one tap away at all times, and every assistant conversation shows a handoff button that writes the whole transcript into the human thread — so nothing is retyped and you arrive with full context.",
      "No AI key or a failed call degrades honestly: it says it can't answer and points at Messages, rather than stalling or guessing.",
      "/admin/assistant is a listening post, not an inbox — nobody needs to reply, the AI already did. Its value is that a repeated question is a missing button, not a bad answer. Rate limited to 30 questions per client per 10 minutes because inference costs money.",
    ],
    use: [
      "Nothing per client — the dock appears for everyone in the portal automatically.",
      "Read /admin/assistant weekly. Three clients asking the same thing is a feature request; build the button and the question disappears.",
      "Anything the assistant couldn't handle arrives in /admin/messages with the transcript attached, so you answer once with the full picture.",
      "Transcripts need the portal_ai_chats table — /admin/assistant prints the SQL when it's missing (see roadmap).",
    ],
    cost: "Fractions of a cent per question on Haiku; nothing when the table or key is absent.",
    value: "Removes you from the top of the support funnel the same way the audit removed you from the top of the sales funnel. A client gets an answer in two seconds instead of waiting hours for you, and you only see the conversations that genuinely need a human.",
    code: "src/lib/portalAssistant.ts · /api/portal/assistant · src/components/portal/PortalChatDock.tsx · src/app/admin/assistant · existing: /api/portal/messages + src/components/admin/MessagesInbox.tsx",
  },
  {
    name: "Sell-without-calls — instant audit, honest scarcity, Zero-Miss guarantee",
    summary: "The acquisition layer (2026-07-28): a prospect scores their own site in 20 seconds, sees what the gaps cost them in their own money, and can buy — without ever booking a call. Servolia no longer offers sales calls at all.",
    how: [
      "No calls, by design. /call and /fr/appel are gone (301 → the audit), the booking widget and its public API are deleted, and every CTA now points at the audit. This is a FEATURE for the buyer, not a limitation: a dentist cannot take a 15-minute sales call between patients, so 'read it and decide at 23:00' beats 'find a slot'. In value-equation terms it drives Effort toward zero, which is the hardest lever to compete with.",
      "Instant audit (/api/audit + src/lib/auditEngine.ts): fetches the prospect's live page and scores 7 weighted dimensions — booking capture (25%), after-hours answering (20%), mobile (15%), trust signals (15%), 5-second clarity (10%), page weight (10%), GDPR (5%). Every finding is a deterministic check against their real markup, so any of them can be verified in ten seconds. A check that cannot run scores null and is excluded rather than counted as a failure.",
      "The result is framed as Hormozi's value equation — Value = (Dream Outcome × Perceived Likelihood) ÷ (Time Delay × Effort). Outcome is THEIR arithmetic (their patient value × their enquiry volume × a conservative 10–25% band that scales with the gaps found), always labelled an estimate. Likelihood cites only what the CGV actually grant. Time is the 7-day delivery. Effort is the 10-minute form.",
      "The endpoint fetches attacker-supplied URLs, so it is hardened accordingly: http/https only, private + link-local + carrier-grade-NAT ranges blocked (including the cloud metadata address), redirects followed manually with the host re-checked at every hop, 2 MB body cap, 12s timeout, 10 audits per IP per 10 minutes. Nothing is persisted — the score is anonymous until the visitor asks for the written teardown.",
      "Honest scarcity (src/lib/capacity.ts): the pricing pages show real delivery capacity read from the builds table — 3 installations a week, because one person with a written 7-day deadline genuinely cannot start a fourth. If the database is unreachable it states the cap and shows no live count; it never invents 'only 1 slot left'.",
      "Zero-Miss guarantee: every enquiry answered within 60 seconds, 24/7, or that month's plan fee is refunded. Written into both CGV (section 4 bis) and both refund policies (2 bis), with real exclusions, capped at the month's plan fee, measured on server-side timestamps the client can check in their portal.",
    ],
    use: [
      "Send a prospect straight to /free-audit (or /fr/audit). They score themselves, see the money, and can go to /examples and /pricing without you touching anything.",
      "Run the audit yourself from the same page before writing a cold email — the worst finding IS the opening line of the email.",
      "Nothing to do for scarcity; it follows the builds table. Change WEEKLY_INSTALL_CAPACITY in src/lib/capacity.ts if your real throughput changes.",
      "Before pushing the guarantee in outbound, make sure Anthropic credits are funded — it is a real refund liability that assumes the receptionist keeps answering.",
    ],
    cost: "Free — one outbound HTTP fetch per audit, no AI call, no storage.",
    value: "Removes the founder from the top of the funnel entirely. The audit was previously a promise of a manual 5-minute Loom within 24 hours, which capped outbound at roughly a dozen prospects before the day was gone; it is now instant and unlimited, and the buyer never has to find a slot in their diary.",
    code: "src/lib/auditEngine.ts · /api/audit · src/components/AuditScorecard.tsx · src/lib/capacity.ts · src/components/CapacityBadge.tsx · legal/cgv §4 bis (EN+FR) · next.config.ts (call redirects)",
  },
  {
    name: "Templates system — registry, auto-wire, and the public catalog",
    summary: "The ready-to-deliver template catalog (2026-07-28): one registry file lists every fully-wired niche template, a paying client's draft site generates itself the moment their intake lands, and prospects can click the live product before choosing a plan.",
    how: [
      "src/lib/templates.ts is the single registry — one SITE_TEMPLATES entry per niche template that is wired end-to-end (niche module + AI copy playbook + receptionist prompt + a live fictional showcase). The registry is METADATA ONLY: it never changes what a template generates, so adding an entry can't ship unreviewed defaults. An entry only exists when the wiring is complete — that's the gate.",
      "Auto-wire: when a paid client submits the intake form, /api/contact links the answers to their build and immediately runs generateSiteForBuild() (src/lib/generateSite.ts — the same shared path the admin Generate button uses: configFromIntake → aiEnrichConfig → draft client_sites row). By the time you open the admin, the draft is already waiting. Failure is swallowed — intake never breaks because generation hiccupped — and the Telegram intake alert says whether the draft is ready or needs a manual generate.",
      "/admin/templates is the readiness board: per template — wiring checklist, live demo link, real-site counts from client_sites, and the 5-step 'how a new client gets wired' strip (pays installation → fills intake → draft auto-generates → you review & polish → publish, plan starts).",
      "Public catalog: /examples and /fr/exemples show each template with what's included and a click-through to the live fictional demo (Cabinet Nicolas Metay · Institut Luméa · Bardin Plomberie). The homepage's old fake-named 'scenario' cards were replaced by LiveShowcase — scaled live iframes of the real demos in browser frames. Honesty rule everywhere: demos are labeled fictional; the credibility comes from the product being clickable, not from invented results.",
    ],
    use: [
      "New client, happy path: nothing. They pay, they fill the intake, you get a Telegram with the draft link — open /admin/sites, polish, publish.",
      "If the Telegram says generation failed (usually no Anthropic credits): open the build in /admin/builds and hit Generate — same code path, safe to re-run.",
      "Selling: send a prospect /examples (or /fr/exemples), or generate a personalized demo with THEIR name from /admin/demo — the registry page links both.",
      "New niche template: ship the three wiring touchpoints + a demo site first, THEN add the SITE_TEMPLATES entry. Never the other way round.",
    ],
    cost: "Free — one Claude call per intake (same call the manual Generate made; ~cents).",
    value: "Delivery time per new client drops to a review-and-publish, the sales page can prove the product is real without fake testimonials, and the founder can see at a glance which niches are actually ready to sell.",
    code: "src/lib/templates.ts · src/lib/generateSite.ts · /api/contact (intake) · src/app/admin/templates · src/app/examples + src/app/fr/exemples · src/components/LiveShowcase.tsx",
  },
  {
    name: "Security model — logins, rate limits, 2FA",
    summary: "How the admin and client doors are locked: fail-closed JWT secrets, constant-time checks, cross-instance rate limiting, optional TOTP 2FA for the admin, and site-wide security headers.",
    how: [
      "Sessions: both admin and portal sessions are signed JWTs in httpOnly/secure/sameSite cookies. Since 2026-07-27 the signing secret FAILS CLOSED — production throws if ADMIN_JWT_SECRET is unset instead of silently using a fallback string that lives in the public repo.",
      "Admin login (rebuilt 2026-08-13, two steps): password first — constant-time compare, 8 attempts / 15 min per IP via the shared rate limiter. If 2FA is on, the reply is not a session but a signed ticket that dies in 5 minutes and grants nothing on its own; the code screen appears only then. The old form asked for a code on every login labelled \"(if enabled)\". Wrong password still returns the same generic error.",
      "Admin 2FA enrolment now lives in the dashboard, not in Vercel: /admin/settings/security → Turn on two-factor. Two phases — 'setup' parks a PENDING secret and enforces nothing, 'confirm' needs a live code before 2FA actually switches on. That ordering is the point: a key typed in wrong is caught while you are still logged in, not at the next login from a phone that can't generate the right code.",
      "Replay defence: every accepted code's 30-second time step is stored as last_step, and the next login must beat it. A code read over your shoulder or caught in a screen-share is dead the moment you use it — not 30 seconds later.",
      "Recovery codes: eight, shown once in plaintext at enrolment, stored only as SHA-256 hashes, each usable once. They work in the same box as the authenticator code on the login screen. This is the way back in after a lost phone — previously that meant editing a Vercel env var and redeploying before you could open your own admin.",
      "Storage: the admin_2fa table (section 8 of supabase/pending-migration.sql). ADMIN_TOTP_SECRET was a migration bridge only and was REMOVED from the code on 2026-08-13, once DB-backed 2FA was confirmed active — a second permanently-valid secret with no replay guard and no recovery codes is a weakness once the real thing works, not a safety net. It never fails open: if the read fails, login is refused rather than waved through, which does mean a Supabase outage locks the admin out entirely. Deliberate — the dashboard reads from Supabase, so an outage leaves nothing worth logging in to.",
      "Turning it off requires a live code or a recovery code, so a stolen session cookie can't quietly strip the second factor and leave the door open.",
      "Client portal: magic links (15-min tokens) stay the default; optional bcrypt passwords. Magic-link requests are limited 5/15min per IP and 3/15min per target address — silently, so no account enumeration. Password login shares the same DB-backed limiter.",
      "Rate limiter: rate_limits table in Supabase (one row per key) = one global window across all serverless instances; degrades gracefully to per-instance memory until the SQL block is run.",
      "Headers on every response: HSTS (1 year), X-Content-Type-Options nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy denying camera/mic/geo/payment.",
      "Already solid before this pass: Stripe webhook signature verification, Bearer-token crons, admin-auth checks on every /api/admin route, portal-session checks on every /api/portal route, server-side upload validation, no Supabase anon key in the browser.",
      "/api/contact spam gate (2026-07-29, after a flood of fake 'Dental Clinic' leads with gibberish LLC names + nonsense domains): a hidden honeypot field named \"url\" (rendered on /contact + /fr/contact, invisible to real visitors) silently no-ops the request if filled; server-side now also requires a real email format and, for type=contact, a non-empty name + problem (the bot was posting straight to the API and skipping fields the Telegram alert doesn't echo back); plus the same 8/15min per-IP limiter used on admin login. Don't click the website links on suspicious leads in the CRM — treat gibberish-domain leads as spam bait, not prospects.",
    ],
    use: [
      "Enable 2FA today: /admin/settings/security → Turn on two-factor. Two minutes, a free authenticator app, and save the eight recovery codes somewhere that is not this dashboard.",
      "If ADMIN_TOTP_SECRET is still set anywhere, the security panel shows an amber notice until it is deleted. Nothing reads it — the notice exists so a stale key can't be revived later.",
      "Run the security SQL block (end of supabase/schema.sql) with the other pending blocks to upgrade rate limiting from per-instance to global.",
      "If you ever rotate ADMIN_JWT_SECRET, every admin and client session is invalidated at once — that's the emergency logout lever.",
    ],
    cost: "None.",
    value: "The CRM holds every lead, client conversation and revenue number. This pass closes the realistic attack paths (forged sessions, brute force, email bombing, clickjacking) at zero recurring cost.",
    code: "src/lib/security.ts · src/lib/auth.ts · src/lib/clientAuth.ts · /api/admin/login · /api/admin/2fa · src/lib/admin2fa.ts · src/components/admin/TwoFactorPanel.tsx · /api/portal/request-link · /api/portal/login-password · /api/contact (honeypot + rate limit) · next.config.ts (headers) · supabase/schema.sql (rate_limits) · supabase/pending-migration.sql §8 (admin_2fa)",
  },
  {
    name: "Telegram notification policy — the phone only buzzes for money",
    summary: "Three tiers so the bot stays worth reading: real events buzz, routine digests arrive silently, and config nags aren't sent at all.",
    how: [
      "LOUD (default): a captured lead, a payment, a scope accepted, a failed charge, a new subscriber, a client portal message, and the morning brief WHEN it has hot leads or 48h-silent leads. These are the ones worth interrupting you.",
      "SILENT (`sendTelegramMessage(text, buttons, { silent: true })` → Telegram's disable_notification): daily traffic stats, weekly SEO, 48h follow-up summaries, monthly client-report summaries. They land in the chat for when you look, without a buzz.",
      "NOT SENT AT ALL: config nags. daily-stats and weekly-seo used to Telegram 'GA4 not connected yet' every single day/week forever — an unset secret is a /admin/settings/integrations concern, not a push notification.",
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
      "VERCEL CRONS (vercel.json, GET, Authorization auto-injected from CRON_SECRET): daily-brief 07:00 · monthly-report 08:00 on the 1st · monthly-invoice 09:00 on the 1st (plan-overage watch — pings Telegram when a client outgrows their tier; never bills).",
      "GITHUB ACTIONS (.github/workflows/*.yml, POST via curl with the CRON_SECRET repo secret — set 2026-07-15): follow-up daily 09:30 UTC (48h lead nudge) · daily-stats 07:15 (GA4 → Telegram) · weekly-seo Monday 08:15 · client-reports 5th 08:00 (AI narrative per subscribed client) · zero-miss daily 07:00 · domain-renewals Mondays 08:00 (the 60s response guarantee — silent unless a client is owed a refund) · blog-generator Mon/Wed/Fri 08:00 · linkedin-generator Mon/Wed/Fri 07:00 · uptime every ~2h (independent of Vercel, alerts even if the site is down).",
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
    name: "Pay-per-booking — RETIRED (2026-08-13)",
    summary: "The results-only offer (€990 setup + €60/attended consultation, aesthetic-only) was retired by operator decision. One model for every niche: the client pays the installation, Servolia delivers, the subscription runs.",
    how: [
      "Why: results-contingent billing meant Servolia carried the delivery risk and the revenue arrived late and unpredictably. The doctrine is pay → deliver — cash up front, one price list, no per-niche variants, nothing to legally re-check per client.",
      "What was removed: /api/checkout-ppb (the checkout), the webhook's ppb_setup branch, the pay-per-booking half of /api/cron/monthly-invoice (its plan-overage watch survives), PAY_PER_BOOKING + payPerBookingEligible() in pricing.ts, and every marketing mention (/fr/esthetique, frGeo FAQs, onboarding).",
      "What deliberately stays: the DB tables/columns from the schema block (pay_per_booking_invoices, billing_mode, per_booking_rate_eur) — empty and harmless, dropping them risks a live DB for zero gain. The compérage note in pricing.ts also stays: it justifies the conversation meter itself.",
    ],
    use: [
      "If a prospect asks for performance-based pricing, the answer is no — point to the fixed subscription and the annual deal (installation waived). Predictability is the pitch, not apology.",
      "Never resurrect this by 'just re-adding the route' — the retirement is a pricing decision, not a technical gap.",
    ],
    cost: "None — this entry records a removal.",
    value: "One model means one funnel, one checkout, one legal posture, and no month-end attendance bookkeeping. Simple systems survive their operator's busy weeks.",
    code: "src/lib/pricing.ts (retirement note) · /api/cron/monthly-invoice (overage watch only)",
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
      "Enable invoice.payment_failed and invoice.paid on the Stripe webhook (see /admin/settings/roadmap — it will nag until it's done).",
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
      "Upgrade card: reads the client's SUBSCRIPTION tier and pitches exactly the next step — no plan sees 'start your monthly plan', Essentiel sees Croissance, Croissance sees Performance, Performance sees nothing. The CTA drops a prefilled message into the Messages tab, so every upsell lands as a warm founder-led conversation.",
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
      "Push annual prepay (two months free): a year paid up front is a year retained.",
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
    value: "Proves ROI every month. This is what justifies the monthly plan renewing.",
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
    name: "Email design system — what a Servolia email looks like",
    summary: "Every transactional email shares one branded, Outlook-safe frame: real logo, preheader, bulletproof button, dark mode, legal footer.",
    how: [
      "Rebuilt 2026-08-16. The old frame was a <div> with max-width and a CSS <span> pretending to be a logo. Both look fine in a browser and neither survives Outlook, which renders mail with Word engine: max-width is ignored so the layout goes full-bleed, and border-radius is dropped so the fake logo became a hard green square with a letter floating off-centre.",
      "The logo is now public/email-logo.png (the node-mark, rounded into real alpha since Outlook ignores border-radius), referenced by ABSOLUTE URL. Not the data URI from logoAsset.ts — Gmail strips base64 images, so the mark would vanish for most recipients. The wordmark stays live HTML text beside it, because images are blocked by default in many clients.",
      "Note: public/logo.png is a DIFFERENT brand from logo-icon.png (glossy blue-green gradient, baked-in background) and clashes with the site green. The icon mark is used on purpose.",
      "Table layout with role=presentation throughout — the only layout Outlook and Gmail both honour. One <div> survives, the hidden preheader.",
      "Preheader: the grey line the inbox shows beside the subject. All 13 templates set one, and it CONTINUES the subject rather than repeating it — they appear side by side, so echoing wastes the only free line you get.",
      "Buttons put the colour on the <td> and the padding on the <a>, so they stay buttons where <a> padding is dropped.",
      "stripHtml builds the plain-text half. It strips <style>/<script>/<head> content (a naive tag-strip opened the text part with a wall of CSS, which spam filters read as cloaking), keeps link targets, and drops image-only links and labels identical to their own href.",
      "EMAIL_REPLY_TO routes replies to an inbox you actually read. Resend SENDS mail but hosts no mailbox, so unless the From address is a real inbox somewhere, every reply is lost — and several templates say \"just reply to this email\".",
      "Broadcasts are wrapped in the same chrome plus an unsubscribe. Cold outreach is deliberately NOT — a heavy branded template to someone who never asked reads as bulk mail and costs deliverability and replies.",
    ],
    use: [
      "Preview any template with sample data at /api/admin/email-preview (add ?t=live&lang=fr, or &raw=1 for source). The logo resolves from the deployed site, so it only appears in production.",
      "Set EMAIL_REPLY_TO in Vercel to wherever you want client replies to land.",
    ],
    cost: "None. Resend free tier covers 3,000/month.",
    value: "These emails are the first thing a paying client sees after handing over money. A broken layout in Outlook or a reply that vanishes both cost more than they look like they do.",
    code: "src/lib/email.ts · public/email-logo.png · /api/admin/email-preview · /api/admin/broadcast",
  },
  {
    name: "Installable app + client push notifications",
    summary: "The client portal installs to a phone home screen and can buzz that device the moment a patient enquires.",
    how: [
      "Manifest at /manifest.webmanifest with start_url /portal — not the marketing home page. Someone who installs this is a client checking for an enquiry, not a visitor re-reading pricing they already bought from.",
      "Chrome fires beforeinstallprompt only with ALL of: HTTPS, name, short_name, start_url, display standalone, background_color, theme_color, a 512px icon AND a registered service worker with a fetch handler. Miss one and the event never fires, with nothing to explain why.",
      "THE SERVICE WORKER CACHES NO PAGES, deliberately. Cache-first would be actively harmful on a site that quotes prices, terms and a guarantee — and service-worker staleness is near-invisible to whoever deployed it. Only offline.html and two icons are cached, used only when the network has actually failed. The API is never intercepted: a replayed POST to checkout would be its own disaster.",
      "Install UI tells the truth per platform: Chrome and Android get a real button wired to the captured event, iOS gets INSTRUCTIONS because Safari has no install API at all, and an already-installed device gets nothing.",
      "Icons are generated at 192 and 512 in plain AND maskable. Android crops to a circle keeping the middle ~80 percent, so the maskable pair is inset; without them the mark loses its corners on most launchers.",
      "Push goes to the client's own devices beside the lead email, never instead of it. Email is the durable record; the push reaches someone who will not open an inbox for two hours.",
      "The notification body carries the caller's NAME only, never the message. A lock screen is readable by whoever is holding the phone, and that is a patient's enquiry.",
      "One row per DEVICE, keyed on email plus endpoint, so a phone and a tablet both buzz. Dead endpoints are pruned by row id, never by endpoint — two accounts can legitimately share an endpoint, and deleting by it would unsubscribe someone who never asked.",
      "The browser permission prompt is ONE-SHOT: a client who taps Block can never be re-asked by any code. So it fires only from an explicit click on our own button, and only once their site is live — asking on page load is how you burn the permission forever on a visit where they were busy.",
      "iOS grants push only inside an INSTALLED PWA, 16.4 and later, which is why the install shipped first.",
    ],
    use: [
      "Clients: /install or /fr/application, also linked from both footers, and nudged inside the portal from the second visit.",
      "To switch push on: npm run vapid in your own terminal — the private key never passes through Claude — then paste the three vars into Vercel, run section 9 of pending-migration.sql, and redeploy.",
      "Everything degrades quietly: with no VAPID keys the send path returns 0 instead of throwing, and the portal never offers notifications.",
    ],
    cost: "None. Web Push is free — no store fees, no review.",
    value: "The product promise is that you never miss an enquiry. Email and WhatsApp already carry it, but both land in a pile. A push reaches the phone already in the room — and the home-screen icon makes checking a glance rather than a task.",
    code: "src/app/manifest.ts · public/sw.js · public/offline.html · src/lib/push.ts · /api/portal/push · src/components/InstallApp.tsx · src/components/InstallSuggestion.tsx · src/components/PushOptIn.tsx · scripts/vapid-keys.mjs · supabase/pending-migration.sql section 9",
  },
  {
    name: "Pre-flight — can I spend money on ads today?",
    summary: "Live provider calls that answer whether traffic bought today can convert, and whether a client who pays receives what was sold.",
    how: [
      "/admin/settings/launch runs LIVE calls, not env-var presence checks. That distinction is the whole point: the two failures that cost the most money both read green on a presence check.",
      "Anthropic: a real 1-token completion. A key can be set and out of credit — which silently drops the receptionist to Cloudflare Llama 3.1 8B and leaves new client site copy as the mechanical template. Full price, degraded product, no error anywhere.",
      "Stripe: the account own charges_enabled / payouts_enabled flags via accounts.retrieveCurrent(), i.e. the real KYC verdict rather than an sk_live_ key prefix. Also surfaces requirements.currently_due, so you see exactly what Stripe is still waiting for.",
      "Stripe webhooks: reads enabled_events off every enabled endpoint. Missing checkout.session.completed means payments never reach the CRM (blocking). Missing invoice.payment_failed means a failed renewal is invisible and you keep serving a client who stopped paying (warning).",
      "Resend: lists domains and requires a VERIFIED one — an unverified domain bounces or lands in spam, so a new client first impression is silence.",
      "Every row carries blocksAds. The banner turns green only when all blockers are clear.",
    ],
    use: [
      "Run it before turning ads on, and again after changing any key in Vercel.",
      "Re-running costs one Anthropic token. Nothing else is billable.",
    ],
    cost: "One Anthropic token per run.",
    value: "Ad spend against a checkout that cannot charge, and a client onboarded onto the degraded AI, are both silent and expensive. This makes both loud before the first euro of traffic.",
    code: "src/app/api/admin/preflight/route.ts · src/components/admin/PreflightPanel.tsx · src/app/admin/settings/launch",
  },
  {
    name: "AI degradation alerts — a silent quality drop made loud",
    summary: "When Claude is unreachable or out of credit the receptionist and site-copy generator fall back. They now say so instead of logging quietly.",
    how: [
      "Two paths fall back: /api/chat drops to Cloudflare Llama 3.1 8B, and aiEnrichConfig keeps the mechanical template draft. Both used to do it on a bare console.error.",
      "Nothing broke, so nothing complained — a paying client could receive the degraded product for weeks while every dashboard read green. That is the failure mode worth watching for.",
      "reportAiFallback() sends a LOUD Telegram message. Under the notification policy a config nag is not sent at all, but this is not a nag: money already changed hands and the delivered thing is not the sold thing.",
      "Throttled to one message per hour per surface via the shared rate limiter, so a dead key during a busy afternoon costs one buzz rather than a hundred. The console line is still written every time.",
      "Detects credit exhaustion specifically (credit balance / insufficient / quota / billing) and names the fix inside the message.",
      "Alerting never throws: a broken alert must not also break the request that was still served.",
    ],
    use: ["Nothing to do — it fires on its own. Live status is at /admin/settings/launch."],
    cost: "None.",
    value: "The gap between what was sold and what was delivered used to be invisible. Now it reaches your phone within a minute of the first degraded reply.",
    code: "src/lib/aiHealth.ts · src/app/api/chat/route.ts · src/lib/generateSiteCopy.ts",
  },
  {
    name: "Settings — five sections, not one scroll",
    summary: "Setup status, secrets, costs, security and the prioritised roadmap — split into real routes you can bookmark.",
    how: [
      "Split 2026-08-13. It used to be one 218-line page: alerts, 2FA, costs, secrets and the roadmap stacked end to end, with the roadmap — the part actually read daily — at the very bottom. Now: /admin/settings (overview), /security, /integrations, /costs, /roadmap.",
      "Real routes, not client-side tabs. Each section is a link that survives a refresh, can be bookmarked, and can be pointed at from docs and error messages — which is why every 'see /admin/settings' pointer in the codebase now names its section.",
      "Tab badges come from src/app/admin/settings/_data.ts, the single place the counts are computed. A badge saying '3 missing' therefore cannot disagree with the page it points at.",
      "Overview shows only what needs a decision: Stripe not in live mode, any missing REQUIRED secret, whether Supabase is connected — then cards into each section carrying the one number that says whether it's worth opening.",
      "The roadmap page groups by status (blocked → in progress → queued) instead of one flat list, so blocked work can't hide behind queued work.",
      "Checks process.env for each integration and reports only whether a secret is SET — never its value. Detects whether Stripe is LIVE or TEST.",
    ],
    use: [
      "Admin → Settings. Anything left to do is under 'What's left', with what it's waiting on.",
      "Deep-link straight to a section: /admin/settings/security, /integrations, /costs, /roadmap.",
    ],
    cost: "None.",
    value: "You always know what's missing without digging through code — and the daily-read part is one click away instead of at the bottom of a long scroll.",
    code: "src/lib/roadmap.ts · src/app/admin/settings/{page,layout,_data}.tsx · .../security · .../integrations · .../costs · .../roadmap · src/components/admin/SettingsTabs.tsx",
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
