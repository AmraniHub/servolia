import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { CheckCircle, ArrowRight, Bot, Calendar, BarChart3, Globe, Clock, Star, TrendingUp, XCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Client System for Aesthetic Clinics — Servolia",
  description: "Turn your aesthetic clinic website into a 24/7 booking and client acquisition system. AI receptionist, Botox & filler booking flows, CRM tracking — delivered in 7 days.",
};

export default function AestheticClinicsPage() {
  const pain = [
    "Potential clients browse at night and book with competitors by morning",
    "Your Instagram DMs are full but no system to convert them",
    "No easy way to book consultations for Botox, fillers, or laser treatments",
    "You rely on word-of-mouth instead of a repeatable client acquisition system",
    "No follow-up for leads who enquired but never booked",
  ];

  const gains = [
    "AI receptionist captures and qualifies leads 24/7 — even from Instagram",
    "Treatment-specific booking flows (Botox, fillers, laser, skin care)",
    "Automated consultation confirmations and 48-hour reminders",
    "Full source tracking — Google, Meta, referrals — so you scale what works",
    "Automatic follow-up sequences for cold leads and past clients",
  ];

  const packages = [
    {
      name: "AI Website System",
      price: "€790",
      description: "A high-converting clinic website with treatment pages and lead capture form.",
      features: [
        "Treatment showcase pages (Botox, fillers, laser, skin)",
        "Before/after gallery section",
        "Lead capture form with qualification",
        "AI chatbot for visitor questions",
        "Google Analytics + Meta Pixel",
        "Delivered in 7 days",
      ],
    },
    {
      name: "AI Booking System",
      price: "€1,490",
      description: "Everything in the Website System plus a full online booking flow for consultations.",
      features: [
        "Everything in Website System",
        "Online booking per treatment type",
        "Automated email + SMS confirmation",
        "48-hour pre-appointment reminder",
        "Cancellation & reschedule flow",
        "Lead CRM dashboard",
      ],
      highlighted: true,
    },
    {
      name: "AI Client System",
      price: "€2,900",
      description: "The complete system — website, booking, AI receptionist, tracking, and monthly reports.",
      features: [
        "Everything in Booking System",
        "AI receptionist trained on your treatments",
        "Lead recovery sequence (for unbooked enquiries)",
        "Google + Meta ad landing pages",
        "Monthly performance report",
        "Priority support + 1 update/month",
      ],
    },
  ];

  const testimonials = [
    {
      name: "Dr. Sophie M.",
      role: "Founder, Aesthetic Clinic, Paris",
      body: "We went from 3 online bookings a week to 14. The AI handles all after-hours inquiries and books directly into our calendar. Worth every cent.",
      rating: 5,
    },
    {
      name: "Elena K.",
      role: "Clinic Director, Amsterdam",
      body: "Our Instagram was full of DMs we couldn't convert. Now everything flows into one system and we follow up automatically. Bookings doubled in 6 weeks.",
      rating: 5,
    },
  ];

  const faqs = [
    {
      q: "Can you build treatment-specific booking flows?",
      a: "Yes. We build separate booking flows for each treatment type — Botox, fillers, laser, skin care consultations — each with its own questions, duration, and confirmation messages.",
    },
    {
      q: "Does the AI understand aesthetic clinic terminology?",
      a: "Absolutely. We train the AI on your specific treatments, prices, protocols, and FAQs so it answers like a knowledgeable receptionist — not a generic chatbot.",
    },
    {
      q: "Can this connect to Instagram DMs?",
      a: "We can integrate a lead capture form with your link-in-bio and ad traffic. Direct DM automation depends on Meta's API limits, but we capture and route all leads into one dashboard.",
    },
    {
      q: "How long does it take?",
      a: "We deliver in 7 working days for Website and Booking systems. The full Client System is 10–14 days due to AI training and integrations.",
    },
    {
      q: "Do I need a technical person to manage it?",
      a: "No. Everything runs automatically. You get a simple dashboard to see your leads and bookings. We handle all the technical setup and maintenance.",
    },
  ];

  return (
    <>
      <Navbar />
      <main>
        {/* HERO */}
        <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 bg-[#080E1C] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#95BF47]/10 via-transparent to-[#6BA52A]/5 pointer-events-none" />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#95BF47]/10 border border-[#95BF47]/30 text-[#95BF47] text-xs font-bold uppercase tracking-widest mb-6">
              Aesthetic Clinics
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
              Your clinic deserves clients who{" "}
              <span className="bg-gradient-to-r from-[#95BF47] to-[#6BA52A] bg-clip-text text-transparent">
                book while you sleep.
              </span>
            </h1>
            <p className="text-lg text-[#94A3B8] max-w-2xl mx-auto mb-4 leading-relaxed">
              Servolia builds AI client acquisition systems for aesthetic clinics — AI receptionists, treatment booking flows, lead tracking, and monthly performance reports.
            </p>
            <p className="text-base font-semibold text-white mb-10">
              Fixed price · Fixed deadline · 7 days delivery
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#95BF47] to-[#6BA52A] text-white font-bold text-base hover:opacity-90 transition-opacity shadow-lg shadow-[#6BA52A]/25"
              >
                Get a Free Audit →
              </Link>
              <Link
                href="/pricing"
                className="px-8 py-4 rounded-xl border border-white/20 text-white font-semibold text-base hover:bg-white/5 transition-colors"
              >
                See Pricing
              </Link>
            </div>
          </div>
        </section>

        {/* PROBLEM vs GAIN */}
        <section className="py-20 lg:py-28 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-black text-[#080E1C] text-center mb-12">
              The gap between your clinic and a full booking calendar
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-red-50 border border-red-100">
                <h3 className="text-base font-black text-red-700 mb-4 flex items-center gap-2">
                  <XCircle className="w-5 h-5" /> Without Servolia
                </h3>
                <ul className="space-y-3">
                  {pain.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                      <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 rounded-2xl bg-green-50 border border-green-100">
                <h3 className="text-base font-black text-green-700 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> With Servolia
                </h3>
                <ul className="space-y-3">
                  {gains.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-green-800">
                      <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-green-500" /> {g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* WHAT&apos;S INCLUDED */}
        <section className="py-20 lg:py-28 bg-[#F5F5F5]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <p className="text-sm font-bold text-[#95BF47] uppercase tracking-widest mb-3">What we build</p>
              <h2 className="text-3xl sm:text-4xl font-black text-[#080E1C] mb-3">Every system includes:</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { icon: <Globe className="w-6 h-6" />, title: "Treatment Website", body: "High-converting pages for each treatment with before/after gallery and patient testimonials." },
                { icon: <Bot className="w-6 h-6" />, title: "AI Receptionist", body: "Trained on your treatments, pricing, and availability. Answers 24/7 via website chat." },
                { icon: <Calendar className="w-6 h-6" />, title: "Online Booking", body: "Treatment-specific booking flows with confirmation, reminders, and rescheduling." },
                { icon: <BarChart3 className="w-6 h-6" />, title: "Lead Dashboard", body: "See every enquiry, its source, and its status. Monthly performance report included." },
              ].map((f, i) => (
                <div key={i} className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#95BF47] to-[#6BA52A] flex items-center justify-center text-white mb-4">
                    {f.icon}
                  </div>
                  <h3 className="text-sm font-black text-[#080E1C] mb-2">{f.title}</h3>
                  <p className="text-xs text-[#64748B] leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PACKAGES */}
        <section className="py-20 lg:py-28 bg-[#080E1C]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <p className="text-sm font-bold text-[#95BF47] uppercase tracking-widest mb-3">Packages</p>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">Choose your system</h2>
              <p className="text-[#94A3B8]">All prices are fixed. No hourly billing. No surprises.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {packages.map((pkg) => (
                <div
                  key={pkg.name}
                  className={`p-6 rounded-2xl flex flex-col ${
                    pkg.highlighted
                      ? "bg-gradient-to-b from-[#1E293B] to-[#0F172A] border-2 border-[#95BF47] shadow-lg shadow-[#6BA52A]/20"
                      : "bg-white/5 border border-white/10"
                  }`}
                >
                  {pkg.highlighted && (
                    <div className="text-xs font-bold text-[#95BF47] uppercase tracking-widest mb-3">Most popular</div>
                  )}
                  <h3 className="text-lg font-black text-white mb-1">{pkg.name}</h3>
                  <div className="text-3xl font-black text-white mb-2">{pkg.price}</div>
                  <p className="text-sm text-[#94A3B8] mb-5 leading-relaxed">{pkg.description}</p>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {pkg.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#CBD5E1]">
                        <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#95BF47]" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/contact"
                    className={`block text-center py-3 rounded-xl font-bold text-sm transition-opacity ${
                      pkg.highlighted
                        ? "bg-gradient-to-r from-[#95BF47] to-[#6BA52A] text-white hover:opacity-90"
                        : "border border-white/20 text-white hover:bg-white/10"
                    }`}
                  >
                    Get started →
                  </Link>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-[#475569] mt-6">50% deposit · 50% on delivery · Stripe secured</p>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="py-20 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black text-[#080E1C] text-center mb-10">What clinic owners say</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {testimonials.map((t, i) => (
                <div key={i} className="p-6 rounded-2xl bg-[#F5F5F5] border border-[#E2E8F0]">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-[#334155] leading-relaxed mb-4">&ldquo;{t.body}&rdquo;</p>
                  <p className="text-xs font-bold text-[#080E1C]">{t.name}</p>
                  <p className="text-xs text-[#94A3B8]">{t.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 bg-[#F5F5F5]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black text-[#080E1C] text-center mb-10">Common questions</h2>
            <div className="space-y-3">
              {faqs.map((f, i) => (
                <div key={i} className="p-5 rounded-2xl bg-white border border-[#E2E8F0]">
                  <h3 className="text-sm font-black text-[#080E1C] mb-2">{f.q}</h3>
                  <p className="text-sm text-[#64748B] leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-br from-[#080E1C] to-[#0F172A]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Ready to fill your booking calendar?
            </h2>
            <p className="text-[#94A3B8] mb-8 max-w-xl mx-auto">
              Get a free audit of your current online presence and see exactly what&apos;s costing you clients each month.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-[#95BF47] to-[#6BA52A] text-white font-bold text-base hover:opacity-90 transition-opacity shadow-lg shadow-[#6BA52A]/25"
            >
              Get My Free Audit <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-xs text-[#475569] mt-4">No commitment · Response within 24h · Free</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
