import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { CheckCircle, ArrowRight, Shield, Clock, Zap } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Servolia",
  description: "Transparent, fixed pricing for AI websites, chatbots, and lead systems. No surprises. 50% deposit, balance on delivery.",
};

const tiers = [
  {
    name: "Starter",
    price: "€690",
    usd: "$750",
    delivery: "3 days",
    desc: "The essentials to get your business found and trusted online.",
    color: "border-[#E2E8F0]",
    popular: false,
    features: [
      "5-page professional website",
      "Contact & inquiry form",
      "Google Analytics 4 setup",
      "GDPR cookie banner",
      "Privacy policy page",
      "Mobile optimized",
      "SSL & fast hosting setup",
      "2 revision rounds",
    ],
    notIncluded: ["AI chatbot", "CRM integration", "Ad tracking"],
    cta: "Get Starter",
    stripe: "/contact?plan=starter",
  },
  {
    name: "Growth",
    price: "€1,490",
    usd: "$1,600",
    delivery: "5 days",
    desc: "AI-powered website that captures leads and books clients automatically.",
    color: "border-[#4F7EF7]",
    popular: true,
    features: [
      "10-page professional website",
      "AI receptionist chatbot",
      "Appointment booking flow",
      "Lead capture + email notification",
      "Google Sheets CRM integration",
      "Meta Pixel + CAPI setup",
      "Google Analytics 4",
      "GDPR compliant pages",
      "Mobile optimized",
      "3 revision rounds",
    ],
    notIncluded: ["Admin dashboard", "Custom automations"],
    cta: "Get Growth",
    stripe: "/contact?plan=growth",
  },
  {
    name: "Pro",
    price: "€2,900",
    usd: "$3,200",
    delivery: "7 days",
    desc: "Complete AI lead system with dashboard, automations, and full tracking.",
    color: "border-[#E2E8F0]",
    popular: false,
    features: [
      "Everything in Growth",
      "Admin business dashboard",
      "Lead pipeline with statuses",
      "Automated email notifications",
      "Appointment management system",
      "Client notes & history",
      "Monthly analytics report",
      "WhatsApp lead notification",
      "A/B landing page sections",
      "Unlimited revisions (first month)",
    ],
    notIncluded: [],
    cta: "Get Pro",
    stripe: "/contact?plan=pro",
  },
];

const addons = [
  { name: "AI Chatbot (standalone)", price: "€500 setup + €99/mo", desc: "Add to any existing website. Trained on your services, available 24/7." },
  { name: "Landing Page + Ad Tracking", price: "€750 + €300/mo", desc: "High-converting page with Meta Pixel, CAPI, GA4, and lead alerts." },
  { name: "Monthly Retainer", price: "From €99/mo", desc: "Updates, chatbot retraining, analytics report, and support. Cancel anytime." },
  { name: "Business Dashboard", price: "€2,500 + €300/mo", desc: "Full admin panel: lead pipeline, appointments, CRM, notifications." },
  { name: "Additional Niche Pages", price: "€250/page", desc: "Expand into new niches. Same quality, fast delivery." },
  { name: "French → English Translation", price: "€150", desc: "Full bilingual site. Both language versions maintained." },
];

