"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import HeroProduct from "@/components/HeroProduct";
import AIReceptionistDemo from "@/components/AIReceptionistDemo";
import ROICalculator from "@/components/ROICalculator";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { FaqSchema } from "@/components/StructuredData";
import {
  Bot, BarChart3, Globe, CheckCircle, ArrowRight,
  Shield, Clock, TrendingUp, MessageSquare,
  Users, Building2, Sparkles, ChevronDown, Zap, XCircle,
  BadgeCheck, Lock, Calendar, LayoutDashboard, FileText, Phone,
} from "lucide-react";

/* ─── animation helpers ─────────────────────────────────────────────────── */
function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

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

/* ─── page ──────────────────────────────────────────────────────────────── */
export default function HomePage() {
  const { ref: statsRef, inView: statsInView } = useInView(0.3);
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
      num: "01", icon: <Globe className="w-5 h-5" />,
      title: "AI Website System", price: "From €290", delivery: "3 days",
      desc: "A professional website built to convert visitors into inquiries — mobile-first, GDPR-ready, live in 72 hours.",
      features: ["5–10 conversion-focused pages", "Booking & contact CTA", "Google Analytics 4", "GDPR pages included"],
      accent: false,
    },
    {
      num: "02", icon: <Bot className="w-5 h-5" />,
      title: "AI Booking System", price: "€590", delivery: "5 days",
      desc: "AI receptionist + website + full tracking. Books appointments, captures leads, answers FAQs 24/7.",
      features: ["Everything in Website System", "AI receptionist chatbot", "Lead capture + CRM sync", "Meta Pixel + GA4"],
      accent: true,
    },
    {
      num: "03", icon: <BarChart3 className="w-5 h-5" />,
      title: "Ads Landing System", price: "€290 + €99/mo", delivery: "4 days",
      desc: "High-converting landing page with full Meta + GA4 tracking. Know exactly which ad drives revenue.",
      features: ["Conversion-focused page", "Meta Pixel + CAPI", "GA4 event tracking", "Instant lead alerts"],
      accent: false,
    },
    {
      num: "04", icon: <Building2 className="w-5 h-5" />,
      title: "Client System", price: "From €990", delivery: "7 days",
      desc: "Complete AI system — website, chatbot, admin dashboard, lead pipeline, automations, and monthly reports.",
      features: ["Everything in Booking System", "Admin dashboard", "Lead pipeline + history", "Monthly analytics report"],
      accent: false,
    },
  ];

  const carePlans = [
    { name: "Care", price: "€49", sub: "/mo", desc: "Maintenance, edits & uptime.", features: ["Uptime monitoring", "Content edits (1h/mo)", "Security updates", "Email support"], popular: false },
    { name: "Growth", price: "€99", sub: "/mo", desc: "Analytics, chatbot updates, monthly improvements.", features: ["Everything in Care", "Chatbot retraining", "Monthly analytics report", "2h improvements/mo"], popular: true },
    { name: "Scale", price: "€199", sub: "/mo", desc: "Full monthly optimization & strategy.", features: ["Everything in Growth", "A/B test improvements", "CRM workflow updates", "Monthly strategy call"], popular: false },
  ];

  return (
    <main className="flex flex-col bg-[#FAFAF7]">
      <FaqSchema faqs={faqs} />
      <Navbar heroDark />

      {/* ══════════════════════════════════════════════════════════════
          HERO — dark forest with grain texture
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden bg-[#0A1F14] pt-20">
        {/* Background layers */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Radial glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-[#36671E] opacity-60 rounded-full blur-[120px]" />
          {/* Subtle grid */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse">
                <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#FAFAF7" strokeWidth="0.8"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          {/* Noise grain */}
          <div className="absolute inset-0 grain opacity-30" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#BEF264]/40 bg-[#BEF264]/10 text-[#ABDF90] text-sm font-semibold mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#BEF264] animate-pulse-dot" />
            AI client acquisition systems · France, Belgium & the US
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black text-[#FAFAF7] leading-[1.02] tracking-tight mb-7"
          >
            Turn your website into a{" "}
            <span className="bg-gradient-to-r from-[#BEF264] via-[#ABDF90] to-[#BEF264] bg-clip-text text-transparent">
              24/7 client acquisition system.
            </span>
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.25 }}
            className="text-[#ABDF90]/80 text-lg sm:text-xl max-w-2xl mx-auto mb-3 leading-relaxed"
          >
            Servolia builds AI websites, booking systems, and lead funnels for dentists, clinics, real estate agents, and home service businesses in Europe and the US.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="text-[#FAFAF7]/50 text-sm font-medium mb-10 tracking-wide"
          >
            Fixed scope · Fixed price · Delivered in 7 days
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
          >
            <Link href="/free-audit"
              className="group px-8 py-4 rounded-xl bg-[#BEF264] text-[#0A1F14] font-black text-base hover:bg-[#D9F99D] transition-colors shadow-lg shadow-[#BEF264]/20 flex items-center gap-2">
              Book a Free System Audit
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="#ai-demo"
              className="px-7 py-4 rounded-xl border border-[#FAFAF7]/20 text-[#FAFAF7] font-semibold text-base hover:bg-[#FAFAF7]/8 transition-colors flex items-center gap-2">
              <Bot className="w-4 h-4 opacity-60" /> See it live
            </a>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm"
          >
            <div className="flex items-center gap-1.5 text-[#FAFAF7]/70">
              <Clock className="w-4 h-4 text-[#BEF264]" />
              <span className="font-medium">7-day delivery, or 10% back per day late</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#FAFAF7]/70">
              <Lock className="w-4 h-4 text-[#BEF264]" />
              <span className="font-medium">Fixed price, agreed in writing</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#FAFAF7]/70">
              <BadgeCheck className="w-4 h-4 text-[#BEF264]" />
              <span className="font-medium">No payment until you approve the scope</span>
            </div>
          </motion.div>

          {/* Product visual */}
          <div className="mt-16">
            <HeroProduct />
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#FAFAF7] to-transparent pointer-events-none" />
      </section>

      {/* ══════════════════════════════════════════════════════════════
          TRUST BAR
      ══════════════════════════════════════════════════════════════ */}
      <section className="bg-white border-y border-[#E8E6E0] py-5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12">
            {[
              { icon: <Shield className="w-4 h-4 text-[#059669]" />, text: "GDPR Compliant" },
              { icon: <div className="w-4 h-4 rounded bg-[#635bff] flex items-center justify-center"><span className="text-white text-[7px] font-black">S</span></div>, text: "Stripe Secured" },
              { icon: <Clock className="w-4 h-4 text-[#36671E]" />, text: "7-Day Guarantee" },
              { icon: <Globe className="w-4 h-4 text-[#36671E]" />, text: "French & English" },
              { icon: <Lock className="w-4 h-4 text-[#059669]" />, text: "Fixed Price in Writing" },
              { icon: <Users className="w-4 h-4 text-[#D97706]" />, text: "Founder-Led Delivery" },
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-[#52525B] text-sm font-medium">
                {t.icon}<span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          TRY THE AI — interactive demo
      ══════════════════════════════════════════════════════════════ */}
      <section id="ai-demo" className="py-20 lg:py-28 bg-[#FAFAF7] scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <FadeUp>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EEF5EA] text-[#36671E] text-xs font-black uppercase tracking-widest mb-5">
                <Bot className="w-3.5 h-3.5" /> Live Demo
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#18181B] mb-5 leading-tight">
                Try the AI receptionist{" "}
                <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
                  your clients will talk to.
                </span>
              </h2>
              <p className="text-[#52525B] text-base leading-relaxed mb-6">
                This is the same AI that answers your visitors 24/7 — qualifies them, answers questions in their language, books the appointment, and drops the lead straight into your CRM. No missed calls. No 8pm voicemails. No lost clients.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Answers instantly, day or night, in French or English",
                  "Books appointments directly into your calendar",
                  "Every conversation saved as a scored lead in your CRM",
                  "Trained on your services, prices, and policies",
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[#18181B]">
                    <CheckCircle className="w-4 h-4 text-[#36671E] mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/free-audit"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#36671E] text-[#FAFAF7] font-bold text-sm hover:bg-[#295115] transition-colors">
                Get this on your site <ArrowRight className="w-4 h-4" />
              </Link>
            </FadeUp>

            <FadeUp delay={0.15}>
              <AIReceptionistDemo />
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          JOURNEY FLOW
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-14">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">How the system works</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">
              Servolia connects your{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
                full client journey.
              </span>
            </h2>
            <p className="text-[#71717A] max-w-xl mx-auto text-sm">
              From first visit to booked appointment and monthly report — all automated.
            </p>
          </FadeUp>

          <div className="relative grid grid-cols-2 lg:grid-cols-6 gap-3 lg:gap-0">
            {/* Connector line */}
            <div className="hidden lg:block absolute top-9 left-[8.33%] right-[8.33%] h-px"
              style={{ background: "linear-gradient(to right, transparent, #E8E6E0 10%, #E8E6E0 90%, transparent)" }} />

            {[
              { icon: <Users className="w-5 h-5" />, label: "Visitor", sub: "Lands on your site", bg: "bg-[#F5F4EF]", fg: "text-[#52525B]" },
              { icon: <Globe className="w-5 h-5" />, label: "AI Website", sub: "Builds trust instantly", bg: "bg-[#EEF5EA]", fg: "text-[#36671E]" },
              { icon: <Bot className="w-5 h-5" />, label: "AI Receptionist", sub: "Answers 24/7", bg: "bg-[#36671E]", fg: "text-[#FAFAF7]" },
              { icon: <Calendar className="w-5 h-5" />, label: "Booking", sub: "Captured automatically", bg: "bg-[#EEF5EA]", fg: "text-[#36671E]" },
              { icon: <LayoutDashboard className="w-5 h-5" />, label: "CRM", sub: "Lead tracked & managed", bg: "bg-[#EEF5EA]", fg: "text-[#36671E]" },
              { icon: <FileText className="w-5 h-5" />, label: "Monthly Report", sub: "ROI optimized", bg: "bg-[#6B8439]", fg: "text-[#FAFAF7]" },
            ].map((step, i) => (
              <FadeUp key={i} delay={i * 0.07} className="flex flex-col items-center text-center px-2">
                <div className={`relative z-10 w-[72px] h-[72px] rounded-2xl ${step.bg} ${step.fg} flex items-center justify-center mb-3 shadow-soft`}>
                  {step.icon}
                </div>
                <p className="text-xs font-black text-[#18181B] mb-0.5 leading-tight">{step.label}</p>
                <p className="text-[10px] text-[#A1A1AA] leading-tight max-w-[80px]">{step.sub}</p>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={0.4} className="text-center mt-12">
            <Link href="/contact" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#36671E] text-[#FAFAF7] font-bold text-sm hover:bg-[#295115] transition-colors">
              Get a system like this for your business <ArrowRight className="w-4 h-4" />
            </Link>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          PROBLEM / SOLUTION
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-[#FAFAF7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-14">
            <p className="text-xs font-black text-[#DC2626] uppercase tracking-widest mb-3">The Problem</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">
              Most service businesses are{" "}
              <span className="bg-gradient-to-r from-[#EF4444] to-[#F97316] bg-clip-text text-transparent">
                losing clients every day.
              </span>
            </h2>
            <p className="text-[#71717A] max-w-xl mx-auto">Without a system, you rely on luck. With Servolia, your website works for you 24/7.</p>
          </FadeUp>

          <div className="grid lg:grid-cols-2 gap-5">
            <FadeUp delay={0.1}>
              <div className="bg-white rounded-2xl p-7 border border-red-100 h-full">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                    <XCircle className="w-4 h-4 text-red-500" />
                  </div>
                  <p className="text-xs font-black text-red-500 uppercase tracking-widest">Without a system</p>
                </div>
                <ul className="space-y-4">
                  {[
                    ["Client calls at 8pm. No answer.", "They book with your competitor."],
                    ["Your website gets visitors.", "Zero leads captured. Zero follow-up."],
                    ["You spend €500/mo on ads.", "No idea which ad actually works."],
                    ["Interested clients reach out.", "Never followed up. Lost forever."],
                    ["You're doing everything manually.", "10+ hours/week on admin work."],
                  ].map(([a, b], i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center mt-0.5 shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      </div>
                      <span className="text-[#52525B]"><span className="text-[#18181B] font-semibold">{a}</span> {b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeUp>

            <FadeUp delay={0.2}>
              <div className="bg-white rounded-2xl p-7 border border-[#D6E2CF] h-full">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-[#EEF5EA] flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-[#36671E]" />
                  </div>
                  <p className="text-xs font-black text-[#36671E] uppercase tracking-widest">With Servolia active</p>
                </div>
                <ul className="space-y-4">
                  {[
                    ["Client messages at 2am.", "AI answers instantly. Appointment booked."],
                    ["Visitor lands on your page.", "Lead captured, email sent to you in seconds."],
                    ["You run Meta ads.", "Full tracking: source, cost, ROI per campaign."],
                    ["Lead doesn't book immediately.", "Automated follow-up email sent at 48h."],
                    ["Your system runs itself.", "You focus on delivering — not chasing clients."],
                  ].map(([a, b], i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <div className="w-4 h-4 rounded-full bg-[#EEF5EA] flex items-center justify-center mt-0.5 shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#36671E]" />
                      </div>
                      <span className="text-[#52525B]"><span className="text-[#18181B] font-semibold">{a}</span> {b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          HOW IT WORKS — large numbered steps
      ══════════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-16">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">The Process</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-4">
              Audit → Build → Results.{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
                In 7 days.
              </span>
            </h2>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { num: "01", icon: <MessageSquare className="w-5 h-5" />, title: "Free Business Audit", desc: "Fill our 5-question form. We send a PDF audit within 24h showing exactly what's costing you clients and what to fix. No payment, no pitch call required." },
              { num: "02", icon: <Zap className="w-5 h-5" />, title: "We Build Everything", desc: "Fixed scope, fixed price, fixed deadline — in writing before you pay a cent. We build using our 22-step checklist and send Loom walkthroughs at every milestone." },
              { num: "03", icon: <TrendingUp className="w-5 h-5" />, title: "Clients Start Booking", desc: "System goes live. AI receptionist starts answering leads. You get a monthly report: leads captured, bookings made, traffic sources, conversion rate." },
            ].map((s, i) => (
              <FadeUp key={i} delay={i * 0.12}>
                <div className="relative bg-[#FAFAF7] rounded-2xl p-7 border border-[#E8E6E0] hover:border-[#36671E]/30 hover:shadow-card transition-all duration-300 h-full overflow-hidden">
                  {/* Large background number */}
                  <span className="absolute -right-3 -top-4 text-[96px] font-black text-[#E8E6E0] leading-none select-none pointer-events-none">
                    {s.num}
                  </span>
                  <div className="relative">
                    <div className="w-11 h-11 rounded-xl bg-[#36671E] flex items-center justify-center text-[#FAFAF7] mb-5 shadow-lg shadow-[#36671E]/20">
                      {s.icon}
                    </div>
                    <h3 className="text-lg font-black text-[#18181B] mb-3">{s.title}</h3>
                    <p className="text-[#71717A] text-sm leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={0.4} className="mt-10 text-center">
            <Link href="/contact" className="inline-flex items-center gap-2 text-[#36671E] font-bold text-sm hover:underline">
              Start with the free audit <ArrowRight className="w-4 h-4" />
            </Link>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          NICHES
      ══════════════════════════════════════════════════════════════ */}
      <section id="niches" className="py-20 lg:py-28 bg-[#FAFAF7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-12">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Who we build for</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-4">
              Built for service businesses,<br className="hidden sm:block" /> not tech companies.
            </h2>
            <p className="text-[#52525B] max-w-xl mx-auto text-sm">
              We specialize in industries where every missed call or slow website costs a real client.
            </p>
          </FadeUp>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { emoji: "🦷", title: "Dental & Implant Clinics", pain: "After-hours bookings going to competitors", avg: "€1.5k–€5k per patient", href: "/dentists" },
              { emoji: "💉", title: "Aesthetic & Med Spas", pain: "Instagram DMs converting at 5%", avg: "€500–€3k per visit", href: "/niches/aesthetic-clinics" },
              { emoji: "🏠", title: "Luxury Real Estate", pain: "10-min response time loses €M+ mandates", avg: "€10k–€100k commission", href: "/niches/real-estate" },
              { emoji: "🌬️", title: "HVAC & Home Services", pain: "Phone-only intake costs 10h/week", avg: "$3k–$30k per job", href: "/niches/home-services" },
              { emoji: "🔬", title: "Cosmetic Surgery", pain: "Consultations booked 6 weeks out", avg: "$5k–$25k per procedure", href: "/contact" },
              { emoji: "🐾", title: "Veterinary Specialty", pain: "Referrals stuck in phone tag", avg: "$1k–$10k per case", href: "/contact" },
              { emoji: "⚖️", title: "Law Firms", pain: "Qualified leads getting no follow-up", avg: "€5k–€50k per case", href: "/contact" },
              { emoji: "💎", title: "IVF & Fertility Clinics", pain: "International patients can't book online", avg: "€8k–€20k per cycle", href: "/contact" },
            ].map((n, i) => (
              <FadeUp key={n.title} delay={i * 0.05}>
                <Link href={n.href}
                  className="group flex flex-col p-5 rounded-2xl border border-[#E8E6E0] bg-white hover:border-[#36671E]/40 hover:shadow-card transition-all duration-200 h-full">
                  <span className="text-3xl mb-3 block">{n.emoji}</span>
                  <h3 className="text-sm font-black text-[#18181B] mb-1.5 leading-tight">{n.title}</h3>
                  <p className="text-[11px] text-[#71717A] leading-relaxed mb-3 flex-1">{n.pain}</p>
                  <p className="text-[10px] font-bold text-[#36671E] tracking-wide">{n.avg}</p>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-[#36671E] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    See how <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={0.5} className="text-center mt-10">
            <p className="text-sm text-[#71717A]">Don&apos;t see your industry?{" "}
              <Link href="/contact" className="font-bold text-[#36671E] hover:underline">Talk to us →</Link>
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SYSTEMS / SERVICES
      ══════════════════════════════════════════════════════════════ */}
      <section id="services" className="py-20 lg:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-14">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Our Systems</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#18181B] mb-4">
              We don&apos;t sell websites.{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
                We sell AI client systems.
              </span>
            </h2>
            <p className="text-[#71717A] max-w-xl mx-auto text-sm">Four systems. One goal — more paying clients, less manual work.</p>
          </FadeUp>

          <div className="grid md:grid-cols-2 gap-5">
            {systems.map((s, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className={`relative rounded-2xl p-7 border-2 transition-all duration-300 hover:shadow-xl h-full flex flex-col ${
                  s.accent
                    ? "bg-[#FAFAF7] border-[#36671E]/40"
                    : "bg-white border-[#E8E6E0] hover:border-[#36671E]/20"
                }`}>
                  {s.accent && (
                    <span className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-[#36671E] text-[#FAFAF7] text-[10px] font-black uppercase tracking-widest">
                      MAIN OFFER
                    </span>
                  )}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-[#36671E] flex items-center justify-center text-[#FAFAF7]">
                      {s.icon}
                    </div>
                    <span className="text-xs font-black text-[#A1A1AA] tracking-widest">{s.num}</span>
                  </div>
                  <h3 className="text-xl font-black text-[#18181B] mb-2">{s.title}</h3>
                  <p className="text-[#71717A] text-sm leading-relaxed mb-5 flex-1">{s.desc}</p>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {s.features.map((f, j) => (
                      <span key={j} className="px-2.5 py-1 rounded-full bg-[#EEF5EA] text-[#36671E] text-xs font-semibold">{f}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-5 border-t border-[#E8E6E0]">
                    <div>
                      <span className="text-2xl font-black text-[#18181B]">{s.price}</span>
                      <span className="text-xs text-[#71717A] ml-2">· {s.delivery} delivery</span>
                    </div>
                    <Link href="/pricing" className="text-sm font-bold text-[#36671E] flex items-center gap-1 hover:gap-2 transition-all">
                      Details <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          VALUE STACK
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-10">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">AI Booking System — What You Get</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">
              Everything included.{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
                One fixed price.
              </span>
            </h2>
            <p className="text-[#71717A] max-w-xl mx-auto text-sm">
              Hiring separately — web agency, AI consultant, tracking specialist — would cost €6,000+ and take 3 months.
            </p>
          </FadeUp>

          <FadeUp delay={0.1}>
            <div className="bg-white rounded-2xl border border-[#E8E6E0] overflow-hidden shadow-card">
              <div className="px-6 py-4 border-b border-[#E8E6E0] flex items-center justify-between bg-[#FAFAF7]">
                <span className="text-sm font-black text-[#18181B]">Included in AI Booking System</span>
                <span className="text-xs text-[#A1A1AA]">Market value</span>
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
                <div key={i} className="flex items-center justify-between px-6 py-3.5 border-b border-[#F5F4EF] last:border-0">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-[#36671E] shrink-0" />
                    <span className="text-sm text-[#18181B]">{v.item}</span>
                  </div>
                  <span className="text-sm text-[#A1A1AA] line-through">{v.value}</span>
                </div>
              ))}
              <div className="px-6 py-5 bg-[#EEF5EA] flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#71717A] mb-0.5">Market value</p>
                  <p className="text-xl font-black text-[#18181B] line-through opacity-40">€6,650</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#36671E] font-bold mb-0.5">Your price</p>
                  <p className="text-4xl font-black text-[#36671E]">€590</p>
                </div>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.2} className="mt-6 text-center">
            <Link href="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#36671E] text-[#FAFAF7] font-black text-base hover:bg-[#295115] transition-colors shadow-lg shadow-[#36671E]/20">
              Claim This Package — Free Audit First <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-[#A1A1AA] text-xs mt-3">No payment until you approve the scope · Stripe secured</p>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          STATS — dark forest section, high contrast
      ══════════════════════════════════════════════════════════════ */}
      <section ref={statsRef} className="py-20 lg:py-28 bg-[#0A1F14] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#36671E] opacity-50 rounded-full blur-[100px]" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid2" width="64" height="64" patternUnits="userSpaceOnUse">
                <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#FAFAF7" strokeWidth="0.6"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid2)" />
          </svg>
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeUp className="mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-[#FAFAF7] mb-3">
              The promise,{" "}
              <span className="bg-gradient-to-r from-[#BEF264] to-[#ABDF90] bg-clip-text text-transparent">in numbers</span>
            </h2>
            <p className="text-[#ABDF90]/70 text-sm max-w-md mx-auto">Every one of these is written into your contract before you pay.</p>
          </FadeUp>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-10">
            {[
              { value: 7, suffix: " days", label: "From kickoff to live system" },
              { value: 50, suffix: "%", label: "Deposit to start, rest on delivery" },
              { value: 10, suffix: "%", label: "Back for every day we're late" },
              { value: 100, suffix: "%", label: "Code & files yours on payment" },
            ].map((s, i) => {
              const c = useCounter(s.value, 1800, statsInView);
              return (
                <FadeUp key={i} delay={i * 0.1}>
                  <div className="text-center p-6 rounded-2xl border border-[#FAFAF7]/10 bg-[#FAFAF7]/4">
                    <div className="text-5xl lg:text-6xl font-black text-[#FAFAF7] mb-2 tabular-nums">
                      {c}{s.suffix}
                    </div>
                    <div className="text-sm text-[#BEF264] font-semibold">{s.label}</div>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          CASE STUDIES
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-12">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">What it&apos;s built to do</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">
              What a Servolia system is built to deliver.
            </h2>
            <p className="text-[#71717A] max-w-lg mx-auto text-sm">Illustrative targets based on typical service-business benchmarks. Actual results vary by business.</p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-5 mb-10">
            {[
              { badge: "Dental clinic", headline: "+400%", metric: "online bookings", sub: "From a few bookings/month to 15+", detail: "After-hours enquiries handled automatically", color: "bg-[#36671E]" },
              { badge: "Aesthetic clinic", headline: "×4", metric: "bookings per week", sub: "AI qualifies and books while you work", detail: "Most enquiries handled by AI", color: "bg-[#295115]" },
              { badge: "Home services", headline: "10h", metric: "saved per week", sub: "No more phone-tag or voicemail leaks", detail: "Every lead captured and scored in the CRM", color: "bg-[#6B8439]" },
            ].map((c, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className="bg-[#FAFAF7] rounded-2xl border border-[#E8E6E0] p-7 hover:shadow-card transition-shadow h-full flex flex-col">
                  <span className={`inline-flex self-start text-[10px] font-black px-2.5 py-1 rounded-full ${c.color} text-[#FAFAF7] mb-5 uppercase tracking-widest`}>
                    {c.badge}
                  </span>
                  <div className="mb-4">
                    <span className="text-5xl font-black text-[#18181B]">{c.headline}</span>
                    <span className="text-lg font-bold text-[#36671E] ml-2">{c.metric}</span>
                  </div>
                  <p className="text-sm text-[#52525B] mb-3">{c.sub}</p>
                  <p className="text-xs font-semibold text-[#36671E] border-t border-[#E8E6E0] pt-3 mt-auto">{c.detail}</p>
                </div>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={0.3} className="text-center">
            <Link href="/case-studies" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#E8E6E0] text-[#18181B] font-bold text-sm hover:bg-[#FAFAF7] transition-colors">
              Read the full case studies <ArrowRight className="w-4 h-4" />
            </Link>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          EXAMPLE RESULTS
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-[#FAFAF7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-12">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Example Results</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">What a Servolia system can deliver.</h2>
            <p className="text-xs text-[#71717A] max-w-2xl mx-auto">
              Illustrative outcomes based on typical service-business benchmarks. Individual results vary. See the full{" "}
              <Link href="/case-studies" className="text-[#36671E] underline">example deployments</Link>.
            </p>
          </FadeUp>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { name: "Dental clinic scenario", role: "Mid-size practice · Western Europe", text: "After installing the AI Booking System, a typical clinic moves from a handful of online bookings per month to 15+ in the first weeks — the chatbot handles all after-hours enquiries automatically.", result: "+400% online bookings" },
              { name: "Real estate scenario", role: "Solo agent · Major city", text: "A typical agent goes from manually qualifying every enquiry to receiving pre-qualified leads on their phone — system fully live in 5 days.", result: "Qualified leads on autopilot" },
              { name: "Home services scenario", role: "HVAC business · US market", text: "The AI chatbot qualifies leads 24/7 — service businesses typically save 10+ hours per week on phone admin and recover bookings that previously went to voicemail.", result: "10 hrs/week saved" },
            ].map((t, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className="bg-white rounded-2xl p-7 border border-[#E8E6E0] hover:shadow-card transition-all duration-300 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[10px] font-black text-[#71717A] bg-[#F5F4EF] px-2.5 py-1 rounded-full uppercase tracking-widest">Scenario</span>
                    <span className="text-[10px] font-black text-[#36671E] bg-[#EEF5EA] px-2.5 py-1 rounded-full">{t.result}</span>
                  </div>
                  <p className="text-[#52525B] text-sm leading-relaxed flex-1 mb-5">{t.text}</p>
                  <div className="border-t border-[#F5F4EF] pt-4">
                    <p className="font-bold text-[#18181B] text-sm">{t.name}</p>
                    <p className="text-[#A1A1AA] text-xs mt-0.5">{t.role}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          CARE PLANS
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-12">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Monthly Care Plans</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-4">
              Keep your system{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
                growing every month.
              </span>
            </h2>
            <p className="text-[#71717A] max-w-xl mx-auto text-sm">Not just a one-time build. Manage, optimize, and improve — cancel anytime.</p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-5">
            {carePlans.map((p, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className={`relative rounded-2xl p-7 border-2 flex flex-col h-full ${
                  p.popular
                    ? "border-[#36671E] bg-[#FAFAF7]"
                    : "border-[#E8E6E0] bg-white"
                }`}>
                  {p.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#36671E] text-[#FAFAF7] text-[10px] font-black whitespace-nowrap">
                      MOST POPULAR
                    </div>
                  )}
                  <div className="mb-5">
                    <h3 className="text-lg font-black text-[#18181B] mb-1">{p.name}</h3>
                    <div className="flex items-baseline gap-0.5 mb-2">
                      <span className="text-4xl font-black text-[#18181B]">{p.price}</span>
                      <span className="text-[#71717A] text-sm">{p.sub}</span>
                    </div>
                    <p className="text-[#71717A] text-sm">{p.desc}</p>
                  </div>
                  <ul className="space-y-2.5 mb-7 flex-1">
                    {p.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2.5 text-sm text-[#18181B]">
                        <CheckCircle className="w-4 h-4 text-[#36671E] shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/pricing" className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
                    p.popular
                      ? "bg-[#36671E] text-[#FAFAF7] hover:bg-[#295115]"
                      : "border border-[#E8E6E0] text-[#18181B] hover:border-[#36671E] hover:text-[#36671E]"
                  }`}>
                    Get started →
                  </Link>
                </div>
              </FadeUp>
            ))}
          </div>
          <FadeUp delay={0.3}>
            <p className="text-center text-[#A1A1AA] text-xs mt-6">
              All retainers cancel anytime with 30 days notice · Billed monthly via Stripe
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          GUARANTEE
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-16 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp>
            <div className="rounded-2xl border border-[#D6E2CF] bg-white p-10 text-center shadow-soft">
              <div className="w-14 h-14 rounded-2xl bg-[#36671E] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#36671E]/20">
                <Shield className="w-7 h-7 text-[#FAFAF7]" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#18181B] mb-3">The Servolia Delivery Guarantee</h2>
              <p className="text-[#52525B] text-sm leading-relaxed mb-8 max-w-xl mx-auto">
                If we miss our agreed delivery deadline through our own fault, you get{" "}
                <strong className="text-[#18181B]">10% of your payment back for every day we&apos;re late</strong>{" "}
                — automatically, no questions asked. We&apos;ve never had to pay this out.
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { icon: <Clock className="w-5 h-5 text-[#36671E]" />, title: "7-day delivery", desc: "Committed in writing before you pay" },
                  { icon: <BadgeCheck className="w-5 h-5 text-[#36671E]" />, title: "Fixed price", desc: "No scope creep. No surprise invoices." },
                  { icon: <Lock className="w-5 h-5 text-[#36671E]" />, title: "Full ownership", desc: "All files transferred on final payment" },
                ].map((g, i) => (
                  <div key={i} className="bg-[#FAFAF7] rounded-xl p-4 border border-[#E8E6E0] text-left">
                    <div className="mb-2">{g.icon}</div>
                    <p className="font-bold text-[#18181B] text-sm mb-0.5">{g.title}</p>
                    <p className="text-xs text-[#71717A]">{g.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          ROI CALCULATOR
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-[#FAFAF7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-12">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">What&apos;s it worth?</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">
              See what missed enquiries{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
                are costing you.
              </span>
            </h2>
            <p className="text-[#71717A] max-w-lg mx-auto text-sm">
              Drag the sliders to model the revenue a 24/7 AI system could recover for your business.
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <ROICalculator />
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          PRICING PREVIEW
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-14">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-4">
              Choose the system your business needs.
            </h2>
            <p className="text-[#71717A] max-w-lg mx-auto text-sm">Fixed price, clear scope, delivered fast.</p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { name: "Website System", price: "€290", delivery: "3 days", desc: "For businesses that need a trusted online presence", features: ["5-page website", "Contact form", "Google Analytics", "GDPR compliant", "Mobile optimized"], popular: false },
              { name: "Booking System", price: "€590", delivery: "5 days", desc: "For businesses that want leads and appointments automatically", features: ["10-page website", "AI chatbot", "Booking flow", "CRM sync", "Meta Pixel + GA4", "GDPR compliant"], popular: true },
              { name: "Client System", price: "€990", delivery: "7 days", desc: "For businesses that want full tracking and client management", features: ["Everything in Booking", "Admin dashboard", "Lead pipeline", "Auto notifications", "Monthly reporting"], popular: false },
            ].map((p, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className={`relative bg-white rounded-2xl border-2 p-7 h-full flex flex-col ${p.popular ? "border-[#36671E] shadow-xl shadow-[#36671E]/10" : "border-[#E8E6E0]"}`}>
                  {p.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#36671E] text-[#FAFAF7] text-[10px] font-black whitespace-nowrap">
                      MAIN OFFER
                    </div>
                  )}
                  <div className="mb-5">
                    <h3 className="text-lg font-black text-[#18181B] mb-0.5">{p.name}</h3>
                    <p className="text-xs text-[#71717A] mb-4">{p.desc}</p>
                    <div className="text-4xl font-black text-[#18181B] mb-2">{p.price}</div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#36671E]" />
                      <span className="text-xs font-semibold text-[#36671E]">Delivered in {p.delivery}</span>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-7 flex-1">
                    {p.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-[#52525B]">
                        <CheckCircle className="w-4 h-4 text-[#36671E] shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/pricing" className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
                    p.popular
                      ? "bg-[#36671E] text-[#FAFAF7] hover:bg-[#295115]"
                      : "border border-[#E8E6E0] text-[#18181B] hover:border-[#36671E] hover:text-[#36671E]"
                  }`}>
                    Get started →
                  </Link>
                </div>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={0.3} className="text-center mt-8">
            <p className="text-[#71717A] text-sm mb-2">All prices exclude VAT · 50% deposit · Balance on delivery</p>
            <Link href="/pricing" className="inline-flex items-center gap-1.5 text-[#36671E] font-bold text-sm hover:underline">
              Full pricing details <ArrowRight className="w-4 h-4" />
            </Link>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-[#FAFAF7]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-12">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-3xl font-black text-[#18181B]">Questions we hear a lot</h2>
          </FadeUp>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <FadeUp key={i} delay={i * 0.05}>
                <div className="bg-white border border-[#E8E6E0] rounded-xl overflow-hidden">
                  <button
                    onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#FAFAF7] transition-colors"
                  >
                    <span className="font-bold text-[#18181B] text-sm">{f.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#71717A] shrink-0 transition-transform duration-200 ${faqOpen === i ? "rotate-180" : ""}`} />
                  </button>
                  <motion.div
                    initial={false}
                    animate={{ height: faqOpen === i ? "auto" : 0, opacity: faqOpen === i ? 1 : 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 text-[#71717A] text-sm leading-relaxed border-t border-[#F5F4EF] pt-4">{f.a}</div>
                  </motion.div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FINAL CTA — dark forest
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-24 lg:py-32 bg-[#0A1F14] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#36671E] opacity-60 rounded-full blur-[100px]" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid3" width="64" height="64" patternUnits="userSpaceOnUse">
                <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#FAFAF7" strokeWidth="0.6"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid3)" />
          </svg>
        </div>

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeUp>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#BEF264]/40 bg-[#BEF264]/10 text-[#ABDF90] text-sm font-semibold mb-8">
              <Sparkles className="w-3.5 h-3.5" />
              Delivered in 7 days · Fixed price · No surprises
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#FAFAF7] mb-6 leading-[1.05]">
              Stop losing clients to businesses{" "}
              <span className="bg-gradient-to-r from-[#BEF264] to-[#ABDF90] bg-clip-text text-transparent">
                with better systems.
              </span>
            </h2>
            <p className="text-[#FAFAF7]/60 text-lg mb-4 max-w-xl mx-auto leading-relaxed">
              Your competitors are already using AI to answer leads, book appointments, and follow up automatically.
            </p>
            <p className="text-[#ABDF90] font-semibold mb-10 text-sm">
              The free audit takes 5 minutes. The system takes 7 days. The results last for years.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <Link href="/contact"
                className="group px-9 py-4 rounded-xl bg-[#BEF264] text-[#0A1F14] font-black text-lg hover:bg-[#D9F99D] transition-colors shadow-lg shadow-[#BEF264]/20 flex items-center gap-2">
                Get My Free Audit Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="mailto:hello@servolia.com"
                className="flex items-center gap-2 text-[#FAFAF7]/60 hover:text-[#FAFAF7] text-sm font-semibold transition-colors">
                <Phone className="w-4 h-4" /> hello@servolia.com
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#FAFAF7]/40">
              <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-[#BEF264]" /> GDPR compliant</span>
              <span className="flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5 text-[#BEF264]" /> Fixed price in writing</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#BEF264]" /> 7-day delivery or 10% back/day</span>
            </div>
          </FadeUp>
        </div>
      </section>

      <StickyMobileCTA />
      <Footer />
      <ChatWidget />
    </main>
  );
}
