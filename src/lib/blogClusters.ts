/**
 * SEO keyword clusters the blog generator cycles through — one per run,
 * selected by `(published_count % CLUSTERS.length)` so topics don't repeat
 * for a full cycle. Mirrors Servolia's actual target niches.
 */

export interface KeywordCluster {
  niche: string;       // matches lead/build "niche" values used elsewhere
  category: string;    // Post.category shown on the blog index
  keyword: string;      // primary SEO keyword/phrase to target
  angle: string;        // the specific angle Claude should write from
}

export const CLUSTERS: KeywordCluster[] = [
  { niche: "dental", category: "Dental", keyword: "AI receptionist for dental clinics", angle: "How an AI receptionist handles after-hours patient calls and books appointments automatically" },
  { niche: "dental", category: "Dental", keyword: "dental clinic missed calls cost", angle: "The real revenue lost per missed call at a dental practice, with a simple way to estimate it" },
  { niche: "aesthetic", category: "Aesthetic Clinics", keyword: "med spa booking system", angle: "Why online booking with AI qualification converts more consultations for aesthetic clinics" },
  { niche: "aesthetic", category: "Aesthetic Clinics", keyword: "aesthetic clinic lead qualification", angle: "How to filter high-intent aesthetic clinic leads from tyre-kickers before they reach the front desk" },
  { niche: "real-estate", category: "Real Estate", keyword: "real estate agent lead response time", angle: "Why response speed decides who wins a real estate lead, and how AI cuts it to seconds" },
  { niche: "real-estate", category: "Real Estate", keyword: "real estate CRM for agents", angle: "What a lightweight CRM with lead scoring actually changes for a solo or small-team agent" },
  { niche: "home-services", category: "Home Services", keyword: "HVAC emergency call answering service", angle: "Why home-service businesses lose emergency jobs to whoever answers first, and how AI dispatch fixes it" },
  { niche: "home-services", category: "Home Services", keyword: "contractor booking software", angle: "How online quote requests and automated follow-up fill a contractor's schedule without more ad spend" },
  { niche: "law-firm", category: "Law Firms", keyword: "law firm client intake automation", angle: "How structured AI intake screens case enquiries before they reach a lawyer's desk" },
  { niche: "law-firm", category: "Law Firms", keyword: "law firm missed consultation calls", angle: "Why a slow intake process loses high-value clients to a faster competing firm" },
  { niche: "accountants", category: "Accounting", keyword: "accounting firm client acquisition", angle: "How accounting firms handle the year-end enquiry surge without hiring more front-desk staff" },
  { niche: "accountants", category: "Accounting", keyword: "bookkeeping firm discovery call booking", angle: "Why an AI-qualified discovery call converts better than a generic contact form for accounting firms" },
  { niche: "consultants", category: "Consulting", keyword: "consultant lead qualification ICP", angle: "How to filter for ideal-client-profile fit automatically so strategy calls aren't wasted on poor fits" },
  { niche: "consultants", category: "Consulting", keyword: "coach client booking system", angle: "Why coaches and consultants lose warm leads to slow follow-up, and how automated nurture fixes it" },
  { niche: "general", category: "AI Systems", keyword: "AI receptionist vs answering service", angle: "A practical comparison of AI receptionists versus traditional human answering services for small businesses" },
  { niche: "general", category: "AI Systems", keyword: "cost of a missed enquiry calculator", angle: "A simple framework any service business can use to calculate what a missed enquiry actually costs them" },
];

export function pickCluster(publishedCount: number): KeywordCluster {
  return CLUSTERS[publishedCount % CLUSTERS.length];
}
