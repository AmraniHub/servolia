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
      { q: "How fast is it live?", a: "Most AI websites go live in 3–5 business days from the moment your intake form and deposit are in." },
      { q: "Do I own the site?", a: "Completely. All code and files transfer to you on final payment — no lock-in, no hostage hosting." },
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
    heroBullets: ["Replies instantly, 24/7", "Books straight into your calendar", "Trained on your services & prices"],
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
      { q: "Is it on the Booking and Client systems?", a: "Yes — the AI receptionist is included in both the AI Booking System and the full Client System." },
    ],
    ctaHeadline: "Stop sending after-hours clients to voicemail.",
    ctaSub: "See the AI receptionist live, then get one trained on your business in days. Start with a free audit.",
  },
  {
    slug: "booking-systems",
    kind: "solution",
    eyebrow: "Solution · Booking Systems",
    title: "Online booking that fills your calendar",
    highlight: "while you work.",
    sub: "Let clients self-schedule 24/7, with automated confirmations, reminders, and no-show recovery — so your diary stays full without the phone tag.",
    heroBullets: ["Self-scheduling 24/7", "Automated reminders & follow-up", "Synced to your CRM & calendar"],
    metaTitle: "AI Booking Systems for Service Businesses — Servolia",
    metaDescription: "Servolia builds online booking systems with AI qualification, automated confirmations, reminders, and no-show recovery — synced to your CRM. Fixed price, fast delivery.",
    withoutTitle: "Phone-only booking",
    without: [
      "Clients can only book when you pick up",
      "No-shows because nobody sent a reminder",
      "Hours lost to scheduling back-and-forth",
      "Lost leads when the line is busy",
    ],
    withTitle: "A Servolia booking system",
    with: [
      "Clients book themselves, day or night",
      "Automatic confirmation + 48h reminder",
      "No-show recovery follow-up built in",
      "Every booking tracked in your CRM",
    ],
    featuresTitle: "What's in the booking system",
    features: [
      { icon: "calendar", title: "24/7 self-scheduling", body: "A clean booking flow on your site lets clients pick a real slot and confirm in under a minute." },
      { icon: "bot", title: "AI qualification first", body: "The AI checks the enquiry is a fit and routes it correctly before it ever takes a slot in your calendar." },
      { icon: "clock", title: "Reminders & recovery", body: "Automated confirmations, 48-hour reminders, and gentle follow-up for no-shows keep your diary full." },
      { icon: "trending", title: "Source tracking", body: "See which ad, post, or page drove each booking so you can double down on what actually works." },
    ],
    steps: [
      { title: "Map your services", body: "We set up your services, durations, availability, and rules so the booking flow matches how you actually work." },
      { title: "Connect & automate", body: "We wire up confirmations, reminders, calendar sync, and CRM logging — then test the whole flow end to end." },
      { title: "Go live & fill up", body: "Clients start self-booking 24/7, and you get a monthly report on bookings, sources, and no-show rate." },
    ],
    faqs: [
      { q: "Does it integrate with my calendar?", a: "Yes — confirmed bookings sync to your calendar so you manage everything in one place." },
      { q: "Can it handle deposits?", a: "Yes, we can add a deposit step via Stripe to reduce no-shows for higher-value appointments." },
      { q: "What about reminders?", a: "Automated email confirmations and reminders are included; SMS/WhatsApp reminders can be added." },
      { q: "How long to set up?", a: "The booking system is typically live in 4–5 business days as part of the AI Booking System." },
    ],
    ctaHeadline: "Let clients book themselves — even at midnight.",
    ctaSub: "Get a booking system that fills your calendar without the phone tag. Start with a free audit.",
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
      { q: "Is the CRM included in a package?", a: "Yes — the full CRM dashboard, pipeline, and reporting are part of the Client System." },
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
    slug: "lawyers",
    kind: "industry",
    eyebrow: "For Law Firms",
    title: "AI client systems for",
    highlight: "law firms.",
    sub: "Qualified case enquiries answered instantly, screened against your criteria, and booked for a consultation — so no high-value client slips away to a faster firm.",
    heroBullets: ["Instant case intake 24/7", "Conflict-aware qualification", "Consultations booked automatically"],
    metaTitle: "AI Lead Systems for Law Firms — Servolia",
    metaDescription: "Servolia builds AI client acquisition systems for law firms: instant case intake, AI qualification, consultation booking, and a CRM pipeline. Fixed price, 7-day delivery.",
    withoutTitle: "How firms lose clients",
    without: [
      "A potential client calls after hours and gets voicemail",
      "Intake takes days, so they retain a faster firm",
      "Qualified enquiries get no structured follow-up",
      "No view of which marketing drives real cases",
    ],
    withTitle: "With a Servolia system",
    with: [
      "Case enquiries answered and screened instantly",
      "Consultations booked directly into your diary",
      "Every enquiry tracked and followed up on time",
      "Clear reporting on cost per qualified case",
    ],
    featuresTitle: "Built for legal client acquisition",
    features: [
      { icon: "scale", title: "Structured intake", body: "The AI gathers the matter type, urgency, and key facts up front, so consultations start with the information you need." },
      { icon: "bot", title: "Screening & qualification", body: "Filters enquiries against your practice areas and criteria, flagging the matters worth your time." },
      { icon: "calendar", title: "Consultation booking", body: "Books qualified prospects straight into your calendar with confirmations and reminders." },
      { icon: "lock", title: "Confidential & compliant", body: "GDPR-ready intake with secure handling of sensitive enquiry data, and clear privacy terms included." },
    ],
    steps: [
      { title: "Free audit", body: "We review how enquiries reach your firm today and show where high-value clients are being lost." },
      { title: "We build your system", body: "Website, AI intake, booking, and CRM — configured for your practice areas in 7 days, fixed price." },
      { title: "Cases come to you", body: "Qualified consultations land in your diary and a monthly report shows your cost per acquired case." },
    ],
    faqs: [
      { q: "Can it handle multiple practice areas?", a: "Yes — the AI routes enquiries by matter type so family, corporate, or property leads each follow the right intake." },
      { q: "Is sensitive data handled securely?", a: "Yes. Intake is GDPR-ready with secure data handling and clear privacy terms; we don't ask for unnecessary detail." },
      { q: "Does it replace my staff?", a: "No — it handles first response and qualification so your team spends time on cases, not phone tag." },
      { q: "How fast is it live?", a: "A full firm system is typically delivered in 7 business days." },
    ],
    ctaHeadline: "Stop losing cases to faster firms.",
    ctaSub: "Get an AI intake and booking system built for your practice areas. Start with a free audit.",
  },
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
