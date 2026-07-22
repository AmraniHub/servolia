import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CheckoutButton from "@/components/CheckoutButton";
import CarePlansSection from "@/components/CarePlansSection";
import Guarantee from "@/components/Guarantee";
import Link from "next/link";
import {
  CheckCircle, ArrowRight, Shield, Clock, Zap,
  Globe, Smartphone, LayoutDashboard, Bot, BarChart3,
  Building2, Star,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Servolia",
  description: "Fixed pricing for AI websites, booking systems, and client management. No surprises. 50% deposit, balance on delivery.",
  alternates: {
    canonical: "https://servolia.com/pricing",
    languages: {
      "en-US": "https://servolia.com/pricing",
      "fr-FR": "https://servolia.com/fr/tarifs",
      "x-default": "https://servolia.com/pricing",
    },
  },
};

const tiers = [
  {
    plan: "starter",
    name: "Website System",
    price: "€290",
    deposit: "€145",
    usd: "~$315",
    delivery: "3 days",
    for: "For businesses that need a trusted, professional online presence",
    desc: "A conversion-first website that builds trust and turns visitors into inquiries.",
    icon: <Globe className="w-5 h-5" />,
    color: "from-[#36671E] to-[#143424]",
    popular: false,
    features: [
      "5-page professional website",
      "Booking & contact CTA",
      "Mobile-first responsive design",
      "GDPR pages included",
      "Google Analytics 4",
      "SSL & fast hosting setup",
      "2 revision rounds",
    ],
  },
  {
    plan: "growth",
    name: "Booking System",
    price: "€590",
    deposit: "€295",
    usd: "~$640",
    delivery: "5 days",
    for: "For businesses that want leads and appointments booked automatically",
    desc: "AI receptionist + website + full tracking. Your business works for you 24/7.",
    icon: <Bot className="w-5 h-5" />,
    color: "from-[#295115] to-[#6B8439]",
    popular: true,
    features: [
      "10-page professional website",
      "AI receptionist chatbot (24/7)",
      "Lead capture + email notification",
      "Appointment booking flow",
      "Google Sheets CRM integration",
      "Google Analytics 4",
      "GDPR compliant pages",
      "3 revision rounds",
    ],
  },
  {
    plan: "pro",
    name: "Client System",
    price: "€990",
    deposit: "€495",
    usd: "~$1,070",
    delivery: "7 days",
    for: "For businesses that want full tracking, dashboard, and automation",
    desc: "Complete AI lead system with dashboard, pipeline, automations, and monthly reports.",
    icon: <Building2 className="w-5 h-5" />,
    color: "from-[#F59E0B] to-[#EF4444]",
    popular: false,
    features: [
      "Everything in Booking System",
      "Admin business dashboard",
      "Lead pipeline with statuses",
      "Client notes & history",
      "Automated email notifications",
      "WhatsApp lead notification",
      "Monthly analytics report",
      "Unlimited revisions (first month)",
    ],
  },
];

const appServices = [
  {
    plan: "webapp",
    name: "Web App / SaaS MVP",
    price: "€290",
    deposit: "€145",
    delivery: "7–14 days",
    icon: <LayoutDashboard className="w-5 h-5" />,
    desc: "Custom web application, SaaS MVP, or internal tool — built and deployed to production.",
    features: ["Custom React / Next.js app", "User authentication", "Database + API backend", "Admin panel", "Vercel deployment", "1 month support"],
  },
  {
    plan: "mobile",
    name: "Mobile App (Android/iOS)",
    price: "€490",
    deposit: "€245",
    delivery: "10–15 days",
    icon: <Smartphone className="w-5 h-5" />,
    desc: "React Native app for Android (iOS optional +€100). Play Store submission included.",
    features: ["Android app (React Native)", "iOS version available +€100", "Push notifications", "User auth + API integration", "Play Store submission", "1 month support"],
  },
];

