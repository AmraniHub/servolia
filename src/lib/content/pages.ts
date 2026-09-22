/**
 * Data-driven marketing pages (solutions + industries).
 * Add a new solution or industry by adding one entry here — the route,
 * metadata, and full page render automatically.
 */

export type IconName =
  | "globe" | "bot" | "calendar" | "dashboard" | "chart" | "shield"
  | "zap" | "clock" | "users" | "phone" | "message" | "trending"
  | "lock" | "file" | "scale" | "calculator" | "briefcase" | "search";

export interface Feature { icon: IconName; title: string; body: string }
export interface Step { title: string; body: string }
export interface FAQ { q: string; a: string }

export interface MarketingContent {
  slug: string;
  kind: "solution" | "industry";
  eyebrow: string;
  title: string;        // plain part of the H1
  highlight: string;    // gradient part of the H1
  sub: string;
  heroBullets: string[];
  metaTitle: string;
  metaDescription: string;
  withoutTitle: string;
  without: string[];
  withTitle: string;
  with: string[];
  featuresTitle: string;
  features: Feature[];
  steps: Step[];
  faqs: FAQ[];
  ctaHeadline: string;
  ctaSub: string;
}

/* ─────────────────────────── SOLUTIONS ─────────────────────────── */

const solutions: MarketingContent[] = [
  {
    slug: "ai-websites",
    kind: "solution",
    eyebrow: "Solution · AI Websites",
    title: "AI websites that turn visitors into",
    highlight: "booked clients.",
    sub: "A conversion-first website built around an AI that answers, qualifies, and books — not a brochure that just sits there. Mobile-first, GDPR-ready, live in days.",
    heroBullets: ["Conversion-focused, not decorative", "Built-in AI receptionist", "GDPR & analytics from day one"],
    metaTitle: "AI Websites for Service Businesses — Servolia",
    metaDescription: "Servolia builds conversion-first AI websites for service businesses: mobile-first, GDPR-ready, with a built-in AI receptionist that books clients 24/7. Fixed price, 7-day delivery.",
    withoutTitle: "A normal website",
    without: [
      "Looks nice but captures nothing after hours",
      "No follow-up when a visitor leaves",
      "You can't tell which page or ad drove a client",
      "Slow to load, invisible on Google",
    ],
    withTitle: "A Servolia AI website",
    with: [
      "AI answers and books visitors 24/7",
      "Every enquiry captured and scored in your CRM",
      "Full GA4 + Meta tracking on every action",
      "Fast, mobile-first, built to rank locally",
    ],
    featuresTitle: "What's inside every AI website",
    features: [
      { icon: "globe", title: "Conversion-first build", body: "5–10 pages structured around a single goal: turn the visitor into a booked enquiry, with clear CTAs on every screen." },
      { icon: "bot", title: "Built-in AI receptionist", body: "An assistant trained on your services and prices that answers questions and books appointments around the clock." },
      { icon: "chart", title: "Tracking from day one", body: "Google Analytics 4 installed and tested, so you know exactly what drives every lead." },
      { icon: "shield", title: "GDPR & legal pages", body: "Privacy policy, cookie consent, and terms written and included — compliant for the EU and US out of the box." },
    ],
    steps: [
      { title: "Free audit", body: "We review your current site and show you exactly what's costing you clients — no charge, no call required." },
      { title: "We build it", body: "Fixed scope, fixed price, fixed deadline in writing. Live in 3–5 days with you reviewing at every milestone." },
      { title: "It starts working", body: "The site goes live, the AI starts booking, and every lead lands in your CRM with a monthly performance report." },
    ],
    faqs: [
      { q: "Can you rebuild my existing website?", a: "Yes — we can rebuild it, or add the AI receptionist and tracking to your current site if it's worth keeping. We'll recommend the right option in your free audit." },
      { q: "How fast is it live?", a: "Live in 7 days from the moment your intake form is in and your installation is paid." },
      { q: "Do I own the site?", a: "Completely. All code and files transfer to you on delivery — no lock-in, no hostage hosting." },
      { q: "Is it really mobile-first?", a: "Yes. Most service-business traffic is mobile, so we design for the phone first and scale up to desktop." },
    ],
    ctaHeadline: "Ready for a website that actually books clients?",
    ctaSub: "Start with a free audit. We'll show you exactly what to change to start converting more visitors.",
  },
  {
    slug: "ai-receptionist",
    kind: "solution",
    eyebrow: "Solution · AI Receptionist",
    title: "An AI receptionist that never misses",
    highlight: "a client again.",
    sub: "Your visitors get instant answers and booked appointments at 2pm or 2am — in French or English. Every conversation becomes a scored lead in your CRM automatically.",
    heroBullets: ["Replies instantly, 24/7", "Takes every booking request", "Trained on your services"],
    metaTitle: "AI Receptionist for Service Businesses — Servolia",
    metaDescription: "An AI receptionist that answers visitors 24/7, qualifies them, books appointments, and saves every lead to your CRM. Trained on your services. Built by Servolia in days.",
    withoutTitle: "Without an AI receptionist",
    without: [
      "Calls after 6pm go to voicemail — and to competitors",
      "DMs and form fills wait hours for a reply",
      "Your team loses hours to repetitive questions",
      "No record of who asked what, or when",
    ],
    withTitle: "With the Servolia AI receptionist",
    with: [
      "Every enquiry answered in seconds, any hour",
      "Qualifies and books while you're with a client",
      "Handles FAQs so your team focuses on real work",
      "Every chat saved, scored, and followed up",
    ],
    featuresTitle: "What the AI receptionist does",
    features: [
      { icon: "message", title: "Instant, human-like replies", body: "Answers questions about services, pricing, hours, and location in natural language — in your client's language." },
      { icon: "calendar", title: "Books appointments", body: "Offers real slots and confirms the booking directly, then sends a confirmation and reminder automatically." },
      { icon: "users", title: "Qualifies every lead", body: "Asks the right questions to separate serious enquiries from tyre-kickers before they ever reach you." },
      { icon: "dashboard", title: "Feeds your CRM", body: "Every conversation becomes a lead record with a score, source, and full transcript — nothing slips through." },
    ],
    steps: [
      { title: "We train it on you", body: "Your services, prices, policies, and tone — the AI is configured to sound like your business, not a generic bot." },
      { title: "It goes live on your site", body: "Embedded on your website and ready to answer, qualify, and book from day one." },
      { title: "You get the leads", body: "Bookings hit your calendar, leads hit your CRM, and you get a monthly report on what it captured." },
    ],
    faqs: [
      { q: "Does it speak French?", a: "Yes — it answers in French or English automatically based on the visitor, and can be configured for other languages too." },
      { q: "What if it doesn't know an answer?", a: "It captures the enquiry, says a human will follow up, and notifies you instantly — so you never lose the lead." },
      { q: "Can it book into my existing calendar?", a: "Yes, we integrate booking with your calendar and CRM so confirmed appointments appear where you already work." },
      { q: "Which plans include it?", a: "All of them — the AI receptionist is included in every monthly plan, from Essentiel up. The tier decides how many conversations a month are included, not whether you get it." },
    ],
    ctaHeadline: "Stop sending after-hours clients to voicemail.",
    ctaSub: "See the AI receptionist live, then get one trained on your business in days. Start with a free audit.",
  },
  {
    slug: "booking-systems",
    kind: "solution",
    /* REWRITTEN 2026-09-22. This page sold self-scheduling into real slots,
       automatic confirmations, 48h reminders, no-show recovery, calendar sync
       and deposits. None of it exists: the product takes appointment
       REQUESTS (or hands the visitor to the practice's own Doctolib/Planity)
       and alerts the practice. Every line below is that. */
    eyebrow: "Solution · Appointment requests",
    title: "Appointment requests, day and night",
    highlight: "without the phone tag.",
    sub: "Your AI receptionist takes every appointment request on your site — name, phone, what they need — or sends the visitor straight to your Doctolib or Planity. You get it instantly, and call back when it suits you.",
    heroBullets: ["Requests taken 24/7", "Instant email + WhatsApp alert", "Every request in your portal"],
    metaTitle: "AI Appointment Requests for Service Businesses — Servolia",
    metaDescription: "Servolia's AI receptionist takes appointment requests on your website 24/7 — name, phone, need — or hands visitors to your Doctolib or Planity, and alerts you instantly.",
    withoutTitle: "Phone-only booking",
    without: [
      "Clients can only reach you when you pick up",
      "Evening and weekend enquiries go to voicemail",
      "Hours lost to calls that were only questions",
      "Lost leads when the line is busy",
    ],
    withTitle: "With the Servolia receptionist",
    with: [
      "Every request taken, day or night",
      "You are alerted the moment it arrives",
      "Questions answered without a call",
      "Every request kept in your portal with its status",
    ],
    featuresTitle: "What it does",
    features: [
      { icon: "calendar", title: "24/7 appointment requests", body: "Day or night, a visitor leaves their name, phone and what they need in under a minute — or is sent straight to your Doctolib or Planity." },
      { icon: "bot", title: "Questions answered first", body: "It answers what a front desk answers — services, hours, location — so the requests that reach you are the ones that want an appointment." },
      { icon: "clock", title: "Nothing slips", body: "Every request reaches you instantly by email with a one-tap WhatsApp reply, and waits in your portal with its status until you have called back." },
      { icon: "trending", title: "A monthly report", body: "Each month, a plain report of the conversations it held and the requests it took." },
    ],
    steps: [
      { title: "Tell us how you book", body: "Your services, your hours, your Doctolib or Planity link if you use one." },
      { title: "It goes on your site", body: "One line on your site, or the site we build for you. You try it before anything goes live." },
      { title: "Requests arrive", body: "Every request reaches you by email the moment it is taken, and lives in your portal." },
    ],
    faqs: [
      { q: "Does it book straight into my calendar?", a: "No. It takes the request and passes it to you at once — or, if you use Doctolib or Planity, sends the visitor there to pick a slot." },
      { q: "Can it take deposits?", a: "Not today." },
      { q: "Does it send patients reminders?", a: "No: it takes the request and passes it to you at once. If you use Doctolib or Planity, their reminders apply." },
      { q: "Can I try it first?", a: "Yes — type your website at servolia.com/fr/essai and it appears in your name; seven free days on your own site, no card." },
    ],
    ctaHeadline: "Never miss a request — even at midnight.",
    ctaSub: "Try the receptionist on your own site for seven days, free.",
  },
  {
    slug: "crm-dashboards",
    kind: "solution",
    eyebrow: "Solution · CRM Dashboards",
    title: "A CRM that scores your leads and shows you",
    highlight: "what's working.",
    sub: "Every lead, every source, every stage — in one dashboard with automatic scoring, a drag-and-drop pipeline, SLA alerts, and monthly reporting.",
    heroBullets: ["Auto lead scoring 0–100", "Drag-and-drop pipeline", "Monthly performance reports"],
    metaTitle: "CRM Dashboards & Lead Tracking for Service Businesses — Servolia",
    metaDescription: "Servolia builds CRM dashboards with automatic lead scoring, a drag-and-drop pipeline, SLA alerts, and monthly reporting — so service businesses know exactly what drives revenue.",
    withoutTitle: "Leads in a spreadsheet",
    without: [
      "No idea which lead to call first",
      "Enquiries forgotten until it's too late",
      "Can't tell which source drives revenue",
      "No record of what was said or sent",
    ],
    withTitle: "A Servolia CRM dashboard",
    with: [
      "Every lead scored 0–100 automatically",
      "SLA alerts when a lead goes cold",
      "Pipeline view from new to won",
      "Monthly report on sources & conversion",
    ],
    featuresTitle: "What's in the dashboard",
    features: [
      { icon: "trending", title: "Automatic lead scoring", body: "Each lead is scored 0–100 on niche, intent, and value, so your team always knows who to call first." },
      { icon: "dashboard", title: "Drag-and-drop pipeline", body: "Move leads through stages — new, qualified, booked, won — on a visual board that updates instantly." },
      { icon: "clock", title: "SLA alerts", body: "Get flagged the moment a promising lead hasn't been contacted in time, so nothing goes cold." },
      { icon: "file", title: "Monthly reporting", body: "A clear monthly report on leads, sources, conversion, and revenue attribution — no spreadsheets required." },
    ],
    steps: [
      { title: "Connect your sources", body: "Website, chatbot, ads, and forms all feed into one CRM so every enquiry lands in the same place." },
      { title: "Scoring & rules", body: "We configure lead scoring, stages, and SLA rules to match how your business qualifies and closes." },
      { title: "Run & report", body: "Your team works the pipeline daily; you get a monthly report on what's driving real revenue." },
    ],
    faqs: [
      { q: "Is the CRM included in a plan?", a: "The client portal is in every plan; the lead pipeline and the monthly report come with Croissance and up." },
      { q: "Can my team use it?", a: "Yes, the dashboard supports your team with lead routing and individual notifications." },
      { q: "How does lead scoring work?", a: "Each lead is scored on industry, contact details, stage, source, and estimated value — fully automatic." },
      { q: "Can I export my data?", a: "Always. You can export leads to CSV at any time — your data is yours." },
    ],
    ctaHeadline: "Stop guessing which leads matter.",
    ctaSub: "Get a CRM that scores your leads and shows you what drives revenue. Start with a free audit.",
  },
];

