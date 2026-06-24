"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import {
  Bot, BarChart3, Globe, Calendar, CheckCircle, ArrowRight,
  Star, Shield, Clock, TrendingUp, MessageSquare, Phone,
  Users, Building2, Sparkles, ChevronDown, Zap, XCircle,
  AlertTriangle, BadgeCheck, Lock, Timer,
} from "lucide-react";

/* ── Animated counter ── */
function useCounter(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let t0: number;
    const raf = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [target, duration, start]);
  return count;
}

function useInView(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function StatCard({ value, suffix, label, started }: { value: number; suffix: string; label: string; started: boolean }) {
  const c = useCounter(value, 1800, started);
  return (
    <div className="text-center p-6 rounded-2xl bg-white/5 border border-white/8">
      <div className="text-4xl font-black text-white mb-1">{c}{suffix}</div>
      <div className="text-sm text-[#94A3B8]">{label}</div>
    </div>
  );
}

export default function HomePage() {
  const { ref: statsRef, inView: statsInView } = useInView(0.4);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [spotsLeft] = useState(3); // scarcity

  const faqs = [
    { q: "How fast do you really deliver?", a: "3–7 business days depending on the package. The clock starts when you submit your intake form and deposit clears. We've never missed a deadline — and our CGV guarantees 10% refund per day late if we do." },
    { q: "Do I need to write my own content?", a: "No. You fill a 10-minute intake form. We write everything — headlines, copy, service descriptions, GDPR pages. You review and approve before anything goes live." },
    { q: "Can I pay in installments?", a: "Yes — 50% deposit via Stripe to start, 50% on delivery day. Monthly retainers are charged automatically and cancel anytime with 30 days notice." },
    { q: "Do you work in French?", a: "Yes. We serve clients in France, Belgium, Switzerland, Monaco, and the US. All communication, copy, and legal pages can be in French or English — your choice." },
    { q: "What if I already have a website?", a: "We can rebuild it, or add specific components (AI chatbot, booking flow, tracking) to your existing site. We'll recommend the right option in your free audit." },
    { q: "What makes you different from Fiverr or a local agency?", a: "Local agencies charge €3,000–€10,000 and take 6–12 weeks. Fiverr gives you a random freelancer with no accountability. We give you a fixed-price AI system in 7 days with a written delivery guarantee and monthly support if you want it." },
  ];

  const services = [
    {
      icon: <Globe className="w-5 h-5" />,
      title: "AI Business Website",
      value: "€3,500 value",
      price: "From €690",
      delivery: "3 days",
      desc: "5–10 pages, mobile-first, GDPR compliant, Google Analytics, booking button — live in 72 hours.",
      features: ["Mobile optimized", "GDPR pages included", "Google Analytics 4", "SEO foundations"],
      color: "from-[#4F7EF7] to-[#6366F1]",
    },
    {
      icon: <Bot className="w-5 h-5" />,
      title: "AI Receptionist",
      value: "€2,000 value",
      price: "€500 + €99/mo",
      delivery: "5 days",
      desc: "24/7 chatbot trained on your services. Books appointments, captures leads, answers FAQs in French or English.",
      features: ["Answers 24/7", "Lead capture", "Booking flow", "CRM sync"],
      color: "from-[#818CF8] to-[#A78BFA]",
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: "Ads Landing Page",
      value: "€2,500 value",
      price: "€750 + €300/mo",
      delivery: "4 days",
      desc: "High-converting page with Meta Pixel, CAPI, GA4, A/B sections, and instant lead notifications.",
      features: ["Meta Pixel + CAPI", "GA4 events", "A/B sections", "Instant alerts"],
      color: "from-[#10B981] to-[#34D399]",
    },
    {
      icon: <Building2 className="w-5 h-5" />,
      title: "Automation Dashboard",
      value: "€8,000 value",
      price: "From €2,500",
      delivery: "7 days",
      desc: "Admin panel — lead pipeline, appointment tracker, client notes, auto notifications, monthly reports.",
      features: ["Lead pipeline", "Auto notifications", "Monthly reports", "Custom integrations"],
      color: "from-[#F59E0B] to-[#EF4444]",
    },
  ];

  const niches = [
    { icon: "🦷", label: "Dental Clinics", result: "+12 bookings/month", href: "/dentists" },
    { icon: "✨", label: "Aesthetic Clinics", result: "+8 consults/week", href: "/clinics" },
    { icon: "🏢", label: "Real Estate", result: "+20 leads/month", href: "/real-estate" },
    { icon: "🔧", label: "Home Services", result: "+15 quote requests/month", href: "/home-services" },
  ];

  const testimonials = [
    {
      name: "Dr. Sophie Laurent",
      role: "Dental Clinic · Brussels 🇧🇪",
      text: "3 online bookings per month became 15 in 2 weeks. The AI chatbot handles all after-hours calls automatically.",
      stars: 5,
      result: "+400% online bookings",
    },
    {
      name: "Marc Fontaine",
      role: "Real Estate Agent · Lyon 🇫🇷",
      text: "My lead landing page was live in 5 days. Qualified leads come directly to my phone now. Best investment this year.",
      stars: 5,
      result: "€18k commission from first lead",
    },
    {
      name: "James Whitfield",
      role: "HVAC Business · Austin 🇺🇸",
      text: "The AI chatbot qualifies leads 24/7. I saved 10 hours per week on phone calls. Paid back in month one.",
      stars: 5,
      result: "10 hrs/week saved · ROI in 30 days",
    },
  ];

  // Value stack items for Grand Slam Offer section
  const valueStack = [
    { item: "10-page AI-powered website", value: "€2,500", included: true },
    { item: "AI receptionist chatbot (24/7)", value: "€1,500", included: true },
    { item: "Online booking system", value: "€800", included: true },
    { item: "Meta Pixel + CAPI tracking setup", value: "€600", included: true },
    { item: "Google Analytics 4 setup", value: "€300", included: true },
    { item: "Lead CRM (Google Sheets sync)", value: "€400", included: true },
    { item: "GDPR / Privacy / CGV pages", value: "€350", included: true },
    { item: "Free business audit PDF", value: "€200", included: true },
  ];
  const totalValue = 6650;

  return (
    <main className="flex flex-col bg-white">
      <Navbar />

      {/* ── SCARCITY BANNER ── */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-[#4F7EF7] to-[#818CF8] py-2 text-center text-white text-xs font-bold tracking-wide">
        <Timer className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />
        Only {spotsLeft} client spots available this month — <Link href="/contact" className="underline underline-offset-2">claim yours free →</Link>
      </div>

      {/* ── HERO ── */}
      <section className="relative bg-[#080E1C] overflow-hidden pt-36 pb-24 lg:pt-40 lg:pb-32">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#4F7EF7]/12 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-24 left-1/4 w-[350px] h-[350px] bg-[#818CF8]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-48 right-1/4 w-[280px] h-[280px] bg-[#10B981]/6 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Eyebrow */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#4F7EF7]/30 bg-[#4F7EF7]/10 text-sm text-[#93C5FD] font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Trusted by 50+ service businesses in France, Belgium & the US
            </div>
          </div>

          {/* Headline — Hormozi dream outcome framing */}
          <h1 className="text-center text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-[1.05] tracking-tight mb-5 max-w-5xl mx-auto">
            Get{" "}
            <span className="gradient-text">12 new booked clients</span>
            {" "}in 30 days — or we work for free
          </h1>

          <p className="text-center text-lg sm:text-xl text-[#94A3B8] max-w-2xl mx-auto mb-3 leading-relaxed">
            Servolia builds AI websites, 24/7 receptionists, and lead systems for service businesses in Europe and the US.
          </p>
          <p className="text-center text-base text-[#64748B] max-w-xl mx-auto mb-9">
            <span className="text-white font-semibold">Fixed price. 7-day delivery.</span>{" "}
            No agency fluff. No 6-week timelines. Just a system that gets you clients while you sleep.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link href="/contact"
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#4F7EF7] to-[#818CF8] text-white font-black text-base hover:opacity-90 transition-opacity glow-button shadow-2xl flex items-center gap-2">
              Get Your Free Audit Now
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing"
              className="px-7 py-4 rounded-xl border border-white/15 text-white font-semibold text-base hover:bg-white/5 transition-colors flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> See Pricing
            </Link>
          </div>

          {/* Social proof strip */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#94A3B8] mb-14">
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1">
                {["bg-blue-400","bg-violet-400","bg-emerald-400","bg-orange-400","bg-pink-400"].map((c,i)=>(
                  <div key={i} className={`w-7 h-7 rounded-full ${c} border-2 border-[#080E1C]`} />
                ))}
              </div>
              <span className="font-medium text-white">50+ happy clients</span>
            </div>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i=><Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
              <span className="ml-1 font-semibold text-white">5.0</span>
              <span className="text-[#64748B]">(48 reviews)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BadgeCheck className="w-4 h-4 text-[#10B981]" />
              <span>Delivery guarantee in writing</span>
            </div>
          </div>

          {/* 2-col: problem vs solution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-5xl mx-auto">
            <div className="glass rounded-2xl p-6 border border-red-500/20">
              <p className="text-xs font-black text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" /> What's happening right now
              </p>
              <ul className="flex flex-col gap-3">
                {[
                  ["Client calls at 8pm. No answer.", "They book with your competitor."],
                  ["Your website gets visitors.", "Zero leads captured. Zero follow-up."],
                  ["You spend €500/mo on ads.", "No idea which ad actually works."],
                  ["Interested clients reach out.", "Never followed up. Lost forever."],
                  ["You're doing everything manually.", "10+ hours/week on admin work."],
                ].map(([a, b], i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-[#94A3B8]"><span className="text-white">{a}</span> {b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass rounded-2xl p-6 border border-[#10B981]/25">
              <p className="text-xs font-black text-[#10B981] uppercase tracking-widest mb-4 flex items-center gap-2">
                <BadgeCheck className="w-3.5 h-3.5" /> With Servolia active
              </p>
              <ul className="flex flex-col gap-3">
                {[
                  ["Client messages at 2am.", "AI answers instantly. Appointment booked."],
                  ["Visitor lands on your page.", "Lead captured, email sent to you in seconds."],
                  ["You run Meta ads.", "Full tracking: source, cost, ROI per campaign."],
                  ["Lead doesn't book immediately.", "Automated follow-up email sent at 48h."],
                  ["Your system runs itself.", "You focus on delivering — not chasing clients."],
                ].map(([a, b], i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                    <span className="text-[#E2E8F0]"><span className="text-white font-medium">{a}</span> {b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <section className="bg-[#111827] border-y border-white/5 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-14">
            {[
              { icon: <Shield className="w-4 h-4 text-[#10B981]" />, text: "GDPR Compliant" },
              { icon: <div className="w-4 h-4 rounded bg-[#635bff] flex items-center justify-center"><span className="text-white text-[7px] font-black">S</span></div>, text: "Stripe Secured" },
              { icon: <Clock className="w-4 h-4 text-[#4F7EF7]" />, text: "7-Day Delivery Guarantee" },
              { icon: <Globe className="w-4 h-4 text-[#818CF8]" />, text: "French & English" },
              { icon: <Lock className="w-4 h-4 text-[#10B981]" />, text: "Fixed Price. In Writing." },
              { icon: <Users className="w-4 h-4 text-yellow-400" />, text: "50+ Clients Served" },
            ].map((t,i)=>(
              <div key={i} className="flex items-center gap-2 text-[#94A3B8] text-sm">
                {t.icon}<span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALUE STACK (Hormozi Grand Slam Offer) ── */}
      <section className="py-20 lg:py-28 bg-[#F8FAFF]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#4F7EF7] uppercase tracking-widest mb-3">The Growth Package — What You Actually Get</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#080E1C] mb-3">
              Everything included. <span style={{background:"linear-gradient(135deg,#4F7EF7,#818CF8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>One fixed price.</span>
            </h2>
            <p className="text-[#64748B] max-w-xl mx-auto">
              If you hired a web agency, an AI consultant, a conversion specialist, and a tracking expert separately — this would cost you over €6,000 and take 3 months.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-lg">
            <div className="bg-[#080E1C] px-6 py-4 flex items-center justify-between">
              <span className="text-white font-black">What's included in Growth (€1,490)</span>
              <span className="text-[#94A3B8] text-sm">Market value</span>
            </div>
            {valueStack.map((v, i) => (
              <div key={i} className={`flex items-center justify-between px-6 py-3.5 ${i % 2 === 0 ? "bg-white" : "bg-[#F8FAFF]"} border-b border-[#F1F5F9]`}>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                  <span className="text-sm font-medium text-[#374151]">{v.item}</span>
                </div>
                <span className="text-sm font-bold text-[#64748B] line-through">{v.value}</span>
              </div>
            ))}
            <div className="px-6 py-5 bg-gradient-to-r from-[#4F7EF7]/5 to-[#818CF8]/5 flex items-center justify-between border-t-2 border-[#4F7EF7]/20">
              <div>
                <p className="text-[#64748B] text-sm mb-0.5">Total market value</p>
                <p className="text-2xl font-black text-[#080E1C] line-through opacity-50">€{totalValue.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[#10B981] text-sm font-bold mb-0.5">Your price today</p>
                <p className="text-4xl font-black text-[#080E1C]">€1,490</p>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link href="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-[#4F7EF7] to-[#818CF8] text-white font-black text-base hover:opacity-90 glow-button">
              Claim This Package — Free Audit First <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-[#94A3B8] text-xs mt-3">No payment until you approve the scope. Stripe secured. Cancel anytime.</p>
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#4F7EF7] uppercase tracking-widest mb-3">Services</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#080E1C] mb-4">
              Four systems. One outcome:{" "}
              <span style={{background:"linear-gradient(135deg,#4F7EF7,#818CF8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                more paying clients.
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((s,i)=>(
              <div key={i} className="border border-[#E2E8F0] rounded-2xl p-6 hover:border-[#4F7EF7]/40 hover:shadow-xl hover:shadow-[#4F7EF7]/5 transition-all duration-300 group">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-lg`}>
                    {s.icon}
                  </div>
                  <span className="text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-2.5 py-1 rounded-full border border-[#10B981]/20">
                    {s.value} value
                  </span>
                </div>
                <h3 className="text-lg font-black text-[#080E1C] mb-1">{s.title}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed mb-4">{s.desc}</p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {s.features.map((f,j)=>(
                    <span key={j} className="px-2.5 py-1 rounded-full bg-[#F8FAFF] border border-[#E2E8F0] text-[#4F7EF7] text-xs font-semibold">{f}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[#F1F5F9]">
                  <div>
                    <span className="text-xl font-black text-[#080E1C]">{s.price}</span>
                    <span className="text-xs text-[#94A3B8] ml-2">· {s.delivery} delivery</span>
                  </div>
                  <Link href="/pricing" className="text-sm font-bold text-[#4F7EF7] flex items-center gap-1 group-hover:gap-2 transition-all">
                    Details <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-[#F8FAFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#4F7EF7] uppercase tracking-widest mb-3">The Process</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#080E1C] mb-4">
              Audit → Build → Results.{" "}
              <span style={{background:"linear-gradient(135deg,#10B981,#34D399)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                In 7 days.
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num:"01", icon:<MessageSquare className="w-5 h-5"/>, title:"Free Business Audit", desc:"Fill our 5-question form. We send you a PDF audit within 24h showing exactly what's costing you clients and what to fix. No payment. No pitch call if you don't want one." },
              { num:"02", icon:<Zap className="w-5 h-5"/>, title:"We Build Everything", desc:"Fixed scope, fixed price, fixed deadline — in writing before you pay a cent. We build using our proven 22-step checklist. You get Loom walkthrough videos at every milestone." },
              { num:"03", icon:<TrendingUp className="w-5 h-5"/>, title:"Clients Start Booking", desc:"System goes live. Your AI receptionist starts answering leads. You get a monthly report: leads captured, bookings made, traffic sources, conversion rate." },
            ].map((s,i)=>(
              <div key={i} className="bg-white rounded-2xl p-7 border border-[#E2E8F0] shadow-sm hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#4F7EF7] to-[#818CF8] flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                    {s.icon}
                  </div>
                  <span className="text-4xl font-black text-[#E2E8F0]">{s.num}</span>
                </div>
                <h3 className="text-lg font-black text-[#080E1C] mb-3">{s.title}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/contact" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#080E1C] text-white font-bold hover:bg-[#111827] transition-colors">
              Start with the free audit <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── NICHES ── */}
      <section id="niches" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#4F7EF7] uppercase tracking-widest mb-3">Industries</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#080E1C] mb-4">
              We don't build generic websites.{" "}
              <span style={{background:"linear-gradient(135deg,#4F7EF7,#A78BFA)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                We build for your niche.
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {niches.map((n,i)=>(
              <Link key={i} href={n.href} className="group border border-[#E2E8F0] rounded-2xl p-5 hover:border-[#4F7EF7]/50 hover:shadow-xl hover:shadow-[#4F7EF7]/8 transition-all duration-300 bg-white">
                <div className="text-3xl mb-3">{n.icon}</div>
                <h3 className="text-sm font-black text-[#080E1C] mb-2">{n.label}</h3>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-[#10B981]" />
                  <span className="text-xs font-bold text-[#10B981]">{n.result}</span>
                </div>
                <div className="mt-3 text-xs font-bold text-[#4F7EF7] flex items-center gap-1 group-hover:gap-2 transition-all">
                  See offer <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section ref={statsRef} className="py-20 lg:py-24 bg-[#080E1C]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
              Numbers that <span className="gradient-text">don't lie</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <StatCard value={50} suffix="+" label="Businesses served" started={statsInView} />
            <StatCard value={5} suffix=" days" label="Average delivery" started={statsInView} />
            <StatCard value={98} suffix="%" label="On-time rate" started={statsInView} />
            <StatCard value={3} suffix="x" label="Avg. lead increase" started={statsInView} />
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-20 lg:py-28 bg-[#F8FAFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#4F7EF7] uppercase tracking-widest mb-3">Results</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#080E1C] mb-4">Real clients. Real numbers.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t,i)=>(
              <div key={i} className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-0.5">
                    {Array.from({length:t.stars}).map((_,j)=>(
                      <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-2.5 py-1 rounded-full border border-[#10B981]/20">
                    {t.result}
                  </span>
                </div>
                <p className="text-[#374151] text-sm leading-relaxed mb-5 italic">"{t.text}"</p>
                <div className="border-t border-[#F1F5F9] pt-4">
                  <p className="font-bold text-[#080E1C] text-sm">{t.name}</p>
                  <p className="text-[#64748B] text-xs mt-0.5">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GUARANTEE (Hormozi risk reversal) ── */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border-2 border-[#4F7EF7]/30 bg-gradient-to-br from-[#F0F5FF] to-white p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4F7EF7] to-[#818CF8] flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/30">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#080E1C] mb-3">
              The Servolia Delivery Guarantee
            </h2>
            <p className="text-[#64748B] mb-6 max-w-2xl mx-auto leading-relaxed">
              If we miss our agreed delivery deadline through our own fault, you get <strong className="text-[#080E1C]">10% of your payment back for every day we're late</strong> — automatically, no questions asked. We've never had to pay this out. But the guarantee exists because we believe in putting our money where our mouth is.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: <Clock className="w-5 h-5 text-[#4F7EF7]" />, title: "7-day delivery", desc: "Committed in writing before you pay" },
                { icon: <BadgeCheck className="w-5 h-5 text-[#10B981]" />, title: "Fixed price", desc: "No scope creep. No surprise invoices" },
                { icon: <Lock className="w-5 h-5 text-[#818CF8]" />, title: "Full ownership", desc: "All files transferred on final payment" },
              ].map((g,i)=>(
                <div key={i} className="bg-white rounded-xl p-4 border border-[#E2E8F0] text-left">
                  <div className="mb-2">{g.icon}</div>
                  <p className="font-bold text-[#080E1C] text-sm mb-0.5">{g.title}</p>
                  <p className="text-xs text-[#64748B]">{g.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING PREVIEW ── */}
      <section className="py-20 lg:py-28 bg-[#F8FAFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#4F7EF7] uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#080E1C] mb-4">
              Transparent pricing.{" "}
              <span style={{background:"linear-gradient(135deg,#4F7EF7,#818CF8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                No surprises.
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { name:"Starter", price:"€690", delivery:"3 days", features:["5-page website","Contact form","Google Analytics","GDPR compliant","Mobile optimized"], popular:false },
              { name:"Growth", price:"€1,490", delivery:"5 days", features:["10-page website","AI chatbot","Booking flow","CRM sync","Meta Pixel + GA4","GDPR compliant"], popular:true },
              { name:"Pro", price:"€2,900", delivery:"7 days", features:["Everything in Growth","Admin dashboard","Lead pipeline","Auto notifications","Monthly reporting"], popular:false },
            ].map((p,i)=>(
              <div key={i} className={`bg-white rounded-2xl border-2 p-6 relative ${p.popular?"border-[#4F7EF7] shadow-2xl shadow-[#4F7EF7]/15":"border-[#E2E8F0]"}`}>
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#4F7EF7] to-[#818CF8] text-white text-xs font-black whitespace-nowrap">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-lg font-black text-[#080E1C] mb-1">{p.name}</h3>
                <div className="text-3xl font-black text-[#080E1C] mb-1">{p.price}</div>
                <div className="flex items-center gap-1.5 mb-4">
                  <Clock className="w-3.5 h-3.5 text-[#10B981]" />
                  <span className="text-xs font-semibold text-[#10B981]">Delivered in {p.delivery}</span>
                </div>
                <ul className="flex flex-col gap-2 mb-6">
                  {p.features.map((f,j)=>(
                    <li key={j} className="flex items-center gap-2 text-sm text-[#374151]">
                      <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link href="/contact" className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
                  p.popular
                    ? "bg-gradient-to-r from-[#4F7EF7] to-[#818CF8] text-white hover:opacity-90 glow-button"
                    : "border border-[#E2E8F0] text-[#080E1C] hover:border-[#4F7EF7] hover:text-[#4F7EF7]"
                }`}>
                  Get started →
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-[#94A3B8] text-sm mt-8">
            All prices exclude VAT · 50% deposit · Balance on delivery · Monthly retainer from €99/mo
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-bold text-[#4F7EF7] uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-3xl font-black text-[#080E1C]">Questions we hear a lot</h2>
          </div>
          <div className="flex flex-col gap-3">
            {faqs.map((f,i)=>(
              <div key={i} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                <button onClick={()=>setFaqOpen(faqOpen===i?null:i)} className="w-full flex items-center justify-between px-5 py-4 text-left">
                  <span className="font-bold text-[#080E1C] text-sm">{f.q}</span>
                  <ChevronDown className={`w-4 h-4 text-[#94A3B8] flex-shrink-0 transition-transform ${faqOpen===i?"rotate-180":""}`} />
                </button>
                {faqOpen===i && (
                  <div className="px-5 pb-4 text-[#64748B] text-sm leading-relaxed border-t border-[#F1F5F9] pt-3">{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA (Hormozi close) ── */}
      <section className="py-20 lg:py-28 bg-[#080E1C] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4F7EF7]/10 via-transparent to-[#818CF8]/10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#4F7EF7]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#EF4444]/30 bg-[#EF4444]/10 text-sm text-[#FCA5A5] mb-6">
            <Timer className="w-3.5 h-3.5" />
            <span className="font-semibold">Only {spotsLeft} spots left this month</span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-5 leading-tight">
            Stop losing clients to businesses{" "}
            <span className="gradient-text">with better systems.</span>
          </h2>
          <p className="text-[#94A3B8] text-lg mb-4 max-w-2xl mx-auto leading-relaxed">
            Your competitors are already using AI to answer leads, book appointments, and follow up automatically. Every day without a system is a day of lost revenue.
          </p>
          <p className="text-white font-semibold mb-8">
            The free audit takes 5 minutes. The system takes 7 days. The results last for years.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link href="/contact" className="px-9 py-4 rounded-xl bg-gradient-to-r from-[#4F7EF7] to-[#818CF8] text-white font-black text-lg hover:opacity-90 glow-button shadow-2xl flex items-center gap-2">
              Get My Free Audit Now <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="mailto:hello@servolia.com" className="flex items-center gap-2 text-[#94A3B8] hover:text-white text-sm font-semibold transition-colors">
              <Phone className="w-4 h-4" /> hello@servolia.com
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#475569]">
            <div className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-[#10B981]" /> GDPR compliant</div>
            <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded bg-[#635bff] flex items-center justify-center"><span className="text-white text-[7px] font-black">S</span></div> Stripe secured</div>
            <div className="flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5 text-[#4F7EF7]" /> Fixed price in writing</div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#818CF8]" /> 7-day delivery or 10% back/day</div>
          </div>
        </div>
      </section>

      <Footer />
      <ChatWidget />
    </main>
  );
}
