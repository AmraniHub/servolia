import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { CheckCircle, ArrowRight, Bot, Calendar, BarChart3, Globe, XCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Lead System for Real Estate Agents — Servolia",
  description: "Stop losing property leads to slow follow-up. Servolia builds AI websites, lead capture, and automated follow-up systems for real estate agents in Europe and the US.",
};

export default function RealEstatePage() {
  const pain = [
    "A lead asks about a property at 9pm — you reply at 9am. They've already called 3 others.",
    "Your website shows properties but captures zero contact information",
    "You spend hours calling cold leads who enquired once and forgot about you",
    "No system to track which ad, post, or listing drives actual viewings",
    "Competitors with better online systems are winning mandates you could have had",
  ];

  const gains = [
    "AI receptionist qualifies leads instantly — property type, budget, timeline, location",
    "Every visitor becomes a lead: name, phone, email, and property interest captured",
    "Automatic follow-up sequence: day 1, day 3, day 7 — so no lead goes cold",
    "Full tracking: Google, Meta, portal referrals — you know what drives your pipeline",
    "Monthly CRM report showing every lead, its status, and estimated commission value",
  ];

  const packages = [
    {
      name: "Website System",
      price: "€490",
      description: "A professional agency website that positions you as the local expert and captures every visitor.",
      features: [
        "5-page professional website",
        "Property listing showcase section",
        "Lead capture form (name, phone, property interest)",
        "Google Analytics 4 + Meta Pixel",
        "Mobile-first, fast loading",
        "GDPR compliant",
      ],
    },
    {
      name: "AI Booking System",
      price: "€990",
      description: "AI receptionist + website + full lead tracking. Your pipeline fills while you're at viewings.",
      features: [
        "Everything in Website System",
        "AI receptionist (qualifies buyers & sellers 24/7)",
        "Viewing request booking flow",
        "Automated lead follow-up (day 1, 3, 7)",
        "CRM dashboard (Google Sheets)",
        "Instant lead notifications to your phone",
      ],
      highlighted: true,
    },
    {
      name: "AI Client System",
      price: "€1,900",
      description: "The complete system for agents running ads or managing a team — full pipeline visibility.",
      features: [
        "Everything in Booking System",
        "Landing pages for buyer & seller campaigns",
        "Meta CAPI + Google Ads conversion tracking",
        "Lead pipeline CRM with status tracking",
        "Monthly performance report with ROI",
        "Priority support + monthly optimization",
      ],
    },
  ];

  const faqs = [
    {
      q: "Can the AI qualify buyers vs sellers automatically?",
      a: "Yes. We train the chatbot to ask the right questions: buying or selling, property type, budget range, timeline, preferred areas. Only qualified leads reach your inbox.",
    },
    {
      q: "Can this connect with property portals like SeLoger or Rightmove?",
      a: "We can embed listing widgets and drive portal traffic back to your site for lead capture. Direct API integration depends on the portal's terms.",
    },
    {
      q: "I work in a specific area — can the system be geo-targeted?",
      a: "Absolutely. We build the site with your specific area(s), local knowledge content, and Google Maps integration to reinforce local authority.",
    },
    {
      q: "Can I use this for a team of 3–5 agents?",
      a: "Yes. The CRM dashboard and lead routing can be set up for multiple agents with individual notification preferences.",
    },
    {
      q: "How fast will I see leads?",
      a: "Most clients see the first online lead within 48 hours of launch — especially if they share the site on social media or have existing Google traffic.",
    },
  ];

  return (
    <>
      <Navbar />
      <main>
        {/* HERO */}
        <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 bg-[#FAFAF7] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#36671E]/10 via-transparent to-[#295115]/5 pointer-events-none" />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EEF5EA] border border-[#36671E]/30 text-[#36671E] text-xs font-bold uppercase tracking-widest mb-6">
              Real Estate Agents
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#18181B] leading-[1.05] tracking-tight mb-6">
              Stop losing property leads{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#295115] bg-clip-text text-transparent">
                to slow follow-up.
              </span>
            </h1>
            <p className="text-lg text-[#52525B] max-w-2xl mx-auto mb-4 leading-relaxed">
              Servolia builds AI lead systems for real estate agents — AI receptionist, viewing booking flows, automated follow-up, and full pipeline tracking. Fixed price, delivered in 7 days.
            </p>
            <p className="text-base font-semibold text-[#18181B] mb-10">
              Fixed price · Fixed deadline · No monthly contracts needed to start
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/free-audit"
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold text-base hover:opacity-90 transition-opacity shadow-lg shadow-[#36671E]/15">
                Get a Free Audit →
              </Link>
              <Link href="/pricing"
                className="px-8 py-4 rounded-xl border border-[#A1A1AA] text-[#18181B] font-semibold text-base hover:bg-[#F5F4EF] transition-colors">
                See Pricing
              </Link>
            </div>
          </div>
        </section>

        {/* PROBLEM vs GAIN */}
        <section className="py-20 lg:py-28 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-black text-[#080E1C] text-center mb-12">
              Every slow response costs you a commission
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-red-50 border border-red-100">
                <h3 className="text-base font-black text-red-700 mb-4 flex items-center gap-2">
                  <XCircle className="w-5 h-5" /> Without a system
                </h3>
                <ul className="space-y-3">
                  {pain.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                      <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />{p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 rounded-2xl bg-green-50 border border-green-100">
                <h3 className="text-base font-black text-green-700 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> With Servolia active
                </h3>
                <ul className="space-y-3">
                  {gains.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-green-800">
                      <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-green-500" />{g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* WHAT'S INCLUDED */}
        <section className="py-20 lg:py-28 bg-[#FAFAF7]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">What we build</p>
              <h2 className="text-3xl font-black text-[#080E1C] mb-3">Every real estate system includes:</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { icon: <Globe className="w-6 h-6" />, title: "Agent Website", body: "Professional site that positions you as the local expert with property showcase, testimonials, and trust signals." },
                { icon: <Bot className="w-6 h-6" />, title: "AI Lead Qualifier", body: "Trained to ask the right questions 24/7: buying or selling, budget, timeline, preferred area. Sends you only qualified leads." },
                { icon: <Calendar className="w-6 h-6" />, title: "Viewing Booking", body: "Buyers and sellers book viewings or appraisals directly online — syncs with your calendar, sends automatic confirmations." },
                { icon: <BarChart3 className="w-6 h-6" />, title: "Pipeline Dashboard", body: "Every lead tracked by source, status, and estimated commission. Monthly report delivered on the 5th." },
              ].map((f, i) => (
                <div key={i} className="p-5 rounded-2xl bg-white border border-[#E8E6E0] shadow-sm">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#36671E] to-[#295115] flex items-center justify-center text-[#FAFAF7] mb-4">
                    {f.icon}
                  </div>
                  <h3 className="text-sm font-black text-[#080E1C] mb-2">{f.title}</h3>
                  <p className="text-xs text-[#71717A] leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PACKAGES */}
        <section className="py-20 lg:py-28 bg-[#FAFAF7]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Packages</p>
              <h2 className="text-3xl font-black text-[#18181B] mb-3">Choose your system</h2>
              <p className="text-[#52525B]">Fixed price. No hourly billing. No agencies fees. No surprises.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {packages.map((pkg) => (
                <div key={pkg.name} className={`p-6 rounded-2xl flex flex-col ${pkg.highlighted ? "bg-gradient-to-b from-[#F5F4EF] to-white border-2 border-[#36671E] shadow-lg shadow-[#36671E]/10" : "bg-[#F5F4EF] border border-[#D4D2CC]"}`}>
                  {pkg.highlighted && <div className="text-xs font-bold text-[#36671E] uppercase tracking-widest mb-3">Most popular</div>}
                  <h3 className="text-lg font-black text-[#18181B] mb-1">{pkg.name}</h3>
                  <div className="text-3xl font-black text-[#18181B] mb-2">{pkg.price}</div>
                  <p className="text-sm text-[#52525B] mb-5 leading-relaxed">{pkg.description}</p>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {pkg.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#3F3F46]">
                        <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#36671E]" />{f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/free-audit"
                    className={`block text-center py-3 rounded-xl font-bold text-sm transition-opacity ${pkg.highlighted ? "bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] hover:opacity-90" : "border border-[#A1A1AA] text-[#18181B] hover:bg-[#F0EFEA]"}`}>
                    Get started →
                  </Link>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-[#A1A1AA] mt-6">50% deposit · 50% on delivery · Stripe secured · Monthly care from €69/mo</p>
          </div>
        </section>

        {/* WHAT IT'S BUILT TO DO */}
        <section className="py-16 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="p-8 rounded-2xl bg-[#FAFAF7] border border-[#E8E6E0]">
              <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-4">What it&apos;s built to do</p>
              <p className="text-[#080E1C] text-lg font-semibold leading-relaxed mb-3">
                A lead landing page designed to go live in 5 days, sending qualified leads straight to your phone. The AI handles initial qualification — so you spend your time only on the buyers and sellers who are genuinely ready to move.
              </p>
              <p className="text-xs text-[#A1A1AA]">Illustrative target based on typical real-estate benchmarks. Actual results vary.</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 bg-[#FAFAF7]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black text-[#080E1C] text-center mb-10">Questions from agents</h2>
            <div className="space-y-3">
              {faqs.map((f, i) => (
                <div key={i} className="p-5 rounded-2xl bg-white border border-[#E8E6E0]">
                  <h3 className="text-sm font-black text-[#080E1C] mb-2">{f.q}</h3>
                  <p className="text-sm text-[#71717A] leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-[#FAFAF7]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl font-black text-[#18181B] mb-4">Ready to stop losing leads to slow follow-up?</h2>
            <p className="text-[#52525B] mb-8 max-w-xl mx-auto">
              Get a free audit of your current online presence. We record a 5-minute Loom showing exactly what&apos;s costing you mandates and viewings.
            </p>
            <Link href="/free-audit"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black hover:opacity-90 transition-opacity">
              Get My Free Audit <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-[#A1A1AA] mt-4">No commitment · Response within 24h · Free</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
