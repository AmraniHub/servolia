"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Zap,
  Bot,
  BarChart3,
  Globe,
  Calendar,
  CheckCircle,
  ArrowRight,
  Star,
  Shield,
  Clock,
  TrendingUp,
  MessageSquare,
  Phone,
  Users,
  Building2,
  Home,
  Stethoscope,
  Sparkles,
  ChevronDown,
} from "lucide-react";

function useCounter(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

function useInView(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function StatCard({ value, suffix, label, started }: { value: number; suffix: string; label: string; started: boolean }) {
  const count = useCounter(value, 1800, started);
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-black text-white mb-1">{count}{suffix}</div>
      <div className="text-sm text-[#94A3B8]">{label}</div>
    </div>
  );
}

function ChatDemo() {
  const messages = [
    { from: "user", text: "Bonjour, j'aimerais prendre rendez-vous." },
    { from: "bot", text: "Bonjour ! Je suis l'assistant du Cabinet Dentaire Martin. Quel soin souhaitez-vous ?" },
    { from: "user", text: "Un détartrage." },
    { from: "bot", text: "Parfait ! J'ai des disponibilités jeudi à 14h ou vendredi à 10h. Quelle heure vous convient ?" },
    { from: "user", text: "Jeudi 14h." },
    { from: "bot", text: "✅ Réservé ! Vous recevrez une confirmation par email. À jeudi !" },
  ];
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= messages.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), shown === 0 ? 800 : 1300);
    return () => clearTimeout(t);
  }, [shown, messages.length]);

  return (
    <div className="bg-[#111827] rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4F7EF7] to-[#818CF8] flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-white text-sm font-bold">Cabinet Dentaire Martin</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            <span className="text-[#10B981] text-xs font-medium">AI Receptionist · 24/7</span>
          </div>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-3 min-h-[280px]">
        {messages.slice(0, shown).map((m, i) => (
          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
              m.from === "user"
                ? "bg-gradient-to-r from-[#4F7EF7] to-[#818CF8] text-white rounded-br-sm"
                : "bg-white/5 text-[#E2E8F0] rounded-bl-sm border border-white/8"
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {shown < messages.length && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-3 flex gap-1 items-center">
              {[0,1,2].map((i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#94A3B8] inline-block"
                  style={{ animation: `pulse 1.2s ${i*0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="px-4 pb-3 flex items-center justify-between">
        <span className="text-xs text-[#475569]">Powered by</span>
        <span className="text-xs font-bold gradient-text">Servolia AI</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { ref: statsRef, inView: statsInView } = useInView(0.4);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const faqs = [
    { q: "How fast do you deliver?", a: "Most projects are delivered in 3–7 business days. Website packages in 3–5 days, AI chatbot in 5–7 days. We commit to deadlines in writing before we start." },
    { q: "Do I need to provide content?", a: "No. We write all copy based on a simple intake form you fill in. You review and approve before launch. Nothing goes live without your sign-off." },
    { q: "Can I pay in installments?", a: "Yes — 50% upfront via Stripe to start, 50% on delivery. Monthly retainers are billed automatically and can be cancelled anytime." },
    { q: "Do you work with businesses in France and Belgium?", a: "Yes. We serve clients across France, Belgium, Switzerland, Monaco, and the US. All communications in French or English. Legal pages are GDPR-compliant." },
    { q: "What makes you different from a regular web agency?", a: "We don't just build websites — we build systems that capture leads, answer clients 24/7 with AI, book appointments, and report results monthly. Delivered in 7 days, not 7 weeks." },
    { q: "What happens after delivery?", a: "We offer monthly retainer plans from €99/mo covering maintenance, chatbot updates, analytics reporting, and optimization. Or take a one-time delivery with no ongoing commitment." },
  ];

  const services = [
    {
      icon: <Globe className="w-5 h-5" />,
      title: "AI Business Website",
      desc: "5–10 pages, contact form, booking button, SEO, Google Analytics, GDPR compliance — delivered in 3–5 days.",
      price: "From €690",
      color: "from-[#4F7EF7] to-[#6366F1]",
      features: ["Mobile optimized", "GDPR compliant", "Google Analytics", "3-day delivery"],
    },
    {
      icon: <Bot className="w-5 h-5" />,
      title: "AI Receptionist",
      desc: "24/7 chatbot trained on your services. Captures leads, books appointments, answers FAQs, syncs to your CRM.",
      price: "From €500 + €99/mo",
      color: "from-[#818CF8] to-[#A78BFA]",
      features: ["24/7 availability", "Lead capture", "Booking flow", "CRM sync"],
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: "Landing Page + Ads Tracking",
      desc: "High-converting landing page with Meta Pixel, GA4, CAPI, A/B sections, and instant lead notifications.",
      price: "From €750 + €300/mo",
      color: "from-[#10B981] to-[#34D399]",
      features: ["Meta Pixel + CAPI", "GA4 tracking", "A/B ready", "Lead alerts"],
    },
    {
      icon: <Building2 className="w-5 h-5" />,
      title: "Business Automation Dashboard",
      desc: "Admin panel with lead database, appointment pipeline, status tracking, client notes, and automated notifications.",
      price: "From €2,500 + €300/mo",
      color: "from-[#F59E0B] to-[#EF4444]",
      features: ["Lead pipeline", "Appointment tracking", "Auto notifications", "Custom integrations"],
    },
  ];

  const niches = [
    { icon: "🦷", label: "Dental Clinics", desc: "AI booking website that fills your calendar — even at 2am.", result: "+12 bookings/month avg.", href: "/dentists" },
    { icon: "✨", label: "Aesthetic Clinics", desc: "Premium lead system for med spas and cosmetic practices.", result: "+8 consults/week avg.", href: "/clinics" },
    { icon: "🏢", label: "Real Estate", desc: "Lead pages, listing sites, and CRM automation for agents.", result: "+20 qualified leads/month", href: "/real-estate" },
    { icon: "🔧", label: "Home Services", desc: "Roofing, HVAC, plumbing — capture leads before competitors.", result: "+15 quote requests/month", href: "/home-services" },
  ];

  const testimonials = [
    {
      name: "Dr. Sophie Laurent",
      role: "Dental Clinic Owner",
      location: "Brussels, Belgium 🇧🇪",
      text: "Within 2 weeks of launching our Servolia website and AI chatbot, we went from 3 online bookings per month to over 15. The chatbot handles all after-hours inquiries automatically.",
      stars: 5,
    },
    {
      name: "Marc Fontaine",
      role: "Real Estate Agent",
      location: "Lyon, France 🇫🇷",
      text: "Servolia built my lead landing page in 5 days. I now receive qualified leads directly on my phone. Best investment I made this year.",
      stars: 5,
    },
    {
      name: "James Whitfield",
      role: "HVAC Business Owner",
      location: "Austin, Texas 🇺🇸",
      text: "The AI chatbot qualifies leads 24/7 and I saved 10 hours per week on phone calls. Servolia delivered exactly what they promised, on time.",
      stars: 5,
    },
  ];

  const steps = [
    { num: "01", title: "Free Business Audit", desc: "Fill our 5-question form. We analyze your online presence and send you a PDF report showing exactly what's missing — free, no strings attached.", icon: <MessageSquare className="w-5 h-5" /> },
    { num: "02", title: "We Build Your System", desc: "Fixed scope, fixed price, fixed deadline — all in writing. We build your website, AI chatbot, tracking, and lead system using our proven checklist.", icon: <Zap className="w-5 h-5" /> },
    { num: "03", title: "Results Start Flowing", desc: "Your system goes live. Leads come in. The AI handles follow-up. You get a monthly report showing contacts, bookings, and inquiries.", icon: <TrendingUp className="w-5 h-5" /> },
  ];

  return (
    <main className="flex flex-col bg-white">
      <Navbar />

      {/* HERO */}
      <section className="relative bg-[#080E1C] overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#4F7EF7]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-[#818CF8]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-[250px] h-[250px] bg-[#10B981]/6 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#4F7EF7]/30 bg-[#4F7EF7]/10 text-sm text-[#93C5FD]">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="font-semibold">AI-Powered · 7-Day Delivery · GDPR Compliant</span>
            </div>
          </div>

          <h1 className="text-center text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6 max-w-5xl mx-auto">
            Your business deserves a system{" "}
            <span className="gradient-text">that works 24/7</span>
          </h1>

          <p className="text-center text-lg sm:text-xl text-[#94A3B8] max-w-2xl mx-auto mb-8 leading-relaxed">
            Servolia builds AI-powered websites, receptionists, and lead systems for service businesses in Europe and the US.{" "}
            <strong className="text-white font-semibold">Fixed price. 7-day delivery. Real results.</strong>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/contact" className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#4F7EF7] to-[#818CF8] text-white font-bold text-base hover:opacity-90 transition-opacity glow-button shadow-2xl flex items-center gap-2">
              Get Your Free Audit <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing" className="px-7 py-3.5 rounded-xl border border-white/15 text-white font-semibold text-base hover:bg-white/5 transition-colors flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> See Pricing
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#94A3B8]">
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1">
                {["bg-blue-400","bg-violet-400","bg-emerald-400","bg-orange-400"].map((c,i)=>(
                  <div key={i} className={`w-6 h-6 rounded-full ${c} border-2 border-[#080E1C]`} />
                ))}
              </div>
              <span>50+ clients served</span>
            </div>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map((i)=>(
                <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="ml-1">5.0 rating</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Avg. 5-day delivery</span>
            </div>
          </div>

          <div className="mt-14 max-w-lg mx-auto lg:max-w-none lg:grid lg:grid-cols-2 lg:gap-8 lg:items-center">
            <div className="lg:order-2"><ChatDemo /></div>
            <div className="mt-8 lg:mt-0 lg:order-1 grid grid-cols-1 gap-3">
              <div className="glass rounded-xl p-5 border border-red-500/20">
                <p className="text-xs font-bold text-red-400 mb-3">✗ WITHOUT SERVOLIA</p>
                <ul className="flex flex-col gap-2">
                  {[
                    "Clients call, no answer → they call a competitor",
                    "Website exists but captures 0 leads",
                    "No tracking — you don't know where clients come from",
                    "Bookings only happen during business hours",
                    "Leads lost in WhatsApp chats with no follow-up",
                  ].map((t,i)=>(
                    <li key={i} className="flex items-start gap-2 text-sm text-[#94A3B8]">
                      <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="glass rounded-xl p-5 border border-[#10B981]/20">
                <p className="text-xs font-bold text-[#10B981] mb-3">✓ WITH SERVOLIA</p>
                <ul className="flex flex-col gap-2">
                  {[
                    "AI receptionist answers instantly, 24/7, in French or English",
                    "Every visitor becomes a lead — captured, qualified, notified",
                    "Full tracking: source, channel, conversion, ROI",
                    "Bookings fill automatically while you sleep",
                    "Clean CRM — every lead tracked and followed up",
                  ].map((t,i)=>(
                    <li key={i} className="flex items-start gap-2 text-sm text-[#E2E8F0]">
                      <CheckCircle className="w-4 h-4 text-[#10B981] mt-0.5 flex-shrink-0" />{t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="bg-[#111827] border-y border-white/5 py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12">
            {[
              { icon: <Shield className="w-4 h-4 text-[#10B981]" />, text: "GDPR Compliant" },
              { icon: <div className="w-4 h-4 rounded bg-[#635bff] flex items-center justify-center"><span className="text-white text-[7px] font-black">S</span></div>, text: "Stripe Secured" },
              { icon: <Clock className="w-4 h-4 text-[#4F7EF7]" />, text: "7-Day Delivery Guarantee" },
              { icon: <Globe className="w-4 h-4 text-[#818CF8]" />, text: "French & English Service" },
              { icon: <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />, text: "5.0 Client Rating" },
              { icon: <Users className="w-4 h-4 text-[#10B981]" />, text: "50+ Businesses Served" },
            ].map((t,i)=>(
              <div key={i} className="flex items-center gap-2 text-[#94A3B8] text-sm">
                {t.icon}<span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#4F7EF7] uppercase tracking-widest mb-3">What We Build</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#080E1C] leading-tight mb-4">
              Four systems. One mission:{" "}
              <span style={{background:"linear-gradient(135deg,#4F7EF7,#818CF8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                more clients.
              </span>
            </h2>
            <p className="text-[#64748B] text-lg max-w-2xl mx-auto">
              Fixed scope, fixed price, delivered on time. No vague proposals. No runaway projects.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((s,i)=>(
              <div key={i} className="group border border-[#E2E8F0] rounded-2xl p-6 hover:border-[#4F7EF7]/40 hover:shadow-xl hover:shadow-[#4F7EF7]/5 transition-all duration-300">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white mb-4 shadow-lg`}>
                  {s.icon}
                </div>
                <h3 className="text-lg font-black text-[#080E1C] mb-2">{s.title}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed mb-4">{s.desc}</p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {s.features.map((f,j)=>(
                    <span key={j} className="px-2.5 py-1 rounded-full bg-[#F8FAFF] border border-[#E2E8F0] text-[#4F7EF7] text-xs font-semibold">{f}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black text-[#080E1C]">{s.price}</span>
                  <Link href="/pricing" className="text-sm font-bold text-[#4F7EF7] flex items-center gap-1 hover:gap-2 transition-all">
                    Learn more <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-[#F8FAFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#4F7EF7] uppercase tracking-widest mb-3">The Process</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#080E1C] mb-4">
              From audit to results{" "}
              <span style={{background:"linear-gradient(135deg,#10B981,#34D399)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                in 3 steps.
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {steps.map((s,i)=>(
              <div key={i} className="relative">
                {i < steps.length-1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-[#4F7EF7]/40 to-transparent z-0 -translate-x-4" />
                )}
                <div className="bg-white rounded-2xl p-7 border border-[#E2E8F0] shadow-sm hover:shadow-lg transition-shadow relative z-10">
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#4F7EF7] to-[#818CF8] flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                      {s.icon}
                    </div>
                    <span className="text-4xl font-black text-[#E2E8F0]">{s.num}</span>
                  </div>
                  <h3 className="text-lg font-black text-[#080E1C] mb-3">{s.title}</h3>
                  <p className="text-[#64748B] text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/contact" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#080E1C] text-white font-bold text-base hover:bg-[#111827] transition-colors">
              Start with a free audit <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* NICHES */}
      <section id="niches" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#4F7EF7] uppercase tracking-widest mb-3">Industries We Serve</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#080E1C] mb-4">
              Built for your industry,{" "}
              <span style={{background:"linear-gradient(135deg,#4F7EF7,#A78BFA)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                not just any business.
              </span>
            </h2>
            <p className="text-[#64748B] text-lg max-w-xl mx-auto">
              Every niche has its own system. We don't sell generic websites — we build what your industry actually needs.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {niches.map((n,i)=>(
              <Link key={i} href={n.href} className="group border border-[#E2E8F0] rounded-2xl p-6 hover:border-[#4F7EF7]/50 hover:shadow-xl hover:shadow-[#4F7EF7]/8 transition-all duration-300 bg-white">
                <div className="text-3xl mb-4">{n.icon}</div>
                <h3 className="text-base font-black text-[#080E1C] mb-2">{n.label}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed mb-4">{n.desc}</p>
                <div className="flex items-center gap-1.5 mb-4">
                  <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />
                  <span className="text-xs font-bold text-[#10B981]">{n.result}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#4F7EF7] group-hover:gap-2 transition-all">
                  See offer <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section ref={statsRef} className="py-20 lg:py-24 bg-[#080E1C]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
              Numbers that <span className="gradient-text">speak for themselves</span>
            </h2>
            <p className="text-[#94A3B8]">Real results from real clients across Europe and the US.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCard value={50} suffix="+" label="Businesses served" started={statsInView} />
            <StatCard value={5} suffix=" days" label="Average delivery" started={statsInView} />
            <StatCard value={98} suffix="%" label="On-time rate" started={statsInView} />
            <StatCard value={3} suffix="x" label="Avg. lead increase" started={statsInView} />
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20 lg:py-28 bg-[#F8FAFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#4F7EF7] uppercase tracking-widest mb-3">Client Results</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#080E1C] mb-4">What our clients say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t,i)=>(
              <div key={i} className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-0.5 mb-4">
                  {Array.from({length:t.stars}).map((_,j)=>(
                    <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-[#374151] text-sm leading-relaxed mb-5 italic">"{t.text}"</p>
                <div className="border-t border-[#F1F5F9] pt-4">
                  <p className="font-bold text-[#080E1C] text-sm">{t.name}</p>
                  <p className="text-[#64748B] text-xs">{t.role}</p>
                  <p className="text-[#94A3B8] text-xs mt-0.5">{t.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#4F7EF7] uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#080E1C] mb-4">
              Transparent pricing.{" "}
              <span style={{background:"linear-gradient(135deg,#4F7EF7,#818CF8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                No surprises.
              </span>
            </h2>
            <p className="text-[#64748B] text-lg max-w-xl mx-auto">
              Fixed scope, fixed price, fixed delivery date. Everything in writing before we start.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { name:"Starter", price:"€690", desc:"Professional online presence for local businesses.", features:["5-page website","Contact form","Google Analytics","GDPR compliant","Mobile optimized","3-day delivery"], cta:"Get Started", popular:false },
              { name:"Growth", price:"€1,490", desc:"AI-powered system that captures and converts leads.", features:["10-page website","AI chatbot","Booking flow","CRM integration","Meta Pixel + GA4","5-day delivery"], cta:"Most Popular", popular:true },
              { name:"Pro", price:"€2,900", desc:"Full lead system with automation and dashboard.", features:["Everything in Growth","Admin dashboard","Lead pipeline","Auto notifications","Monthly reporting","7-day delivery"], cta:"Get Pro", popular:false },
            ].map((p,i)=>(
              <div key={i} className={`rounded-2xl border-2 p-6 relative ${p.popular ? "border-[#4F7EF7] shadow-2xl shadow-[#4F7EF7]/15" : "border-[#E2E8F0]"}`}>
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#4F7EF7] to-[#818CF8] text-white text-xs font-black">
                    MOST POPULAR
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-lg font-black text-[#080E1C] mb-1">{p.name}</h3>
                  <div className="text-3xl font-black text-[#080E1C] mb-1">{p.price}</div>
                  <p className="text-[#64748B] text-sm">{p.desc}</p>
                </div>
                <ul className="flex flex-col gap-2.5 mb-6">
                  {p.features.map((f,j)=>(
                    <li key={j} className="flex items-center gap-2 text-sm text-[#374151]">
                      <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link href="/pricing" className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
                  p.popular
                    ? "bg-gradient-to-r from-[#4F7EF7] to-[#818CF8] text-white hover:opacity-90 glow-button"
                    : "border border-[#E2E8F0] text-[#080E1C] hover:border-[#4F7EF7] hover:text-[#4F7EF7]"
                }`}>
                  {p.cta} →
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-[#94A3B8] text-sm mt-8">
            All prices exclude VAT · 50% deposit to start · Balance on delivery · Monthly retainers available
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 lg:py-28 bg-[#F8FAFF]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-bold text-[#4F7EF7] uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#080E1C] mb-4">Questions we hear a lot</h2>
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

      {/* FINAL CTA */}
      <section className="py-20 lg:py-28 bg-[#080E1C] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4F7EF7]/10 via-transparent to-[#818CF8]/10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#4F7EF7]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 text-sm text-[#34D399] mb-6">
            <Calendar className="w-3.5 h-3.5" />
            <span className="font-semibold">Free audit · No commitment · Results in 7 days</span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6 leading-tight">
            Ready to turn your website into a{" "}
            <span className="gradient-text">client machine?</span>
          </h2>
          <p className="text-[#94A3B8] text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            Tell us about your business. We'll send you a free audit showing exactly what you're missing and how to fix it — in 24 hours.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/contact" className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#4F7EF7] to-[#818CF8] text-white font-black text-base hover:opacity-90 transition-opacity glow-button shadow-2xl flex items-center gap-2">
              Get My Free Audit <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="mailto:hello@servolia.com" className="flex items-center gap-2 text-[#94A3B8] hover:text-white transition-colors text-sm font-semibold">
              <Phone className="w-4 h-4" /> Or email hello@servolia.com
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-[#475569]">
            <div className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-[#10B981]" /> GDPR compliant</div>
            <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded bg-[#635bff] flex items-center justify-center"><span className="text-white text-[7px] font-black">S</span></div> Stripe secured</div>
            <div className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-[#4F7EF7]" /> Fixed price guarantee</div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#818CF8]" /> 7-day delivery</div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
