import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CheckoutButton from "@/components/CheckoutButton";
import CarePlansSection from "@/components/CarePlansSection";
import { SETUP_PLAN, PLANS } from "@/lib/pricing";
import Guarantee from "@/components/Guarantee";
import Link from "next/link";
import {
  CheckCircle, ArrowRight, Shield, Clock, Zap,
  Globe, Bot, Building2,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Servolia",
  description: "One €490 installation, then €149–€449/month all-in: site, 24/7 AI receptionist, hosting, domain and pro email. Pay yearly and get two months free.",
  alternates: {
    canonical: "https://servolia.com/pricing",
    languages: {
      "en-US": "https://servolia.com/pricing",
      "fr-FR": "https://servolia.com/fr/tarifs",
      "x-default": "https://servolia.com/pricing",
    },
  },
};


const process = [
  { num: "01", title: "Free audit", desc: "Fill a 5-question form. We send a PDF audit within 24h." },
  { num: "02", title: "Approve scope", desc: "We write the full scope in writing. You review and sign off." },
  { num: "03", title: "€490 installation", desc: "Pay the installation via Stripe to start — waived if you pay the first year up front." },
  { num: "04", title: "We build", desc: "7-day build. You get Loom walkthroughs at every step." },
  { num: "05", title: "Review + launch", desc: "You review, approve, and your monthly plan starts. We go live and hand over everything." },
];