const process = [
  { num: "01", title: "Free audit", desc: "Fill a 5-question form. We send a PDF audit within 24h." },
  { num: "02", title: "Approve scope", desc: "We write the full scope in writing. You review and sign off." },
  { num: "03", title: "50% deposit", desc: "Pay the 50% deposit via Stripe to start the build." },
  { num: "04", title: "We build", desc: "3–7 days build. You get Loom walkthroughs at every step." },
  { num: "05", title: "Review + launch", desc: "You review, approve, pay balance. We go live and hand over everything." },
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
            Choose the system{" "}
            <span className="gradient-text">your business needs.</span>
          </h1>
          <p className="text-[#52525B] text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            From a professional website to a complete AI client acquisition system.
            Fixed price, clear scope, delivered fast.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#52525B]">
            <div className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-[#10B981]" /> GDPR compliant</div>
            <div className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#36671E]" /> Fixed delivery date</div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-[#635bff] flex items-center justify-center">
                <span className="text-[#18181B] text-[7px] font-black">S</span>
              </div>
              50% deposit via Stripe
            </div>
            <div className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-[#36671E]" /> No hidden fees</div>
          </div>
        </div>
      </section>

      {/* ── SYSTEM TIERS ── */}
      <section className="py-16 lg:py-20 bg-[#FAFAF7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tiers.map((t, i) => (
              <div key={i} className={`bg-white rounded-2xl border-2 p-7 relative flex flex-col ${
                t.popular ? "border-[#36671E] shadow-2xl shadow-[#ABDF90]/12" : "border-[#E8E6E0]"
              }`}>
                {t.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] text-xs font-black whitespace-nowrap">
                    MAIN OFFER
                  </div>
                )}

                {/* Header */}
                <div className="mb-5">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center text-[#FAFAF7] mb-3 shadow-md`}>
                    {t.icon}
                  </div>
                  <h2 className="text-xl font-black text-[#080E1C] mb-1">{t.name}</h2>
                  <p className="text-xs font-semibold text-[#36671E] mb-3">{t.for}</p>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-black text-[#080E1C]">{t.price}</span>
                    <span className="text-[#52525B] text-sm">{t.usd}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Clock className="w-3.5 h-3.5 text-[#10B981]" />
                    <span className="text-sm font-semibold text-[#10B981]">Delivered in {t.delivery}</span>
                  </div>
                  <p className="text-[#71717A] text-sm leading-relaxed">{t.desc}</p>
                </div>

                {/* Features — one ticked list, same as /fr/tarifs */}
                <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                  {t.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-[#374151]">
                      <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <CheckoutButton
                  plan={t.plan}
                  label={`Pay ${t.deposit} deposit →`}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 ${
                    t.popular
                      ? "bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] hover:opacity-90 shadow-lg shadow-blue-500/15"
                      : "border-2 border-[#E8E6E0] text-[#080E1C] hover:border-[#36671E] hover:text-[#36671E]"
                  }`}
                />
                <p className="text-center text-xs text-[#52525B] mt-2.5">
                  50% now via Stripe · Balance on delivery
                </p>
              </div>
            ))}
          </div>

          <p className="text-center text-[#52525B] text-sm mt-8">
            All prices exclude VAT · Prices in EUR · US clients quoted in USD separately
          </p>
        </div>
      </section>

      {/* ── WHAT HAPPENS AFTER ── */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">The Process</p>
            <h2 className="text-2xl sm:text-3xl font-black text-[#080E1C]">What happens after you choose a plan</h2>
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
                    <p className="font-black text-[#080E1C] text-sm mb-0.5">{s.title}</p>
                    <p className="text-[#71717A] text-sm">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CARE PLANS (all-in, monthly/annual) ── */}
      <CarePlansSection lang="en" />

      {/* ── APP DEVELOPMENT ── */}
      <section className="py-16 lg:py-20 bg-[#FAFAF7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">App Development</p>
            <h2 className="text-2xl sm:text-3xl font-black text-[#18181B] mb-3">Need a web app or mobile app?</h2>
            <p className="text-[#52525B] text-sm max-w-lg mx-auto">
              React Native for mobile. Next.js for web. Deployed and live — not just a Figma mockup.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {appServices.map((a, i) => (
              <div key={i} className="bg-[#F5F4EF] border border-[#D4D2CC] rounded-2xl p-6 flex flex-col backdrop-blur">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#295115] to-[#6B8439] flex items-center justify-center text-[#FAFAF7] mb-4 shadow-md">
                  {a.icon}
                </div>
                <h3 className="text-lg font-black text-[#18181B] mb-1">{a.name}</h3>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-black text-[#18181B]">{a.price}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-3">
                  <Clock className="w-3.5 h-3.5 text-[#10B981]" />
                  <span className="text-xs font-semibold text-[#10B981]">Delivered in {a.delivery}</span>
                </div>
                <p className="text-[#52525B] text-sm mb-4 leading-relaxed">{a.desc}</p>
                <ul className="flex flex-col gap-2 mb-6 flex-1">
                  {a.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-[#3F3F46]">
                      <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                <CheckoutButton
                  plan={a.plan}
                  label={`Pay ${a.deposit} deposit →`}
                  className="w-full py-3.5 rounded-xl font-bold text-sm border-2 border-[#D4D2CC] text-[#18181B] hover:bg-[#F0EFEA] transition-all disabled:opacity-60"
                />
                <p className="text-center text-xs text-[#A1A1AA] mt-2.5">50% now via Stripe · Balance on delivery</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Guarantee lang="en" />

      {/* ── PRICING FAQ ── */}
      <section className="py-16 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-[#080E1C] mb-2">Pricing FAQs</h2>
          </div>
          <div className="flex flex-col gap-4">
            {[
              { q: "How does payment work?", a: "50% upfront via Stripe to start the project. The remaining 50% is due on delivery day — before we transfer domain ownership and all assets to you." },
              { q: "Are there any hidden fees?", a: "Never. The price quoted is the price you pay. Third-party tools (hosting, domain, Stripe fees) are extra and disclosed upfront. Our service fee has no surprises." },
              { q: "Do you offer refunds?", a: "If we miss the agreed delivery deadline, we refund 10% per day of delay. If we fail to deliver at all, full refund. See our full refund policy in the CGV." },
              { q: "Can I upgrade plans after delivery?", a: "Yes. If you start on Website System and want to add AI chatbot or a dashboard later, we quote an upgrade price — never the full plan price." },
              { q: "Does the mobile app work on both Android and iOS?", a: "We build with React Native so the same code runs on both. Android app and Play Store submission is included. iOS version is +€100, App Store submission +€100 extra." },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E8E6E0] p-5 shadow-sm">
                <h3 className="font-bold text-[#080E1C] text-sm mb-2">{f.q}</h3>
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
