import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { CheckCircle, ArrowRight, Bot, Calendar, BarChart3, Globe, Clock, Star, TrendingUp } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Booking System for Dental Clinics — Servolia",
  description: "Turn your dental website into a 24/7 booking assistant. AI receptionist, lead capture, appointment flow, and tracking — delivered in 7 days.",
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
      price: "€790",
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
      price: "€1,590",
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
      price: "€2,990",
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
      <section className="bg-[#080E1C] pt-28 pb-16 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#95BF47]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex justify-center mb-5">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#95BF47]/30 bg-[#95BF47]/10 text-sm text-[#93C5FD]">
              🦷 <span className="font-semibold">Built specifically for dental clinics</span>
            </div>
          </div>
          <h1 className="text-center text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-5">
            Turn your dental website into a{" "}
            <span className="gradient-text">24/7 booking assistant</span>
          </h1>
          <p className="text-center text-lg text-[#94A3B8] max-w-2xl mx-auto mb-8">
            We build a fast website, AI receptionist, booking flow, and lead tracking system for dental clinics — in 7 days. Fixed price. GDPR compliant.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link href="/contact?niche=dentist" className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#95BF47] to-[#6BA52A] text-white font-bold text-base hover:opacity-90 glow-button flex items-center gap-2">
              Get Free Clinic Audit <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing" className="text-[#94A3B8] hover:text-white text-sm font-semibold transition-colors">
              View pricing →
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#94A3B8]">
            <div className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-[#10B981]" /> Avg. +12 bookings/month</div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#95BF47]" /> 7-day delivery</div>
            <div className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" /> 5.0 rating</div>
          </div>
        </div>
      </section>

      {/* Pain / Gain */}
      <section className="py-16 lg:py-20 bg-[#F5F5F5]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-red-100">
              <p className="text-xs font-black text-red-500 uppercase tracking-widest mb-4">Without Servolia</p>
              <ul className="flex flex-col gap-3">
                {pain.map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[#64748B]">
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
            <p className="text-sm font-bold text-[#95BF47] uppercase tracking-widest mb-2">What We Build</p>
            <h2 className="text-3xl font-black text-[#080E1C]">Every piece your clinic needs</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: <Globe className="w-5 h-5" />, title: "Professional Website", desc: "Fast, mobile-first, GDPR-compliant site that builds trust instantly.", color: "from-[#95BF47] to-[#5A8A1E]" },
              { icon: <Bot className="w-5 h-5" />, title: "AI Receptionist", desc: "Trained on your services. Answers patients 24/7 in French or English.", color: "from-[#6BA52A] to-[#8FBF3A]" },
              { icon: <Calendar className="w-5 h-5" />, title: "Booking System", desc: "Online appointment requests with automatic confirmation emails.", color: "from-[#10B981] to-[#34D399]" },
              { icon: <BarChart3 className="w-5 h-5" />, title: "Lead Tracking", desc: "Meta Pixel + GA4. See exactly where every patient came from.", color: "from-[#F59E0B] to-[#EF4444]" },
            ].map((item, i) => (
              <div key={i} className="border border-[#E2E8F0] rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center text-white mb-3`}>
                  {item.icon}
                </div>
                <h3 className="font-black text-[#080E1C] text-sm mb-1.5">{item.title}</h3>
                <p className="text-[#64748B] text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-12 bg-[#080E1C]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center gap-1 mb-4">
            {[1,2,3,4,5].map(i=><Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />)}
          </div>
          <blockquote className="text-lg text-white font-medium italic leading-relaxed mb-5">
            "Within 2 weeks of launching our Servolia website and AI chatbot, we went from 3 online bookings per month to over 15. The chatbot handles all after-hours inquiries automatically. I wish we had this 3 years ago."
          </blockquote>
          <div>
            <p className="font-bold text-white text-sm">Dr. Sophie Laurent</p>
            <p className="text-[#94A3B8] text-xs">Dental Clinic Owner · Brussels, Belgium 🇧🇪</p>
          </div>
        </div>
      </section>

      {/* Packages */}
      <section className="py-16 lg:py-20 bg-[#F5F5F5]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#95BF47] uppercase tracking-widest mb-2">Clinic Packages</p>
            <h2 className="text-3xl font-black text-[#080E1C] mb-3">Choose your plan</h2>
            <p className="text-[#64748B]">All prices exclude VAT. 50% deposit · Balance on delivery.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((p, i) => (
              <div key={i} className={`bg-white rounded-2xl border-2 p-6 relative ${p.popular ? "border-[#95BF47] shadow-2xl shadow-[#95BF47]/15" : "border-[#E2E8F0]"}`}>
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#95BF47] to-[#6BA52A] text-white text-xs font-black whitespace-nowrap">
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
                      ? "bg-gradient-to-r from-[#95BF47] to-[#6BA52A] text-white hover:opacity-90 glow-button"
                      : "border border-[#E2E8F0] text-[#080E1C] hover:border-[#95BF47] hover:text-[#95BF47]"
                  }`}>
                  {p.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#080E1C]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-black text-white mb-4">
            Ready to fill your <span className="gradient-text">appointment calendar?</span>
          </h2>
          <p className="text-[#94A3B8] mb-6">Get a free clinic audit. We'll show you exactly what's missing and how to fix it in 7 days.</p>
          <Link href="/contact?niche=dentist"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#95BF47] to-[#6BA52A] text-white font-bold hover:opacity-90 glow-button">
            Get My Free Clinic Audit <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