export default function PricingPage() {
  return (
    <main className="flex flex-col bg-white">
      <Navbar />

      {/* ── HERO ── */}
      <section className="bg-[#FAFAF7] pt-28 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Pricing</p>
          <h1 className="text-4xl sm:text-5xl font-black text-[#18181B] mb-4 leading-tight">
            Choose the plan{" "}
            <span className="gradient-text">your business needs.</span>
          </h1>
          <p className="text-[#52525B] text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            One installation fee, then a monthly plan that keeps answering your patients.
            Fixed price, clear scope, cancel any time.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#52525B]">
            <div className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-[#059669]" /> GDPR compliant</div>
            <div className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#36671E]" /> Fixed delivery date</div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-[#635bff] flex items-center justify-center">
                <span className="text-white text-[7px] font-black">S</span>
              </div>
              €490 installation via Stripe
            </div>
            <div className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-[#36671E]" /> No hidden fees</div>
          </div>
        </div>
      </section>

      {/* ── HOW IT'S PRICED: one installation, then the plan ── */}
      <section className="py-16 lg:py-20 bg-[#FAFAF7]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-6 items-stretch">
            {/* Step 1 — the only one-time cost */}
            <div className="bg-white rounded-2xl border-2 border-[#E8E6E0] p-7 flex flex-col">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#A1A1AA] mb-3">Step 1 · once</p>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#36671E] to-[#143424] flex items-center justify-center text-[#FAFAF7] mb-3 shadow-md">
                <Globe className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black text-[#18181B] mb-1">{SETUP_PLAN.name}</h2>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl font-black text-[#18181B]">€{SETUP_PLAN.totalEur}</span>
                <span className="text-[#52525B] text-sm">one-time</span>
              </div>
              <div className="flex items-center gap-1.5 mb-4">
                <Clock className="w-3.5 h-3.5 text-[#059669]" />
                <span className="text-sm font-semibold text-[#059669]">Live in {SETUP_PLAN.delivery}</span>
              </div>
              <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                {[
                  "Your site, written and built for your practice",
                  "Your AI receptionist trained on your services",
                  "Domain, hosting, SSL and pro email set up",
                  "GDPR pages and cookie consent included",
                  "One round of revisions before launch",
                ].map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-[#3F3F46]">
                    <CheckCircle className="w-4 h-4 text-[#059669] flex-shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              {/* Charged in full — /api/checkout no longer splits this into a
                  deposit, so the button and the card agree. */}
              <CheckoutButton
                plan={SETUP_PLAN.key}
                label={`Pay the €${SETUP_PLAN.totalEur} installation`}
                className="w-full text-center py-3 rounded-xl font-black text-sm bg-[#36671E] text-[#FAFAF7] hover:bg-[#295115] transition-colors disabled:opacity-60 mb-3"
              />
              <div className="rounded-xl bg-[#EEF5EA] p-3">
                <p className="text-xs font-black text-[#36671E]">Waived when you start on an annual plan.</p>
              </div>
            </div>

            {/* Step 2 — the product */}
            <div className="bg-[#0A1F14] rounded-2xl border-2 border-[#36671E] p-7 flex flex-col relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#36671E] opacity-50 rounded-full blur-3xl pointer-events-none" />
              <div className="relative flex flex-col h-full">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#ABDF90] mb-3">Step 2 · monthly</p>
                <div className="w-10 h-10 rounded-xl bg-[#BEF264]/20 flex items-center justify-center text-[#ABDF90] mb-3">
                  <Bot className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black text-[#FAFAF7] mb-1">Your plan</h2>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-4xl font-black text-[#FAFAF7]">€{PLANS.essentiel.monthlyEur}–{PLANS.performance.monthlyEur}</span>
                  <span className="text-[#ABDF90]/70 text-sm">/month</span>
                </div>
                <p className="text-[#ABDF90]/80 text-sm leading-relaxed mb-4">
                  This is the product. Your site stays hosted and updated, your AI receptionist keeps
                  answering, and every enquiry lands in your portal. Plans differ by how many
                  conversations you need each month — nothing is locked behind a higher tier.
                </p>
                <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                  {[
                    "24/7 AI receptionist in every plan",
                    "Hosting, domain and pro email included",
                    "Instant lead alerts + client portal",
                    "Two months free when you pay yearly",
                  ].map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-[#FAFAF7]/85">
                      <CheckCircle className="w-4 h-4 text-[#BEF264] flex-shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                <a href="#plans"
                  className="block text-center w-full py-3.5 rounded-xl font-bold text-sm bg-[#BEF264] text-[#0A1F14] hover:bg-[#D9F99D] transition-colors">
                  Compare the plans ↓
                </a>
              </div>
            </div>
          </div>

          <p className="text-center text-[#52525B] text-sm mt-8">
            All prices exclude VAT · Prices in EUR · Cancel any time with 30 days notice
          </p>
        </div>
      </section>

      {/* ── WHAT HAPPENS AFTER ── */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">The Process</p>
            <h2 className="text-2xl sm:text-3xl font-black text-[#18181B]">What happens after you choose a plan</h2>
          </div>
          <div className="relative">
            <div className="absolute left-5 top-6 bottom-6 w-px bg-gradient-to-b from-[#36671E]/30 via-[#6BA52A]/40 to-[#ABDF90]/20 hidden sm:block" />
            <div className="flex flex-col gap-5">
              {process.map((s, i) => (
                <div key={i} className="flex items-start gap-5 sm:pl-12 relative">
                  <div className="sm:absolute sm:left-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#36671E] to-[#295115] flex items-center justify-center text-[#18181B] text-xs font-black flex-shrink-0 shadow-md shadow-[#6BA52A]/20">
                    {s.num}
                  </div>
                  <div className="bg-[#FAFAF7] rounded-xl px-5 py-4 flex-1 border border-[#E8E6E0]">
                    <p className="font-black text-[#18181B] text-sm mb-0.5">{s.title}</p>
                    <p className="text-[#71717A] text-sm">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CARE PLANS (all-in, monthly/annual) ── */}
      <div id="plans" />
      <CarePlansSection lang="en" />

      <Guarantee lang="en" />

      {/* ── PRICING FAQ ── */}
      <section className="py-16 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-[#18181B] mb-2">Pricing FAQs</h2>
          </div>
          <div className="flex flex-col gap-4">
            {[
              { q: "How does payment work?", a: "A €490 installation fee via Stripe to start — waived if you pay your first year up front. After that it's just your monthly plan, cancellable any time with 30 days notice." },
              { q: "Are there any hidden fees?", a: "Never. The price quoted is the price you pay. Third-party tools (hosting, domain, Stripe fees) are extra and disclosed upfront. Our service fee has no surprises." },
              { q: "Do you offer refunds?", a: "If we miss the agreed delivery deadline, we refund 10% per day of delay. If we fail to deliver at all, full refund. See our full refund policy in the CGV." },
              { q: "Can I change plan later?", a: "Any time, up or down. If you go over your included conversations we simply move you to the next plan — you never get a surprise overage bill." },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E8E6E0] p-5 shadow-sm">
                <h3 className="font-bold text-[#18181B] text-sm mb-2">{f.q}</h3>
                <p className="text-[#71717A] text-sm leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-black text-[#18181B] mb-4">Not sure which plan?</h2>
          <p className="text-[#52525B] mb-6 leading-relaxed">
            Get a free audit first. We'll recommend the right system based on your business, budget, and goals — no pressure.
          </p>
          <Link href="/contact" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold hover:opacity-90 transition-opacity glow-button">
            Get Free Audit <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-[#A1A1AA] text-xs mt-4">5 questions · 24h response · No commitment</p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
