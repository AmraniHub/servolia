"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import {
  Bot, BarChart3, Globe, CheckCircle, ArrowRight,
  Star, Shield, Clock, TrendingUp, MessageSquare, Phone,
  Users, Building2, Sparkles, ChevronDown, Zap, XCircle,
  AlertTriangle, BadgeCheck, Lock, Calendar, LayoutDashboard, FileText,
} from "lucide-react";

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
    <div className="text-center p-6 rounded-2xl bg-white/5 border border-white/10">
      <div className="text-4xl font-black text-white mb-1">{c}{suffix}</div>
      <div className="text-sm text-[#94A3B8]">{label}</div>
    </div>
  );
}

export default function HomePage() {
  const { ref: statsRef, inView: statsInView } = useInView(0.4);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const faqs = [
    { q: "How fast do you really deliver?", a: "3–7 business days depending on the package. The clock starts when you submit your intake form and deposit clears. We've never missed a deadline — our CGV guarantees 10% refund per day late if we do." },
    { q: "Do I need to write my own content?", a: "No. You fill a 10-minute intake form. We write everything — headlines, copy, service descriptions, GDPR pages. You review and approve before anything goes live." },
    { q: "Can I pay in installments?", a: "Yes — 50% deposit via Stripe to start, 50% on delivery day. Monthly retainers are charged automatically and cancel anytime with 30 days notice." },
    { q: "Do you work in French?", a: "Yes. We serve clients in France, Belgium, Switzerland, Monaco, and the US. All communication, copy, and legal pages can be in French or English — your choice." },
    { q: "What if I already have a website?", a: "We can rebuild it, or add specific components (AI chatbot, booking flow, tracking) to your existing site. We'll recommend the right option in your free audit." },
    { q: "What makes you different from Fiverr or a local agency?", a: "Local agencies charge €3,000–€10,000 and take 6–12 weeks. Fiverr gives you a random freelancer with no accountability. We give you a fixed-price AI system in 7 days with a written delivery guarantee and monthly support." },
  ];

  const systems = [
    {
      num: "01",
      icon: <Globe className="w-5 h-5" />,
      title: "AI Website System",
      for: "For businesses with an outdated or missing online presence",
      price: "From €790",
      delivery: "3 days",
      desc: "A professional website built to convert visitors into inquiries — mobile-first, GDPR-ready, live in 72 hours.",
      features: ["5–10 conversion-focused pages", "Booking & contact CTA", "Google Analytics 4", "GDPR pages included"],
      color: "from-[#95BF47] to-[#5A8A1E]",
      highlight: false,
    },
    {
      num: "02",
      icon: <Bot className="w-5 h-5" />,
      title: "AI Booking System",
      for: "For businesses that want leads and appointments on autopilot",
      price: "€1,490",
      delivery: "5 days",
      desc: "AI receptionist + website + full tracking. Books appointments, captures leads, answers FAQs 24/7 in French or English.",
      features: ["Everything in Website System", "AI receptionist chatbot", "Lead capture + CRM sync", "Meta Pixel + GA4"],
      color: "from-[#6BA52A] to-[#8FBF3A]",
      highlight: true,
    },
    {
      num: "03",
      icon: <BarChart3 className="w-5 h-5" />,
      title: "Ads Landing System",
      for: "For businesses running or planning paid ad campaigns",
      price: "€750 + €300/mo",
      delivery: "4 days",
      desc: "High-converting landing page with full Meta + GA4 tracking. Know exactly which ad drives revenue.",
      features: ["Conversion-focused page", "Meta Pixel + CAPI", "GA4 event tracking", "Instant lead alerts"],
      color: "from-[#10B981] to-[#34D399]",
      highlight: false,
    },
    {
      num: "04",
      icon: <Building2 className="w-5 h-5" />,
      title: "Client System",
      for: "For businesses that need complete lead and client management",
      price: "From €2,900",
      delivery: "7 days",
      desc: "Complete AI system — website, chatbot, admin dashboard, lead pipeline, automations, and monthly reports.",
      features: ["Everything in Booking System", "Admin dashboard", "Lead pipeline + history", "Monthly analytics report"],
      color: "from-[#F59E0B] to-[#EF4444]",
      highlight: false,
    },
  ];

  const carePlans = [
    {
      name: "Care",
      price: "€99/mo",
      desc: "Maintenance, small edits, and uptime monitoring.",
      features: ["Uptime monitoring", "Content edits (1h/mo)", "Security updates", "Email support"],
      popular: false,
    },
    {
      name: "Growth",
      price: "€199/mo",
      desc: "Analytics reporting, chatbot updates, and monthly improvements.",
      features: ["Everything in Care", "Chatbot retraining", "Monthly analytics report", "2h of improvements/mo"],
      popular: true,
    },
    {
      name: "Scale",
      price: "€399/mo",
      desc: "Full monthly optimization: A/B testing, CRM, and conversion review.",
      features: ["Everything in Growth", "A/B test improvements", "CRM workflow updates", "Monthly strategy call"],
      popular: false,
    },
  ];

  const valueStack = [
    { item: "10-page conversion website", value: "€2,500" },
    { item: "AI receptionist chatbot (24/7)", value: "€1,500" },
    { item: "Appointment booking flow", value: "€800" },
    { item: "Meta Pixel + CAPI tracking", value: "€600" },
    { item: "Google Analytics 4 setup", value: "€300" },
    { item: "Lead CRM (Google Sheets sync)", value: "€400" },
    { item: "GDPR / Privacy / CGV pages", value: "€350" },
    { item: "Free business audit PDF", value: "€200" },
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

  return (
    <main className="flex flex-col bg-white">
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative bg-[#080E1C] overflow-hidden pt-28 pb-24 lg:pt-36 lg:pb-32">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#95BF47]/12 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-32 left-1/4 w-[320px] h-[320px] bg-[#6BA52A]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-48 right-1/4 w-[260px] h-[260px] bg-[#10B981]/6 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#95BF47]/30 bg-[#95BF47]/10 text-sm text-[#95BF47] font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Trusted by 50+ service businesses in France, Belgium & the US
            </div>
          </div>

          <h1 className="text-center text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6 max-w-5xl mx-auto">
            Turn your website into a{" "}
            <span className="gradient-text">24/7 client acquisition system.</span>
          </h1>

          <p className="text-center text-lg sm:text-xl text-[#94A3B8] max-w-2xl mx-auto mb-4 leading-relaxed">
            Servolia builds AI websites, receptionists, booking flows, and lead tracking systems for dentists, clinics, real estate agents, and local service businesses in Europe and the US.
          </p>
          <p className="text-center text-base font-semibold text-white max-w-xl mx-auto mb-10">
            Fixed scope · Fixed price · Delivered in 7 days
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/contact"
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#95BF47] to-[#6BA52A] text-[#0B1800] font-black text-base hover:opacity-90 transition-opacity glow-button shadow-2xl flex items-center gap-2">
              Get Your Free Audit
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing"
              className="px-7 py-4 rounded-xl border border-white/15 text-white font-semibold text-base hover:bg-white/5 transition-colors flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> View Pricing
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#94A3B8]">
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
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <section className="bg-white border-b border-[#F1F5F9] py-5 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-14">
            {[
              { icon: <Shield className="w-4 h-4 text-[#10B981]" />, text: "GDPR Compliant" },
              { icon: <div className="w-4 h-4 rounded bg-[#635bff] flex items-center justify-center"><span className="text-white text-[7px] font-black">S</span></div>, text: "Stripe Secured" },
              { icon: <Clock className="w-4 h-4 text-[#95BF47]" />, text: "7-Day Delivery Guarantee" },
              { icon: <Globe className="w-4 h-4 text-[#6BA52A]" />, text: "French & English" },
              { icon: <Lock className="w-4 h-4 text-[#10B981]" />, text: "Fixed Price — In Writing" },
              { icon: <Users className="w-4 h-4 text-yellow-500" />, text: "50+ Clients Served" },
            ].map((t,i)=>(
              <div key={i} className="flex items-center gap-2 text-[#64748B] text-sm font-medium">
                {t.icon}<span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── JOURNEY FLOW ── */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#95BF47] uppercase tracking-widest mb-3">How the system works</p>
            <h2 className="text-2xl sm:text-3xl font-black text-[#080E1C] mb-3">
              Servolia connects your full client journey.
            </h2>
            <p className="text-[#64748B] max-w-xl mx-auto text-sm">
              From first visit to booked appointment and monthly report — all automated, all in one system.
            </p>
          </div>

          {/* Flow steps */}
          <div className="relative">
            {/* Connector line — desktop only */}
            <div className="hidden lg:block absolute top-10 left-[8%] right-[8%] h-px bg-gradient-to-r from-transparent via-[#95BF47]/30 to-transparent pointer-events-none" />

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 lg:gap-2">
              {[
                { icon: <Users className="w-5 h-5" />, label: "Visitor", sub: "Lands on your site", color: "from-[#64748B] to-[#94A3B8]" },
                { icon: <Globe className="w-5 h-5" />, label: "AI Website", sub: "Builds trust instantly", color: "from-[#95BF47] to-[#5A8A1E]" },
                { icon: <Bot className="w-5 h-5" />, label: "AI Receptionist", sub: "Answers 24/7", color: "from-[#6BA52A] to-[#8FBF3A]" },
                { icon: <Calendar className="w-5 h-5" />, label: "Booking Request", sub: "Captured automatically", color: "from-[#10B981] to-[#34D399]" },
                { icon: <LayoutDashboard className="w-5 h-5" />, label: "CRM Dashboard", sub: "Lead tracked & managed", color: "from-[#F59E0B] to-[#EF4444]" },
                { icon: <FileText className="w-5 h-5" />, label: "Monthly Report", sub: "ROI tracked & optimized", color: "from-[#06B6D4] to-[#95BF47]" },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center text-center group">
                  <div className={`relative w-20 h-20 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white shadow-lg mb-3 group-hover:scale-105 transition-transform duration-200`}>
                    {step.icon}
                    {i < 5 && (
                      <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 items-center justify-center z-10">
                        <ArrowRight className="w-4 h-4 text-[#CBD5E1]" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-black text-[#080E1C] mb-0.5">{step.label}</p>
                  <p className="text-[10px] text-[#94A3B8] leading-tight max-w-[90px]">{step.sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center mt-10">
            <Link href="/contact" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#95BF47] to-[#6BA52A] text-[#0B1800] font-bold text-sm hover:opacity-90 transition-opacity glow-button">
              Get a system like this for your business <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── PROBLEM / SOLUTION ── */}
      <section className="py-20 lg:py-28 bg-[#F5F5F5]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-bold text-[#95BF47] uppercase tracking-widest mb-3">The Reality</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#080E1C] mb-3">
              Most service businesses are{" "}
              <span style={{background:"linear-gradient(135deg,#EF4444,#F97316)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                losing clients every day
              </span>
            </h2>
            <p className="text-[#64748B] max-w-xl mx-auto">Without a system, you rely on luck. With Servolia, your website works for you 24/7.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl p-6 border border-red-100 shadow-sm">
              <p className="text-xs font-black text-red-500 uppercase tracking-widest mb-5 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Without a system
              </p>
              <ul className="flex flex-col gap-3.5">
                {[
                  ["Client calls at 8pm. No answer.", "They book with your competitor."],
                  ["Your website gets visitors.", "Zero leads captured. Zero follow-up."],
                  ["You spend €500/mo on ads.", "No idea which ad actually works."],
                  ["Interested clients reach out.", "Never followed up. Lost forever."],
                  ["You're doing everything manually.", "10+ hours/week on admin work."],
                ].map(([a, b], i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-[#64748B]"><span className="text-[#080E1C] font-semibold">{a}</span> {b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-sm">
              <p className="text-xs font-black text-[#10B981] uppercase tracking-widest mb-5 flex items-center gap-2">
                <BadgeCheck className="w-3.5 h-3.5" /> With Servolia active
              </p>
              <ul className="flex flex-col gap-3.5">
                {[
                  ["Client messages at 2am.", "AI answers instantly. Appointment booked."],
                  ["Visitor lands on your page.", "Lead captured, email sent to you in seconds."],
                  ["You run Meta ads.", "Full tracking: source, cost, ROI per campaign."],
                  ["Lead doesn't book immediately.", "Automated follow-up email sent at 48h."],
                  ["Your system runs itself.", "You focus on delivering — not chasing clients."],
                ].map(([a, b], i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                    <span className="text-[#64748B]"><span className="text-[#080E1C] font-semibold">{a}</span> {b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#95BF47] uppercase tracking-widest mb-3">The Process</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#080E1C] mb-4">
              Audit → Build → Results.{" "}
              <span style={{background:"linear-gradient(135deg,#10B981,#34D399)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                In 7 days.
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-9 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-gradient-to-r from-[#95BF47]/20 via-[#6BA52A]/40 to-[#95BF47]/20 pointer-events-none" />
            {[
              { num:"01", icon:<MessageSquare className="w-5 h-5"/>, title:"Free Business Audit", desc:"Fill our 5-question form. We send a PDF audit within 24h showing exactly what's costing you clients and what to fix. No payment, no pitch call if you don't want one." },
              { num:"02", icon:<Zap className="w-5 h-5"/>, title:"We Build Everything", desc:"Fixed scope, fixed price, fixed deadline — in writing before you pay a cent. We build using our proven 22-step checklist and send you Loom walkthroughs at every milestone." },
              { num:"03", icon:<TrendingUp className="w-5 h-5"/>, title:"Clients Start Booking", desc:"System goes live. Your AI receptionist starts answering leads. You get a monthly report: leads captured, bookings made, traffic sources, conversion rate." },
            ].map((s,i)=>(
              <div key={i} className="relative bg-white rounded-2xl p-7 border border-[#E2E8F0] shadow-sm hover:shadow-lg hover:border-[#95BF47]/25 transition-all duration-300">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#95BF47] to-[#6BA52A] flex items-center justify-center text-white shadow-lg shadow-[#6BA52A]/20 flex-shrink-0">
                    {s.icon}
                  </div>
                  <span className="text-3xl font-black text-[#E2E8F0]">{s.num}</span>
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
      <section id="niches" className="py-20 lg:py-28 bg-[#080E1C]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-bold text-[#95BF47] uppercase tracking-widest mb-3">Who we build for</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Built for service businesses,<br className="hidden sm:block" /> not tech companies.
            </h2>
            <p className="text-[#94A3B8] max-w-xl mx-auto">
              We specialize in industries where every missed call or slow website costs a real client.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              {
                emoji: "🦷",
                title: "Dental Clinics",
                pain: "Missed calls = missed appointments",
                href: "/dentists",
              },
              {
                emoji: "💉",
                title: "Aesthetic Clinics",
                pain: "Patients choosing competitors online",
                href: "/niches/aesthetic-clinics",
              },
              {
                emoji: "🏠",
                title: "Real Estate Agents",
                pain: "Leads go cold before follow-up",
                href: "#",
              },
              {
                emoji: "🔧",
                title: "Home Services",
                pain: "No 24/7 quote or booking system",
                href: "#",
              },
              {
                emoji: "⚖️",
                title: "Lawyers & Notaries",
                pain: "Consultations hard to book online",
                href: "#",
              },
              {
                emoji: "📊",
                title: "Accountants & Advisors",
                pain: "No professional digital presence",
                href: "#",
              },
            ].map((n) => (
              <Link
                key={n.title}
                href={n.href}
                className={`group relative p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#95BF47]/40 transition-all duration-200 ${n.href === "#" ? "cursor-default" : ""}`}
                onClick={n.href === "#" ? (e) => e.preventDefault() : undefined}
              >
                <div className="text-3xl mb-3">{n.emoji}</div>
                <h3 className="text-sm font-black text-white mb-1">{n.title}</h3>
                <p className="text-xs text-[#64748B] leading-relaxed">{n.pain}</p>
                {n.href !== "#" && (
                  <div className="mt-3 flex items-center gap-1 text-xs text-[#95BF47] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    See how <ArrowRight className="w-3 h-3" />
                  </div>
                )}
                {n.href === "#" && (
                  <span className="mt-3 inline-block text-[10px] text-[#475569] font-medium">Coming soon</span>
                )}
              </Link>
            ))}
          </div>

          <div className="text-center mt-10">
            <p className="text-sm text-[#64748B]">Don&apos;t see your industry?</p>
            <Link href="/contact" className="text-sm font-bold text-[#95BF47] hover:underline">
              Talk to us — we likely cover it →
            </Link>
          </div>
        </div>
      </section>

      {/* ── SYSTEMS ── */}
      <section id="services" className="py-20 lg:py-28 bg-[#F5F5F5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#95BF47] uppercase tracking-widest mb-3">Our Systems</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#080E1C] mb-4">
              Servolia doesn't sell websites.{" "}
              <span style={{background:"linear-gradient(135deg,#95BF47,#6BA52A)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                We sell AI client systems.
              </span>
            </h2>
            <p className="text-[#64748B] max-w-xl mx-auto">Four systems. One goal — more paying clients, less manual work.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {systems.map((s,i)=>(
              <div key={i} className={`rounded-2xl p-6 lg:p-7 transition-all duration-300 group hover:shadow-xl ${
                s.highlight
                  ? "bg-gradient-to-br from-[#95BF47]/8 to-[#6BA52A]/5 border-2 border-[#95BF47]/35"
                  : "bg-white border border-[#E2E8F0] hover:border-[#95BF47]/25"
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-lg`}>
                      {s.icon}
                    </div>
                    <span className="text-xs font-black text-[#94A3B8] tracking-widest uppercase">{s.num}</span>
                  </div>
                  {s.highlight && (
                    <span className="text-xs font-black text-[#95BF47] bg-[#95BF47]/10 px-2.5 py-1 rounded-full border border-[#95BF47]/20">
                      MAIN OFFER
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-[#080E1C] mb-1">{s.title}</h3>
                <p className="text-xs font-semibold text-[#6BA52A] mb-3">{s.for}</p>
                <p className="text-[#64748B] text-sm leading-relaxed mb-4">{s.desc}</p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {s.features.map((f,j)=>(
                    <span key={j} className="px-2.5 py-1 rounded-full bg-[#F5F5F5] border border-[#E2E8F0] text-[#95BF47] text-xs font-semibold">{f}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-[#F1F5F9]">
                  <div>
                    <span className="text-xl font-black text-[#080E1C]">{s.price}</span>
                    <span className="text-xs text-[#94A3B8] ml-2">· {s.delivery} delivery</span>
                  </div>
                  <Link href="/pricing" className="text-sm font-bold text-[#95BF47] flex items-center gap-1 group-hover:gap-2 transition-all">
                    See details <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALUE STACK (Booking System) ── */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#95BF47] uppercase tracking-widest mb-3">AI Booking System — What You Actually Get</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#080E1C] mb-3">
              Everything included.{" "}
              <span style={{background:"linear-gradient(135deg,#95BF47,#6BA52A)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                One fixed price.
              </span>
            </h2>
            <p className="text-[#64748B] max-w-xl mx-auto">
              If you hired a web agency, an AI consultant, a conversion specialist, and a tracking expert separately — this would cost over €6,000 and take 3 months.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-lg">
            <div className="bg-[#080E1C] px-6 py-4 flex items-center justify-between">
              <span className="text-white font-black">Included in AI Booking System (€1,490)</span>
              <span className="text-[#94A3B8] text-sm">Market value</span>
            </div>
            {[
              { item: "10-page conversion website", value: "€2,500" },
              { item: "AI receptionist chatbot (24/7)", value: "€1,500" },
              { item: "Appointment booking flow", value: "€800" },
              { item: "Meta Pixel + CAPI tracking", value: "€600" },
              { item: "Google Analytics 4 setup", value: "€300" },
              { item: "Lead CRM (Google Sheets sync)", value: "€400" },
              { item: "GDPR / Privacy / CGV pages", value: "€350" },
              { item: "Free business audit PDF", value: "€200" },
            ].map((v, i) => (
              <div key={i} className={`flex items-center justify-between px-6 py-3.5 ${i % 2 === 0 ? "bg-white" : "bg-[#F5F5F5]"} border-b border-[#F1F5F9]`}>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                  <span className="text-sm font-medium text-[#374151]">{v.item}</span>
                </div>
                <span className="text-sm font-bold text-[#64748B] line-through">{v.value}</span>
              </div>
            ))}
            <div className="px-6 py-5 bg-gradient-to-r from-[#95BF47]/5 to-[#6BA52A]/5 flex items-center justify-between border-t-2 border-[#95BF47]/20">
              <div>
                <p className="text-[#64748B] text-sm mb-0.5">Total market value</p>
                <p className="text-2xl font-black text-[#080E1C] line-through opacity-40">€6,650</p>
              </div>
              <div className="text-right">
                <p className="text-[#10B981] text-sm font-bold mb-0.5">Your price today</p>
                <p className="text-4xl font-black text-[#080E1C]">€1,490</p>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link href="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-[#95BF47] to-[#6BA52A] text-[#0B1800] font-black text-base hover:opacity-90 glow-button">
              Claim This Package — Free Audit First <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-[#94A3B8] text-xs mt-3">No payment until you approve the scope · Stripe secured · Cancel anytime</p>
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
      <section className="py-20 lg:py-28 bg-[#F5F5F5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#95BF47] uppercase tracking-widest mb-3">Results</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#080E1C] mb-4">Real clients. Real numbers.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t,i)=>(
              <div key={i} className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm hover:shadow-lg hover:border-[#95BF47]/20 transition-all duration-300">
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

      {/* ── MONTHLY CARE PLANS ── */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-bold text-[#10B981] uppercase tracking-widest mb-3">Monthly Care Plans</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#080E1C] mb-4">
              Keep your system{" "}
              <span style={{background:"linear-gradient(135deg,#10B981,#34D399)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                growing every month.
              </span>
            </h2>
            <p className="text-[#64748B] max-w-xl mx-auto">
              Not just a one-time build. Servolia can manage, optimize, and improve your system month after month. Cancel anytime.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {carePlans.map((p, i) => (
              <div key={i} className={`rounded-2xl p-6 border-2 relative flex flex-col ${
                p.popular
                  ? "border-[#10B981] bg-gradient-to-br from-[#10B981]/5 to-white shadow-lg shadow-emerald-500/10"
                  : "border-[#E2E8F0] bg-white"
              }`}>
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#10B981] to-[#34D399] text-white text-xs font-black whitespace-nowrap">
                    MOST POPULAR
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-lg font-black text-[#080E1C] mb-1">{p.name}</h3>
                  <div className="text-3xl font-black text-[#080E1C] mb-2">{p.price}</div>
                  <p className="text-[#64748B] text-sm">{p.desc}</p>
                </div>
                <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-[#374151]">
                      <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link href="/contact" className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
                  p.popular
                    ? "bg-gradient-to-r from-[#10B981] to-[#34D399] text-white hover:opacity-90"
                    : "border border-[#E2E8F0] text-[#080E1C] hover:border-[#10B981] hover:text-[#10B981]"
                }`}>
                  Get started →
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-[#94A3B8] text-xs mt-6">
            All retainers cancel anytime with 30 days notice · Billed monthly via Stripe
          </p>
        </div>
      </section>

      {/* ── GUARANTEE ── */}
      <section className="py-16 bg-[#F5F5F5]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border-2 border-[#95BF47]/25 bg-white p-8 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#95BF47] to-[#6BA52A] flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#6BA52A]/25">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#080E1C] mb-3">
              The Servolia Delivery Guarantee
            </h2>
            <p className="text-[#64748B] mb-6 max-w-2xl mx-auto leading-relaxed">
              If we miss our agreed delivery deadline through our own fault, you get{" "}
              <strong className="text-[#080E1C]">10% of your payment back for every day we're late</strong>{" "}
              — automatically, no questions asked. We've never had to pay this out. The guarantee exists because we put our money where our mouth is.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: <Clock className="w-5 h-5 text-[#95BF47]" />, title: "7-day delivery", desc: "Committed in writing before you pay" },
                { icon: <BadgeCheck className="w-5 h-5 text-[#10B981]" />, title: "Fixed price", desc: "No scope creep. No surprise invoices." },
                { icon: <Lock className="w-5 h-5 text-[#6BA52A]" />, title: "Full ownership", desc: "All files transferred on final payment" },
              ].map((g,i)=>(
                <div key={i} className="bg-[#F5F5F5] rounded-xl p-4 border border-[#E2E8F0] text-left">
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
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#95BF47] uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#080E1C] mb-4">
              Choose the system your business needs.
            </h2>
            <p className="text-[#64748B] max-w-lg mx-auto">
              From a professional website to a complete AI client acquisition system. Fixed price, clear scope, delivered fast.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: "Website System",
                price: "€790",
                delivery: "3 days",
                for: "For businesses that need a trusted online presence",
                features: ["5-page website", "Contact form", "Google Analytics", "GDPR compliant", "Mobile optimized"],
                popular: false,
              },
              {
                name: "Booking System",
                price: "€1,490",
                delivery: "5 days",
                for: "For businesses that want leads and appointments automatically",
                features: ["10-page website", "AI chatbot", "Booking flow", "CRM sync", "Meta Pixel + GA4", "GDPR compliant"],
                popular: true,
              },
              {
                name: "Client System",
                price: "€2,900",
                delivery: "7 days",
                for: "For businesses that want full tracking and client management",
                features: ["Everything in Booking", "Admin dashboard", "Lead pipeline", "Auto notifications", "Monthly reporting"],
                popular: false,
              },
            ].map((p,i)=>(
              <div key={i} className={`bg-white rounded-2xl border-2 p-6 relative ${p.popular?"border-[#95BF47] shadow-2xl shadow-[#95BF47]/12":"border-[#E2E8F0]"}`}>
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#95BF47] to-[#6BA52A] text-[#0B1800] text-xs font-black whitespace-nowrap">
                    MAIN OFFER
                  </div>
                )}
                <h3 className="text-lg font-black text-[#080E1C] mb-0.5">{p.name}</h3>
                <p className="text-xs text-[#64748B] mb-3">{p.for}</p>
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
                    ? "bg-gradient-to-r from-[#95BF47] to-[#6BA52A] text-[#0B1800] hover:opacity-90 glow-button"
                    : "border border-[#E2E8F0] text-[#080E1C] hover:border-[#95BF47] hover:text-[#95BF47]"
                }`}>
                  Get started →
                </Link>
              </div>
            ))}
          </div>
          <div className="text-center mt-8 flex flex-col items-center gap-2">
            <p className="text-[#94A3B8] text-sm">
              All prices exclude VAT · 50% deposit via Stripe · Balance on delivery · Retainers from €99/mo
            </p>
            <Link href="/pricing" className="inline-flex items-center gap-1.5 text-[#95BF47] font-bold text-sm hover:underline mt-1">
              Full pricing + app development <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 bg-[#F5F5F5]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-bold text-[#95BF47] uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-3xl font-black text-[#080E1C]">Questions we hear a lot</h2>
          </div>
          <div className="flex flex-col gap-3">
            {faqs.map((f,i)=>(
              <div key={i} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
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

      {/* ── FINAL CTA ── */}
      <section className="py-20 lg:py-28 bg-[#080E1C] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#95BF47]/10 via-transparent to-[#6BA52A]/10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#95BF47]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#95BF47]/30 bg-[#95BF47]/10 text-sm text-[#95BF47] mb-6">
            <BadgeCheck className="w-3.5 h-3.5" />
            <span className="font-semibold">Delivered in 7 days · Fixed price · No surprises</span>
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
            <Link href="/contact" className="px-9 py-4 rounded-xl bg-gradient-to-r from-[#95BF47] to-[#6BA52A] text-[#0B1800] font-black text-lg hover:opacity-90 glow-button shadow-2xl flex items-center gap-2">
              Get My Free Audit Now <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="mailto:hello@servolia.com" className="flex items-center gap-2 text-[#94A3B8] hover:text-white text-sm font-semibold transition-colors">
              <Phone className="w-4 h-4" /> hello@servolia.com
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#475569]">
            <div className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-[#10B981]" /> GDPR compliant</div>
            <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded bg-[#635bff] flex items-center justify-center"><span className="text-white text-[7px] font-black">S</span></div> Stripe secured</div>
            <div className="flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5 text-[#95BF47]" /> Fixed price in writing</div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#6BA52A]" /> 7-day delivery or 10% back/day</div>
          </div>
        </div>
      </section>

      <Footer />
      <ChatWidget />
    </main>
  );
}
