import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VideoEmbed from "@/components/VideoEmbed";
import Link from "next/link";
import { ArrowRight, FileText, Video, CreditCard, ClipboardList, Hammer, Eye, Rocket, BarChart3, MessageSquare, CheckCircle } from "lucide-react";
import type { Metadata } from "next";
import ValueStack from "@/components/ValueStack";
import Guarantee from "@/components/Guarantee";

const DEMO_VIDEO_ID = process.env.NEXT_PUBLIC_DEMO_VIDEO_ID;

export const metadata: Metadata = {
  title: "How It Works — Servolia",
  description: "From free audit to live AI system in 7 days. See the exact Servolia delivery process — what happens, when, and what you need to do.",
  alternates: {
    canonical: "https://servolia.com/how-it-works",
    languages: {
      "en-US": "https://servolia.com/how-it-works",
      "fr-FR": "https://servolia.com/fr/comment-ca-marche",
      "x-default": "https://servolia.com/how-it-works",
    },
  },
};

const steps = [
  {
    num: "01",
    icon: <FileText className="w-5 h-5" />,
    title: "You request a free audit",
    who: "You",
    time: "5 minutes",
    desc: "Fill the audit form at /free-audit. Tell us your business type, biggest problem, and current website URL. No phone call required.",
    detail: "We ask for 8 fields: your business name, website, country, industry, biggest problems (multi-select), average client value, email, and phone. That's it.",
    color: "from-[#36671E] to-[#295115]",
  },
  {
    num: "02",
    icon: <Video className="w-5 h-5" />,
    title: "We send your Loom audit within 24h",
    who: "Servolia",
    time: "Within 24 hours",
    desc: "We record a 5-minute screen video walking through your current online presence — showing exactly what's costing you clients and what we'd fix.",
    detail: "This isn't a template. We look at your site, your Google Maps listing, your competitors in the same city, and your booking/contact flow. You get specific observations, not generic advice.",
    color: "from-[#295115] to-[#6B8439]",
  },
  {
    num: "03",
    icon: <MessageSquare className="w-5 h-5" />,
    title: "Optional 15-min discovery call",
    who: "You (optional)",
    time: "Your choice",
    desc: "If you want to discuss the audit, ask questions, or get more detail — we're available. If the audit is enough to convince you, you can skip straight to step 4.",
    detail: "No hard sell. If Servolia is the right fit, it's obvious from the audit. We don't chase or pressure. If you're ready, we send the scope document.",
    color: "from-[#059669] to-[#10B981]",
  },
  {
    num: "04",
    icon: <FileText className="w-5 h-5" />,
    title: "Scope confirmed in writing",
    who: "Servolia",
    time: "Same day",
    desc: "We send a 1-page scope document: exactly what we build, what's not included, the fixed price, and the delivery deadline. You approve it before paying anything.",
    detail: "This protects you. Scope creep is impossible because everything is agreed in writing first. If you want to add something later, we price it separately — no surprises.",
    color: "from-[#F59E0B] to-[#EF4444]",
  },
  {
    num: "05",
    icon: <CreditCard className="w-5 h-5" />,
    title: "50% deposit via Stripe",
    who: "You",
    time: "2 minutes",
    desc: "Pay your 50% deposit through our Stripe checkout. You get an instant receipt, and the build starts the next working day.",
    detail: "We accept all major cards. EUR and USD supported. Your payment is protected by Stripe — the most trusted payment infrastructure in the world. The remaining 50% is due only on delivery.",
    color: "from-[#6366F1] to-[#8B5CF6]",
  },
  {
    num: "06",
    icon: <ClipboardList className="w-5 h-5" />,
    title: "You complete the intake form",
    who: "You",
    time: "8 minutes",
    desc: "Immediately after payment, you're redirected to a 5-step intake form: business info, branding, services, goals, and technical setup.",
    detail: "We ask for your logo (Google Drive link is fine), brand colors, services with prices, target client description, 3 competitors, domain name, and language preference. The more detail you give, the less back-and-forth we need.",
    color: "from-[#EC4899] to-[#F43F5E]",
  },
  {
    num: "07",
    icon: <Hammer className="w-5 h-5" />,
    title: "We build your system",
    who: "Servolia",
    time: "3–7 days",
    desc: "Our team builds using our proven 22-step delivery checklist. Every system goes through QA before you see it — mobile testing, speed check, form testing, GDPR review.",
    detail: "We use Next.js, Cloudflare Workers AI for the chatbot, Vercel for hosting, and Stripe for payments. Your system is fast, secure, and built to last — not a WordPress template.",
    color: "from-[#36671E] to-[#295115]",
  },
  {
    num: "08",
    icon: <Eye className="w-5 h-5" />,
    title: "Loom walkthrough of your draft",
    who: "Servolia",
    time: "Day 3–5",
    desc: "We record a full walkthrough of your draft — page by page, feature by feature. You see everything before we ask for final payment.",
    detail: "This is where you give feedback. We include one round of revisions in every package. You can request copy changes, design adjustments, and feature tweaks. Major scope changes are quoted separately.",
    color: "from-[#06B6D4] to-[#3B82F6]",
  },
  {
    num: "09",
    icon: <CreditCard className="w-5 h-5" />,
    title: "Final payment → go live",
    who: "You",
    time: "Day 5–7",
    desc: "Once you're happy with the draft, we send a Stripe Payment Link for the remaining 50%. Payment clears → we go live within 24 hours.",
    detail: "Going live includes: domain connection, SSL setup, final testing on mobile and desktop, Google Analytics activation, and chatbot activation.",
    color: "from-[#059669] to-[#10B981]",
  },
  {
    num: "10",
    icon: <Rocket className="w-5 h-5" />,
    title: "Your system is live",
    who: "Both",
    time: "Day 7",
    desc: "Your AI system is live, tested, and receiving traffic. We send a launch email with your login credentials, baseline stats, and what to expect in the first 30 days.",
    detail: "Most clients see their first online lead or booking within 48 hours of going live. The AI receptionist starts answering enquiries from day one — even at 2am.",
    color: "from-[#F59E0B] to-[#EF4444]",
  },
  {
    num: "11",
    icon: <BarChart3 className="w-5 h-5" />,
    title: "Monthly care plan activates",
    who: "Servolia",
    time: "Day 30",
    desc: "On day 30, your monthly plan charges automatically via Stripe. This covers hosting, uptime monitoring, chatbot retraining, and your monthly report.",
    detail: "You receive a 1-page PDF on the 5th of each month showing: leads captured, bookings made, top traffic source, chatbot conversations, and one improvement recommendation for next month.",
    color: "from-[#36671E] to-[#295115]",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <Navbar />
      <main>
        {/* HERO */}
        <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-[#FAFAF7]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">The Process</p>
            <h1 className="text-4xl sm:text-5xl font-black text-[#18181B] leading-tight mb-5">
              Audit to live AI system.{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#295115] bg-clip-text text-transparent">
                In 7 days.
              </span>
            </h1>
            <p className="text-[#52525B] text-lg max-w-2xl mx-auto mb-8">
              A fixed process, a fixed price, and a fixed deadline — confirmed in writing before you pay a single cent.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-[#71717A]">
              {["Free audit → no commitment", "Scope in writing first", "50% deposit to start", "Balance only on delivery", "Live in 7 days or money back"].map((t, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-[#36671E]" />{t}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* VIDEO — only renders once a real explainer is recorded and NEXT_PUBLIC_DEMO_VIDEO_ID is set */}
        {DEMO_VIDEO_ID && (
          <section className="pb-16 lg:pb-20 bg-[#FAFAF7]">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <VideoEmbed videoId={DEMO_VIDEO_ID} title="Watch the AI receptionist handle a real enquiry" />
            </div>
          </section>
        )}

        {/* STEPS */}
        <section className="py-16 lg:py-24 bg-[#FAFAF7]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-[#36671E]/50 via-[#ABDF90]/20 to-transparent hidden md:block" />

              <div className="space-y-6">
                {steps.map((s, i) => (
                  <div key={i} className="relative flex gap-6">
                    {/* Icon */}
                    <div className={`hidden md:flex w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} items-center justify-center text-[#FAFAF7] shrink-0 shadow-md z-10`}>
                      {s.icon}
                    </div>

                    {/* Card */}
                    <div className="flex-1 bg-white rounded-2xl border border-[#E8E6E0] p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-black text-[#52525B] tracking-widest">{s.num}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${s.color} text-[#FAFAF7]`}>{s.who}</span>
                          </div>
                          <h3 className="text-base font-black text-[#080E1C]">{s.title}</h3>
                        </div>
                        <span className="text-xs font-medium text-[#71717A] bg-[#FAFAF7] border border-[#E8E6E0] px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap">{s.time}</span>
                      </div>
                      <p className="text-sm text-[#374151] mb-2 leading-relaxed">{s.desc}</p>
                      <p className="text-xs text-[#71717A] leading-relaxed">{s.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ STRIP */}
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black text-[#080E1C] mb-8 text-center">Questions about the process</h2>
            <div className="grid md:grid-cols-2 gap-5">
              {[
                { q: "Do I need to write the website copy?", a: "No. We write everything from your intake form answers. You review and approve before launch." },
                { q: "What if I don't have a logo?", a: "That's fine. We'll work with what you have or suggest a simple wordmark that matches your style." },
                { q: "Can I request changes after seeing the draft?", a: "Yes — one full round of revisions is included in every package. Major scope additions are quoted separately." },
                { q: "What language is the site built in?", a: "Your choice: French, English, or both. We're bilingual and have delivered sites in both." },
                { q: "Who hosts the website?", a: "We host it on Vercel (the same infrastructure powering major global platforms) through your monthly care plan." },
                { q: "What if you miss the deadline?", a: "Our CGV guarantees 10% of your payment back per day late if we miss through our own fault." },
              ].map((faq, i) => (
                <div key={i} className="p-5 rounded-2xl bg-[#FAFAF7] border border-[#E8E6E0]">
                  <h3 className="text-sm font-black text-[#080E1C] mb-2">{faq.q}</h3>
                  <p className="text-sm text-[#71717A] leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-[#FAFAF7]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl font-black text-[#18181B] mb-4">Ready to start?</h2>
            <p className="text-[#52525B] mb-8">Step 1 takes 5 minutes and costs nothing.</p>
            <Link href="/free-audit"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black hover:opacity-90 transition-opacity">
              Request my free audit <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-[#A1A1AA] mt-4">No call required · Loom sent within 24h · No credit card</p>
          </div>
        </section>
      </main>
      <ValueStack />
      <Guarantee />
      <Footer />
    </>
  );
}