/* ─────────────────────────── INDUSTRIES ─────────────────────────── */

const industries: MarketingContent[] = [
  {
    slug: "accountants",
    kind: "industry",
    eyebrow: "For Accounting Firms",
    title: "AI client systems for",
    highlight: "accountants.",
    sub: "Turn website visitors and referrals into booked discovery calls — with an AI that answers service and pricing questions, qualifies the fit, and fills your calendar.",
    heroBullets: ["Answers service & pricing questions", "Qualifies by service & company size", "Discovery calls booked 24/7"],
    metaTitle: "AI Client Systems for Accountants & Bookkeepers — Servolia",
    metaDescription: "Servolia builds AI client acquisition systems for accounting and bookkeeping firms: instant enquiry handling, qualification, discovery-call booking, and CRM tracking.",
    withoutTitle: "How firms leak clients",
    without: [
      "Enquiries arrive at year-end and overwhelm the team",
      "Prospects want pricing answers you can't give 24/7",
      "Referrals go cold without quick follow-up",
      "No clear view of which services attract clients",
    ],
    withTitle: "With a Servolia system",
    with: [
      "Common questions answered instantly, any hour",
      "Prospects qualified by service and company size",
      "Discovery calls booked directly to your calendar",
      "Every enquiry scored and tracked to close",
    ],
    featuresTitle: "Built for accounting firms",
    features: [
      { icon: "calculator", title: "Service-aware answers", body: "The AI explains your services — bookkeeping, tax, payroll, advisory — and answers pricing-structure questions clearly." },
      { icon: "users", title: "Right-fit qualification", body: "Screens prospects by service needed, turnover, and entity type so you talk to clients you actually want." },
      { icon: "calendar", title: "Discovery-call booking", body: "Books qualified prospects into a discovery call with confirmation and reminder, no manual scheduling." },
      { icon: "dashboard", title: "Pipeline & tracking", body: "Every enquiry becomes a scored lead with source attribution, so you know which channels work." },
    ],
    steps: [
      { title: "Free audit", body: "We map how prospects find and contact you today and show where enquiries are being lost." },
      { title: "We build your system", body: "Website, AI assistant, booking, and CRM tailored to your service mix — fixed price, 7 days." },
      { title: "Calendars fill", body: "Qualified discovery calls land in your diary and a monthly report shows your best lead sources." },
    ],
    faqs: [
      { q: "Can it explain my pricing?", a: "It can explain how your pricing works (fixed-fee, monthly, by service) and qualify the prospect, leaving exact quotes to your call." },
      { q: "Does it handle seasonal spikes?", a: "Yes — the AI scales effortlessly through year-end and tax season, qualifying and booking without extra staff." },
      { q: "Will it fit my niche?", a: "Whether you serve contractors, e-commerce, or SMEs, the AI is configured around your ideal client and services." },
      { q: "How fast is delivery?", a: "A complete firm system is typically delivered in 7 business days." },
    ],
    ctaHeadline: "Book more discovery calls, automatically.",
    ctaSub: "Get an AI system that qualifies prospects and fills your calendar. Start with a free audit.",
  },
  {
    slug: "consultants",
    kind: "industry",
    eyebrow: "For Consultants & Coaches",
    title: "AI client systems for",
    highlight: "consultants.",
    sub: "Position yourself as the expert and convert interest into booked strategy calls — with an AI that qualifies prospects against your ideal-client profile around the clock.",
    heroBullets: ["Qualifies against your ICP", "Strategy calls booked 24/7", "Every lead nurtured automatically"],
    metaTitle: "AI Client Systems for Consultants & Coaches — Servolia",
    metaDescription: "Servolia builds AI client acquisition systems for consultants and coaches: ICP qualification, strategy-call booking, automated follow-up, and a CRM pipeline. Fixed price.",
    withoutTitle: "How consultants lose deals",
    without: [
      "Interested prospects book with whoever replies first",
      "Discovery calls wasted on poor-fit leads",
      "Follow-up depends on you remembering",
      "No system — feast-or-famine pipeline",
    ],
    withTitle: "With a Servolia system",
    with: [
      "Prospects engaged the moment they're interested",
      "Only ideal-fit leads reach your calendar",
      "Automated nurture keeps warm leads warm",
      "A predictable, visible pipeline",
    ],
    featuresTitle: "Built for expert practices",
    features: [
      { icon: "briefcase", title: "Authority-first site", body: "A website that positions you as the expert — outcomes, proof, and a clear path to working with you." },
      { icon: "search", title: "ICP qualification", body: "The AI screens prospects against your ideal-client profile so discovery calls are spent only on real fits." },
      { icon: "calendar", title: "Strategy-call booking", body: "Qualified prospects book a call directly, with confirmations and reminders that cut no-shows." },
      { icon: "message", title: "Automated nurture", body: "Warm-but-not-ready leads get timely follow-up automatically, so opportunities don't go cold." },
    ],
    steps: [
      { title: "Free audit", body: "We review how you attract and convert clients today and pinpoint where the pipeline leaks." },
      { title: "We build your system", body: "Positioning site, AI qualifier, booking, and CRM built around your ICP — fixed price, 7 days." },
      { title: "Calls fill up", body: "Ideal-fit strategy calls land in your calendar and a monthly report shows what's driving them." },
    ],
    faqs: [
      { q: "Can it filter out poor-fit leads?", a: "Yes — that's the point. The AI qualifies against your ideal-client criteria so you only spend time on real prospects." },
      { q: "Does it work for coaches too?", a: "Absolutely — coaches, advisors, and agencies use the same model to book qualified discovery and strategy calls." },
      { q: "Can it nurture leads who aren't ready?", a: "Yes, automated follow-up keeps warm leads engaged until they're ready to book." },
      { q: "How fast is it live?", a: "A complete system is typically delivered in 7 business days." },
    ],
    ctaHeadline: "Fill your calendar with ideal-fit clients.",
    ctaSub: "Get an AI system that qualifies prospects and books strategy calls. Start with a free audit.",
  },
];

/* ─────────────────────────── lookups ─────────────────────────── */

export const SOLUTIONS = solutions;
export const INDUSTRIES = industries;

export const SOLUTION_SLUGS = solutions.map((s) => s.slug);
export const INDUSTRY_SLUGS = industries.map((s) => s.slug);

export function getSolution(slug: string): MarketingContent | undefined {
  return solutions.find((s) => s.slug === slug);
}
export function getIndustry(slug: string): MarketingContent | undefined {
  return industries.find((s) => s.slug === slug);
}