export default function PricingPage() {
  return (
    <main className="flex flex-col bg-white">
      <Navbar />

      {/* Hero */}
      <section className="bg-[#080E1C] pt-28 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-bold text-[#4F7EF7] uppercase tracking-widest mb-3">Pricing</p>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">
            Transparent pricing.{" "}
            <span className="gradient-text">No surprises.</span>
          </h1>
          <p className="text-[#94A3B8] text-lg mb-8 max-w-2xl mx-auto">
            Fixed scope, fixed price, fixed delivery date. Everything in writing before we start.
            50% deposit via Stripe · Balance on delivery.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#94A3B8]">
            <div className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-[#10B981]" /> GDPR compliant</div>
            <div className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#4F7EF7]" /> Fixed delivery</div>
            <div className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-[#818CF8]" /> No hidden fees</div>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="py-16 lg:py-20 bg-[#F8FAFF]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tiers.map((t, i) => (
              <div key={i} className={`bg-white rounded-2xl border-2 ${t.color} p-7 relative ${t.popular ? "shadow-2xl shadow-[#4F7EF7]/15" : ""}`}>
                {t.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#4F7EF7] to-[#818CF8] text-white text-xs font-black whitespace-nowrap">
                    MOST POPULAR
                  </div>
                )}
                <div className="mb-6">
                  <h2 className="text-xl font-black text-[#080E1C] mb-2">{t.name}</h2>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-black text-[#080E1C]">{t.price}</span>
                    <span className="text-[#94A3B8] text-sm">/ {t.usd}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Clock className="w-3.5 h-3.5 text-[#10B981]" />
                    <span className="text-sm font-semibold text-[#10B981]">Delivered in {t.delivery}</span>
                  </div>
                  <p className="text-[#64748B] text-sm leading-relaxed">{t.desc}</p>
                </div>

                <ul className="flex flex-col gap-2.5 mb-5">
                  {t.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-[#374151]">
                      <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                  {t.notIncluded.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-[#94A3B8]">
                      <span className="w-4 h-4 flex-shrink-0 mt-0.5 text-center">—</span>{f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={t.stripe}
                  className={`block text-center py-3.5 rounded-xl font-bold text-sm transition-all ${
                    t.popular
                      ? "bg-gradient-to-r from-[#4F7EF7] to-[#818CF8] text-white hover:opacity-90 glow-button"
                      : "border-2 border-[#E2E8F0] text-[#080E1C] hover:border-[#4F7EF7] hover:text-[#4F7EF7]"
                  }`}
                >
                  {t.cta} →
                </Link>

                <p className="text-center text-xs text-[#94A3B8] mt-3">
                  50% deposit · Balance on delivery · Stripe secured
                </p>
              </div>
            ))}
          </div>
          <p className="text-center text-[#94A3B8] text-sm mt-6">
            All prices exclude VAT. US clients billed in USD. Monthly retainer available for all plans from €99/mo.
          </p>
        </div>
      </section>

      {/* Add-ons */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#4F7EF7] uppercase tracking-widest mb-3">Add-ons & Extras</p>
            <h2 className="text-3xl font-black text-[#080E1C] mb-3">Expand your system</h2>
            <p className="text-[#64748B]">Add on to any plan or order standalone.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {addons.map((a, i) => (
              <div key={i} className="border border-[#E2E8F0] rounded-xl p-5 hover:border-[#4F7EF7]/40 hover:shadow-md transition-all">
                <h3 className="font-black text-[#080E1C] text-sm mb-1">{a.name}</h3>
                <p className="text-[#4F7EF7] font-bold text-base mb-2">{a.price}</p>
                <p className="text-[#64748B] text-sm leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ pricing */}
      <section className="py-16 bg-[#F8FAFF]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-[#080E1C] mb-2">Pricing FAQs</h2>
          </div>
          <div className="flex flex-col gap-4">
            {[
              { q: "How does payment work?", a: "50% upfront via Stripe to start the project. The remaining 50% is due on delivery day — before we transfer domain ownership and all assets to you." },
              { q: "Are there any hidden fees?", a: "Never. The price quoted is the price you pay. Third-party tools (hosting, domain, Stripe fees) are extra and disclosed upfront. Our service fee has no surprises." },
              { q: "Do you offer refunds?", a: "If we miss the agreed delivery deadline, we refund 10% per day of delay. If we fail to deliver at all, full refund. See our full refund policy in the CGV." },
              { q: "Can I upgrade plans after delivery?", a: "Yes. If you start on Starter and want to add AI chatbot or a dashboard later, we'll quote an upgrade price — never full price." },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-5">
                <h3 className="font-bold text-[#080E1C] text-sm mb-2">{f.q}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#080E1C]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-black text-white mb-4">Not sure which plan?</h2>
          <p className="text-[#94A3B8] mb-6">Get a free audit first. We'll recommend the right plan based on your business needs.</p>
          <Link href="/contact" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#4F7EF7] to-[#818CF8] text-white font-bold hover:opacity-90 transition-opacity glow-button">
            Get Free Audit <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
