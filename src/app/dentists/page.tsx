import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import Link from "next/link";
import { CheckCircle, ArrowRight, Bot, Calendar, BarChart3, Globe, Clock, Lock, TrendingUp } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Booking System for Dental Clinics — Servolia",
  description: "Stop losing patients to the clinic that answers first. AI receptionist, online booking, and lead tracking for dental clinics — delivered in 7 days, fixed price.",
  alternates: {
    canonical: "https://servolia.com/dentists",
    languages: {
      "en-US": "https://servolia.com/dentists",
      "fr-FR": "https://servolia.com/fr/dentistes",
      "x-default": "https://servolia.com/dentists",
    },
  },
};

export default function DentistsPage() {
  const pain = [
    "Patients call outside hours and never call back",
    "Your website has no online booking — they go to a competitor",
    "You spend 2+ hours per day managing appointment calls",
    "You don't know which source (Google, Instagram, referral) brings clients",
    "No system to follow up with patients who enquired but didn't book",
  ];

  const gains = [
    "AI receptionist answers every patient inquiry — at 2am if needed",
    "Online booking integrated directly into your website",
    "Automatic email/SMS confirmation and reminder sent to patient",
    "Full tracking: Google, Meta, direct — you see what's working",
    "Automatic follow-up for unbooked leads after 48 hours",
  ];

  const packages = [
    {
      name: "Starter Clinic",
      price: "€490",
      delivery: "3 days",
      features: [
        "5-page dental website",
        "Appointment request form",
        "Google Analytics 4",
        "GDPR compliant pages",
        "Mobile optimized",
        "Google My Business setup tips",
      ],
      cta: "Get Starter",
      popular: false,
    },
    {
      name: "AI Clinic System",
      price: "€990",
      delivery: "5 days",
      features: [
        "10-page website",
        "AI receptionist chatbot",
        "Online booking flow",
        "Patient lead capture",
        "Email notification to clinic",
        "Meta Pixel + GA4",
        "GDPR compliant pages",
        "CRM Google Sheet sync",
      ],
      cta: "Get AI System",
      popular: true,
    },
    {
      name: "Full Clinic Pro",
      price: "€1,900",
      delivery: "7 days",
      features: [
        "Everything in AI System",
        "Admin patient dashboard",
        "Appointment pipeline",
        "Auto reminder emails",
        "WhatsApp lead notification",
        "Monthly analytics report",
        "A/B landing pages",
      ],
      cta: "Get Full Pro",
      popular: false,
    },
  ];

  return (
    <main className="flex flex-col bg-white">
      <Navbar />

      {/* Hero */}
      <section className="bg-[#FAFAF7] pt-28 pb-16 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#EEF5EA] rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex justify-center mb-5">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#36671E]/30 bg-[#EEF5EA] text-sm text-[#36671E]">
              🦷 <span className="font-semibold">Built specifically for dental clinics</span>
            </div>
          </div>
          <h1 className="text-center text-4xl sm:text-5xl lg:text-6xl font-black text-[#18181B] leading-tight mb-5">
            Stop losing patients to the clinic{" "}
            <span className="gradient-text">that answers first.</span>
          </h1>
          <p className="text-center text-lg text-[#52525B] max-w-2xl mx-auto mb-6">
            Patients enquire after hours, wait too long, or hit a contact form that goes nowhere — and book elsewhere. Servolia installs an AI receptionist, online booking, and lead tracking on your site in 7 days, so every enquiry is answered and captured.
          </p>
          {/* Missed-revenue math */}
          <div className="max-w-xl mx-auto mb-8 p-4 rounded-2xl bg-white border border-[#D6E2CF] text-center">
            <p className="text-sm text-[#52525B]">
              A clinic missing just <strong className="text-[#18181B]">9 after-hours enquiries a month</strong>, at{" "}
              <strong className="text-[#18181B]">€1,500 per patient</strong>, is leaking
            </p>
            <p className="text-3xl font-black text-[#36671E] mt-1">~€13,500 / month</p>
            <p className="text-[10px] text-[#A1A1AA] mt-1">Illustrative estimate — your free audit uses your clinic&apos;s own numbers.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link href="/free-audit" className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold text-base hover:opacity-90 glow-button flex items-center gap-2">
              Get Free Clinic Audit <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing" className="text-[#52525B] hover:text-[#18181B] text-sm font-semibold transition-colors">
              View pricing →
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#52525B]">
            <div className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-[#10B981]" /> Built for more bookings</div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#36671E]" /> 7-day delivery</div>
            <div className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-[#36671E]" /> Fixed price in writing</div>
          </div>
        </div>
      </section>

      {/* Pain / Gain */}
      <section className="py-16 lg:py-20 bg-[#FAFAF7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-red-100">
              <p className="text-xs font-black text-red-500 uppercase tracking-widest mb-4">Without Servolia</p>
              <ul className="flex flex-col gap-3">
                {pain.map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[#71717A]">
                    <span className="text-red-400 flex-shrink-0 font-bold">✗</span>{t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#10B981]/20">
              <p className="text-xs font-black text-[#10B981] uppercase tracking-widest mb-4">With Servolia</p>
              <ul className="flex flex-col gap-3">
                {gains.map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[#374151]">
                    <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-2">What We Build</p>
            <h2 className="text-3xl font-black text-[#080E1C]">Every piece your clinic needs</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: <Globe className="w-5 h-5" />, title: "Professional Website", desc: "Fast, mobile-first, GDPR-compliant site that builds trust instantly.", color: "from-[#36671E] to-[#143424]" },
              { icon: <Bot className="w-5 h-5" />, title: "AI Receptionist", desc: "Trained on your services. Answers patients 24/7 in French or English.", color: "from-[#295115] to-[#6B8439]" },
              { icon: <Calendar className="w-5 h-5" />, title: "Booking System", desc: "Online appointment requests with automatic confirmation emails.", color: "from-[#059669] to-[#10B981]" },
              { icon: <BarChart3 className="w-5 h-5" />, title: "Lead Tracking", desc: "Meta Pixel + GA4. See exactly where every patient came from.", color: "from-[#F59E0B] to-[#EF4444]" },
            ].map((item, i) => (
              <div key={i} className="border border-[#E8E6E0] rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center text-[#FAFAF7] mb-3`}>
                  {item.icon}
                </div>
                <h3 className="font-black text-[#080E1C] text-sm mb-1.5">{item.title}</h3>
                <p className="text-[#71717A] text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What it's built to do */}
      <section className="py-12 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-4">What it&apos;s built to do</p>
          <blockquote className="text-lg text-[#18181B] font-medium leading-relaxed mb-3">
            A typical clinic running the AI Booking System is designed to move from a handful of online bookings a month to 15+ — with the chatbot handling after-hours enquiries automatically and dropping every lead into the CRM.
          </blockquote>
          <p className="text-xs text-[#A1A1AA]">Illustrative target based on typical dental-practice benchmarks. Actual results vary.</p>
        </div>
      </section>

      {/* Packages */}
      <section className="py-16 lg:py-20 bg-[#FAFAF7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-2">Clinic Packages</p>
            <h2 className="text-3xl font-black text-[#080E1C] mb-3">Choose your plan</h2>
            <p className="text-[#71717A]">All prices exclude VAT. 50% deposit · Balance on delivery.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((p, i) => (
              <div key={i} className={`bg-white rounded-2xl border-2 p-6 relative ${p.popular ? "border-[#36671E] shadow-2xl shadow-[#ABDF90]/15" : "border-[#E8E6E0]"}`}>
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] text-xs font-black whitespace-nowrap">
                    RECOMMENDED
                  </div>
                )}
                <h3 className="text-lg font-black text-[#080E1C] mb-1">{p.name}</h3>
                <div className="text-3xl font-black text-[#080E1C] mb-1">{p.price}</div>
                <div className="flex items-center gap-1.5 mb-4">
                  <Clock className="w-3.5 h-3.5 text-[#10B981]" />
                  <span className="text-xs font-semibold text-[#10B981]">Delivered in {p.delivery}</span>
                </div>
                <ul className="flex flex-col gap-2 mb-6">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-[#374151]">
                      <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                <Link href={`/contact?niche=dentist&plan=${p.name}`}
                  className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
                    p.popular
                      ? "bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] hover:opacity-90 glow-button"
                      : "border border-[#E8E6E0] text-[#080E1C] hover:border-[#36671E] hover:text-[#36671E]"
                  }`}>
                  {p.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-black text-[#18181B] mb-4">
            Ready to fill your <span className="gradient-text">appointment calendar?</span>
          </h2>
          <p className="text-[#52525B] mb-6">Get a free clinic audit. We'll show you exactly what's missing and how to fix it in 7 days.</p>
          <Link href="/free-audit"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold hover:opacity-90 glow-button">
            Get My Free Clinic Audit <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <StickyMobileCTA label="Get My Free Clinic Audit" sub="Free · 24h delivery · No call required" />
      <Footer />
    </main>
  );
}
