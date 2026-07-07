import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { CheckCircle, ArrowRight, Bot, Phone, MapPin, Zap, XCircle, Clock } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Booking System for HVAC, Plumbing & Home Services — Servolia",
  description: "Stop losing $3k–$30k home services jobs to slow follow-up. Servolia builds AI lead systems for HVAC, plumbing, roofing, electrical, and home service businesses in the US and Europe.",
};

export default function HomeServicesPage() {
  const pain = [
    "Customer calls at 8pm — voicemail loses the job to the next contractor",
    "You spend 10+ hours/week qualifying leads on the phone before quoting",
    "No way to track which Google ad, Nextdoor post, or referral drives jobs",
    "Emergency calls bleed into nights and weekends with no triage system",
    "Quote requests sit in your inbox while competitors close the same lead",
  ];

  const gains = [
    "AI receptionist answers 24/7 — qualifies service type, urgency, address, budget",
    "Online quote request flow with instant push notification to your phone",
    "Automated follow-up sequence catches the 40% who don't reply immediately",
    "Local SEO + Google Business Profile setup so you rank in your service area",
    "Pipeline dashboard tracking every job from lead to invoice",
  ];

  const services = [
    "HVAC contractors (heating, cooling, ductwork)",
    "Plumbers (residential, commercial, emergency)",
    "Electricians & solar installers",
    "Roofing & exterior contractors",
    "Landscaping & pool services",
    "Smart home & home automation",
  ];

  const packages = [
    {
      name: "Website System",
      price: "$590",
      description: "Professional contractor website built for local trust and emergency calls.",
      features: [
        "5–7 page contractor website",
        "Service area + emergency call CTA",
        "Trust signals (licenses, insurance, BBB)",
        "Google Analytics 4 + tracking",
        "Mobile-optimized for on-the-go users",
        "Google Business Profile setup",
      ],
    },
    {
      name: "AI Booking System",
      price: "$1,190",
      description: "AI receptionist + website + instant lead alerts. Most popular for contractors who want to stop missing calls.",
      features: [
        "Everything in Website System",
        "AI receptionist (qualifies service, urgency, budget)",
        "Online quote request flow",
        "Instant SMS/push alerts to your phone",
        "Automated 24h + 72h follow-up",
        "Lead CRM dashboard",
      ],
      highlighted: true,
    },
    {
      name: "AI Client System",
      price: "$2,190",
      description: "Complete system for contractors running ads or scaling a team — full pipeline visibility and reporting.",
      features: [
        "Everything in AI Booking System",
        "Landing pages for Google Ads",
        "Meta CAPI + Google Ads conversion tracking",
        "Pipeline CRM with job status",
        "Monthly ROI report by lead source",
        "Priority support + monthly optimization",
      ],
    },
  ];

  const faqs = [
    {
      q: "Can the AI handle emergency calls differently from standard quotes?",
      a: "Yes. We train the chatbot to detect urgency keywords (no heat, flood, no power) and prioritize those alerts to your phone with an emergency tag.",
    },
    {
      q: "What if I work in multiple service areas or counties?",
      a: "We build dedicated service area pages for local SEO and configure your AI to ask for ZIP/postcode upfront so you only get qualified leads in your zones.",
    },
    {
      q: "Can it integrate with my existing CRM or dispatch software?",
      a: "Yes — ServiceTitan, Housecall Pro, Jobber, and similar. We can push qualified leads via webhook or Zapier integration. Tell us your stack in the audit.",
    },
    {
      q: "How quickly will I see leads?",
      a: "Most contractors see their first online quote request within 48–72 hours of launch — especially with Google Ads or a strong Google Business Profile.",
    },
    {
      q: "Does this work for both residential and commercial?",
      a: "Yes. The AI is trained to ask if the request is residential or commercial and adjusts qualifying questions accordingly.",
    },
  ];

  return (
    <>
      <Navbar />
      <main>
        {/* HERO */}
        <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 bg-[#FAFAF7] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#EEF5EA]/40 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EEF5EA] border border-[#36671E]/20 text-[#36671E] text-xs font-bold uppercase tracking-widest mb-6">
              HVAC · Plumbing · Roofing · Electrical
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#18181B] leading-[1.05] tracking-tight mb-6">
              Stop losing $5,000 jobs{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#295115] bg-clip-text text-transparent">
                to voicemail.
              </span>
            </h1>
            <p className="text-lg text-[#52525B] max-w-2xl mx-auto mb-4 leading-relaxed">
              Servolia builds AI lead systems for home service contractors — AI receptionist, instant quote flows, automated follow-up, and full pipeline tracking. Fixed price. Live in 7 days.
            </p>
            <p className="text-base font-semibold text-[#18181B] mb-10">
              Fixed price · Fixed deadline · 50% deposit, balance on delivery
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/free-audit"
                className="px-8 py-4 rounded-xl bg-[#36671E] text-[#FAFAF7] font-bold text-base hover:bg-[#295115] transition-colors shadow-card">
                Get a Free Audit →
              </Link>
              <Link href="/pricing"
                className="px-8 py-4 rounded-xl border border-[#D4D2CC] bg-white text-[#18181B] font-semibold text-base hover:bg-[#F5F4EF] transition-colors">
                See Pricing
              </Link>
            </div>
          </div>
        </section>

        {/* PROBLEM vs GAIN */}
        <section className="py-20 lg:py-28 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-black text-[#18181B] text-center mb-12">
              Every missed call is a competitor&apos;s next job
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-[#FEE2E2] border border-[#DC2626]/20">
                <h3 className="text-base font-black text-[#991B1B] mb-4 flex items-center gap-2">
                  <XCircle className="w-5 h-5" /> Without a system
                </h3>
                <ul className="space-y-3">
                  {pain.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#7F1D1D]">
                      <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#DC2626]" />{p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 rounded-2xl bg-[#EEF5EA] border border-[#36671E]/20">
                <h3 className="text-base font-black text-[#36671E] mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> With Servolia active
                </h3>
                <ul className="space-y-3">
                  {gains.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#143424]">
                      <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#36671E]" />{g}
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
              <h2 className="text-3xl font-black text-[#18181B] mb-3">Every contractor system includes:</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { icon: <Phone className="w-6 h-6" />, title: "24/7 AI Receptionist", body: "Qualifies service type, urgency, address, and budget — no missed calls ever again." },
                { icon: <Zap className="w-6 h-6" />, title: "Instant Lead Alerts", body: "SMS + push notification to your phone the moment someone qualifies. Beat competitors to the call-back." },
                { icon: <MapPin className="w-6 h-6" />, title: "Local SEO Setup", body: "Optimized service area pages + Google Business Profile so you show up when local customers search." },
                { icon: <Bot className="w-6 h-6" />, title: "Pipeline Dashboard", body: "Every quote tracked from lead to invoice. Monthly report on which sources drive real revenue." },
              ].map((f, i) => (
                <div key={i} className="p-5 rounded-2xl bg-white border border-[#E8E6E0] shadow-soft">
                  <div className="w-11 h-11 rounded-xl bg-[#36671E] flex items-center justify-center text-[#FAFAF7] mb-4">
                    {f.icon}
                  </div>
                  <h3 className="text-sm font-black text-[#18181B] mb-2">{f.title}</h3>
                  <p className="text-xs text-[#71717A] leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHO IT'S FOR */}
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-black text-[#18181B] text-center mb-8">Built for these service businesses</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {services.map((s, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0]">
                  <CheckCircle className="w-4 h-4 text-[#36671E] shrink-0" />
                  <span className="text-sm text-[#18181B] font-medium">{s}</span>
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
              <p className="text-[#71717A]">Fixed price. No hourly billing. No surprises.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {packages.map(pkg => (
                <div key={pkg.name} className={`p-6 rounded-2xl flex flex-col ${pkg.highlighted
                  ? "bg-white border-2 border-[#36671E] shadow-elevated"
                  : "bg-white border border-[#E8E6E0] shadow-soft"}`}>
                  {pkg.highlighted && <div className="text-xs font-bold text-[#36671E] uppercase tracking-widest mb-3">Most popular</div>}
                  <h3 className="text-lg font-black text-[#18181B] mb-1">{pkg.name}</h3>
                  <div className="text-3xl font-black text-[#18181B] mb-2">{pkg.price}</div>
                  <p className="text-sm text-[#71717A] mb-5 leading-relaxed">{pkg.description}</p>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {pkg.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#52525B]">
                        <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#36671E]" />{f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/free-audit"
                    className={`block text-center py-3 rounded-xl font-bold text-sm transition-colors ${pkg.highlighted
                      ? "bg-[#36671E] text-[#FAFAF7] hover:bg-[#295115]"
                      : "border border-[#D4D2CC] text-[#18181B] hover:bg-[#F5F4EF]"}`}>
                    Get started →
                  </Link>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-[#A1A1AA] mt-6">50% deposit · 50% on delivery · Monthly care from $69/mo</p>
          </div>
        </section>

        {/* WHAT IT'S BUILT TO DO */}
        <section className="py-16 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="p-8 rounded-2xl bg-[#FAFAF7] border border-[#E8E6E0]">
              <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-4">What it&apos;s built to do</p>
              <p className="text-[#18181B] text-lg font-semibold leading-relaxed mb-3">
                The AI receptionist qualifies leads 24/7, so a typical contractor speaks only to people who are already serious — designed to save 10+ hours a week on the phone and recover the after-hours quote requests that used to go to voicemail.
              </p>
              <p className="text-xs text-[#A1A1AA]">Illustrative target based on typical home-services benchmarks. Actual results vary.</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 bg-[#FAFAF7]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black text-[#18181B] text-center mb-10">Questions from contractors</h2>
            <div className="space-y-3">
              {faqs.map((f, i) => (
                <div key={i} className="p-5 rounded-2xl bg-white border border-[#E8E6E0]">
                  <h3 className="text-sm font-black text-[#18181B] mb-2">{f.q}</h3>
                  <p className="text-sm text-[#71717A] leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-[#36671E]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl font-black text-[#FAFAF7] mb-4">Ready to stop missing $5k jobs?</h2>
            <p className="text-[#FAFAF7]/80 mb-8 max-w-xl mx-auto">
              Get a free audit. We&apos;ll record a 5-minute Loom showing exactly what&apos;s costing you jobs and how we&apos;d fix it.
            </p>
            <Link href="/free-audit"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#FAFAF7] text-[#36671E] font-black hover:bg-white transition-colors">
              Get My Free Audit <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-[#FAFAF7]/60 mt-4 flex items-center justify-center gap-2">
              <Clock className="w-3 h-3" /> Response within 24 hours · No call required
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
