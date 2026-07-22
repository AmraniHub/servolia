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
  { step: "1. Attention", detail: "Ads, SEO (niche + country landing pages) and outbound bring a clinic owner to the site." },
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
    name: "Client portal (bilingual)",
    summary: "Where the client logs in to see their leads, results and billing. Full English/French with a language switch.",
    how: [
      "Magic-link or password login (client_auth).",
      "Overview: subscription, this month's stats, build status, add-ons.",
      "My leads: every enquiry the assistant handled, exportable to CSV.",
      "Reports: the monthly numbers. Messages: a direct thread with you.",
    ],
    use: ["Send them /portal/login.", "Reply to their messages in Admin → Messages."],
    cost: "None beyond hosting.",
    value: "Makes the value visible every month — the single biggest defence against churn.",
    code: "src/components/PortalDashboard.tsx · /api/portal/*",
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
