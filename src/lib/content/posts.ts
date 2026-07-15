/**
 * Data-driven blog / insights.
 * Add an article by adding one entry here — route, metadata, index card,
 * and sitemap entry update automatically.
 */

import { pollinationsImageUrl } from "@/lib/pollinations";

export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "callout"; text: string };

export interface Post {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readingMinutes: number;
  publishedAt: string;   // ISO date
  metaTitle: string;
  metaDescription: string;
  ctaHeadline: string;
  body: Block[];
  related: string[];     // slugs
  coverImageUrl?: string;
}

const posts: Post[] = [
  {
    slug: "dental-clinic-losing-patients-after-hours",
    title: "Why your dental clinic is losing patients after 6pm — and how AI fixes it",
    excerpt:
      "Most practices are full during the day and invisible after it. Here's where after-hours patients actually go, and how a 24/7 AI receptionist captures them instead.",
    category: "Dental",
    coverImageUrl: pollinationsImageUrl("Dental", "evening, dusk, closed sign"),
    readingMinutes: 6,
    publishedAt: "2026-06-20",
    metaTitle: "Why Dental Clinics Lose Patients After Hours (And the AI Fix)",
    metaDescription:
      "After-hours calls and messages are where dental clinics quietly lose patients. Learn how a 24/7 AI receptionist captures and books them automatically.",
    ctaHeadline: "Stop sending evening patients to voicemail.",
    body: [
      { type: "p", text: "A dental practice can be fully booked during the day and still lose a steady stream of new patients — because the moment that matters most often happens after the lights go off. Someone with a broken crown, a sudden ache, or a long-postponed implant decision picks up their phone at 8pm. They call. No answer. They move to the next clinic on Google." },
      { type: "p", text: "This isn't a marketing problem. The patient already found you. It's a capture problem: there's no one and nothing to answer at the exact moment intent is highest." },
      { type: "h2", text: "Where after-hours patients actually go" },
      { type: "p", text: "When a prospective patient can't reach you, they rarely wait until morning. High-intent dental enquiries — pain, cosmetic decisions, implant consultations — are emotional and time-sensitive. The patient keeps scrolling and contacts whoever responds first." },
      { type: "ul", items: [
        "Evenings and weekends are when working patients finally have time to deal with their teeth.",
        "A missed first contact rarely calls back — they've already messaged a competitor.",
        "The highest-value cases (implants, full-mouth, cosmetic) are exactly the ones patients research at night.",
      ]},
      { type: "quote", text: "The clinic with the best dentistry doesn't always win the patient. Often, the clinic that answered first does." },
      { type: "h2", text: "What a 24/7 AI receptionist changes" },
      { type: "p", text: "An AI receptionist sits on your website and answers instantly, any hour. Trained on your treatments, prices, and booking rules, it does the job your front desk does — at the moments your front desk is closed." },
      { type: "ul", items: [
        "Answers common questions: do you do implants, how much is a consultation, are you open Saturday.",
        "Qualifies the enquiry so you know whether it's a cleaning or a €6,000 case.",
        "Offers a real appointment slot and books it, then sends a confirmation and reminder.",
        "Logs every conversation as a scored lead so nothing is forgotten by morning.",
      ]},
      { type: "h2", text: "Why this beats a contact form" },
      { type: "p", text: "A contact form is a one-way message into a void. The patient fills it in, hears nothing for hours, and books elsewhere. An AI receptionist is a conversation that ends in a booked appointment — the difference between collecting an email and filling a chair." },
      { type: "callout", text: "Rule of thumb: every hour a high-intent dental enquiry waits for a reply, the odds of converting it drop sharply. After-hours, the wait is the whole night — unless something answers." },
      { type: "h2", text: "The practical setup" },
      { type: "p", text: "You don't need to rebuild your practice management software. The AI receptionist lives on your website, books into your calendar, and feeds a simple CRM so your team sees every new patient enquiry in one place — with a confirmation and reminder already sent." },
      { type: "p", text: "The result is quiet but compounding: the patients who used to vanish after 6pm now show up in your schedule the next morning." },
    ],
    related: ["ai-receptionist-clinics-what-it-does", "real-cost-of-a-missed-enquiry"],
  },
  {
    slug: "ai-receptionist-clinics-what-it-does",
    title: "AI receptionists for clinics: what they actually do in 2026",
    excerpt:
      "Cut through the hype. Here's a plain-English breakdown of what an AI receptionist does for a clinic, what it doesn't, and where it fits alongside your team.",
    category: "AI Systems",
    coverImageUrl: pollinationsImageUrl("AI Systems", "friendly digital assistant concept, clinic setting"),
    readingMinutes: 7,
    publishedAt: "2026-06-12",
    metaTitle: "AI Receptionists for Clinics: What They Actually Do (2026)",
    metaDescription:
      "A plain-English guide to what an AI receptionist does for clinics — answering, qualifying, booking — what it doesn't do, and how it works with your team.",
    ctaHeadline: "See an AI receptionist built for your clinic.",
    body: [
      { type: "p", text: "\"AI receptionist\" has become a catch-all phrase, and that vagueness makes it easy to dismiss. So let's be concrete. For a clinic, an AI receptionist is a trained assistant on your website that handles the first conversation with a prospective patient — and turns it into a booking." },
      { type: "h2", text: "What it does" },
      { type: "ol", items: [
        "Answers instantly. No hold music, no voicemail — replies in seconds, day or night, in the patient's language.",
        "Answers correctly. It's trained on your treatments, prices, hours, and policies, so it speaks for your clinic, not in generic terms.",
        "Qualifies. It asks the right questions to tell a routine enquiry from a high-value case, and routes accordingly.",
        "Books. It offers genuine availability and confirms the appointment, then sends a confirmation and a reminder.",
        "Records. Every conversation becomes a lead in your CRM with a score, a source, and a full transcript.",
      ]},
      { type: "h2", text: "What it doesn't do" },
      { type: "p", text: "An AI receptionist is not a replacement for clinical judgement or for your team's relationships with patients. It doesn't give medical advice, and it shouldn't pretend to be human. Done well, it's transparent about being an assistant — and it hands off to a person whenever a question goes beyond what it's been trained on." },
      { type: "quote", text: "The goal isn't to remove humans from your clinic. It's to stop losing patients in the gap between their question and your team's availability." },
      { type: "h2", text: "Where it fits with your team" },
      { type: "p", text: "Think of it as the layer that catches everything your front desk can't: the after-hours enquiries, the repetitive pricing questions, the overflow when the phone is ringing during a busy clinic. Your team keeps doing the high-value human work; the AI absorbs the volume that used to slip through." },
      { type: "ul", items: [
        "During opening hours: handles overflow and FAQs so the phone line stays free for complex calls.",
        "After hours: becomes the only thing standing between a high-intent patient and a competitor.",
        "Always: makes sure every enquiry is captured, scored, and followed up — none forgotten.",
      ]},
      { type: "h2", text: "How to evaluate one" },
      { type: "p", text: "If you're considering an AI receptionist, judge it on three things: whether it's actually trained on your specifics, whether it can book a real appointment (not just collect an email), and whether every conversation lands in a system you can see. Anything less is a chatbot, not a receptionist." },
      { type: "callout", text: "A useful test: ask the demo a real patient question with a price in it. If it answers naturally and offers to book, it's doing the job. If it deflects to a form, it isn't." },
    ],
    related: ["dental-clinic-losing-patients-after-hours", "booking-systems-vs-contact-forms"],
  },
  {
    slug: "real-cost-of-a-missed-enquiry",
    title: "The real cost of a missed enquiry for a service business",
    excerpt:
      "A missed call feels like nothing. Multiply it across a month and a realistic client value, and it's often the single biggest line item your P&L never shows.",
    category: "Growth",
    coverImageUrl: pollinationsImageUrl("Growth", "declining line on a small business ledger, subtle"),
    readingMinutes: 5,
    publishedAt: "2026-06-04",
    metaTitle: "The Real Cost of a Missed Enquiry for Service Businesses",
    metaDescription:
      "Missed calls and slow replies are invisible on your P&L but expensive in reality. Here's how to estimate what missed enquiries cost — and how to recover them.",
    ctaHeadline: "See what missed enquiries are costing you.",
    body: [
      { type: "p", text: "Most service businesses track what they spend and what they earn. Almost none track what they miss. Yet for a clinic, a law firm, or a home-services company, missed enquiries are often the largest hidden cost in the business — invisible precisely because nothing was recorded." },
      { type: "h2", text: "A simple way to estimate it" },
      { type: "p", text: "You don't need perfect data. Three rough numbers get you a defensible estimate:" },
      { type: "ol", items: [
        "How many enquiries you get per month — calls, form fills, and messages combined.",
        "How many you realistically miss or fail to follow up — after-hours, busy lines, slow replies.",
        "What one new client is worth to you on average.",
      ]},
      { type: "p", text: "Multiply the missed enquiries by a conservative close rate, then by your average client value. The number is usually uncomfortable — because each missed enquiry isn't a small loss, it's a fraction of a client you already attracted and then dropped." },
      { type: "quote", text: "You already paid to generate the enquiry. Missing it doesn't just cost a sale — it wastes the marketing that created it." },
      { type: "h2", text: "Why missed enquiries cluster where you can't see them" },
      { type: "ul", items: [
        "After hours: the single biggest leak, because intent is high and your office is closed.",
        "Peak times: when the phone rings while your team is already serving someone.",
        "Follow-up: leads that came in fine but were never chased after the first contact.",
      ]},
      { type: "h2", text: "Recovering them is cheaper than generating new ones" },
      { type: "p", text: "Here's the leverage: recovering missed enquiries doesn't require more ad spend or more traffic. It requires capturing demand you're already creating. A 24/7 AI system that answers, qualifies, and books closes the gap where the leaks happen — after hours, at peak times, and in follow-up." },
      { type: "callout", text: "The cheapest growth available to most service businesses isn't more leads. It's not losing the ones they already have." },
      { type: "p", text: "Before spending another euro on ads, it's worth modelling what you're already losing. Often the recovery alone pays for the system many times over." },
    ],
    related: ["booking-systems-vs-contact-forms", "ai-receptionist-clinics-what-it-does"],
  },
  {
    slug: "booking-systems-vs-contact-forms",
    title: "Booking systems vs. contact forms: why self-scheduling wins",
    excerpt:
      "A contact form asks the client to wait. A booking system lets them commit. That difference quietly decides how many enquiries become appointments.",
    category: "Booking",
    coverImageUrl: pollinationsImageUrl("Booking", "self-service, tapping a confirmed appointment"),
    readingMinutes: 5,
    publishedAt: "2026-05-26",
    metaTitle: "Booking Systems vs. Contact Forms: Why Self-Scheduling Wins",
    metaDescription:
      "Contact forms create a waiting gap where clients drop off. Learn why 24/7 self-scheduling converts more enquiries into booked appointments for service businesses.",
    ctaHeadline: "Let clients book themselves, 24/7.",
    body: [
      { type: "p", text: "The contact form is the default on almost every service-business website. It's also where a surprising share of ready-to-buy clients quietly disappear. The problem isn't the form itself — it's the gap it creates between intent and action." },
      { type: "h2", text: "The waiting gap" },
      { type: "p", text: "When a client fills in a contact form, they've done their part and now have to wait — for a callback, an email, a slot to be offered. In that wait, momentum dies. They get busy, they cool off, or they book with a competitor who let them schedule on the spot." },
      { type: "quote", text: "Every step you add between intent and a confirmed appointment is a step where a client can leave." },
      { type: "h2", text: "What self-scheduling does differently" },
      { type: "p", text: "A booking system collapses the gap. The client picks a real slot, confirms, and walks away with an appointment — while their intent is still hot. There's no waiting, no phone tag, no second decision to make later." },
      { type: "ul", items: [
        "Available 24/7, so the client books when it suits them — including the evenings and weekends your office is closed.",
        "Instant confirmation and reminders, which cut no-shows.",
        "AI qualification first, so the right enquiries reach the right slots.",
        "Every booking logged automatically, with the source attached.",
      ]},
      { type: "h2", text: "When a form is still fine" },
      { type: "p", text: "Forms aren't useless. For genuinely complex enquiries — a bespoke quote, a sensitive legal matter — a short form that routes to a human can be the right first step. The mistake is using a form as the default for everything, including the simple bookings that a client would happily make themselves in thirty seconds." },
      { type: "callout", text: "A good rule: if the next step is a standard appointment, let the client book it. Reserve forms for the cases that truly need a human to scope first." },
      { type: "h2", text: "The combined approach" },
      { type: "p", text: "The strongest setup uses both: an AI receptionist to answer and qualify, self-scheduling to capture the straightforward bookings instantly, and a routed form for the complex enquiries that need a person. The result is fewer drop-offs and a calendar that fills itself." },
    ],
    related: ["real-cost-of-a-missed-enquiry", "dental-clinic-losing-patients-after-hours"],
  },
];

/* ─────────────────────────── lookups ─────────────────────────── */

export const POSTS = [...posts].sort(
  (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
);

export const POST_SLUGS = posts.map((p) => p.slug);

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

export function getRelated(slugs: string[]): Post[] {
  return slugs.map((s) => posts.find((p) => p.slug === s)).filter(Boolean) as Post[];
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
